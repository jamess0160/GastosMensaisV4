# API — Contrato para o front-end

Documento gerado a partir dos `*.route.ts` e `*.schema.ts` do repositório. Ele descreve **o que a API aceita e o que devolve hoje**. Toda validação citada aqui é a que roda de verdade (Joi, em `<Feature>.schema.ts`), não uma intenção.

---

## 1. Convenções gerais

### 1.1 Base URL

Em produção o front é servido em `https://www.gastosmensais.com.br` e a API em `https://www.gastosmensais.com.br/api`. **Mesma origem** — sem CORS, sem preflight.

Os caminhos deste documento são relativos a essa base: `/Accounts` aqui é `https://www.gastosmensais.com.br/api/Accounts` no navegador.

> **Mudança de contrato:** o prefixo `/Base` foi removido de todas as rotas. Onde antes era `/api/Base/Accounts`, agora é `/api/Accounts`. Não há rota mantida no caminho antigo — o `/Base` simplesmente não existe mais e responde 404.

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
| `IdWorkspace` | number | opcional — entrar em workspace existente |

> ⚠️ **Não pré-hasheie nem criptografe a senha no cliente.** O que a API recebe vira a credencial efetiva: um hash vazado seria reproduzido como está. O bcrypt (custo 12) roda no servidor.

> ⚠️ **`IdWorkspace` é uma pendência conhecida de segurança:** hoje entra direto como matrícula `owner`, sem convite nem conferência. Não use até virar convite assinado.

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

## 4. Workspaces — `/Workspaces` 🔒

Não há `POST`: hoje é um workspace por usuário e ele nasce no cadastro.

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

## 5. Accounts — `/Accounts` 🔒

Uma conta **não tem saldo guardado**. `Balance` é calculado a cada leitura.

### `GET /Accounts`

Sem query. Devolve as contas do workspace com as formas de pagamento embutidas.

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

**`Balance`** = `InitialBalance` + entradas recebidas − transferências que saíram − **pernas de gasto pagas**. Pendente é previsão e **não entra**. Não é coluna: não tente recalcular somando lançamentos no cliente.

`Type` ∈ `checking` | `cash`. **Não existe conta de tipo cartão** — cartão é forma de pagamento.

### `POST /Accounts`

| Campo | Tipo | Regra |
|---|---|---|
| `Name` | string | obrigatório, ≤255 |
| `Type` | `checking` \| `cash` | default `checking` |
| `IconPath` | string \| null | ≤255, default `null` |
| `Color` | `#RRGGBB` \| null | default `null` |
| `InitialBalance` | number | 2 casas, default `0`. **Negativo é válido** (cheque especial) |
| `InitialBalanceDate` | CalendarDate \| null | default `null` |
| `Position` | int \| null | default `null` |

**Resposta:** `{ "IdAccount": 1 }`. A conta já nasce com uma forma **pix** e uma **débito** — busque-as no `GET`.

### `PUT /Accounts/IdAccount=:IdAccount`

`Name` obrigatório; `Type`, `IconPath`, `Color`, `InitialBalance`, `InitialBalanceDate`, `Position` opcionais (omitido = mantém).

> **`InitialBalance` congela depois do primeiro lançamento:** alterá-lo responde `406` `"Esta conta já tem lançamentos: o saldo inicial não pode mais ser alterado."` Desabilite o campo na tela quando a conta já tiver movimento.

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
  "ClosingDay": 20,
  "DueDay": 27,
  "Brand": "Mastercard",
  "LastDigits": "1234",
  "IconPath": null,
  "Color": null,
  "Position": 1,
  "Active": true,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}
```

`Kind` ∈ `pix` | `debit` | `credit_card`. `ClosingDay`/`DueDay` só fazem sentido em `credit_card` — nas outras são `null`.

### `POST /PaymentMethods`

**Só cartão de crédito.** Pix e débito nascem com a conta e não se criam pela mão.

| Campo | Tipo | Regra |
|---|---|---|
| `IdAccount` | number | obrigatório |
| `Name` | string | obrigatório, ≤255 |
| `Kind` | `credit_card` | obrigatório, único valor aceito |
| `ClosingDay` | int 1–31 | **obrigatório** |
| `DueDay` | int 1–31 | **obrigatório** |
| `Brand` | string \| null | ≤100, default `null` |
| `LastDigits` | string \| null | exatamente 4 dígitos, default `null` |
| `IconPath` | string \| null | ≤255, default `null` |
| `Color` | `#RRGGBB` \| null | default `null` |
| `Position` | int \| null | default `null` |

**Resposta:** `{ "IdPaymentMethod": 3 }`.

### `PUT /PaymentMethods/IdPaymentMethod=:IdPaymentMethod`

`Name` obrigatório; `ClosingDay`, `DueDay`, `Brand`, `LastDigits`, `IconPath`, `Color`, `Position` opcionais.

**`Kind` e `IdAccount` não são aceitos:** um pix não vira cartão e um cartão não muda de conta — as duas trocas reescreveriam o significado das compras já lançadas nele. Mandar `null` em `ClosingDay`/`DueDay` de um cartão dá `406`.

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
| `fixed` | Corrente de ocorrências **reais** | `RecurrenceDay`, `RecurrenceEndDate`, `Occurrences` |

`installment` aceita **uma única perna** (uma forma de pagamento). O `TotalValue` continua sendo o **total da compra**, nunca o da parcela — e o centavo que sobra vai na **primeira** parcela.

`fixed` **não é molde + instâncias**: toda linha é um gasto de verdade. A raiz tem `IdParentExpense: null` e carrega a recorrência; as geradas apontam para ela.

### 11.3 `Status` é derivado — nunca envie

`Status` ∈ `pending` | `paid` | `canceled`, calculado num único lugar e recalculado a cada quitação. **Só chega a `paid` quando TODAS as pernas estão pagas** — quitar 1 de 6 parcelas deixa a compra `pending`.

### `GET /Expenses`

**Query** (todos opcionais): `From`, `To` (`YYYY-MM-DD`, inclusivos, sobre `ExpenseDate`), `Status`, `Kind`, `IdCategory`.

Sem `Status`, os cancelados ficam de fora.

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

> Em cartão, um dia de diferença na compra vira **um mês** de diferença no caixa: comprou até o dia do fechamento, cai na fatura deste mês; depois dele, na do mês seguinte.

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
| `RecurrenceEndDate` | CalendarDate \| null | **só** em `fixed` |
| `Occurrences` | int 1–60 | **só** em `fixed`, default **12** |

`Paid: true` é o caso do débito, que já sai pago no ato; no cartão a perna fica em aberto e se quita pela rota da perna.

**`Tags` é texto puro.** A API reusa a tag existente (ignorando maiúsculas), desarquiva a arquivada ou insere a nova — tudo dentro da transaction do gasto. É o **único** lugar em que uma tag nasce.

`Status` **não é aceito**.

**Resposta**

```json
{ "IdExpense": 1, "Occurrences": 12 }
```

`Occurrences` = quantas linhas de gasto nasceram: `1`, ou a série inteira em `fixed`.

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

A perna não tem `GET` nem `POST` de cadastro: ela nasce com o gasto e sai embutida nele. O que existe aqui é **o verbo que move saldo**.

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

**Modelo:** `Budgets` é a **definição vigente** (uma linha por categoria, sem mês); `BudgetPeriods` é o **mês congelado**. Editar a definição muda **o futuro**; mês passado guarda o teto que realmente valeu. Nunca leia o limite de um mês passado da definição.

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
  "IdCategory": 1,
  "Category": { "IdCategory": 1, "Description": "Alimentação", "Color": "#FF5722", "...": "linha completa" },
  "Spent": 645.9
}]
```

Note que `ReferenceMonth` **volta como `YYYY-MM-01`** (a coluna guarda o dia 1), embora seja enviado como `YYYY-MM`.

**`Spent` — três regras que mudam o número:**

1. **Soma pernas, não gastos.** 600 em 6× custa 100 ao orçamento de agosto, não 600 — o resto é problema do mês seguinte.
2. **A data que conta é `coalesce(DueDate, ExpenseDate)`**, então uma compra no cartão cai no mês em que a fatura vence.
3. **Conta pendente junto com pago** — ao contrário do saldo da conta. Orçamento é o que você **comprometeu**; saldo é o que você **realizou**. Só o cancelado sai.

**O alerta é do cliente:** a resposta traz `LimitValue`, `Spent` e `AlertPercent`; comparar os três números é trabalho da tela.

### `POST /Budgets`

Numa transaction: resolve a definição vigente (cria, ou **atualiza** para o novo limite — só existe uma por categoria) e materializa o mês.

| Campo | Tipo | Regra |
|---|---|---|
| `IdCategory` | number | obrigatório |
| `ReferenceMonth` | `YYYY-MM` | obrigatório |
| `LimitValue` | number | obrigatório, 2 casas, **> 0** (teto zero é não ter teto — apague o mês) |
| `AlertPercent` | int 1–100 | default **80** |

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

Também não existem: `POST /Workspaces` (workspace nasce no cadastro), `GET` de `PaymentMethods` (vem embutido na conta), CRUD de `Tags` além de busca e arquivar, `GET`/`POST` de `BudgetPeriods`, e a **rotina mensal** que materializaria os orçamentos.

**Fora deste contrato:** `/Cache` (`GET /Cache/CacheName=:CacheName`, `POST /Cache`, `POST /Cache/Reset/CacheName=:CacheName`) é o subsistema interno de cache em memória sincronizado por socket. Não tem schema Joi, não é escopado por workspace e não faz parte do domínio do app — não consuma a partir das telas.

---

## 17. Cola rápida

| Método | Rota | Auth |
|---|---|---|
| POST | `/Users` | público |
| POST | `/Users/login` | público |
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
| PUT | `/Inflows/IdInflow=:IdInflow` | 🔒 |
| POST | `/Inflows/IdInflow=:IdInflow/receive` | 🔒 |
| DELETE | `/Inflows/IdInflow=:IdInflow` | 🔒 |
| GET | `/Expenses` | 🔒 |
| GET | `/Expenses/IdExpense=:IdExpense` | 🔒 |
| POST | `/Expenses` | 🔒 |
| PUT | `/Expenses/IdExpense=:IdExpense` | 🔒 |
| PUT | `/Expenses/IdExpense=:IdExpense/series` | 🔒 |
| DELETE | `/Expenses/IdExpense=:IdExpense` | 🔒 |
| DELETE | `/Expenses/IdExpense=:IdExpense/series` | 🔒 |
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
