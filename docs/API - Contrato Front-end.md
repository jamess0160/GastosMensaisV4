# API — Contrato para o front-end

Documento gerado a partir dos `*.route.ts` e `*.schema.ts` do repositório. Ele descreve **o que a API aceita e o que devolve hoje**. Toda validação citada aqui é a que roda de verdade (Joi, em `<Feature>.schema.ts`), não uma intenção.

> **Mudou alguma coisa?** O [changelog](#18-changelog) no fim do documento lista toda alteração que afeta o front, da mais recente para a mais antiga, dizendo o que quebra e o que fazer. Comece por ele.

---

## 1. Convenções gerais

### 1.1 Base URL

Em produção o front é servido em `https://www.gastosmensais.com.br` e a API em `https://www.gastosmensais.com.br/api`. **Mesma origem** — sem CORS, sem preflight.

Os caminhos deste documento são relativos a essa base: `/Accounts` aqui é `https://www.gastosmensais.com.br/api/Accounts` no navegador.

> **Desenvolvimento:** front e API em portas diferentes são origens diferentes, e o cookie de sessão é `SameSite=Strict` — ele **não** será enviado. Faça proxy de `/api` pelo dev server (`server.proxy` do Vite). Não contorne isso afrouxando o cookie.

### 1.2 Autenticação — cookie, e só cookie

A sessão é um JWT no cookie `token`:

| Atributo | Valor | Consequência para o front |
|---|---|---|
| `HttpOnly` | sim | O JavaScript **não lê** o token. Não tente guardá-lo |
| `SameSite` | `Strict` | O navegador anexa sozinho em requisições de mesma origem |
| `Secure` | em produção | — |
| `Max-Age` | 86400 (24h) | Expirou = 401. Redirecione para o login |

**Não existe header `Authorization`.** Um token válido enviado no header responde **401**. Basta usar `fetch(..., { credentials: 'same-origin' })` e o cookie viaja sozinho.

O token carrega **duas** informações: `IdUser` e `IdWorkspace`. Por isso **nenhuma rota recebe `IdWorkspace`** — a única exceção é `POST /Workspaces/switch`, que é justamente quem troca o workspace da sessão e reemite o cookie.

### 1.3 Formato de erro

Toda falha tratada responde JSON com uma única chave:

```json
{ "msg": "Conta não encontrada!" }
```

| Status | Significado | O que o front faz |
|---|---|---|
| `401` | Sem cookie, cookie inválido ou expirado. **Corpo vazio** | Manda para o login |
| `406` | Erro de negócio ou de validação. `msg` é texto pronto para o usuário | Mostra `msg` |
| `500` | Erro não tratado. **Corpo vazio** (`res.sendStatus(500)`) | Mensagem genérica |

Erros de validação Joi também são `406`, com `msg` fixo: `"Dados de entrada inválidos."`, `"Parâmetros inválidos na URL."` ou `"Parâmetros inválidos na Query."`.

Não há `404` para linha inexistente em rota de tenant: responde `406` com `msg`. Um `404` confirmaria que a linha existe em outro workspace.

### 1.4 Formato dos caminhos

Parâmetros de rota usam o padrão `Nome=:Valor`, não `/:Valor`:

```
PUT    /Accounts/IdAccount=12
DELETE /Expenses/IdExpense=45/series
```

### 1.5 Tipos

| Tipo neste doc | JSON | Observação |
|---|---|---|
| `number` | número | Dinheiro chega como **número**, nunca string |
| `CalendarDate` | `"YYYY-MM-DD"` | Data de calendário. **Nunca faça `new Date(valor)`** — em UTC-3 o dia 05 vira 04. Trate como string |
| `ReferenceMonth` | `"YYYY-MM"` | Só na entrada do orçamento. Na resposta volta como `"YYYY-MM-01"` |
| `datetime` | ISO 8601 | Instante de verdade (`CreatedAt`, `PaidAt`, `ReceivedAt`). Aqui `new Date()` é correto |
| `Color` | `"#RRGGBB"` | 7 caracteres, hexadecimal |

**Dinheiro:** sempre `decimal(15,2)`. Envie no máximo 2 casas — o Joi valida `precision(2)`.

**Rateios fecham na soma.** Todo split é por **valor absoluto**, nunca porcentagem, e a soma das partes tem que bater exatamente com o `TotalValue` (a API confere em centavos). Se não bater, `406`.

### 1.6 PUT é substituição, não merge parcial

Nos PUTs, campos marcados `obrigatório` têm que ir sempre — mesmo que não tenham mudado. Campos opcionais **omitidos permanecem como estão**; enviados, substituem. Em listas (`Payments`, `Persons`, `Tags`), enviar **substitui a lista inteira**.

---

## 2. Users — `/Users`

### `POST /Users` — cadastro *(público)*

Cria, numa única transaction: o **usuário**, o **workspace** dele, a **matrícula** e a **Person** dele mesmo.

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `Name` | string | obrigatório |
| `Email` | string | obrigatório, formato de e-mail, normalizado para minúsculas |
| `Password` | string | obrigatório, **texto puro** (ver aviso) |
| `Phone` | number | obrigatório |
| `InviteHash` | string | opcional — o hash do convite, para entrar num workspace existente |

> ⚠️ **Não pré-hasheie nem criptografe a senha no cliente.** O que a API recebe vira a credencial efetiva: um hash vazado seria reproduzido como está. O bcrypt (custo 12) roda no servidor.

> ⚠️ **`IdWorkspace` não é mais aceito** e mandá-lo responde `406`. Entrar num workspace existente exige convite — ver a seção 4.

**Sem `InviteHash`:** nasce o workspace próprio do usuário, e ele é `owner` dele.

**Com `InviteHash`:** **não** nasce workspace nenhum. O usuário é matriculado no workspace do convite, com o `Role` que a **linha do convite** manda (`editor` ou `viewer`), e ganha a `Person` dele nesse workspace. O `IdWorkspace` da resposta é o do convite.

O `Email` do corpo **tem que ser o mesmo do convite** — diferente responde `406` e nada é gravado, nem o usuário. Convite inexistente, revogado, expirado ou já usado: `406`, cada um com a sua `msg`.

**Resposta `200`**

```json
{ "IdUser": 1, "IdWorkspace": 1 }
```

E-mail já em uso: `406`.

> O cadastro **não** loga o usuário. Chame `POST /Users/login` em seguida.

---

### `POST /Users/login` *(público)*

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `login` | string | obrigatório, normalizado para minúsculas (é o e-mail) |
| `password` | string | obrigatório |

**Resposta `200`** — e o `Set-Cookie: token=...`, que é o que importa.

```json
{ "msg": "Login realizado com sucesso" }
```

Credencial errada: `406` com `{ "msg": "Login inválido" }` — a mesma mensagem para e-mail inexistente e senha errada, de propósito.

O login já seleciona o primeiro workspace do usuário, então a sessão nunca começa sem workspace.

---

### `POST /Users/logout` *(público)*

Sem body. Sobrescreve o cookie `token` com um `Set-Cookie` expirado, encerrando a sessão.

**Resposta `200`**

```json
{ "msg": "Sessão encerrada com sucesso" }
```

> **Não exige sessão de propósito.** Chamar sem cookie, com cookie expirado ou com token inválido responde `200` do mesmo jeito — um logout que respondesse `401` travaria o botão "Sair" justamente no caso em que o usuário mais quer sair.

O token continua **tecnicamente válido até o `exp`** (24h) para quem tiver copiado o valor. Não há lista de revogação. Na prática o cookie é `HttpOnly`, então copiá-lo exige acesso ao aparelho.

**Ação do front:** chame a rota e, em seguida, limpe o estado local (cache do mês, dados do usuário) e redirecione para o login. Não tente apagar o cookie pelo JavaScript — ele é `HttpOnly` e o `document.cookie` não o alcança.

---

### `GET /Users/getSelf` 🔒

**Resposta `200`** (`Password` nunca sai):

```json
{
  "IdUser": 1,
  "Name": "Tiago",
  "Email": "tiago@exemplo.com",
  "Phone": 11999999999,
  "LastLogin": "2026-08-30T12:00:00.000Z",
  "TrialStartAt": "2026-08-01T00:00:00.000Z",
  "TrialEndAt": null,
  "Active": true,
  "CreatedAt": "2026-08-01T00:00:00.000Z",
  "UpdatedAt": "2026-08-30T12:00:00.000Z"
}
```

---

### `PUT /Users/IdUser=:IdUser` 🔒

**Body:** `Name` (obrigatório), `Email` (obrigatório), `Phone` (obrigatório).

**Resposta `200`:** corpo vazio.

---

### `PUT /Users/updatePassword` 🔒

**Body:** `oldPassword` (obrigatório), `newPassword` (obrigatório) — **no body, nunca na URL**: o path cai no log de acesso do proxy, no histórico do navegador e no header `Referer`.

**Resposta `200`:** corpo vazio. Senha antiga errada: `406` `"Senha antiga não bate com a senha registrada"`.

---

## 3. UsersAuth (biometria / WebAuthn) — `/UsersAuth`

Dois fluxos de dois passos, costurados por um **`ChallengeToken`** (JWT curto, 5 min) que a API assina no passo 1 e o cliente devolve no passo 2. A API não guarda estado entre os passos.

**`DeviceKey`**: id base64url de 32 bytes que a **API gera** e o **aparelho guarda** (localStorage). Não é credencial — só responde "quais passkeys oferecer aqui" e "já perguntei sobre biometria neste aparelho".

### `GET /UsersAuth/checkDevice/DeviceKey=:DeviceKey` *(público)*

Tri-estado, para decidir o que mostrar na tela de login:

```json
{ "UseAuth": true }
```

| `UseAuth` | Significa | Tela |
|---|---|---|
| `true` | Há passkey neste aparelho | Oferece login por biometria |
| `false` | O usuário já recusou aqui | Não oferece; vai direto para senha |
| `null` | Nunca foi perguntado | Depois do login por senha, convida a cadastrar |

---

### `GET /UsersAuth/options/login/DeviceKey=:DeviceKey` *(público)*

**Resposta `200`**

```json
{
  "options": {
    "challenge": "...",
    "allowCredentials": [{ "id": "..." }],
    "rpId": "...",
    "timeout": 60000,
    "userVerification": "preferred"
  },
  "ChallengeToken": "eyJ..."
}
```

`options` é o `PublicKeyCredentialRequestOptionsJSON` da spec — passe direto para `startAuthentication()` do `@simplewebauthn/browser`. **Não é validado por Joi de propósito**: o formato é o da lib.

Sem credencial no aparelho: `406` `"Nenhuma credencial biométrica registrada neste dispositivo."`

O desafio **não fixa usuário**: duas pessoas podem ter passkey no mesmo aparelho, e quem escolhe é o autenticador.

---

### `POST /UsersAuth/authenticate` *(público)*

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `ChallengeToken` | string | obrigatório, o que veio do passo 1 |
| `Response` | object | obrigatório, o retorno do `startAuthentication()` — precisa ter `id`; o resto passa como veio |

**Resposta `200`** — mesma do login por senha, com o `Set-Cookie`:

```json
{ "msg": "Login realizado com sucesso" }
```

Falha: `406` `"Login inválido"`.

O usuário é resolvido **pela credencial assinada**, não pelo `DeviceKey`.

---

### `GET /UsersAuth/getSelf` 🔒

Lista as passkeys da conta.

```json
[{
  "IdUserAuth": 1,
  "IdUser": 1,
  "CredentialId": "...",
  "DeviceKey": "...",
  "Active": true,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}]
```

---

### `GET /UsersAuth/options/register` 🔒

**Resposta `200`:** `{ "options": { ... }, "ChallengeToken": "eyJ..." }` — `options` é o `PublicKeyCredentialCreationOptionsJSON`, para `startRegistration()`.

---

### `POST /UsersAuth/register` 🔒

**Body:** `ChallengeToken` (obrigatório), `Response` (obrigatório, retorno do `startRegistration()`), `DeviceKey` (opcional — mande o que já existe no aparelho; sem ele a API gera um).

**Resposta `200`**

```json
{ "verified": true, "DeviceKey": "aBc..." }
```

Guarde o `DeviceKey` no aparelho. Registrar limpa uma recusa anterior.

---

### `POST /UsersAuth/skipDevice` 🔒

"Não quero biometria neste aparelho" — é o que faz `checkDevice` passar a responder `false`.

**Body:** `DeviceKey` (opcional). **Resposta:** `{ "DeviceKey": "aBc..." }`.

---

### `DELETE /UsersAuth/IdUserAuth=:IdUserAuth` 🔒

Soft delete (a linha fica, para o `CredentialId` seguir ocupando o índice único — senão o mesmo autenticador poderia registrar a passkey de novo como se fosse nova).

**Resposta:** `{ "msg": "Biometria removida com sucesso" }`.

---

## 4. Workspaces — `/Workspaces` 🔒 *(exceto `GET /Workspaces/invite/Hash=:Hash`)*

Não há `POST`: um workspace nasce no cadastro, e a única forma de entrar num que já existe é o **convite** (4.1). Um usuário pode ser membro de mais de um — `getSelf` devolve todos, e é o `switch` que escolhe em qual a sessão está.

### `GET /Workspaces/getSelf`

Os workspaces em que o usuário é membro.

```json
[{ "IdWorkspace": 1, "Name": "Casa", "IdOwnerUser": 1, "CreatedAt": "...", "UpdatedAt": "..." }]
```

### `POST /Workspaces/switch`

**A única rota que recebe `IdWorkspace` do cliente.** Confere a matrícula e **reemite o cookie** — o workspace vive dentro do token.

**Body:** `{ "IdWorkspace": 2 }`

**Resposta:** o workspace escolhido, mesma forma do `getSelf` (objeto único).

### `PUT /Workspaces`

Edita o workspace **selecionado na sessão** — sem id no caminho.

**Body:** `Name` (obrigatório, ≤255).

**Resposta:** `{ "msg": "Workspace atualizado com sucesso" }`.

---

### 4.1 Convites — como se entra num workspace alheio

Um convite é **uma linha no banco**, e o que viaja no link é o `Hash`: 32 bytes aleatórios em base64url (43 caracteres, seguros em URL). Nunca o `IdWorkspace`, que é sequencial.

**A API não manda e-mail.** Ela devolve o hash; **quem entrega o link é o usuário** — monte a URL da sua tela de aceite com ele (ex.: `https://www.gastosmensais.com.br/convite/<Hash>`) e deixe o dono copiar ou compartilhar.

**O e-mail é parte da tranca, não enfeite.** O link é compartilhável por desenho — vai por WhatsApp —, então o segredo do hash sozinho não bastaria: quem recebesse o encaminhamento entraria. No aceite a API compara o e-mail do convite com o da conta que está aceitando (o da sessão no `join`, o do corpo no cadastro). Diferente: `406`. **Diga isso na tela de aceite**, mostrando o `Email` que o `GET` público devolve.

Um convite é de **uso único**, vale **7 dias** e pode ser **revogado** a qualquer momento.

---

### `POST /Workspaces/invite` 🔒 *(só `owner`)*

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `Email` | string | obrigatório, formato de e-mail, normalizado para minúsculas |
| `Role` | `"editor"` \| `"viewer"` | opcional, default `"editor"` |

`Role: "owner"` responde `406`: **propriedade não se convida.**

**Resposta `200`**

```json
{ "Hash": "Yk3s...43 caracteres", "ExpiresAt": "2026-09-11T12:00:00.000Z" }
```

- Quem não é `owner` do workspace da sessão: `403`.
- Convidar quem **já é membro**: `406`.
- **Convidar o mesmo e-mail de novo renova o convite pendente** — hash e validade novos, o hash anterior deixa de funcionar. Não nascem dois links.

---

### `GET /Workspaces/invites` 🔒 *(só `owner`)*

Os convites **pendentes** do workspace da sessão — "quem eu convidei e ainda não entrou". Aceitos e revogados não aparecem.

```json
[{
  "IdWorkspaceInvite": 3, "IdWorkspace": 1, "IdInviterUser": 1,
  "Email": "alguem@exemplo.com", "Role": "editor",
  "Hash": "Yk3s...", "Status": "pending",
  "ExpiresAt": "2026-09-11T12:00:00.000Z",
  "AcceptedAt": null, "IdAcceptedUser": null,
  "CreatedAt": "...", "UpdatedAt": "..."
}]
```

O `Hash` volta para o dono conseguir **reenviar o link** sem precisar revogar e criar outro.

---

### `GET /Workspaces/invite/Hash=:Hash` *(público)*

A tela de aceite, **antes de qualquer sessão**: quem recebeu o link ainda pode não ter conta.

```json
{
  "WorkspaceName": "Casa",
  "InviterName": "Tiago",
  "Email": "alguem@exemplo.com",
  "Role": "editor",
  "ExpiresAt": "2026-09-11T12:00:00.000Z"
}
```

**Nenhum id na resposta**, de propósito — a rota não pode virar sonda para descobrir workspace por id.

Convite inexistente, revogado, expirado ou já aceito: `406`, e a `msg` diz qual dos quatro. Mostre a `msg`: "expirou, peça outro" e "não encontrado" mandam o usuário para lugares diferentes.

---

### `POST /Workspaces/join` 🔒

Aceite de quem **já tem conta**. Quem ainda não tem se cadastra pelo `POST /Users` com `InviteHash`.

**Body:** `{ "Hash": "Yk3s..." }` — só isso. O papel vem da linha do convite, nunca do cliente.

**Resposta `200`:** `{ "IdWorkspace": 1 }`.

> ⚠️ **O join NÃO troca a sessão.** Ele dá a matrícula e o cookie continua apontando para o workspace em que você estava — de propósito: aceitar não pode trocar o workspace debaixo da tela que o usuário estava usando. Para operar no workspace novo, chame **`POST /Workspaces/switch`** com o `IdWorkspace` que voltou.

`406` quando: o e-mail da sessão não é o do convite, o convite não existe, foi revogado, expirou ou já foi usado.

---

### `DELETE /Workspaces/invite/IdWorkspaceInvite=:IdWorkspaceInvite` 🔒 *(só `owner`)*

Revoga o convite (`Status = 'revoked'`): o link para de funcionar **na hora**.

**Resposta `200`:** `{ "msg": "Convite revogado com sucesso" }`.

Convite de outro workspace, ou que não está mais `pending` (já aceito ou já revogado): `406`. **Revogar não desfaz matrícula já criada** — remover membro é outra coisa, e ainda não existe.

---

## 5. Accounts — `/Accounts` 🔒

Uma conta **não tem saldo guardado**. `Balance` é calculado a cada leitura, e é sempre o saldo **de um mês**.

### `GET /Accounts`

| Query | Tipo | Regra |
|---|---|---|
| `ReferenceMonth` | `YYYY-MM` | opcional, default **o mês corrente** |

Devolve as contas do workspace com as formas de pagamento embutidas. **O `ReferenceMonth` recorta o `Balance`, não a lista** — as contas são as mesmas em qualquer mês. Mande o mês que a tela está exibindo.

```json
[{
  "IdAccount": 1,
  "IdWorkspace": 1,
  "IdUser": 1,
  "Name": "Nubank",
  "Type": "checking",
  "IconPath": null,
  "Color": "#8A05BE",
  "InitialBalance": 1000,
  "InitialBalanceDate": "2026-01-01",
  "Balance": 1875.4,
  "Position": 1,
  "Active": true,
  "CreatedAt": "...",
  "UpdatedAt": "...",
  "PaymentMethods": [ /* ver seção 6 */ ]
}]
```

**`Balance`** = `InitialBalance` + entradas recebidas − transferências que saíram − **pernas de gasto pagas**, tudo **com data até o último dia do `ReferenceMonth`**. Pendente é previsão e **não entra**. Não é coluna: não tente recalcular somando lançamentos no cliente.

A data que conta é a do lançamento — `CompetenceDate` na entrada, `DueDate` (ou a data do gasto, fora de cartão) na perna —, **não a data em que se clicou em receber/quitar**. Duas consequências para a tela:

- uma entrada de setembro já marcada como recebida **não** aparece no saldo de agosto: peça `ReferenceMonth=2026-09` para vê-la;
- quitar hoje a parcela que vence em novembro **não** mexe no saldo de agosto — ela sai no saldo de novembro.

O saldo de abertura obedece ao mesmo corte quando a conta tem `InitialBalanceDate`: uma conta aberta em agosto vem com `Balance: 0` em março. Sem `InitialBalanceDate`, a abertura conta em qualquer mês.

**`Type` ∈ `checking` | `cash` | `card`**, e o tipo decide **quais formas de pagamento nascem com a conta**:

| `Type` | O que é | Nasce com | Aceita cartão de crédito? |
|---|---|---|---|
| `checking` | conta bancária | **pix + débito** | **sim** — é a única |
| `cash` | dinheiro na carteira | uma forma `debit` chamada **"Dinheiro"** | não |
| `card` | saldo fechado sem conta atrás — o **vale-alimentação** | uma forma `debit` com o **nome da conta** | não |

**`card` não é "conta de cartão de crédito"** — é o oposto disso. **Não existe conta de tipo cartão de crédito**: cartão de crédito é forma de pagamento (seção 6). O `card` é o vale: tem saldo próprio, não tem conta bancária atrás e **não tem fatura** — o gasto sai do saldo no ato, que é por isso que a forma que nasce com ele é `debit` e não um `Kind` novo. Quem precisa do rótulo "vale" na tela tem o `Name`, que é o que o usuário escreve.

### `POST /Accounts`

| Campo | Tipo | Regra |
|---|---|---|
| `Name` | string | obrigatório, ≤255 |
| `Type` | `checking` \| `cash` \| `card` | default `checking` |
| `IconPath` | string \| null | ≤255, default `null` |
| `Color` | `#RRGGBB` \| null | default `null` |
| `InitialBalance` | number | 2 casas, default `0`. **Negativo é válido** (cheque especial) |
| `InitialBalanceDate` | CalendarDate \| null | default `null` |
| `Position` | int \| null | default `null` |

**Resposta:** `{ "IdAccount": 1 }`. A conta já nasce com as formas de pagamento do seu `Type` (a tabela acima) — busque-as no `GET`.

### `PUT /Accounts/IdAccount=:IdAccount`

`Name` obrigatório; `Type`, `IconPath`, `Color`, `InitialBalance`, `InitialBalanceDate`, `Position` opcionais (omitido = mantém).

> **`InitialBalance` congela depois do primeiro lançamento:** alterá-lo responde `406` `"Esta conta já tem lançamentos: o saldo inicial não pode mais ser alterado."` Desabilite o campo na tela quando a conta já tiver movimento.

> **`Type` congela pela mesma regra:** alterá-lo depois do primeiro lançamento responde `406` `"Esta conta já tem lançamentos: o tipo dela não pode mais ser alterado."` O `Type` decide quais formas de pagamento nasceram com a conta, e trocá-lo **não as refaz** — nem numa conta vazia, onde a troca é aceita: as formas que nasceram ficam como estão, e renomeá-las é do usuário. Desabilite o campo junto com o saldo inicial.

**Resposta:** `{ "msg": "Conta atualizada com sucesso" }`.

### `DELETE /Accounts/IdAccount=:IdAccount`

**Arquiva** (`Active = false`) e arquiva as formas de pagamento junto. O histórico continua apontando para a linha.

**Resposta:** `{ "msg": "Conta arquivada com sucesso" }`.

---

## 6. PaymentMethods — `/PaymentMethods` 🔒

**Não há `GET`**: a forma de pagamento sai embutida em `GET /Accounts`.

**Forma da linha** (a mesma dentro de `Accounts.PaymentMethods`):

```json
{
  "IdPaymentMethod": 3,
  "IdWorkspace": 1,
  "IdAccount": 1,
  "Name": "Cartão Roxo",
  "Kind": "credit_card",
  "DueDay": 27,
  "ClosingOffsetDays": 7,
  "IconPath": null,
  "Color": null,
  "Position": 1,
  "Active": true,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}
```

`Kind` ∈ `pix` | `debit` | `credit_card`. `DueDay`/`ClosingOffsetDays` só fazem sentido em `credit_card` — nas outras são `null`.

**`debit` cobre três coisas diferentes** e o que as separa é o `Name`, não o `Kind`: o débito da conta corrente, o "Dinheiro" da conta `cash` e a forma com o nome da conta num vale (`Type='card'`). Nas três o gasto sai do saldo **no ato** e não há fatura — que é exatamente o que `debit` significa no modelo.

**O cartão é descrito pelo vencimento, não pelo fechamento.** `DueDay` é o dia do mês em que a fatura vence e `ClosingOffsetDays` é quantos dias **antes** dele ela fecha — é o dado que o emissor realmente pede ao cliente, e a folga é o que ele aplica por baixo. Não existe mais um campo com o dia do fechamento: ele é `DueDay − ClosingOffsetDays` e muda de mês para mês (vencendo dia 5 com folga de 7, a fatura fecha em 26/02 e em 29/03).

Não há padrão de mercado para a folga — fica tipicamente entre 6 e 10 dias, e o **default é 7**. Na tela de cadastro, peça o vencimento e deixe a folga num campo avançado já preenchido.

**Não existem `Brand` nem `LastDigits`.** Quem identifica o cartão na tela é o `Name`, que o usuário escreve — e o `IconPath`/`Color`, se você quiser um rótulo visual. Se a sua tela mostrava "Nubank ****1234", peça isso dentro do `Name`.

### `POST /PaymentMethods`

**Só cartão de crédito.** Pix e débito nascem com a conta e não se criam pela mão.

> **E só em conta `checking`.** `IdAccount` apontando para uma conta `cash` ou `card` responde `406` `"Cartão de crédito só existe em conta corrente."` As duas são contas de **saldo fechado** — dinheiro na carteira e vale-alimentação — e uma fatura nelas não teria de onde sair: o cartão de crédito é uma dívida que vence contra uma conta bancária. Na tela de cadastro do cartão, ofereça **só as contas `checking`** no seletor.

| Campo | Tipo | Regra |
|---|---|---|
| `IdAccount` | number | obrigatório |
| `Name` | string | obrigatório, ≤255 |
| `Kind` | `credit_card` | obrigatório, único valor aceito |
| `DueDay` | int 1–31 | **obrigatório** |
| `ClosingOffsetDays` | int 1–28 | default `7` |
| `IconPath` | string \| null | ≤255, default `null` |
| `Color` | `#RRGGBB` \| null | default `null` |
| `Position` | int \| null | default `null` |

**Resposta:** `{ "IdPaymentMethod": 3 }`.

### `PUT /PaymentMethods/IdPaymentMethod=:IdPaymentMethod`

`Name` obrigatório; `DueDay`, `ClosingOffsetDays`, `IconPath`, `Color`, `Position` opcionais.

**`Kind` e `IdAccount` não são aceitos:** um pix não vira cartão e um cartão não muda de conta — as duas trocas reescreveriam o significado das compras já lançadas nele. Mandar `null` em `DueDay`/`ClosingOffsetDays` de um cartão dá `406`.

**Editar o cartão não recalcula as compras já lançadas.** `ClosingDate`/`DueDate` são gravadas na perna no momento do lançamento (seção 11) e não são revistas depois. Corrigir o vencimento ou a folga vale para o que vier daí em diante; o que já está gravado só muda por um `PUT` no próprio gasto.

**Resposta:** `{ "msg": "Forma de pagamento atualizada com sucesso" }`.

### `DELETE /PaymentMethods/IdPaymentMethod=:IdPaymentMethod`

Arquiva. **Resposta:** `{ "msg": "Forma de pagamento arquivada com sucesso" }`.

---

## 7. Categories — `/Categories` 🔒

Categoria é **só de gasto** — entrada não tem categoria. **Lista plana: categoria não é filha de outra.**

### `GET /Categories`

Devolve as do workspace **e as globais juntas**, numa lista só.

```json
[{
  "IdCategory": 1,
  "IdWorkspace": null,
  "Description": "Alimentação",
  "IconKey": "food",
  "Color": "#FF5722",
  "Position": 1,
  "Active": true,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}]
```

> **`IdWorkspace: null` = categoria pré-definida do sistema.** Ela aparece em todo workspace e **não pode ser editada nem arquivada** — tentar responde `406`. Use esse campo para desabilitar os botões de editar/excluir na tela.

### `POST /Categories`

| Campo | Tipo | Regra |
|---|---|---|
| `Description` | string | obrigatório, ≤255 |
| `IconKey` | string \| null | ≤100, default `null`. É **chave do catálogo de ícones do cliente**, não caminho de arquivo (por isso `IconKey` aqui e `IconPath` em Accounts) |
| `Color` | `#RRGGBB` \| null | default `null` |
| `Position` | int \| null | default `null` |

**Resposta:** `{ "IdCategory": 14 }`.

### `PUT /Categories/IdCategory=:IdCategory`

`Description` obrigatório; `IconKey`, `Color`, `Position` opcionais.

**Resposta:** `{ "msg": "Categoria atualizada com sucesso" }`.

### `DELETE /Categories/IdCategory=:IdCategory`

Arquiva. **Resposta:** `{ "msg": "Categoria arquivada com sucesso" }`.

---

## 8. Persons — `/Persons` 🔒

Quem recebeu ou quem gastou. Os dois rateios (entrada e gasto) apontam para **Persons**, nunca para Users — pessoa não precisa ter login.

### `GET /Persons`

```json
[{
  "IdPerson": 1,
  "IdWorkspace": 1,
  "Name": "Tiago",
  "IdUser": 1,
  "Active": true,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}]
```

`IdUser` aqui é **vínculo de identidade** (essa pessoa é um usuário do sistema), não autoria. Nulo é o caso comum.

### `POST /Persons`

**Body:** `Name` (obrigatório, ≤255) — **e só**. `IdUser` não é aceito de propósito: é único no banco inteiro, e aceitá-lo do cliente consumiria a vaga de outro usuário.

Nome já usado no workspace (mesmo arquivado, e a comparação ignora maiúsculas): `406`.

**Resposta:** `{ "IdPerson": 2 }`.

### `PUT /Persons/IdPerson=:IdPerson`

**Body:** `Name` (obrigatório). **Resposta:** `{ "msg": "Pessoa atualizada com sucesso" }`.

### `DELETE /Persons/IdPerson=:IdPerson`

Arquiva. **Recusa (`406`) a pessoa vinculada a um login** (`IdUser` preenchido): o vínculo não pode ser reconstruído por rota nenhuma, e arquivar tiraria esse usuário de todo rateio futuro para sempre.

**Resposta:** `{ "msg": "Pessoa arquivada com sucesso" }`.

---

## 9. Tags — `/Tags` 🔒

**Duas rotas só, e é de propósito.** A tag **não tem cadastro**: ela nasce do texto digitado no lançamento do gasto. Não há `POST` (cadastrar antes de usar seriam dois passos para uma etiqueta) e não há `PUT` (renomear mudaria a etiqueta de todos os gastos já marcados).

### `GET /Tags/search?Search=via`

O input de sugestão enquanto se digita. `Search` opcional, ≤100 caracteres. Busca `ILIKE`, com os curingas escapados, e o resultado vem limitado.

```json
[{
  "IdTag": 1,
  "IdWorkspace": 1,
  "IdUser": 1,
  "Name": "Viagem Chile",
  "Color": null,
  "Active": true,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}]
```

`IdUser` aqui é **autoria** (quem usou a tag primeiro) — sentido oposto ao de `Persons`.

### `DELETE /Tags/IdTag=:IdTag`

Arquiva. **Resposta:** `{ "msg": "Tag arquivada com sucesso" }`.

> Digitar de novo um nome arquivado **desarquiva** a linha — é o único caminho de restauração que existe.

---

## 10. Inflows — `/Inflows` 🔒

Carrega **entrada de dinheiro e transferência entre contas**, discriminadas por `Kind`.

| `Kind` | `IdFromAccount` | `IdToAccount` | Rateio (`Persons`) |
|---|---|---|---|
| `inflow` | **null** (veio de fora) | obrigatório | permitido |
| `transfer` | **obrigatório** | obrigatório, **diferente do From** | **proibido** |

> Transferência é neutra para o patrimônio: **todo total de "quanto entrou" tem que filtrar `Kind <> 'transfer'`**, ou o mesmo dinheiro é contado de novo a cada movimentação entre contas. (No **saldo da conta**, ao contrário, ela conta nos dois lados.)

`Status` ∈ `pending` | `received` | `canceled`. Nasce sempre `pending`. **Não há estado parcial nem `ReceivedValue`.**

### `GET /Inflows`

**Query** (todos opcionais)

| Param | Formato |
|---|---|
| `From` | `YYYY-MM-DD` — inclusivo |
| `To` | `YYYY-MM-DD` — inclusivo |
| `Status` | `pending` \| `received` \| `canceled` |
| `Kind` | `inflow` \| `transfer` |

Filtra por `CompetenceDate`. **Sem `Status`, as canceladas ficam de fora**; peça `Status=canceled` para vê-las. As duas pontas do período são independentes: só `From` é "daqui para a frente", só `To` é "até aqui".

**Resposta** — sem o rateio embutido (a lista de mês não desenha rateio):

```json
[{
  "IdInflow": 1,
  "IdWorkspace": 1,
  "IdUser": 1,
  "Description": "Salário",
  "TotalValue": 5000,
  "Status": "received",
  "Kind": "inflow",
  "IdFromAccount": null,
  "IdToAccount": 1,
  "CompetenceDate": "2026-08-05",
  "ExpectedDate": "2026-08-05",
  "ReceivedAt": "2026-08-05T13:22:00.000Z",
  "Notes": null,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}]
```

### `GET /Inflows/IdInflow=:IdInflow`

Mesma linha **mais** `Persons`:

```json
{
  "...": "campos acima",
  "Persons": [{
    "IdInflowPerson": 1,
    "IdWorkspace": 1,
    "IdInflow": 1,
    "IdPerson": 2,
    "Value": 2500,
    "CreatedAt": "...",
    "UpdatedAt": "..."
  }]
}
```

### `POST /Inflows`

| Campo | Tipo | Regra |
|---|---|---|
| `Description` | string | obrigatório, ≤255 |
| `TotalValue` | number | obrigatório, 2 casas, **> 0** (valor negativo é saída, e saída é gasto) |
| `Kind` | `inflow` \| `transfer` | default `inflow` |
| `IdFromAccount` | number \| null | obrigatório em `transfer`; em `inflow` só aceita `null` |
| `IdToAccount` | number | obrigatório |
| `CompetenceDate` | CalendarDate | obrigatório |
| `ExpectedDate` | CalendarDate \| null | default `null` |
| `Notes` | string \| null | default `null` |
| `Persons` | `[{ IdPerson, Value }]` | default `[]`; **proibido** em `transfer`; se vier, a soma tem que fechar com `TotalValue` |

`Status` **não é aceito**: nasce pendente.

**Resposta:** `{ "IdInflow": 1 }`.

### `POST /Inflows/batch`

Grava **N entradas numa transaction só: tudo ou nada.** É a rota da tela de "repetir o mês passado".

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `Inflows` | array | obrigatório, **1 a 100** itens |

**Cada item é exatamente o body do `POST /Inflows`**, validado pelo mesmo schema — o que é `406` sozinho é `406` no lote. Transferência (`Kind: "transfer"`) pode vir no mesmo lote que entrada.

**Resposta `200`**

```json
{ "msg": "Entradas cadastradas com sucesso", "IdInflows": [12, 13, 14] }
```

Os ids voltam na **ordem em que você mandou**, para invalidar o cache do mês certo.

**Se um item for recusado, nenhum é gravado** — nem os que estavam certos. A `msg` diz **qual**:

```json
{ "msg": "Item 2: A soma do rateio precisa fechar exatamente com o valor da entrada." }
```

`"Item 2"` é o segundo item do array (posição `1`, base 0). Use isso para destacar a linha no formulário.

**Todas nascem `pending`.** Nenhum saldo se move na gravação — é o `receive` de cada uma que faz isso. Por isso a operação é segura de refazer depois de um erro.

> **Não existe `POST /Inflows/clone`, e não vai existir.** Quem escolhe o que copiar do mês anterior é o **usuário**, item a item; o cliente monta as cópias (avança as datas, apara o dia no mês curto, leva o rateio junto) e manda tudo aqui. Como consequência, **idempotência é problema do cliente**: desabilite o botão enquanto a requisição está em voo — repetir o lote cria tudo de novo.

### `PUT /Inflows/IdInflow=:IdInflow`

| Campo | Regra |
|---|---|
| `Description` | obrigatório |
| `TotalValue` | obrigatório, > 0 |
| `CompetenceDate` | obrigatório |
| `ExpectedDate` | opcional |
| `Notes` | opcional |
| `Persons` | opcional — omitir mantém, enviar substitui inteiro |

**Não se edita `Kind`, contas nem `Status`.** Os três reescreveriam o que o lançamento significa, e o saldo das contas envolvidas junto.

> Editar uma entrada **já recebida é permitido** — é o que a decisão de não cachear saldo compra. E o rateio é reconferido contra o **novo** total mesmo quando não foi enviado: quando só o total muda, é o rateio gravado que deixa de fechar.

**Resposta:** `{ "msg": "Entrada atualizada com sucesso" }`.

### `POST /Inflows/IdInflow=:IdInflow/receive`

Sem body. É **isto** que põe o dinheiro no saldo. Tudo ou nada.

**Resposta:** `{ "msg": "Entrada recebida com sucesso" }`.

`406` quando: a entrada não existe no workspace, **já está recebida**, ou está cancelada.

### `POST /Inflows/IdInflow=:IdInflow/unreceive`

Sem body. A simétrica do `receive`: volta o `Status` para `pending` e limpa o `ReceivedAt`. O dinheiro sai do saldo.

**Resposta:** `{ "msg": "Recebimento desfeito com sucesso" }`.

`406` quando: a entrada não existe no workspace, **não está recebida**, ou está cancelada.

> **Não existe "estorno" a lançar.** O saldo não é guardado em lugar nenhum — ele é somado dos lançamentos a cada leitura, contando só o que está `received`. Voltar o `Status` **é** a retirada. Depois de desfazer, o `Balance` de `GET /Accounts` volta sozinho ao valor de antes; não crie lançamento nenhum para compensar.

Numa **transferência**, desfazer devolve as duas contas de uma vez — a de origem e a de destino.

Receber de novo depois de desfeito é o caminho normal de quem errou o clique, e grava um `ReceivedAt` novo: o do recebimento que de fato aconteceu.

### `DELETE /Inflows/IdInflow=:IdInflow`

**Cancela** (`Status = 'canceled'`). Não há delete físico nem `Active` nesta tabela.

**Resposta:** `{ "msg": "Entrada cancelada com sucesso" }`.

---

## 11. Expenses — `/Expenses` 🔒

### 11.1 Os dois eixos — leia antes de montar a tela

Um gasto tem **dois rateios independentes que nunca se cruzam**:

| Eixo | Campo | Pergunta | Move saldo? |
|---|---|---|---|
| **Financeiro** | `Payments` | Com qual forma de pagamento foi pago | **sim** |
| **Analítico** | `Persons` | De quem é o custo | não |

**Duas formas de pagamento + duas pessoas = 2 + 2 linhas, nunca 4.** Cada eixo fecha com o `TotalValue` por conta própria.

### 11.2 Os três formatos (`Kind`)

| `Kind` | O que é | Campos próprios |
|---|---|---|
| `single` | Compra à vista | — |
| `installment` | 600 em 6× → **6 pernas de 100** | `InstallmentTotal` (2–120) |
| `fixed` | Corrente de ocorrências **reais** | `RecurrenceDay`, `RecurrenceEndDate` |

`installment` aceita **uma única perna** (uma forma de pagamento). O `TotalValue` continua sendo o **total da compra**, nunca o da parcela — e o centavo que sobra vai na **primeira** parcela.

`fixed` **não é molde + instâncias**: toda linha é um gasto de verdade. A raiz tem `IdParentExpense: null` e carrega a recorrência; as geradas apontam para ela.

**Quantas nascem é decisão do servidor:** a janela é de **12 ocorrências**, contando a raiz, e não há campo para mudá-la. O que limita a série é essa janela **ou** o `RecurrenceEndDate` — o que vier primeiro. A recorrência nunca fica aberta. Você não precisa saber esse número antes de salvar: o `POST` responde `Occurrences` com quantas nasceram.

### 11.3 `Status` é derivado — nunca envie

`Status` ∈ `pending` | `paid` | `canceled`, calculado num único lugar e recalculado a cada quitação. **Só chega a `paid` quando TODAS as pernas estão pagas** — quitar 1 de 6 parcelas deixa a compra `pending`.

### `GET /Expenses`

**Query** (todos opcionais): `From`, `To` (`YYYY-MM-DD`, inclusivos, sobre `ExpenseDate`), `Status`, `Kind`, `IdCategory`, `IncludeCanceled`.

Sem `Status` e sem `IncludeCanceled`, os cancelados ficam de fora.

**`IncludeCanceled`** (booleano, default `false`) existe para o filtro de status **multi-seleção**: é ele que traz "em aberto **e** cancelado" numa requisição só.

| Query | O que volta |
|---|---|
| *(nada)* ou `IncludeCanceled=false` | Tudo menos os cancelados |
| `IncludeCanceled=true` | **A lista completa**, cancelados incluídos — separe por `Status` no cliente |
| `Status=canceled` | **Só** os cancelados |
| `Status=pending` (com ou sem `IncludeCanceled`) | Só os `pending` — `Status` é sempre um estado só, e ganha do booleano |

Peça o mês **uma vez** com `IncludeCanceled=true` e aplique os filtros de tela sobre essa lista: uma chave de cache por mês, em vez de uma por combinação de filtro.

> **Esta lista é a das compras do mês, não a do que cai no mês.** O filtro é a `ExpenseDate`, então uma compra parcelada de março **não** aparece aqui em agosto — embora a 6ª parcela dela pese em agosto. Para o total do mês, e para as colunas de pessoa e forma de pagamento sem um `GET` por linha, use **`GET /ExpensePayments`** (seção 12).

**Resposta** — sem pernas, rateio ou tags (a lista de mês não os mostra):

```json
[{
  "IdExpense": 1,
  "IdWorkspace": 1,
  "IdUser": 1,
  "Description": "Mercado",
  "TotalValue": 600,
  "Status": "pending",
  "IdCategory": 1,
  "ExpenseDate": "2026-08-10",
  "Kind": "installment",
  "IdParentExpense": null,
  "RecurrenceDay": null,
  "RecurrenceEndDate": null,
  "Notes": null,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}]
```

### `GET /Expenses/IdExpense=:IdExpense`

A mesma linha **mais os três filhos**:

```json
{
  "...": "campos acima",
  "Payments": [{
    "IdExpensePayment": 1,
    "IdWorkspace": 1,
    "IdExpense": 1,
    "IdPaymentMethod": 3,
    "Value": 100,
    "InstallmentNumber": 1,
    "InstallmentTotal": 6,
    "ClosingDate": "2026-08-20",
    "DueDate": "2026-08-27",
    "Paid": false,
    "PaidAt": null,
    "CreatedAt": "...",
    "UpdatedAt": "..."
  }],
  "Persons": [{
    "IdExpensePerson": 1,
    "IdWorkspace": 1,
    "IdExpense": 1,
    "IdPerson": 2,
    "Value": 300,
    "CreatedAt": "...",
    "UpdatedAt": "..."
  }],
  "Tags": [{ "IdTag": 1, "Name": "Viagem Chile", "Color": null, "...": "linha completa da tag" }]
}
```

`Tags` traz a **tag inteira** (o nome é o que a tela desenha), não a linha de vínculo.

**`ClosingDate`/`DueDate` vivem na perna, não no gasto** — cada parcela cai numa fatura. São `null` fora de `credit_card`, **exceto** que uma parcela sempre ganha `DueDate` de mês em mês: parcelamento não é privilégio de cartão (crediário, dividir uma compra com um amigo no pix).

> Em cartão, um dia de diferença na compra vira **um mês** de diferença no caixa: a compra entra na **primeira fatura que ainda não fechou**. O fechamento sai do cartão como `DueDay − ClosingOffsetDays` (seção 6), então ele é uma data que muda de mês para mês — não um dia fixo do calendário.

### `POST /Expenses`

| Campo | Tipo | Regra |
|---|---|---|
| `Description` | string | obrigatório, ≤255 |
| `TotalValue` | number | obrigatório, 2 casas, **> 0**. Em parcelado, o **total da compra** |
| `IdCategory` | number | **obrigatório** |
| `ExpenseDate` | CalendarDate | obrigatório |
| `Kind` | `single` \| `installment` \| `fixed` | default `single` |
| `Notes` | string \| null | default `null` |
| `Payments` | `[{ IdPaymentMethod, Value, Paid? }]` | **obrigatório, mín. 1**, soma fecha com o total. `Paid` default `false` |
| `Persons` | `[{ IdPerson, Value }]` | default `[]`; se vier, soma fecha com o total |
| `Tags` | `string[]` | default `[]`. **Texto, não id** — ≤100 cada |
| `InstallmentTotal` | int 2–120 | **só** em `installment`: obrigatório lá, **proibido** nos outros |
| `RecurrenceDay` | int 1–31 | **só** em `fixed`, opcional (sem ele vale o dia da compra) |
| `RecurrenceEndDate` | CalendarDate \| null | **só** em `fixed` — corta a série antes da janela do servidor |

`Paid: true` é o caso do débito, que já sai pago no ato; no cartão a perna fica em aberto e se quita pela rota da perna.

**`Tags` é texto puro.** A API reusa a tag existente (ignorando maiúsculas), desarquiva a arquivada ou insere a nova — tudo dentro da transaction do gasto. É o **único** lugar em que uma tag nasce.

`Status` **não é aceito**. **`Occurrences` também não** — mandá-lo responde `406`; ele só existe na resposta.

**Resposta**

```json
{ "IdExpense": 1, "Occurrences": 12 }
```

`Occurrences` = quantas linhas de gasto nasceram: `1`, ou a série inteira em `fixed` (a janela de 12, ou menos se o `RecurrenceEndDate` cortar antes).

### `PUT /Expenses/IdExpense=:IdExpense`

| Campo | Regra |
|---|---|
| `Description` | obrigatório |
| `TotalValue` | obrigatório, > 0 |
| `IdCategory` | obrigatório |
| `ExpenseDate` | obrigatório |
| `Notes` | opcional |
| `Payments` | opcional — omitir mantém, enviar substitui inteiro |
| `Persons` | opcional — idem |
| `Tags` | opcional, texto — idem |

**Não se edita `Kind`, `Status` nem a recorrência.** Recusas específicas (`406`):

- gasto **cancelado** não pode ser editado;
- **as parcelas de uma compra parcelada não se editam** — `"cancele e lance de novo"`.

**Resposta:** `{ "msg": "Gasto atualizado com sucesso" }`.

### `PUT /Expenses/IdExpense=:IdExpense/series`

"Esta e as seguintes", como num calendário: age na ocorrência chamada **e em todas as posteriores**. O corte é a **data dela**, não o relógio — ocorrência passada guarda o valor que realmente valeu.

**Body:** `Description` (obrigatório), `TotalValue` (obrigatório), `IdCategory` (obrigatório), `Notes` (opcional), `Persons` (opcional).

**Sem `ExpenseDate` e sem `Payments`:** mexer na data moveria a ocorrência de mês, e a forma de pagamento se troca ocorrência a ocorrência.

**Resposta**

```json
{ "msg": "Série atualizada com sucesso", "Occurrences": 8 }
```

### `DELETE /Expenses/IdExpense=:IdExpense`

**Cancela** (`Status = 'canceled'`). Cancelar um gasto já pago é o estorno: o dinheiro volta ao saldo.

Já cancelado: `406`. **Resposta:** `{ "msg": "Gasto cancelado com sucesso" }`.

### `DELETE /Expenses/IdExpense=:IdExpense/series`

Cancela desta ocorrência para a frente.

**Resposta:** `{ "msg": "Série encerrada com sucesso", "Canceled": 8 }`.

---

## 12. ExpensePayments — `/ExpensePayments` 🔒

A perna não tem `POST` de cadastro: ela nasce com o gasto. O que existe aqui é **a lista do que cai num período** e **o verbo que move saldo**.

### `GET /ExpensePayments`

**A lista do que *sai* no mês.** `GET /Expenses` é a lista do que foi **comprado** (filtra por `ExpenseDate`); esta é a lista do que **cai** — filtra por `coalesce(DueDate, ExpenseDate)`, a mesma data que o `Spent` do orçamento e o `Balance` da conta já usam.

**É por isso que ela existe:** uma compra parcelada feita em **março** não aparece em `GET /Expenses?From=2026-08-01&To=2026-08-31`, mas a **6ª parcela dela pesa em agosto**. Quem monta o total do mês a partir da lista de gastos precisa varrer meses para trás atrás de parcelamentos abertos — e o contrato permite 120 parcelas, então acima de qualquer janela que você escolher a parcela **some do total**. Com esta rota a varredura inteira sai: uma requisição devolve tudo que cai no período, parcelas de compras antigas incluídas.

| Query | Tipo | Regra |
|---|---|---|
| `From` | CalendarDate | opcional, inclusivo |
| `To` | CalendarDate | opcional, inclusivo |
| `IncludeCanceled` | boolean | default `false` |

As duas pontas são opcionais (só `From` é "daqui para a frente", só `To` é "até aqui"), como em todas as listagens de movimento. `IncludeCanceled` segue a regra de `GET /Expenses`: sem ele, as pernas de gasto cancelado ficam de fora — **as duas listas do mesmo mês não podem discordar sobre o que contêm**.

A lista vem ordenada pela data em que a perna pesa, não pela data da compra.

**Resposta** — a perna, com o gasto de origem e o rateio dele:

```json
[{
  "IdExpensePayment": 12,
  "IdWorkspace": 1,
  "IdExpense": 4,
  "IdPaymentMethod": 3,
  "Value": 100,
  "InstallmentNumber": 6,
  "InstallmentTotal": 6,
  "ClosingDate": "2026-08-20",
  "DueDate": "2026-08-28",
  "Paid": false,
  "PaidAt": null,
  "CreatedAt": "...",
  "UpdatedAt": "...",
  "Expense": { "IdExpense": 4, "Description": "Notebook", "TotalValue": 600, "ExpenseDate": "2026-03-10", "...": "a linha inteira da seção 11" },
  "Persons": [{ "IdExpensePerson": 7, "IdWorkspace": 1, "IdExpense": 4, "IdPerson": 2, "Value": 600, "CreatedAt": "...", "UpdatedAt": "..." }]
}]
```

> **⚠️ O rateio que vem na perna é o do GASTO, não o da perna.** Numa compra de 600 em 6×, as **seis** pernas trazem o mesmo `Persons` de **600**. Somar pessoa a pessoa, perna a perna, dá **3600** — e nada estoura: o número só fica errado. Para "quanto é da Maria neste mês", rateie a perna pela proporção do gasto: `Persons[i].Value × Payment.Value ÷ Expense.TotalValue`.

**A forma de pagamento vem como `IdPaymentMethod`, não inteira.** Ela já chega completa dentro de `GET /Accounts` — repeti-la em cada perna repetiria a mesma linha dezenas de vezes na resposta de um mês. Cruze pelo id com o que você já tem em cache. O mesmo vale para a pessoa: o nome sai de `GET /Persons`.

**Sem tags.** Se a linha da sua tela mostra etiqueta, abra o gasto (`GET /Expenses/IdExpense=:IdExpense`).

### `POST /ExpensePayments/IdExpensePayment=:IdExpensePayment/pay`

**Sem body** — o instante do pagamento quem grava é o servidor. Recalcula o `Status` do gasto na mesma transaction.

**Resposta:** `{ "msg": "Parcela quitada com sucesso" }`.

`406` se: a perna não existe, o gasto está cancelado, ou a parcela **já está quitada**.

### `POST /ExpensePayments/IdExpensePayment=:IdExpensePayment/unpay`

Desquita. Existe porque um clique errado, sem ele, tiraria dinheiro da conta sem volta.

**Resposta:** `{ "msg": "Parcela desquitada com sucesso" }`.

---

## 13. Budgets — `/Budgets` 🔒

> **Entrega reduzida de propósito: o cadastro do mês é manual.** A rotina que materializaria o mês a partir da definição ainda não existe, então hoje é o usuário que informa o mês.

**Modelo:** `Budgets` é a **definição vigente** (uma linha por alvo, sem mês); `BudgetPeriods` é o **mês congelado**. Editar a definição muda **o futuro**; mês passado guarda o teto que realmente valeu. Nunca leia o limite de um mês passado da definição.

**O alvo de um teto é uma categoria OU uma pessoa**, nunca os dois — mesma tabela, mesmo `POST`, mesma lista. O `Scope` da resposta diz qual é.

| `Scope` | O que soma | Eixo |
|---|---|---|
| `category` | tudo que caiu naquela categoria | o gasto inteiro |
| `person` | tudo que foi **atribuído** àquela pessoa | o eixo **analítico** (`ExpensePersons`), nunca o financeiro |

**Um gasto conta nos dois orçamentos, e isso não é dupla contagem** — são duas perguntas diferentes sobre o mesmo dinheiro ("quanto foi de mercado" e "quanto foi da Maria"). O que **não** se pode é somar os dois num total.

> **A soma dos orçamentos de pessoa não fecha com o total gasto do mês, e isso não é bug.** O rateio entre pessoas é **opcional** no gasto: um gasto sem `Persons` não entra em orçamento de pessoa nenhum. Escreva isso na tela, ou a primeira conferência que alguém fizer vira chamado.

Orçamento é **só de gasto** — entrada não tem categoria, então não tem teto.

### `GET /Budgets?ReferenceMonth=YYYY-MM`

`ReferenceMonth` **obrigatório**, no formato `YYYY-MM`. Aqui o mês **é** a unidade (ao contrário das listagens de movimento, que usam `From`/`To`): um teto vale para o mês civil inteiro.

```json
[{
  "IdBudgetPeriod": 1,
  "IdWorkspace": 1,
  "IdBudget": 1,
  "ReferenceMonth": "2026-08-01",
  "LimitValue": 800,
  "AlertPercent": 80,
  "Status": "open",
  "ClosedAt": null,
  "CreatedAt": "...",
  "UpdatedAt": "...",
  "Scope": "category",
  "IdCategory": 1,
  "Category": { "IdCategory": 1, "Description": "Alimentação", "Color": "#FF5722", "...": "linha completa" },
  "IdPerson": null,
  "Person": null,
  "Spent": 645.9
}]
```

**`Scope`, `IdCategory`/`Category` e `IdPerson`/`Person` andam em par:** num orçamento de categoria os dois campos de pessoa são `null`, e num de pessoa os dois de categoria são `null`. Use o `Scope` para decidir qual par ler — ele existe para o cliente não ter que deduzir o tipo pelo id que veio nulo. `Category` e `Person` vêm **inteiras**, porque é o nome (e a cor) que a tela desenha.

Um orçamento cujo alvo foi **arquivado** some da lista do mês — ele não tem mais o que mostrar. A linha continua no banco: arquivar não é apagar, e o mês é histórico.

Note que `ReferenceMonth` **volta como `YYYY-MM-01`** (a coluna guarda o dia 1), embora seja enviado como `YYYY-MM`.

**`Spent` — três regras que mudam o número:**

1. **Soma pernas, não gastos.** 600 em 6× custa 100 ao orçamento de agosto, não 600 — o resto é problema do mês seguinte.
2. **A data que conta é `coalesce(DueDate, ExpenseDate)`**, então uma compra no cartão cai no mês em que a fatura vence.
3. **Conta pendente junto com pago** — ao contrário do saldo da conta. Orçamento é o que você **comprometeu**; saldo é o que você **realizou**. Só o cancelado sai.

**No `Scope: "person"` vale uma quarta regra: o comprometido é rateado pelas parcelas.**

```
Spent = Σ ( ExpensePersons.Value × ExpensePayments.Value ÷ Expenses.TotalValue )
```

600 em 6× todos da Maria dão **100 por mês** no orçamento dela — o mesmo número que a categoria enxerga. Sem o rateio, o mesmo gasto contaria 600 num orçamento e 100 no outro, e "quanto a Maria comprometeu em agosto" não teria resposta certa. O arredondamento é feito **uma vez, no fim**: numa parcela de 100 dividida 400/200 entre duas pessoas, saem `66.67` e `33.33`.

**O alerta é do cliente:** a resposta traz `LimitValue`, `Spent` e `AlertPercent`; comparar os três números é trabalho da tela.

### `POST /Budgets`

Numa transaction: resolve a definição vigente (cria, ou **atualiza** para o novo limite — só existe uma por categoria) e materializa o mês.

| Campo | Tipo | Regra |
|---|---|---|
| `IdCategory` | number | **exatamente um** dos dois |
| `IdPerson` | number | **exatamente um** dos dois |
| `ReferenceMonth` | `YYYY-MM` | obrigatório |
| `LimitValue` | number | obrigatório, 2 casas, **> 0** (teto zero é não ter teto — apague o mês) |
| `AlertPercent` | int 1–100 | default **80** |

**`IdCategory` e `IdPerson` são mutuamente exclusivos:** mandar os dois, ou nenhum, é `406`. Um alvo que não existe no seu workspace (ou que está arquivado) também é `406`.

Orçar o **mesmo alvo duas vezes no mesmo mês** responde `406` `"Este orçamento já existe neste mês."` — o conserto é editar o mês que já existe (seção 14), não cadastrar de novo. Só existe **uma definição por alvo**: cadastrar o mês seguinte reencontra a mesma e passa a valer o teto novo, sem reescrever os meses já congelados.

`Status` **não é aceito**: o mês nasce `open`.

**Resposta:** `{ "IdBudget": 1, "IdBudgetPeriod": 1 }`.

---

## 14. BudgetPeriods — `/BudgetPeriods` 🔒

**Sem `GET`** (o mês sai em `GET /Budgets`, que é onde ele significa algo) e **sem `POST`** (o mês nasce no `POST /Budgets`). As duas rotas mexem em **um mês só** — é isso que a separação em duas tabelas compra.

### `PUT /BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod`

**Body:** `LimitValue` (obrigatório, > 0), `AlertPercent` (opcional, 1–100).

**`ReferenceMonth` e `IdBudget` não são aceitos:** mover o teto de lugar é apagar este e cadastrar outro.

**Resposta:** `{ "msg": "Orçamento do mês atualizado com sucesso" }`.

### `DELETE /BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod`

**Delete físico — o único do projeto.** Um período é plano, não lançamento: nada aponta para ele e nenhum dinheiro passou por ali. **A definição sobrevive.**

**Resposta:** `{ "msg": "Orçamento do mês removido com sucesso" }`.

---

## 15. Utils — `/Utils`

| Rota | Auth | Resposta |
|---|---|---|
| `GET /Utils/ServerTime` | público | `1756512000000` (número, epoch ms) |
| `GET /Utils/Health` | público | `{ "msg": "API Funcionando", "timeStamp": 1756512000000, "serverTime": "30/08/2026 12:00:00" }` |
| `GET /Utils/Reload` | 🔒 | texto `"Mensagem socket enviada com sucesso!"` — dispara reload via socket |
| `POST /Utils/Logs` | 🔒 | texto `"Sucesso"` |

**`POST /Utils/Logs`** — body:

```json
{
  "Type": "error",
  "Log": {
    "msg": "obrigatório",
    "rota": "...",
    "methodo": "...",
    "user_id": 1,
    "stack": ["..."],
    "data": {},
    "errorMessage": "..."
  }
}
```

`Type` ∈ `info` | `error` | `userError` | `untracked` | `telemetry`. Só `Log.msg` é obrigatório.

---

## 16. O que ainda não tem API

Existe no banco, mas **sem rota**: `UserDevices`, `Notifications`, `Plans`, `Subscriptions`.

**Gestão de membros ainda não existe:** listar quem é membro, trocar o papel de alguém, remover um membro, sair de um workspace e transferir propriedade. O convite (4.1) entrega só a entrada. Revogar um convite **não** desfaz matrícula já criada.

Também não existem: `POST /Workspaces` (workspace nasce no cadastro), `GET` de `PaymentMethods` (vem embutido na conta), CRUD de `Tags` além de busca e arquivar, `GET`/`POST` de `BudgetPeriods`, e a **rotina mensal** que materializaria os orçamentos.

**Fora deste contrato:** `/Cache` (`GET /Cache/CacheName=:CacheName`, `POST /Cache`, `POST /Cache/Reset/CacheName=:CacheName`) é o subsistema interno de cache em memória sincronizado por socket. Não tem schema Joi, não é escopado por workspace e não faz parte do domínio do app — não consuma a partir das telas.

---

## 17. Cola rápida

| Método | Rota | Auth |
|---|---|---|
| POST | `/Users` | público |
| POST | `/Users/login` | público |
| POST | `/Users/logout` | público |
| GET | `/Users/getSelf` | 🔒 |
| PUT | `/Users/IdUser=:IdUser` | 🔒 |
| PUT | `/Users/updatePassword` | 🔒 |
| GET | `/UsersAuth/checkDevice/DeviceKey=:DeviceKey` | público |
| GET | `/UsersAuth/options/login/DeviceKey=:DeviceKey` | público |
| POST | `/UsersAuth/authenticate` | público |
| GET | `/UsersAuth/getSelf` | 🔒 |
| GET | `/UsersAuth/options/register` | 🔒 |
| POST | `/UsersAuth/register` | 🔒 |
| POST | `/UsersAuth/skipDevice` | 🔒 |
| DELETE | `/UsersAuth/IdUserAuth=:IdUserAuth` | 🔒 |
| GET | `/Workspaces/getSelf` | 🔒 |
| POST | `/Workspaces/switch` | 🔒 |
| POST | `/Workspaces/invite` | 🔒 `owner` |
| GET | `/Workspaces/invites` | 🔒 `owner` |
| GET | `/Workspaces/invite/Hash=:Hash` | público |
| POST | `/Workspaces/join` | 🔒 |
| DELETE | `/Workspaces/invite/IdWorkspaceInvite=:Id` | 🔒 `owner` |
| PUT | `/Workspaces` | 🔒 |
| GET | `/Accounts` | 🔒 |
| POST | `/Accounts` | 🔒 |
| PUT | `/Accounts/IdAccount=:IdAccount` | 🔒 |
| DELETE | `/Accounts/IdAccount=:IdAccount` | 🔒 |
| POST | `/PaymentMethods` | 🔒 |
| PUT | `/PaymentMethods/IdPaymentMethod=:IdPaymentMethod` | 🔒 |
| DELETE | `/PaymentMethods/IdPaymentMethod=:IdPaymentMethod` | 🔒 |
| GET | `/Categories` | 🔒 |
| POST | `/Categories` | 🔒 |
| PUT | `/Categories/IdCategory=:IdCategory` | 🔒 |
| DELETE | `/Categories/IdCategory=:IdCategory` | 🔒 |
| GET | `/Persons` | 🔒 |
| POST | `/Persons` | 🔒 |
| PUT | `/Persons/IdPerson=:IdPerson` | 🔒 |
| DELETE | `/Persons/IdPerson=:IdPerson` | 🔒 |
| GET | `/Tags/search` | 🔒 |
| DELETE | `/Tags/IdTag=:IdTag` | 🔒 |
| GET | `/Inflows` | 🔒 |
| GET | `/Inflows/IdInflow=:IdInflow` | 🔒 |
| POST | `/Inflows` | 🔒 |
| POST | `/Inflows/batch` | 🔒 |
| PUT | `/Inflows/IdInflow=:IdInflow` | 🔒 |
| POST | `/Inflows/IdInflow=:IdInflow/receive` | 🔒 |
| POST | `/Inflows/IdInflow=:IdInflow/unreceive` | 🔒 |
| DELETE | `/Inflows/IdInflow=:IdInflow` | 🔒 |
| GET | `/Expenses` | 🔒 |
| GET | `/Expenses/IdExpense=:IdExpense` | 🔒 |
| POST | `/Expenses` | 🔒 |
| PUT | `/Expenses/IdExpense=:IdExpense` | 🔒 |
| PUT | `/Expenses/IdExpense=:IdExpense/series` | 🔒 |
| DELETE | `/Expenses/IdExpense=:IdExpense` | 🔒 |
| DELETE | `/Expenses/IdExpense=:IdExpense/series` | 🔒 |
| GET | `/ExpensePayments` | 🔒 |
| POST | `/ExpensePayments/IdExpensePayment=:Id/pay` | 🔒 |
| POST | `/ExpensePayments/IdExpensePayment=:Id/unpay` | 🔒 |
| GET | `/Budgets` | 🔒 |
| POST | `/Budgets` | 🔒 |
| PUT | `/BudgetPeriods/IdBudgetPeriod=:Id` | 🔒 |
| DELETE | `/BudgetPeriods/IdBudgetPeriod=:Id` | 🔒 |
| GET | `/Utils/ServerTime` | público |
| GET | `/Utils/Health` | público |
| GET | `/Utils/Reload` | 🔒 |
| POST | `/Utils/Logs` | 🔒 |

---

## 18. Changelog

Toda mudança da API que o front enxerga entra aqui, **da mais recente para a mais antiga**. O
resto do documento descreve sempre o estado *atual*; esta seção é o que diz **o que mudou desde
a última vez que você leu** e o que precisa mudar do seu lado.

Uma entrada tem sempre as mesmas quatro partes: a data, a rota afetada, **se quebra ou não** o
que já está escrito, e a ação do front. Mudança que não afeta o front (refatoração interna,
teste, índice de banco) **não** entra aqui.

| Marcador | Significado |
|---|---|
| 🔴 **Quebra** | Código do front que funcionava para de funcionar, ou passa a mostrar número errado. Exige ação |
| 🟡 **Comportamento** | Nada quebra na chamada, mas a resposta mudou de significado. Confira antes de ignorar |
| 🟢 **Adição** | Campo, rota ou parâmetro novo. Compatível com o que já existe |

---

### 2026-09-05 — `/Budgets`: o teto agora pode ser **de uma pessoa**, não só de uma categoria

🟢 **Adição** — ver a seção 13, `/Budgets`.

**O que entrou.** O mesmo teto mensal que existia por categoria, agora somando tudo que é **atribuído a uma pessoa** — o eixo analítico (`ExpensePersons`), não o financeiro.

- **`POST /Budgets`** passa a aceitar `IdPerson` **no lugar de** `IdCategory`. Os dois são **mutuamente exclusivos**: mandar os dois, ou nenhum, é `406`. O resto do corpo não muda.
- **`GET /Budgets`** devolve os dois tipos **na mesma lista** e cada linha ganha três campos: **`Scope`** (`"category"` | `"person"`), **`IdPerson`** e **`Person`** (a linha inteira). `IdCategory` e `Category` passam a vir **`null`** nas linhas de `Scope: "person"`.

**Ação do front:** ler o `Scope` antes de desenhar a linha, em vez de assumir que `Category` está sempre preenchida. Quem só quer o comportamento de hoje pode filtrar `Scope === "category"` e nada muda — nenhum orçamento de pessoa existe até alguém cadastrar o primeiro.

**O `Spent` da pessoa é rateado pelas parcelas:** `ExpensePersons.Value × ExpensePayments.Value ÷ Expenses.TotalValue`. 600 em 6× todos da Maria dão **100 por mês**, o mesmo número que a categoria enxerga — sem o rateio o mesmo gasto contaria 600 num orçamento e 100 no outro. Arredondado uma vez, no fim.

**Um gasto conta nos dois orçamentos, e isso não é dupla contagem** — são duas perguntas sobre o mesmo dinheiro. **Não some os dois num total.**

> **⚠️ A soma dos orçamentos de pessoa não fecha com o total gasto do mês, e isso não é bug.** O rateio é **opcional** no gasto: um gasto sem `Persons` não entra em orçamento de pessoa nenhum. Deixe isso escrito na tela.

🟡 **A `msg` do mês repetido mudou:** orçar o mesmo alvo duas vezes no mesmo mês respondia `"Esta categoria já tem orçamento neste mês."` e agora responde `"Este orçamento já existe neste mês."` — a mensagem não podia continuar falando em categoria. Continua `406`, no mesmo caso. Se você mostrava a `msg` do servidor, nada a fazer; se comparava o texto, ajuste.

**Não mudou:** `PUT` e `DELETE /BudgetPeriods` servem aos dois tipos sem nenhuma diferença (é o motivo de o alvo novo ter entrado na mesma tabela), e o `Spent` de categoria continua contando exatamente como contava.

### 2026-09-05 — `/Accounts` e `/PaymentMethods`: conta "apenas cartão", e quem aceita cartão de crédito

🟢 **Adição** na seção 5 e 🔴 **Quebra** na seção 6.

**Entrou o `Type='card'`.** O caso é o **vale-alimentação**: um cartão com saldo próprio, sem conta bancária atrás e **sem fatura**. Até aqui o cadastro obrigava a escolher entre `checking` (que nasce com pix + débito) e `cash` (que nasce com "Dinheiro"), e nenhum dos dois descreve um vale.

A conta `card` nasce com **uma forma de pagamento só**, `Kind='debit'`, **com o nome da conta** — "Vale Alimentação" é o que o usuário quer ver na hora de escolher como pagou. Não há `Kind='voucher'`: vale não tem fatura, o gasto sai do saldo no ato, e isso já é o que `debit` significa. `InitialBalance` funciona normalmente e é o saldo do vale, com a trava de sempre (congela no primeiro lançamento).

**Ação do front:** acrescentar a opção no seletor de tipo de conta do cadastro. Nada mais muda para quem já usa `checking` e `cash` — os dois continuam criando exatamente o que criavam.

🔴 **`POST /PaymentMethods` passa a responder `406` para cartão de crédito fora de conta corrente.** `IdAccount` de uma conta `cash` **ou** `card` devolve `"Cartão de crédito só existe em conta corrente."` As duas são contas de saldo fechado e uma fatura nelas não teria de onde sair.

**Ação do front:** no cadastro do cartão de crédito, oferecer **só as contas `checking`** no seletor de conta. Na prática esse caminho nunca foi oferecido, mas a chamada existia e passava — por isso entra como quebra, e não como comportamento.

**É regra nova para o `cash` também**, não só para o tipo que está nascendo: fazer valer para um e não para o outro deixaria a regra arbitrária. **Linhas que já existem continuam valendo:** um cartão criado antes numa conta `cash` não é apagado nem migrado — gasto lançado aponta para ele.

🟡 **`PUT /Accounts` passa a recusar a troca de `Type` em conta já movimentada**, com `406` `"Esta conta já tem lançamentos: o tipo dela não pode mais ser alterado."` — a mesma trava que o `InitialBalance` já tinha, e pela mesma pergunta ("esta conta tem movimento?"). Enquanto a conta está vazia a troca passa, e **não cria nem apaga forma de pagamento nenhuma**: as que nasceram ficam. Desabilite o campo `Type` junto com o `InitialBalance`.

### 2026-09-05 — `GET /ExpensePayments`: a lista do que **cai** no mês, com a parcela da compra antiga junto

🟢 **Adição** — ver a seção 12, `/ExpensePayments`.

**O que entrou.** `GET /ExpensePayments?From=&To=&IncludeCanceled=`. Devolve as **pernas** cuja `coalesce(DueDate, ExpenseDate)` cai no intervalo, cada uma com o **gasto de origem** (`Expense`) e o **rateio dele** (`Persons`). As duas pontas do período são opcionais e `IncludeCanceled` segue a mesma regra de `GET /Expenses`.

**O furo que ela fecha — leia mesmo que você não vá usar a rota agora.** `GET /Expenses` filtra por `ExpenseDate`: uma compra parcelada de **março não aparece em agosto**, mas a 6ª parcela dela **pesa** em agosto. Quem monta o total do mês pela lista de gastos tem que varrer meses para trás atrás de parcelamentos abertos, e o contrato permite **120 parcelas** — acima da janela que você escolher, a parcela **some do total do mês**. É a única lacuna em que o número na tela fica *errado*, e não só ausente.

**Ação do front:** trocar por esta rota a varredura de meses para trás (`INSTALLMENT_LOOKBACK_MONTHS`) **e** o `GET /Expenses/IdExpense=:IdExpense` por linha que preenchia as colunas de pessoa e forma de pagamento. Uma requisição resolve as duas coisas — inclusive no Relatório, que olha período e hoje paga esse custo por mês do intervalo.

> **⚠️ O `Persons` que vem na perna é o do GASTO, não o da perna.** Numa compra de 600 em 6×, as seis pernas trazem o mesmo rateio de **600**. Somar pessoa a pessoa, perna a perna, dá **3600** — e **nada estoura**: o número só fica errado. Para "quanto é da Maria neste mês", rateie: `Persons[i].Value × Payment.Value ÷ Expense.TotalValue`.

**A forma de pagamento vem como `IdPaymentMethod`**, não a linha inteira — ela já está em `GET /Accounts`. Idem a pessoa, que está em `GET /Persons`. **Não há tags** na resposta.

**Não mudou nada:** `GET /Expenses` continua exatamente como estava — é a lista das **compras**, e as duas convivem. O `pay`/`unpay` também não muda.

### 2026-09-04 — `POST /Inflows/batch`: grava várias entradas de uma vez, tudo ou nada

🟢 **Adição** — ver a seção 10, `/Inflows`.

**O que entrou.** `POST /Inflows/batch`, com `{ "Inflows": [ ...até 100 itens... ] }`. **Cada item é exatamente o body do `POST /Inflows`**, validado pelo mesmo schema. Resposta: `{ msg, IdInflows: [...] }`, com os ids **na ordem em que você mandou**.

**É tudo ou nada.** Um item recusado derruba o lote inteiro — nenhuma linha é gravada, nem as que estavam certas. A `msg` diz qual item foi: `"Item 2: ..."`, contando a partir de 1 (a posição `1` do array). Destaque essa linha no formulário.

**Ação do front:** a tela de "repetir o mês passado" monta as cópias no cliente — escolha do usuário item a item, datas avançadas, dia aparado no mês curto, rateio junto — e manda tudo numa chamada. Depois do `200`, invalide o cache do mês com os `IdInflows` que voltaram.

**Desabilite o botão enquanto a requisição está em voo.** Não há idempotência do lado do servidor e não vai haver: repetir o lote cria tudo de novo. Não existe repetição silenciosa a evitar aqui — só duplo clique, que é do cliente.

**Todas nascem `pending`**, como no `POST` avulso: nenhum saldo se move na gravação, o que torna o erro fácil de refazer.

> **`POST /Inflows/clone` não vai existir.** Ele foi substituído por esta rota: quem escolhe o que clonar é o usuário, e ao servidor sobrou gravar. Fica registrado para ninguém esperar por ele.

**Não mudou:** o `POST /Inflows` avulso, nem nenhuma validação — o schema do item é literalmente o mesmo objeto.

### 2026-09-04 — `/Inflows`: dá para **desfazer** um recebimento

🟢 **Adição** — ver a seção 10, `/Inflows`.

**O que entrou.** `POST /Inflows/IdInflow=:IdInflow/unreceive`, sem body. Volta o `Status` para `pending`, limpa o `ReceivedAt` e o dinheiro sai do saldo. É a simétrica exata do `receive`, do mesmo jeito que o `unpay` é a do `pay` na perna do gasto.

**Ação do front:** ligar o botão de desfazer da tela de Renda nesta rota. Depois do `200`, **releia `GET /Accounts`** — o `Balance` volta sozinho ao valor de antes.

**Não lance nada para compensar.** O saldo não é guardado: ele é somado dos lançamentos `received` a cada leitura, então voltar o `Status` já é a retirada. Uma entrada de sinal contrário criada "para estornar" contaria duas vezes.

Numa **transferência**, desfazer devolve as duas contas de uma vez.

`406` quando a entrada não existe no workspace, **não está recebida**, ou está cancelada — cada caso com a sua `msg`, espelhando as que o `receive` já tinha.

**Não mudou:** o `receive`, o cálculo do saldo, e o fato de que editar uma entrada já recebida continua permitido.

### 2026-09-04 — `/PaymentMethods`: `Brand` e `LastDigits` deixam de existir

🔴 **Quebra** — ver as seções 5, `/Accounts`, e 6, `/PaymentMethods`.

**As duas colunas foram derrubadas do banco.** Elas somem da resposta e deixam de ser aceitas na entrada:

- **Ler:** a forma de pagamento embutida em `GET /Accounts` **não traz mais** `Brand` nem `LastDigits`. Quem lê qualquer um dos dois passa a receber `undefined`.
- **Escrever:** `POST` e `PUT /PaymentMethods` com qualquer um dos dois respondem `406` (`"Dados de entrada inválidos."`).

**Ação do front:** tirar os dois campos do formulário de cartão e de qualquer leitura. Quem mostrava "Nubank ****1234" põe isso no `Name`, que é o campo que o usuário escreve e o único que o sistema usa para identificar a forma de pagamento. O front já os havia removido de tudo — esta entrada existe para o contrato parar de prometê-los.

**Por que.** Nenhuma regra do sistema lia qualquer um dos dois: a fatura sai de `DueDay`/`ClosingOffsetDays`, o saldo sai da perna, o rateio sai do gasto. E o `LastDigits` ainda carregava quatro dígitos de um cartão real gravados em texto puro para servir de rótulo — dado sensível guardado sem nada em troca.

**Os dados não voltam.** As colunas foram apagadas; a bandeira e o final que estavam gravados se foram junto. Nada mais muda: `DueDay`, `ClosingOffsetDays`, `Name`, `IconPath`, `Color` e `Position` seguem iguais.

### 2026-09-04 — `POST /Expenses`: `Occurrences` sai do corpo e a janela do gasto fixo passa a ser do servidor

🔴 **Quebra** — ver a seção 11, `/Expenses`.

**O que quebrou.** `POST /Expenses` **não aceita mais `Occurrences`**. Mandar o campo agora responde `406` (`"Dados de entrada inválidos."`), inclusive com o valor que era o default.

**O que entrou no lugar.** A janela virou **constante do servidor: 12 ocorrências, contando a raiz.** O que limita a série passa a ser essa janela **ou** o `RecurrenceEndDate`, o que vier primeiro — e o `RecurrenceEndDate` continua no corpo, igual. A recorrência **não** fica aberta; nem antes ficava.

**A resposta não muda.** `POST /Expenses` continua devolvendo `{ IdExpense, Occurrences }`, e `Occurrences` continua sendo quantas linhas de gasto nasceram. O mesmo vale para `PUT .../series`.

**Ação do front:** parar de enviar `Occurrences` — quem já parou não precisa fazer nada. Continue lendo o número **da resposta** para dizer quantas ocorrências foram criadas; a tela não precisa saber a janela antes de salvar, ela pergunta gravando. Se você quer uma série mais curta, mande `RecurrenceEndDate`.

**Por que mudou.** Quantas ocorrências nascem de uma vez é regra de domínio, não escolha de quem lança um gasto: quem cadastra um aluguel quer "todo mês", não "doze". Enquanto o campo existia no contrato e o cliente não o mandava, quem lesse o contrato para escrever tela nova escreveria errado.

### 2026-09-04 — `POST /Users`: `IdWorkspace` sai do cadastro; entrar em workspace alheio agora exige **convite**

🔴 **Quebra** · 🟢 **Adição** — ver as seções 2, `/Users`, e 4.1, convites.

**O que quebrou.** `POST /Users` **não aceita mais `IdWorkspace`**. Mandar o campo agora responde `406` (`"Dados de entrada inválidos."`), e nenhuma matrícula nasce dele.

**Por que.** A rota é pública e esse campo entrava direto como matrícula **`owner`** do workspace informado, sem convite e sem conferência de dono. `IdWorkspace` é inteiro sequencial: adivinhava-se contando. Era a pendência que segurava o deploy, e ela está fechada.

**O que entrou no lugar: `InviteHash`.** Mesmo campo opcional, outro valor — o hash de 32 bytes de uma linha de convite, que só existe se alguém criou. Com ele, o cadastro entra no workspace do convite com o papel que a **linha** manda; sem ele, nasce o workspace próprio, como sempre.

**Cinco rotas novas em `/Workspaces`** (seção 4.1): criar convite, listar pendentes, descrever um convite pelo hash (**pública**), aceitar quem já tem conta, e revogar. **A API não manda e-mail** — ela devolve o hash e quem entrega o link é o usuário.

**Ação do front:**

1. **Tirar `IdWorkspace` de qualquer chamada de cadastro.** Se a sua tela ainda tem esse campo, ele agora quebra o cadastro inteiro em vez de fazer nada.
2. **Tela de convite (dono):** `POST /Workspaces/invite` com `{ Email, Role }`, montar a URL da sua tela de aceite com o `Hash` que voltou, e oferecer copiar/compartilhar. `GET /Workspaces/invites` lista os pendentes com o `Hash` de cada um, para reenviar; `DELETE` revoga.
3. **Tela de aceite (convidado), pública:** `GET /Workspaces/invite/Hash=:Hash` para mostrar quem convidou, para qual workspace e **para qual e-mail** — sem sessão. Daí saem dois caminhos: quem não tem conta vai para o cadastro com `InviteHash`; quem já tem entra e chama `POST /Workspaces/join`.
4. **Depois do `join`, chame `POST /Workspaces/switch`.** O `join` **não** troca a sessão de propósito. Sem o switch, o usuário aceita e continua vendo o workspace antigo — que é o bug mais provável desta entrega.
5. **Trate os `406` pela `msg`.** Convite inexistente, revogado, expirado, já usado e e-mail diferente são cinco mensagens distintas, e cada uma manda o usuário para um lugar diferente.

**A regra que não é óbvia: o e-mail tem que bater.** O link é compartilhável por desenho, então o hash sozinho não é a tranca — quem recebesse o encaminhamento entraria. A API compara o e-mail do convite com o da conta que aceita (o da sessão no `join`, o do corpo no cadastro). Deixe isso claro na tela: mostre o `Email` que o `GET` público devolve, com um "entre com esta conta".

**Convidar o mesmo e-mail duas vezes renova o convite**, com hash novo — o link anterior morre. Não gere dois links esperando que os dois funcionem.

**Não mudou:** o `POST /Users` sem convite, o login, o `switch`, e o formato de `GET /Workspaces/getSelf` (que agora simplesmente pode devolver mais de um workspace).

### 2026-09-04 — `POST /Users/logout`: agora existe como sair da sessão

🟢 **Adição** — ver a seção 2, `/Users`.

**O que entrou.** `POST /Users/logout`, **pública**, sem body. A resposta é `200` com `{ "msg": "Sessão encerrada com sucesso" }` e um `Set-Cookie` que expira o `token`. Depois dela, toda rota 🔒 responde `401`.

**Por que ela não exige token.** Exigir sessão para encerrar sessão responde `401` no caso em que o usuário mais precisa sair — token expirado, cookie meio apagado, aba antiga —, e o botão "Sair" trava sem ter o que fazer. Não há o que autorizar aqui: o efeito da rota é apagar um cookie do próprio chamador.

**Ação do front:** trocar qualquer limpeza local de sessão pela chamada à rota. O cookie é `HttpOnly`, então o `document.cookie` **nunca** conseguiu apagá-lo — quem hoje só limpa o estado da aplicação está deixando a sessão viva no navegador. Depois do `200`: limpe o cache local e redirecione para o login.

**O que não mudou:** nada. Nenhuma rota existente teve resposta, corpo ou status alterados.

**Limite conhecido:** não há lista de revogação. O token segue válido até o `exp` (24h) para quem tiver copiado o valor antes — o que exige acesso ao aparelho, já que ele é `HttpOnly`. Se "encerrar sessões nos outros aparelhos" virar requisito, é aí que entra uma lista de revogação, não antes.

### 2026-09-03 — `GET /Expenses`: `IncludeCanceled` traz os cancelados junto com o resto

🟢 **Adição** — ver a seção 11, `/Expenses`.

**O que entrou.** Um booleano opcional na query, `IncludeCanceled`, default `false`. Com ele em `true` a lista vem completa, cancelados incluídos.

**Nada do que já existe muda.** `IncludeCanceled` ausente ou `false` devolve exatamente a resposta de hoje, e `Status=canceled` continua trazendo só os cancelados. `Status` e `IncludeCanceled` podem vir juntos, e **`Status` ganha**: ele é sempre o recorte de um estado só.

**Ação do front:** para o filtro de status multi-seleção, pare de mandar `Status` e mande `IncludeCanceled=true`, separando por `Status` no cliente. Quem não usa o filtro não muda nada.

**Por que um booleano e não `Status` aceitando lista** — com o booleano o app pede **o mês uma vez** e aplica os cinco filtros de tela sobre a lista em cache: uma chave de cache por mês, reaproveitada entre Início, Gastos e Relatório. Com `Status` em lista, cada combinação de filtro vira uma consulta e uma chave nova. A alternativa do lado do cliente — disparar as duas consultas e fundir por id — dobrava a requisição do mês e mudava de lugar uma regra ("o que a lista contém") que é do servidor.

### 2026-09-03 — `/PaymentMethods`: o cartão passa a ser descrito pelo **vencimento e uma folga**, não por um dia de fechamento

🔴 **Quebra** — ver as seções 6, `/PaymentMethods`, e 11, `/Expenses`.

**`ClosingDay` deixou de existir.** No lugar entrou **`ClosingOffsetDays`**: quantos dias antes do vencimento a fatura fecha, default `7`, aceito de 1 a 28. `DueDay` continua igual e passa a ser o único campo obrigatório dos dois.

**Ação do front:**

- **`POST` e `PUT /PaymentMethods`:** trocar `ClosingDay` por `ClosingOffsetDays`. Mandar `ClosingDay` agora é `406`. Se o formulário só pedir o vencimento, **omita a folga** e deixe o default de 7 valer.
- **Ler a linha da forma de pagamento** (dentro de `GET /Accounts`): `ClosingDay` sumiu da resposta. Quem mostrava "fecha dia 20" tem que calcular a data a partir de `DueDay − ClosingOffsetDays`, lembrando que ela **muda de mês para mês**.
- **Tela de cadastro:** pergunte o **vencimento**, que é o que o usuário sabe de cabeça, e deixe a folga num campo avançado já preenchido com 7.

**Por que mudou** — o modelo pedia um dado que o usuário não tem: nenhum emissor brasileiro deixa escolher o dia do fechamento, todos pedem o vencimento e fecham N dias antes. Pior, um fechamento guardado como dia do mês precisava ser grampeado onde o dia não existe (dia 30 em fevereiro) enquanto a comparação que decide a fatura seguia usando o número original — as duas metades da regra passavam a falar de datas diferentes. E a rolagem do vencimento tinha que ser inferida de dois números soltos, em vez de ser a própria subtração.

**Os cálculos de `ClosingDate`/`DueDate` das pernas mudam junto** (seção 11), mesmo para cartões cujo cadastro não for tocado, porque a regra de qual fatura recebe a compra é outra. Um cartão que vence dia 10 com folga de 7 agora fecha dia 3: a compra do dia 2 vence **no mesmo mês**, onde antes o par `fecha 30 / vence 10` sempre a jogava para o mês seguinte. Confira as datas que a sua tela mostra depois de subir.

**Gastos já lançados não são recalculados pela API.** As pernas guardam as datas do momento do lançamento; nada as revisita.

### 2026-08-31 — `GET /Accounts`: o saldo agora é sempre o saldo **de um mês**

🟡 **Comportamento** · 🟢 **Adição** — ver a seção 5, `/Accounts`.

**O que estava errado.** O `Balance` filtrava só por *estado* (`Status='received'` na entrada,
`Paid=true` na perna de gasto) e por **data nenhuma**. Estado não é data: uma entrada com
`CompetenceDate` em setembro que já tivesse sido marcada como recebida entrava no saldo exibido
em agosto, e quitar hoje uma parcela que vence em novembro tirava o dinheiro do saldo de agosto.
O saldo ficava plausível e errado.

**O que mudou.**

- `GET /Accounts` passou a aceitar `?ReferenceMonth=YYYY-MM` (**opcional**, default o mês
  corrente). Ele recorta **o `Balance`, não a lista** — as contas são as mesmas em qualquer mês.
- O corte vai até o **último dia** do mês pedido e lê **a data do lançamento**: `CompetenceDate`
  na entrada, `DueDate` (ou a data do gasto, fora de cartão) na perna. **Não** a data em que se
  clicou em receber/quitar.
- O saldo de abertura obedece ao mesmo corte quando a conta tem `InitialBalanceDate`: conta
  aberta em agosto vem com `Balance: 0` em março. Sem `InitialBalanceDate` a abertura conta em
  qualquer mês, como antes.
- `ReferenceMonth` fora do formato `YYYY-MM` responde `406` (`"Parâmetros inválidos na Query."`).

**Ação do front.**

1. Na tela que tem seletor de mês, **mande o mês exibido**: `GET /Accounts?ReferenceMonth=2026-08`.
   Sem o parâmetro você recebe o mês corrente, que é o comportamento certo para quem abre o app.
2. Se você exibe saldo junto de uma lista filtrada por `From`/`To`, os dois recortes são
   diferentes de propósito — saldo é **posição** (mês fechado), lista é **fatia** (intervalo
   livre). Não tente derivar um do outro.
3. Números que pareciam certos podem mudar: um saldo que incluía lançamento de mês futuro agora
   não inclui mais. Isso é a correção, não uma regressão.

**Não mudou:** a forma da linha de `Accounts`, o `POST`/`PUT`/`DELETE`, nem a regra de que
pendente é previsão e não entra no saldo.
