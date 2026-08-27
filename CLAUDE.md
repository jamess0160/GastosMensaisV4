# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — run the API in dev mode via nodemon (`tsx index.ts`, restarts on `.ts`/`.js` changes, ignores `Logs/*`).
- `npm test` — run the integration suite (Jest in-band, config in `jest.config.ts`); `npm test -- Users` filters by file. `npm run test:watch` re-runs on change. See "Integration tests" below.
- `npm run start:test` + `npm run test:e2e` — the end to end pair: the first boots the API with `NODE_ENV=test` (test database, port 4100), the second points the same suites at it via `TEST_BASE_URL`. Both go through `cross-env`, since `VAR=value cmd` doesn't work in the Windows shell npm uses.
- `npm run build` — full build: `build:app` (webpack bundles `index.ts` → `build/bundle.js`, `node_modules` excluded via `webpack-node-externals`) + `build:migrations` (`tsc -p tsconfig.migrations.json` compiles `migrations/*.ts` → `build/migrations`, compiled independently of the app bundle since migrations run through the Knex CLI).
- Migrations (Knex CLI, `development` environment only, config in `knexfile.ts`): `npx knex migrate:latest`, `npx knex migrate:rollback`, `npx knex migrate:make <name>`.
- No lint script is configured.

## Environment

- Env vars load through `Utils.configEnv()` (`Utils/Utils.ts`), which reads `.env`, or `.env.test` when `NODE_ENV=test`. `exemple.env` documents the full var list (`PORT`, `SOCKETPORT`, `DB_CLIENT`, `DB_HOST`, `DB_LOGIN`, `DB_PASSWORD`, `DB_SCHEMA`, `DB_PORT`, `JWT_SECRET`, `CONSTANTS_PATH`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`).
- All env access goes through `enviromentManager.getEnv(key, optional?)` (`Utils/enviromentManager.ts`), never `process.env` directly. Values are read as-is from the `.env`; a missing var throws an `APIError` at boot unless `optional` is `true`, in which case it returns `""`. The `.env` itself is what protects the secrets, so keep it out of git and restrict its file permissions — there used to be an AES layer here with the key hardcoded in the repo, which is why it was removed rather than fixed.
- `Utils.getConstants()` reads a JSON file for runtime-tunable flags, path from `CONSTANTS_PATH` (default `Utils/constants.json`). The `Constants` interface in `Utils/Utils.ts` only types a subset of the fields actually present in `constants.json` — extra keys are unused leftovers from a template and can be ignored.

## Architecture

Express + TypeScript API using Knex over MySQL (client is configurable via `DB_CLIENT`). Path alias `root/*` maps to the repo root — used everywhere instead of relative imports across features (wired via `tsconfig-paths/register` for `ts-node`/`tsx`, and `TsconfigPathsPlugin` for webpack).

### Feature module layout

Each feature lives under `routes/<Feature>/` (see `routes/Users/`, `routes/Workspaces/`, `routes/UsersAuth/`, `routes/Cache/`, `routes/Utils/`) with a consistent split:

- `<Feature>.route.ts` — an `express()` sub-app with route definitions; every handler is wrapped in `AsyncHandler`, often preceded by a schema validator. All sub-apps are collected into the `Routes` array in `routes/index.ts` and mounted via `server.app.use(Routes)`.
- `<Feature>.controller.ts` — thin: pulls params/body off `req`/`res.locals`, delegates to a class in `sections/`, calls `res.json(...)`.
- `<Feature>.schema.ts` — Joi schemas wrapped by `joiController` (`Utils/joiController.ts`): `validateBody`/`validateParams`/`validateQuery`/`validateResponse`. Each returns middleware built from `AsyncHandler(fn, requireToken=false)`, so schema validation itself never requires auth even when the route does.
- `<Feature>.model.ts` — a `class_X_model extends BaseModel` (`Utils/Base.ts`) exposing the injected `KnexConnection` as `this.KnexConnection`; holds the Knex queries for one primary table. One model file per table, so a feature that owns a second table gets a second file next to it (`Workspaces/WorkspaceMembers.model.ts`, `UsersAuth/TrustedDevices.model.ts`).
- `sections/` — business logic, one class per operation (e.g. `GET/getSelf.ts`, `POST/create.ts`), each with a `run()` method the controller calls; plus feature-local support files like `AcessControl.section.ts` and a `types.ts` namespace for payload types.

Follow this same file split (route/controller/schema/model/sections) when adding a new feature or endpoint rather than putting logic directly in the controller.

### Request pipeline

`AsyncHandler` (`Utils/AsyncHandler.ts`) wraps every route handler and is the single place that: loads constants, enforces auth (calls `Users_controller.acessMiddleware` unless `requireToken` is explicitly `false`), awaits the handler, and catches errors — logging via `Logs.handleError` (gated by `constants.logs.routeErros`), replying with `{ msg }` + `error.status` for a thrown `APIError` (`Utils/Logs.ts`), or a bare 500 otherwise.

Auth is JWT-based (`routes/Users/sections/AcessControl.section.ts`): `acessMiddleware` reads the raw token from the `authorization` header (not a `Bearer ` prefix) and verifies it with `JWT_SECRET`, setting `res.locals.IdUser` on success (typed via the `Express.Locals` augmentation in `Utils/Globals.d.ts`). `AcessControl` also has `setTokenCookie`/`clearTokenCookie` helpers, but nothing currently reads the cookie back — the header is what's actually enforced.

Every login ends at `AcessControl.startSession(res, IdUser)` — it issues the token cookie and stamps `LastLogin`. Both credential paths (password and biometrics) call it and nothing else emits a token, so the two can't drift apart in what they record.

Signup (`POST /Base/Users`) creates the **user and their workspace in one transaction** (`routes/Users/sections/POST/create.ts` + `routes/Workspaces/sections/POST/create.ts`) and returns `{ IdUser, IdWorkspace }`. Every domain table is scoped by `IdWorkspace`, so a user without one can't record anything — half an account. The workspace also gets its `WorkspaceMembers` row in the same transaction: reads go through membership (`Workspaces_model.getByMember`), so a workspace without it is an orphan tenant nobody can see. There is no `POST /Base/Workspaces`; today the only way a workspace is born is signup.

`IdWorkspace` arrives from the client in the URL, never from the token, so any tenant-scoped route must call `WorkspacesAcessControl.assertMember`/`assertRole` (`routes/Workspaces/sections/AcessControl.section.ts`) before reading or writing. Not-a-member answers 406 with "not found", not 404 — a 404 would confirm the workspace exists.

### Biometrics (WebAuthn), `routes/UsersAuth/`

Passkey login, carried over from V3's `webAuth` (`@simplewebauthn/server` v13). Two two-step flows — ask for options, return the signed assertion — stitched together by a `ChallengeToken`:

- **The challenge is a short JWT, not a session.** V3 parked it in a session cookie; here the API is stateless (`acessMiddleware` reads the header, and nothing reads the cookie back), so `WebAuthnChallenge` signs `{ challenge, type, IdUser? }` with `JWT_SECRET` for 5 minutes and the client returns it in the POST body. Signing rather than echoing is the whole point: a client-chosen challenge isn't random and opens replay. `type` lives inside the token so a register challenge can't be spent as a login one, and `register` additionally checks `challenge.IdUser` against the token's user, or a challenge lifted from another account would pin a passkey on the wrong one.
- **`DeviceKey` is not a credential** — it's a 32-byte base64url id the API generates and the device stores. It only answers "which credentials to offer here" and "have I already asked about biometrics on this device". Authentication is the passkey signature, nothing else. base64url (not V3's base64) because it travels as a URL param.
- **The user is resolved from the credential, not the device.** Login options take a `DeviceKey` and may return several `allowCredentials` (two people can enrol on one phone); `authenticate` looks up the `CredentialId` that came back signed. `Counter` is written back on every login — that's what keeps the lib's clone detection working.
- **`checkDevice` is tri-state**, like V3's `checkUser`: `true` = passkey here, `false` = the user declined here (`TrustedDevices`, V3's `ignoreauth`, written by `skipDevice`), `null` = never asked. Registering clears the decline.
- Public routes are exactly the ones a device without a token needs: `checkDevice`, login options, `authenticate`. Enrolling and removing credentials require a password session.
- Removal is a soft delete: the row stays so its `CredentialId` keeps the unique index occupied, otherwise an authenticator still holding the passkey could re-register it as new.

Passwords are hashed server-side and only there: `PasswordHasher` (`routes/Users/sections/PasswordHasher.section.ts`, bcrypt cost 12) is the single place that hashes and compares, used by `create`, `update`, `updatePassword` and `validateLogin`. The client sends the plaintext password in the **body** — never in the URL, since the path reaches the proxy access log, the browser history, the `Referer` header and `Logs.handleError` via `req.originalUrl`; that's why `POST /Base/Users/login` and `PUT /Base/Users/updatePassword` take a body instead of route params. `AsyncHandler` runs `Utils.redactSensitive` over `req.body` before logging, and `getSelf` strips `Password` from the response. Don't pre-hash or encrypt the password on the client: whatever the API receives becomes the effective credential, so a leaked hash could be replayed as-is.

### Database (Knex)

- `Utils/Connections/Knex/KnexConnection.ts` builds the shared `KnexConnection` from the `DB_*` env vars, and exports `KnexTransaction(fn)` — wraps `knex.transaction`, passing a `TransactionEvents` (`section/transactionEvents.ts`) so code inside a transaction can register `attachOnEnd(fn)` callbacks that fire after the transaction resolves. Models return QueryBuilders, so a section running inside a transaction enlists each query with `.transacting(tx)` (see `routes/Users/sections/POST/create.ts`) instead of building a second set of models.
- `DBTypes` (same file) maps table name → row interface. Row shapes themselves live in `Utils/database.ts` under the `Database` namespace. When adding a table, add its interface to `Database` and register it in `DBTypes` — this is what gives `joinTables` its type safety.
- Two custom QueryBuilder methods are registered globally in `Utils/Connections/Knex/AppKnex.ts`:
  - `.joinTables({ tableName: { selfPath, destinyColumn?, type?: "single"|"multi", append? } })` (`section/JoinTables.ts`) — fetches related rows from another table and attaches them onto the result (single object or array), based on `DBTypes`. Use `append` to further filter/shape the sub-query. It applies **no implicit filter**: only the registration tables carry `Active` (see below), and filtering it is each model's job via `append: (q) => q.where("Active", true)`. The name is `joinTables` (not `join`) because Knex's `.join()` is native and `QueryBuilder.extend` throws at boot on a name collision.
  - `.returnId(idColumnName)` (`section/returnId.ts`) — only valid on a single-row insert; returns the inserted id, branching on `DB_CLIENT` (mysql/mysql2 uses the insert id, other clients use `.returning("*")`).

#### Schema conventions

Tables are PascalCase plural, PK is `Id<Singular>` via `table.increments(...)`. Money is always `decimal(15,2)`, never float. Every table has `CreatedAt` and `UpdatedAt`; there is no `ON UPDATE` in Postgres, so every model sets `UpdatedAt` itself.

`Active` means soft-delete/archive and exists on every registration table: `Users`, `UsersAuth`, `TrustedDevices`, `Accounts`, `PaymentMethods`, `Categories`, `Budgets`. Elsewhere the lifecycle comes from a `Status` column or the row cascades from its parent.

Domain tables are scoped by `IdWorkspace` (tenant) with `IdUser` as author. One workspace per user today; `WorkspaceMembers` is already in place for sharing later.

**An account has no stored balance.** `Accounts.InitialBalance`/`InitialBalanceDate` are the opening balance — origin data, since no entry in the system derives it — and everything after that is computed from the ledger: `InitialBalance` + received `Inflows` into the account − received `Inflows` out of it − paid `ExpensePayments` whose `PaymentMethod` belongs to it. A `CurrentBalance` cache column existed and was dropped (migration `20260827022816`): keeping it in sync would mean every route that touches money remembering to recalculate, and missing one doesn't break anything — it just drifts, and a plausible wrong balance is the worst failure this app has. The indexes for the computed read are already in place. Note transfers count **both** directions here, unlike the "how much came in" totals that exclude them.

`PaymentMethods` is the child of `Accounts` and is the single place where `pix`, `debit` and `credit_card` live — there is no separate cards table and no account of type `credit_card`. Creating an account auto-generates its `pix` and `debit` rows; credit cards are added by the user. `ClosingDay`/`DueDay` are only meaningful on `Kind='credit_card'`.

`Categories` covers **expenses only** for now, and `IdWorkspace IS NULL` marks a system-wide predefined category — every read is `where(IdWorkspace = X or IdWorkspace is null)`.

Budgets are template + instance: `Budgets` holds the standing limit for a category (one row per category, no month), and `BudgetPeriods` holds one frozen row per month. A routine materializes the period rows at the start of each month. Editing `Budgets` changes the future only — closed periods keep the limit that actually applied, which is what makes "what was my limit in March" answerable. Never read a past month's limit off `Budgets`.

`Persons` is who received or spent the money — the V3 `destinys` replacement. A person is just a name plus an **optional** `IdUser` link, so someone with no login (a child, a partner who doesn't use the app) can still take a share. Both split tables point at `Persons`, never at `Users` directly.

`Expenses` has **two independent split axes** that must never be conflated: `ExpensePayments` is the financial axis (one row per payment method *and per installment* — this is what moves balances), `ExpensePersons` is the analytical axis (who the cost is attributed to). Both split by absolute value, no percentages. Two payment methods and two people produce **2 + 2 rows, never 4**. `ClosingDate`/`DueDate` live on the leg, not the expense, because each installment falls in its own invoice; they're derived from the `PaymentMethods` `ClosingDay`/`DueDay` and are null outside `credit_card`.

**Nothing is partially settled.** `Expenses.Status` is derived from the legs and only reaches `'paid'` once *every* leg is paid; `Inflows.Status` goes straight from `'pending'` to `'received'`. Neither table has a `PaidValue`/`ReceivedValue` column and neither has a `'partial'` state. The per-leg `Paid`/`PaidAt` on `ExpensePayments` stay because installments require them — a 6× purchase needs to know which parcels are settled — but that detail is never promoted to a partial status on the parent.

A recurring ("fixed") expense is a **chain of real occurrences**, not template + instances: every `Expenses` row is a real expense. The series root has a null `IdParentExpense` and carries `RecurrenceDay`/`RecurrenceEndDate`; generated occurrences point back at it. This is deliberate — a template row would be a phantom that every report has to filter out.

`Tags` are the temporary taxonomy (a trip, an event) alongside the permanent `Categories`: an expense has one category and N tags. The link table is `ExpenseTags` rather than a generic one so inflows can get their own later without touching `Tags`.

`Inflows` carries **both** money coming in and transfers between accounts, discriminated by `Kind`: `'inflow'` has a null `IdFromAccount` (the money came from outside) and `'transfer'` requires both accounts, different from each other — two `CHECK` constraints enforce this. Because a transfer is net-zero for net worth, **every "how much came in" total must filter `Kind <> 'transfer'`**, or the same money is counted again each time it moves between accounts. `InflowPersons` splits an inflow across `Persons`; it only applies to `Kind='inflow'`, never to transfers. Inflows have no category and no recurrence by design.

**Current scope.** The schema is complete — all 22 tables above exist in `migrations/`. What is **not** built is the code on top of them: only `Users`, `Workspaces`/`WorkspaceMembers` and `UsersAuth`/`TrustedDevices` have routes today. Everything else (accounts, categories, persons, tags, inflows, expenses, budgets, platform) is schema without an API.

`ROADMAP.md` maps that remaining work in stages, ordered by the foreign keys, and records the cross-cutting decisions that have to be settled before the movement tables get routes — account balance is already settled (computed, never cached), still open are who writes the derived `Expenses.Status` and the shared period-filter format. Read it before starting a new feature — building out of order means writing against a table whose parent has no API yet.

#### PostgreSQL specifics

V3 was MySQL; V4 is PostgreSQL. Knex handles the DDL translation (`tinyint`→`smallint`, `.unsigned()` ignored, `enu`→`text`+`CHECK`, `binary`→`bytea`, `datetime`→`timestamptz`), but three things bite at the query layer:

- **`Active` is a real `boolean`.** Use `.where("Active", true)` / `.update({ Active: false })`. The MySQL habit of `.where("Active", 1)` throws `operator does not exist: boolean = integer`.
- **`numeric`, `bigint` and `date` are re-typed on read** by `registerPgTypeParsers` (`section/pgTypeParsers.ts`, called from `AppKnex.ts`). Without it node-postgres returns money and bigints as *strings* and `date` as a local-midnight `Date` that shifts the calendar day in UTC-3. Money and counters arrive as `number`; `date` columns (`CompetenceDate`, `DueDate`, `ReferenceMonth`, …) arrive as `"YYYY-MM-DD"` strings — they are calendar dates, not instants, so never wrap them in `new Date()` for display. Note the parsers are registered in the app path only; the Knex CLI (`knexfile.ts`) does not load them, which is fine as long as migrations only do DDL and inserts.
- **Identifiers are case-sensitive.** Knex always double-quotes, so the PascalCase table/column names work through the query builder. Any raw SQL must quote them explicitly (`select "IdUser" from "Users"`), or Postgres will fold to lowercase and fail.

Postgres has no `ON UPDATE CURRENT_TIMESTAMP`, so every model must set `UpdatedAt: KnexConnection.fn.now()` on update, as `Users.model.ts` does.

### Cache subsystem (`routes/Cache/`)

An in-memory, socket-synced cache (`CacheEngine`, singleton `cacheEngine`), not tied to any one feature:

- `cacheEngine.attachConsummer(type, consumer)` registers a bucket ("type") backed by a `CacheConsummer` with `restoreCacheData()` (initial load, e.g. from DB) and optional `formatSet`/`formatGet`/`formatSocket` hooks to reshape data on write/read/broadcast.
- `cacheEngine.setProp`/`getProp`/`reset` are the CRUD entry points, exposed over HTTP by `Cache.route.ts` (`GET /Base/Cache/CacheName=:CacheName`, `POST /Base/Cache`, `POST /Base/Cache/Reset/CacheName=:CacheName`).
- Writes push to socket.io clients that joined the corresponding room. Rooms are `type` or `type.key`; clients join/leave via the `joinCacheRoom`/`leaveCacheRoom` socket events wired in `Utils/socket.ts`.
- Every cache op is separately logged via `Logs.insertCacheLog` into `Logs/cache/<type>.*.log`.

### Socket.io

Runs on its own port (`SOCKETPORT`, separate from the HTTP `PORT`). `Utils/Connections/Socket.ts` has the abstract `SocketEngine` base (default `joinRoom`/`leaveAllRooms` events, `attachDefaultRoute` for subclasses to add more). `Utils/socket.ts`'s `SocketController extends SocketEngine`, adding the cache-room events and outbound helpers (`sendCache`, `sendCacheTo`, `sendTotalCacheTo`).

### Logging

Winston + daily-rotate-file, writing under `Logs/`. `Logs.insertLog(log, type)` logs to `Logs/<type>/<date>.<type>.log` (`type` ∈ `info`/`error`/`userError`/`untracked`/`telemetry`); `insertRotineLog`/`insertCacheLog` log to `Logs/rotines/<name>/` and `Logs/cache/<name>/` respectively. `Logs.handleError` auto-classifies a thrown `APIError` with `status === 406` as `userError`, everything else as `error`.

## Integration tests

There are no unit tests: every suite is an integration test that goes through the real pipeline (`AsyncHandler` → Joi schema → section → Knex → Postgres). Nothing is mocked.

- **One file per feature/table**, next to the feature: `routes/<Feature>/<Feature>.tests.ts` (`testMatch: **/*.tests.ts`). `routes/Users/Users.tests.ts` is the reference. Inside it, **one `describe` per route**, in the same order as `<Feature>.route.ts`, plus a final `describe("Fluxo end to end")` that walks the feature's happy path over HTTP only.
- **Helpers live in `Utils/Tests/`** (barrel at `Utils/Tests/index.ts`): `TestClient`, `TestDatabase`, `TestEnv` and the factories in `section/factories/`.
- **`TestClient`** is the HTTP client. By default supertest boots the app in-process; with `TEST_BASE_URL` set the exact same tests hit a running server (end to end mode) — that's why tests must never call sections/models directly. It attaches the token to the `authorization` header (no `Bearer`), and `client.login(email, password)` authenticates through the real route and picks the token out of the `token` cookie.
- **`TestDatabase`** wraps the test connection: `truncate([...])` (per suite, CASCADE + restart identity), `connection()` for asserting the persisted row, `reset()`/`migrate()`. Every destructive helper goes through `TestEnv.assertTestDatabase()`, which refuses to run unless the database name contains `test` (override with `TEST_DB_UNSAFE=true`).
- **Factories** seed direct to the DB (`UsersFactory.create()` returns the row, its workspace, the plaintext password and a valid JWT; `UsersAuthFactory.create(IdUser)` seeds a passkey row). Use them for arranging state; use HTTP for what is under test. `UsersFactory` seeds the workspace and membership because signup does — a user without one is a state the app can't reach.
- **Known gap:** no suite closes the WebAuthn loop, because `register`/`authenticate` need a signature from a real authenticator. `UsersAuth.tests.ts` covers everything on either side of the crypto — challenge issuing and binding, who may call what, device state, persistence — and every rejection path. The factory's public key is random, so those credentials list and expire correctly but can never verify.
- **Config**: `Utils/Tests/globalSetup.ts` rolls back and re-runs the migrations once per execution (so the migration seeds are always there); `setupFiles` loads `Utils/Tests/section/TestEnv.ts` before any app module, since `enviromentManager`/`AppKnex` read the env at import time; `setupFilesAfterEnv` destroys the Knex pool at the end of each file. `maxWorkers: 1` because all suites share one database, and `forceExit: true` because importing the app leaves the socket.io server and the cache `memoryLog` interval running.
- **`.env.test`** (gitignored, template in `exemple.env.test`) is layered *on top of* `.env` with `override: true` — it only declares what changes in tests (`DB_SCHEMA` pointing at `gastos_mensais_v4_test`, `SOCKETPORT=0` for an ephemeral port, optional `TEST_BASE_URL`).

```
npm test                # app em memória (supertest)

npm run start:test      # terminal 1: servidor apontando para o banco de teste
npm run test:e2e        # terminal 2: mesmas suítes, servidor real
```

`Utils.configEnv()` applies the same `.env` + `.env.test` layering, so the server started with `NODE_ENV=test` and the test process read the identical config — without that the factories would seed one database while the server reads another.

## Manual API testing

`bruno/` is a Bruno collection (`bruno.json`, `collection.bru`) for exercising endpoints manually against a running local server.
