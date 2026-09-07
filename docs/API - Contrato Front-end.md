# API — Contrato para o front-end

Documento gerado a partir dos `*.route.ts` e `*.schema.ts` do repositório. Ele descreve **o que a API aceita e o que devolve hoje**. Toda validação citada aqui é a que roda de verdade (Joi, em `<Feature>.schema.ts`), não uma intenção.

> **Mudou alguma coisa?** O [changelog](#19-changelog) — um arquivo por leva de desenvolvimento, em [`contrato Front-end/changelogs/`](contrato%20Front-end/changelogs/) — lista toda alteração que afeta o front, dizendo o que quebra e o que fazer. Comece pela leva mais nova.

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

**O usuário nasce com o e-mail não confirmado** (`EmailConfirmedAt: null`) e recebe, logo depois do cadastro, um e-mail com o link de confirmação. Isso **não bloqueia nada**: ele loga e usa o app normalmente. O que a tela precisa fazer é mostrar a faixa pedindo a confirmação enquanto `GET /Users/getSelf` devolver `EmailConfirmedAt: null` — ver o `POST /Users/confirmEmail`.

---

### `POST /Users/login` *(público)*

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `login` | string | obrigatório, normalizado para minúsculas (é o e-mail) |
| `password` | string | obrigatório |
| `RememberDevice` | boolean | opcional, default `false` — o "manter conectado" |

**Resposta `200`** — e o `Set-Cookie: token=...`, que é o que importa.

```json
{ "msg": "Login realizado com sucesso" }
```

Credencial errada: `406` com `{ "msg": "Login inválido" }` — a mesma mensagem para e-mail inexistente e senha errada, de propósito.

O login já seleciona o primeiro workspace do usuário, então a sessão nunca começa sem workspace.

**A duração da sessão sai daqui, e é uma escolha entre duas:**

| `RememberDevice` | Duração | `Max-Age` do cookie |
|---|---|---|
| ausente ou `false` | **24 horas** | `86400` |
| `true` | **30 dias** | `2592000` |

O cookie e o token têm sempre a **mesma** duração — não há como sobrar um sem o outro. A escolha viaja dentro do token, então `POST /Workspaces/switch` reemite a credencial **sem rebaixar** uma sessão de 30 dias.

> **Marque a caixa "manter conectado" da sua tela neste campo**, e só nele: não guarde nada do lado do cliente para "lembrar" a sessão. O que mantém o usuário logado é o cookie, e ele é `HttpOnly`.

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

### `POST /Users/forgotPassword` *(público)*

Manda para o e-mail da conta um link de recuperação de senha. É o par do "Esqueci minha senha".

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `Email` | string | obrigatório, formato de e-mail, normalizado para minúsculas |

**Resposta `200`** — **sempre**, inclusive para e-mail que não tem conta:

```json
{ "msg": "Se este e-mail tiver uma conta, enviamos o link de recuperação." }
```

> **A resposta é idêntica nos dois casos, de propósito.** Responder diferente transformaria a rota num verificador de quais e-mails têm conta — a mesma razão pela qual o login usa a mesma `msg` para e-mail errado e senha errada. **Não tente inferir da resposta se a conta existe**, e não mostre "e-mail não encontrado" na tela: a informação não está aí.

O link do e-mail aponta para **o front**, não para a API: `APP_URL/recuperar-senha?Token=…`. Monte essa tela — é ela que recebe o `Token` da query e chama o `POST /Users/resetPassword`. O link vale **30 minutos** e serve **uma vez só**.

> ⚠️ **O servidor ainda não tem rate limiting.** Enquanto não tiver, segure o botão do seu lado: desabilite-o depois do envio e ofereça o reenvio com um intervalo. Uma rota pública que dispara e-mail é o primeiro lugar onde a falta disso dói.

---

### `POST /Users/resetPassword` *(público)*

Grava a senha nova a partir do token que chegou por e-mail.

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `Token` | string | obrigatório — o que veio na query do link |
| `NewPassword` | string | obrigatório, **texto puro** (as mesmas regras do cadastro) |

**Resposta `200`**

```json
{ "msg": "Senha alterada com sucesso" }
```

Token inválido, expirado, de outra finalidade ou **já usado**: `406` com `{ "msg": "Link de recuperação inválido ou expirado. Peça um novo." }` — uma mensagem só para todos os motivos, porque a ação da tela é a mesma em todos: pedir outro link.

**O link morre no primeiro uso**, sem lista de revogação: o token carrega uma impressão digital da senha atual, e trocar a senha faz ela deixar de casar. Consequência prática: pedir dois links e usar o segundo **invalida o primeiro**.

> **A troca não loga o usuário.** Não vem `Set-Cookie` nenhum — mande para a tela de login com a senha nova.

---

### `POST /Users/confirmEmail` *(público)*

Confirma o endereço a partir do token que chegou por e-mail. O e-mail sai sozinho no cadastro, e de novo sempre que o endereço muda.

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `Token` | string | obrigatório — o que veio na query do link |

**Resposta `200`**

```json
{ "msg": "E-mail confirmado com sucesso" }
```

Token inválido, expirado, de outra finalidade ou **de um endereço que não é mais o da conta**: `406` com `{ "msg": "Link de confirmação inválido ou expirado. Peça um novo." }` — uma mensagem só para todos os motivos, porque a ação da tela é a mesma: pedir outro link.

O link do e-mail aponta para **o front**: `APP_URL/confirmar-email?Token=…`. Monte essa tela — é ela que lê o `Token` da query e chama esta rota. Vale **48 horas**.

> **Confirmar duas vezes não é erro.** A segunda chamada responde `200` sem reescrever nada. Quem clica no link de novo, ou o pré-carregador de link do cliente de e-mail, não pode ver tela de erro para algo que já deu certo.

> **Não confirmar não bloqueia nada hoje.** O usuário entra e usa o app; o que ele perde é a recuperação de senha funcionando de verdade, que depende de o endereço ser mesmo o dele.

> **Não vem `Set-Cookie`**: confirmar o e-mail não abre sessão.

---

### `POST /Users/resendConfirmation` *(público)*

Manda de novo o link de confirmação, para quem não recebeu o do cadastro.

**Body**

| Campo | Tipo | Regra |
|---|---|---|
| `Email` | string | obrigatório, formato de e-mail, normalizado para minúsculas |

**Resposta `200`** — **sempre**, inclusive para e-mail que não tem conta e para quem já confirmou:

```json
{ "msg": "Se este e-mail tiver uma conta pendente de confirmação, enviamos o link." }
```

> **A resposta é idêntica em todos os casos, de propósito** — a mesma razão do `forgotPassword`: responder diferente transformaria a rota num verificador de quais e-mails têm conta. **Não tente inferir da resposta se a conta existe ou se ela já está confirmada.**

> **Há um freio de 2 minutos por endereço.** Dois pedidos seguidos para o mesmo e-mail respondem os dois `200`, mas só o primeiro manda e-mail. A resposta não muda — um `429` aqui devolveria justamente o que a resposta única esconde. Do lado da tela: desabilite o botão e ofereça o reenvio com um contador.

---

### `GET /Users/getSelf` 🔒

**Resposta `200`** (`Password` nunca sai):

```json
{
  "IdUser": 1,
  "Name": "Tiago",
  "Email": "tiago@exemplo.com",
  "Phone": 11999999999,
  "EmailConfirmedAt": null,
  "LastLogin": "2026-08-30T12:00:00.000Z",
  "TrialStartAt": "2026-08-01T00:00:00.000Z",
  "TrialEndAt": null,
  "Active": true,
  "CreatedAt": "2026-08-01T00:00:00.000Z",
  "UpdatedAt": "2026-08-30T12:00:00.000Z"
}
```

---

`EmailConfirmedAt` é `null` enquanto o endereço não foi confirmado, e é ele que a faixa da tela lê para saber se aparece. Ele **volta a ser `null`** quando o usuário troca o e-mail.

---

### `PUT /Users/IdUser=:IdUser` 🔒

**Body:** `Name` (obrigatório), `Email` (obrigatório), `Phone` (obrigatório).

**Resposta `200`:** corpo vazio.

> ⚠️ **Trocar o `Email` derruba a confirmação.** `EmailConfirmedAt` volta a `null` e sai um novo e-mail de confirmação para o **endereço novo**. Mandar o mesmo `Email` de volta — o caso de quem só mudou o nome — não mexe em nada. Depois de um `PUT` que muda o endereço, releia o `getSelf`: a faixa da confirmação volta.

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
| `RememberDevice` | boolean | opcional, default `false` — o mesmo campo e as mesmas duas durações do `POST /Users/login` |

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

Um usuário pode ser membro de mais de um workspace, e há **três** formas de isso acontecer: o primeiro nasce no cadastro, um workspace novo se cria com `POST /Workspaces`, e num que já existe só se entra por **convite** (4.1). `getSelf` devolve todos, e é o `switch` que escolhe em qual a sessão está.

### `POST /Workspaces`

Cria um workspace novo, com o usuário da sessão como dono. É a tela de "separar as finanças" — casa e empresa, pessoal e do casal — para quem já tem conta.

**Body:** `Name` (obrigatório, ≤255).

**Resposta `200`:** `{ "IdWorkspace": 2 }`.

Não recebe `IdWorkspace` (ele nasce aqui) nem `IdOwnerUser` (é o usuário do token). O workspace nasce **vazio**: sem contas, sem categorias próprias, sem lançamentos — só com você como membro `owner` e com a sua pessoa (`Persons`) criada dentro dele, para você já poder entrar num rateio. As categorias globais aparecem nele como em qualquer outro.

> ⚠️ **Criar NÃO troca a sessão**, exatamente como o `join`: o cookie continua apontando para o workspace em que você estava. Para operar no novo, chame **`POST /Workspaces/switch`** com o `IdWorkspace` que voltou.

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

A data que conta é a do lançamento — `CompetenceDate` na entrada, **`CashDate`** na perna (o vencimento quando existe, senão a data do gasto) —, **não a data em que se clicou em receber/quitar**. Duas consequências para a tela:

- uma entrada de setembro já marcada como recebida **não** aparece no saldo de agosto: peça `ReferenceMonth=2026-09` para vê-la;
- quitar hoje a parcela que vence em novembro **não** mexe no saldo de agosto — ela sai no saldo de novembro.

O saldo de abertura obedece ao mesmo corte quando a conta tem `InitialBalanceDate`: uma conta aberta em agosto vem com `Balance: 0` em março. Sem `InitialBalanceDate`, a abertura conta em qualquer mês.

> **O `Balance` não muda com o `CompetenceMode` do cartão (seção 6), e é de propósito.** Ele lê a `CashDate` da perna — quando o dinheiro *sai* —, nunca a `CompetenceDate` — quando a compra *pesa*. Num cartão `purchase`, a compra de 20/08 pesa em agosto no orçamento e só sai da conta em 05/09, com a fatura. Os dois números discordam porque respondem a perguntas diferentes.

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
  "CompetenceMode": "purchase",
  "IconPath": null,
  "Color": null,
  "Position": 1,
  "Active": true,
  "CreatedAt": "...",
  "UpdatedAt": "..."
}
```

`Kind` ∈ `pix` | `debit` | `credit_card`. `DueDay`/`ClosingOffsetDays`/`CompetenceMode` só fazem sentido em `credit_card` — nas outras são `null`.

**`debit` cobre três coisas diferentes** e o que as separa é o `Name`, não o `Kind`: o débito da conta corrente, o "Dinheiro" da conta `cash` e a forma com o nome da conta num vale (`Type='card'`). Nas três o gasto sai do saldo **no ato** e não há fatura — que é exatamente o que `debit` significa no modelo.

**O cartão é descrito pelo vencimento, não pelo fechamento.** `DueDay` é o dia do mês em que a fatura vence e `ClosingOffsetDays` é quantos dias **antes** dele ela fecha — é o dado que o emissor realmente pede ao cliente, e a folga é o que ele aplica por baixo. Não existe mais um campo com o dia do fechamento: ele é `DueDay − ClosingOffsetDays` e muda de mês para mês (vencendo dia 5 com folga de 7, a fatura fecha em 26/02 e em 29/03).

Não há padrão de mercado para a folga — fica tipicamente entre 6 e 10 dias, e o **default é 7**. Na tela de cadastro, peça o vencimento e deixe a folga num campo avançado já preenchido.

**`CompetenceMode` diz em qual mês a compra do cartão pesa** — e é a única configuração do cadastro que muda um número já mostrado na tela.

| Modo | A compra de **21/08**, num cartão que vence dia 28 | Para quem |
|---|---|---|
| `purchase` *(default)* | pesa em **agosto**, o mês da compra | quem paga a fatura inteira todo mês e usa o cartão como meio de pagamento |
| `invoice` | pesa em **setembro**, o mês do vencimento | quem usa o cartão para adiar, e planeja pelo mês da fatura |

**Ele governa a competência, nunca o caixa.** O `Balance` da conta (seção 5) é **idêntico nos dois modos**: o dinheiro sai quando a fatura é paga, e isso não muda. O que muda é o `Spent` do orçamento (seção 13) e o mês em que a perna aparece em `GET /ExpensePayments` (seção 12). Se o seu "quanto ainda posso gastar" e o seu "quanto tenho em conta" começarem a discordar num cartão `purchase`, **é assim que tem que ser**: o primeiro é o mês que a pessoa está vivendo, o segundo é o dinheiro que já saiu.

**Em parcelado o avanço continua por parcela.** 600 em 6× num cartão `purchase` pesa **100 por mês** a partir do mês da compra — não 600 no primeiro.

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
| `CompetenceMode` | `purchase` \| `invoice` | default **`purchase`** |
| `IconPath` | string \| null | ≤255, default `null` |
| `Color` | `#RRGGBB` \| null | default `null` |
| `Position` | int \| null | default `null` |

**Resposta:** `{ "IdPaymentMethod": 3 }`.

### `PUT /PaymentMethods/IdPaymentMethod=:IdPaymentMethod`

`Name` obrigatório; `DueDay`, `ClosingOffsetDays`, `CompetenceMode`, `IconPath`, `Color`, `Position` opcionais.

**`Kind` e `IdAccount` não são aceitos:** um pix não vira cartão e um cartão não muda de conta — as duas trocas reescreveriam o significado das compras já lançadas nele. Mandar `null` em `DueDay`/`ClosingOffsetDays`/`CompetenceMode` de um cartão dá `406`, e mandar qualquer um dos três **fora** de um cartão dá `406` também.

**Editar o cartão não recalcula as compras já lançadas.** `ClosingDate`/`DueDate`/`CompetenceDate`/`CashDate` são gravadas na perna no momento do lançamento (seção 11) e não são revistas depois. Corrigir o vencimento, a folga **ou o `CompetenceMode`** vale para o que vier daí em diante; o que já está gravado só muda por um `PUT` no próprio gasto. Virar a chave em novembro não reescreve agosto — e é de propósito: a alternativa seria mês fechado mudando de número sozinho.

**Resposta:** `{ "msg": "Forma de pagamento atualizada com sucesso" }`.

### `DELETE /PaymentMethods/IdPaymentMethod=:IdPaymentMethod`

Arquiva. **Resposta:** `{ "msg": "Forma de pagamento arquivada com sucesso" }`.

### `POST /PaymentMethods/IdPaymentMethod=:IdPaymentMethod/payInvoice`

**Quita a fatura inteira.** É o que tira o dinheiro do cartão da conta — no crédito, a perna sozinha não quita (seção 12).

| Campo | Tipo | Regra |
|---|---|---|
| `DueDate` | CalendarDate | obrigatório — **o vencimento identifica a fatura** |

**A fatura não é um cadastro, é uma consulta.** Não existe tabela de faturas e não há id de fatura: todas as pernas de um mesmo ciclo compartilham o **mesmo `DueDate` exato**, porque ele é calculado a partir do `DueDay` do cartão. Uma fatura é `(IdPaymentMethod, DueDate)` — pegue o `DueDate` da própria perna, em `GET /ExpensePayments` ou no detalhe do gasto, e mande de volta.

**Resposta:** `{ "msg": "Fatura quitada com sucesso", "Payments": 12 }` — `Payments` é **quantas pernas mudaram de estado**.

**Repetir a chamada é inofensivo:** pernas já pagas são puladas, e `Payments: 0` é resposta legítima ("a fatura já estava assim"). É isso que resolve o caso real de **lançar hoje uma compra esquecida que pertence a uma fatura já paga** — chame de novo e só a que faltava é quitada.

Pernas de **gasto cancelado ficam de fora**: cancelar já é o estorno, e a fatura não pode tirar da conta o dinheiro de uma compra que não existe mais.

O `Status` de **cada gasto atingido** é recalculado na mesma transaction — doze pernas podem ser doze gastos diferentes.

`406` se: a forma de pagamento não existe no workspace, **não é `credit_card`**, ou **não há fatura com esse vencimento** (fatura sem perna nenhuma não é fatura paga, é fatura que não existe).

### `POST /PaymentMethods/IdPaymentMethod=:IdPaymentMethod/unpayInvoice`

Mesmo corpo, sentido inverso. Existe pelo mesmo motivo que o `unpay`, e mais ainda: **um clique errado aqui tira quarenta pagamentos do saldo de uma vez.**

**Resposta:** `{ "msg": "Fatura desquitada com sucesso", "Payments": 12 }`.

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

### 11.3 Estorno — o gasto de valor **negativo**

Um estorno de compra volta na fatura, às vezes na seguinte. Ele se lança como um **gasto com o sinal trocado**: `TotalValue` negativo, e os valores dos dois eixos negativos junto.

**Estorno não é entrada.** Se fosse um `Inflow`, o saldo da conta subiria no mês do estorno **e** a fatura continuaria sendo paga cheia — errado dos dois lados. Nenhum dinheiro entra na conta num estorno: **a fatura é que encolhe**.

E o gasto negativo é o lugar certo porque o estorno tem todas as propriedades de um gasto com o sinal invertido: **categoria** (é assim que o crédito volta ao orçamento certo), **datas de fatura**, **competência**, **rateio por pessoa** e **linha da fatura**.

**As quatro regras que o sinal exige** — todas `406`:

| Regra | Por quê |
|---|---|
| **Só com forma de pagamento `credit_card`** | fora do cartão, dinheiro que volta entra na conta de verdade — e para isso existe `POST /Inflows` |
| **Um gasto é inteiro positivo ou inteiro negativo** | todas as partes, **nos dois eixos**, com o sinal do total. Senão dá para montar uma perna de +200 e outra de −50 fechando em 150: não é compra nem estorno |
| **`Kind='single'` apenas** | estorno de parcelado se lança **um por parcela**: as regras do parcelamento (o centavo que sobra na primeira, as datas mês a mês) não foram reexaminadas com o sinal invertido |
| **Zero continua proibido** | em `TotalValue` e em cada valor dos dois eixos |

**Juros, anuidade e IOF não são estorno:** são gastos **positivos** comuns, lançados no cartão numa categoria de tarifas. Só o estorno tem sinal invertido, porque só ele **reduz** o que você vai pagar.

O estorno é quitado **com a fatura em que caiu** (`payInvoice`, seção 6), como qualquer linha de cartão, e o `charge` funciona igual. O efeito no saldo é o líquido: uma fatura com 500 de compra e 150 de estorno tira **350** da conta.

> **O crédito volta no mês de competência do estorno, que costuma ser outro mês.** Agosto fica com a compra cheia e outubro recebe o crédito — corrigir agosto seria reescrever mês fechado. Consequência: **`Spent` pode vir negativo** num mês em que os estornos superam as compras (seção 13). Não é bug.

### 11.4 `Status` é derivado — nunca envie

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
    "CompetenceDate": "2026-08-27",
    "CashDate": "2026-08-27",
    "Charged": false,
    "ChargedAt": null,
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

**A perna tem duas datas, e elas discordam de propósito.** As duas são congeladas no lançamento e nenhuma das duas é aceita em corpo nenhum — são informativas.

| Campo | O que é | Quem recorta o mês por ela |
|---|---|---|
| `CompetenceDate` | **quando a perna pesa** | o `Spent` do orçamento (seção 13) e `GET /ExpensePayments` (seção 12) |
| `CashDate` | **quando o dinheiro sai da conta** — `DueDate` quando existe, senão a data do gasto | o `Balance` da conta (seção 5) |

Fora de um cartão `purchase` as duas são **sempre iguais**, e é por isso que elas só nasceram agora: até o `CompetenceMode` existir, "pesar" e "sair" eram a mesma coisa. Num cartão `purchase` a compra de 20/08 pesa em **agosto** e sai da conta em **05/09**, com a fatura — uma data não responde às duas perguntas.

**`Charged` e `Paid` são dois fatos diferentes, e só um move dinheiro:**

| Campo | O que afirma | Quem escreve | Move saldo? |
|---|---|---|---|
| `Charged`/`ChargedAt` | **a cobrança entrou na fatura** | o usuário, pelo `charge` (seção 12) | **não** |
| `Paid`/`PaidAt` | **o dinheiro saiu da conta** | o cliente no lançamento, o `pay` da linha, ou — **no cartão** — o `payInvoice` (seção 6) | **sim** |

`Charged` é **`null` fora do cartão de crédito**, pela mesma razão que `ClosingDate` é: não há fatura em que entrar. Use essa nulidade para saber se a linha da sua tela tem o botão de conferência.

### `POST /Expenses`

| Campo | Tipo | Regra |
|---|---|---|
| `Description` | string | obrigatório, ≤255 |
| `TotalValue` | number | obrigatório, 2 casas, **≠ 0**. Negativo é **estorno** (seção 11.3). Em parcelado, o **total da compra** |
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

**`Paid: true` é o caso do débito e do pix**, que já saem pagos no ato. **No cartão de crédito ele é recusado com `406`:** a compra no crédito não nasce quitada — ela é quitada com a **fatura** (`payInvoice`, seção 6). Não ofereça o campo no formulário quando a forma escolhida for cartão.

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

A perna não tem `POST` de cadastro: ela nasce com o gasto. O que existe aqui é **a lista do que cai num período** e **os verbos de estado**.

**Dois fatos, dois verbos, e só um deles mexe em dinheiro:**

| Verbo | Afirma | Onde | Move saldo? |
|---|---|---|---|
| `charge` / `uncharge` | a cobrança **entrou na fatura** | aqui, na perna — **só cartão** | **não** |
| `pay` / `unpay` | o dinheiro **saiu da conta** | aqui, na perna — **nunca em cartão** | sim |
| `payInvoice` / `unpayInvoice` | a **fatura** foi paga | seção 6, na forma de pagamento | sim |

### `GET /ExpensePayments`

**A lista do que *pesa* no mês.** `GET /Expenses` é a lista do que foi **comprado** (filtra por `ExpenseDate`); esta filtra pela **`CompetenceDate`** da perna — a mesma data que o `Spent` do orçamento usa, e a que o `CompetenceMode` do cartão governa (seção 6). Num cartão `invoice` ela é o vencimento da fatura; num `purchase`, o mês da compra (avançando por parcela).

> O `Balance` da conta **não** recorta por aqui: ele usa a `CashDate`, que vem na mesma linha. Se a sua tela soma esta lista esperando bater com o saldo, some pela `CashDate` e conte só o que está `Paid`.

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
  "CompetenceDate": "2026-08-28",
  "CashDate": "2026-08-28",
  "Charged": false,
  "ChargedAt": null,
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

> **🔴 Não vale para cartão de crédito.** Perna de cartão responde `406` `"Perna de cartão de crédito é quitada com a fatura: use POST /PaymentMethods/IdPaymentMethod=:Id/payInvoice."` **Não se paga uma compra isolada da fatura** — nenhum emissor oferece isso, e era esse botão que deixava o saldo do cartão errado. **Parcelado fora do cartão** (carnê, crediário, o racha com um amigo no pix) continua sendo quitado parcela a parcela por aqui.

`406` se: a perna não existe, **é de cartão de crédito**, o gasto está cancelado, ou a parcela **já está quitada**.

### `POST /ExpensePayments/IdExpensePayment=:IdExpensePayment/unpay`

Desquita. Existe porque um clique errado, sem ele, tiraria dinheiro da conta sem volta. Mesma recusa para perna de cartão.

**Resposta:** `{ "msg": "Parcela desquitada com sucesso" }`.

### `POST /ExpensePayments/IdExpensePayment=:IdExpensePayment/charge`

**Sem body.** Marca que **a cobrança entrou na fatura** — `Charged: true` e `ChargedAt` com o instante. **Só em perna de cartão de crédito.**

**Não move saldo nenhum**, não mexe no `Status` do gasto e não é pré-requisito de nada. É a conferência de assinatura: "a Netflix cobrou mesmo este mês? veio no valor certo?", e quem responde é o usuário olhando o app do cartão.

> **É afirmação, não palpite.** Não derive de "a data já passou": a lista é olhada justamente para achar onde a realidade **discordou** da previsão — a assinatura que não cobrou, que cobrou dobrado, que mudou de dia. Uma marcação derivada da data nunca discorda de nada, então nunca acha nada.

**Resposta:** `{ "msg": "Cobrança marcada como lançada na fatura" }`.

`406` se: a perna não existe, **não é de cartão** (`Charged` é `null` ali), o gasto está cancelado, ou já está marcada.

### `POST /ExpensePayments/IdExpensePayment=:IdExpensePayment/uncharge`

Desmarca, e apaga o `ChargedAt` junto.

**Resposta:** `{ "msg": "Cobrança desmarcada da fatura" }`.

---

## 13. Budgets — `/Budgets` 🔒

> **O mês passa a nascer sozinho.** Todo dia 1º, uma rotina no servidor materializa o mês novo a partir das definições ativas e fecha o mês que acabou (`Status: "closed"`). O `POST /Budgets` continua existindo e continua criando o mês que você informar — ele é o caminho de **cadastrar um teto agora**, sem esperar a virada.

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
2. **A data que conta é a `CompetenceDate` da perna**, e no cartão quem a decide é o `CompetenceMode` (seção 6): em `invoice` a compra cai no mês em que a fatura vence, em `purchase` no mês da compra. Fora do cartão é a data do gasto (ou o vencimento da parcela, no carnê).
3. **Conta pendente junto com pago** — ao contrário do saldo da conta. Orçamento é o que você **comprometeu**; saldo é o que você **realizou**. Só o cancelado sai.

**No `Scope: "person"` vale uma quarta regra: o comprometido é rateado pelas parcelas.**

```
Spent = Σ ( ExpensePersons.Value × ExpensePayments.Value ÷ Expenses.TotalValue )
```

600 em 6× todos da Maria dão **100 por mês** no orçamento dela — o mesmo número que a categoria enxerga. Sem o rateio, o mesmo gasto contaria 600 num orçamento e 100 no outro, e "quanto a Maria comprometeu em agosto" não teria resposta certa. O arredondamento é feito **uma vez, no fim**: numa parcela de 100 dividida 400/200 entre duas pessoas, saem `66.67` e `33.33`.

**`Spent` pode vir negativo.** Um mês em que os estornos (seção 11.3) superam as compras da categoria fecha abaixo de zero. Não quebra nada e não é bug — mas trate o caso na barra de progresso.

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

`Status` **não é aceito**: o mês nasce `open`, e quem o move para `closed` é a rotina do dia 1º — nunca uma rota.

**Resposta:** `{ "IdBudget": 1, "IdBudgetPeriod": 1 }`.

---

## 14. BudgetPeriods — `/BudgetPeriods` 🔒

**Sem `GET`** (o mês sai em `GET /Budgets`, que é onde ele significa algo) e **sem `POST`** (o mês nasce no `POST /Budgets`). As duas rotas mexem em **um mês só** — é isso que a separação em duas tabelas compra.

### `PUT /BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod`

**Body:** `LimitValue` (obrigatório, > 0), `AlertPercent` (opcional, 1–100).

**`ReferenceMonth` e `IdBudget` não são aceitos:** mover o teto de lugar é apagar este e cadastrar outro.

**Um mês `closed` continua editável.** Fechar é um carimbo de "este mês acabou", não uma trava: corrigir o teto de um mês passado é justamente o que a tabela do mês congelado permite. O `Status` só volta a `open` se o período for apagado e cadastrado de novo.

**Resposta:** `{ "msg": "Orçamento do mês atualizado com sucesso" }`.

### `DELETE /BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod`

**Delete físico — o único do projeto.** Um período é plano, não lançamento: nada aponta para ele e nenhum dinheiro passou por ali. **A definição sobrevive.**

**Resposta:** `{ "msg": "Orçamento do mês removido com sucesso" }`.

---

## 15. Reports — `/Reports` 🔒

**A feature sem tabela própria.** Ela não guarda nada: lê das outras e devolve o número somado. Existe porque as regras de agregação **se contradizem de propósito**, e enquanto elas moravam replicadas no cliente, duas implementações da mesma pergunta terminavam mostrando dois totais diferentes na mesma tela.

| Número | Regra que **não** vale para os outros |
|---|---|
| Quanto entrou | filtra `Kind <> 'transfer'` |
| Quanto gastou | soma **pernas**, não o `TotalValue` da compra |
| Saldo da conta | **ignora** o pendente |
| `Spent` do orçamento | **conta** o pendente junto com o pago |

Nenhuma dessas regras nasce aqui: as rotas desta seção chamam as mesmas sections que `GET /Accounts` e `GET /Budgets` já usam. Se um número daqui divergir do da tela dele, é bug — não duas leituras legítimas.

### `GET /Reports/Month`

**Os dois indicadores do Dashboard, somados no servidor.**

| Query | Tipo | Regra |
|---|---|---|
| `ReferenceMonth` | `YYYY-MM` | opcional, default o **mês corrente** |

Mês, e não `From`/`To` das listagens de movimento: as duas pontas do cálculo são **posições**, não recortes.

```json
{
  "ReferenceMonth": "2026-09-01",
  "OpeningBalance": 1500,
  "Inflows": 3000,
  "Expenses": 500,
  "OverdueReceivable": 0,
  "OverduePayable": 0,
  "Available": 4000,
  "CurrentBalance": 1300,
  "OpenInvoices": 300
}
```

**`Available` ("quanto ainda posso gastar") e `CurrentBalance` ("quanto tenho em conta") não são duas versões do mesmo fato**, e é por isso que a tela mostra os dois lado a lado: um é o **mês que a pessoa está vivendo**, o outro é o **dinheiro que já saiu**. Eles discordam de propósito.

| | `Available` | `CurrentBalance` |
|---|---|---|
| **Abertura** | `OpeningBalance` — o saldo realizado no fim do mês anterior | nenhuma: o saldo já é acumulado desde a abertura da conta |
| **Base de data** | competência (`CompetenceDate` da perna, que o `CompetenceMode` governa — seção 6) | caixa (`CashDate` da perna) |
| **Base de estado** | comprometido: pendente **e** pago | realizado: só pago / recebido |
| **Entradas** | **as pendentes entram** | só as recebidas |
| **Unidade** | a **perna**, nunca o `TotalValue` da compra | a perna paga |

```
Available = OpeningBalance
          + Inflows            (competência no mês, pendentes + recebidas, sem transferência)
          − Expenses           (pernas com competência no mês, pendentes + pagas)
          + OverdueReceivable
          − OverduePayable
```

**`OpeningBalance` é o termo que faltava, e a ausência dele era um erro de verdade.** Somar só as entradas do mês para dizer quanto ainda dá para gastar ignora o dinheiro que já estava na conta no dia 1º: quem começa setembro com 1000 e recebe 3000 de salário via **3000**, tendo 4000. Se o seu cliente calculava isso somando `GET /Inflows`, **pare** — este é o número certo.

> Se você já usava o paliativo de somar os `Balance` de `GET /Accounts?ReferenceMonth=<mês anterior>`, ele continua dando o mesmo número. A rota existe para tirar essa regra do cliente, não porque o paliativo estivesse errado.

**`OverdueReceivable`/`OverduePayable` são o atrasado, e entram no `Available` dos dois lados.** Uma perna com competência em julho e ainda pendente não está no saldo de julho (não foi paga) nem na janela de agosto (a competência é de julho): sem isso ela **some** do indicador — e some justamente o compromisso que ninguém honrou.

> **O custo está aceito de olhos abertos:** uma entrada prevista que nunca chega infla o `Available` para sempre. É por isso que os dois vão **expostos à parte** — mostre "R$ X vencidos" na tela, com um caminho para receber ou cancelar o que ficou para trás. A alternativa seria o servidor corrigir sozinho, sem contar a ninguém.

**`OpenInvoices` é o que liga os dois números: quanto do saldo já tem dono.** É a soma das pernas de **cartão** que vencem até o fim do mês e ainda não foram pagas — o buraco que o `Available` mostra hoje é o que o `CurrentBalance` vai mostrar quando a fatura for paga.

**E a dupla contagem que não existe:** `payInvoice` **não cria lançamento**, só vira o `Paid` de pernas que já existem. A compra de agosto contada em agosto não volta a contar em setembro.

**Só conta `Active` entra no `OpeningBalance` e no `CurrentBalance`** — o mesmo filtro de `GET /Accounts`, senão a soma do Dashboard discordaria da lista de contas na mesma tela.

`ReferenceMonth` **volta como `YYYY-MM-01`**, como no orçamento: é o mês normalizado que a resposta afirma ter usado.

### `GET /Reports/Statement`

**O extrato de cada conta e de cada cartão, numa rota só** — não uma por conta: a tela é uma, e uma requisição por conta multiplicaria ida e volta para montar tela nenhuma a mais.

| Query | Tipo | Regra |
|---|---|---|
| `ReferenceMonth` | `YYYY-MM` | opcional, default o **mês corrente** |

**O extrato é a decomposição do saldo, não uma consulta paralela.** É a promessa inteira da rota:

```
OpeningBalance (saldo no fim do mês anterior)
  + entradas recebidas na conta, no mês
  − transferências recebidas que saíram da conta, no mês
  − pernas de gasto pagas da conta, no mês
  = ClosingBalance  ← o mesmo Balance que GET /Accounts devolve para este mês
```

**Some `OpeningBalance` com os `Value` das linhas e você chega ao `ClosingBalance`, ao centavo.** Se não chegar, é bug da API — não arredonde por conta própria para "fechar" a tela.

```json
{
  "ReferenceMonth": "2026-09-01",
  "Accounts": [{
    "IdAccount": 1, "Name": "Conta corrente", "Active": true,
    "OpeningBalance": 1000.00, "ClosingBalance": 4300.00,
    "Entries": [
      { "Date": "2026-09-05", "Kind": "inflow",   "Description": "Salário",         "Value":  3000.00, "IdInflow": 12 },
      { "Date": "2026-09-10", "Kind": "transfer", "Description": "Para a poupança", "Value":  -200.00, "IdInflow": 15 },
      { "Date": "2026-09-15", "Kind": "invoice",  "Description": "Fatura Nubank",   "Value":  -500.00, "IdPaymentMethod": 7 }
    ]
  }],
  "Cards": [{
    "IdPaymentMethod": 7, "Name": "Nubank", "DueDate": "2026-09-15",
    "Total": 500.00,
    "Entries": [
      { "Date": "2026-08-20", "Description": "Mercado", "Value": 320.00, "IdExpense": 44, "IdExpensePayment": 61, "InstallmentNumber": null, "InstallmentTotal": null, "Paid": true, "Charged": true }
    ]
  }]
}
```

**`Value` é assinado, e não duas colunas de débito e crédito.** Com sinal, conferir o extrato é literalmente somar a lista; com duas colunas, vira uma subtração que alguém escreve ao contrário uma hora.

**`Kind` discrimina a origem, e cada linha carrega o id do que a gerou** para a tela navegar do extrato até o lançamento:

| `Kind` | O que é | Ids que vêm |
|---|---|---|
| `opening` | o **saldo inicial da conta**, quando o `InitialBalanceDate` cai dentro do mês | nenhum — não é lançamento |
| `inflow` | entrada recebida | `IdInflow` |
| `transfer` | transferência recebida — **nas duas contas, com sinais opostos** | `IdInflow` |
| `expense` | perna de gasto paga **fora do cartão** | `IdExpense`, `IdExpensePayment` |
| `invoice` | **a fatura inteira do cartão, agregada numa linha** | `IdPaymentMethod` |

**A fatura entra como uma linha, e o detalhe fica no extrato do cartão.** Quarenta compras do cartão viram quarenta linhas no extrato da conta — o que nenhum extrato bancário faz, e o que soterra as linhas que importam. O agrupamento é `(cartão, vencimento)`, e **a soma não muda**: o total do grupo é o mesmo que as pernas somavam.

**A transferência não é filtrada aqui**, ao contrário do "quanto entrou" da rota anterior: para o extrato, ela é uma saída real de uma conta e uma entrada real na outra. Some as duas linhas e o patrimônio não muda — que é o que uma transferência é.

#### As duas assimetrias — leia antes de montar a tela

**1. Extrato da conta é caixa; extrato do cartão é fatura.**

| | Extrato da conta | Extrato do cartão |
|---|---|---|
| O que é | o dinheiro que **passou** | a **fatura** — o que foi comprado |
| Estado | **só liquidado** (entrada recebida, perna paga) | **pago E pendente** |
| Corte | a `CashDate` da perna / a competência da entrada | o **`DueDate`** — a fatura é o par `(cartão, vencimento)` |
| Data da linha | a do lançamento | a da **compra** |

Uma fatura existe antes de ser paga — é isso que a torna útil de olhar. Já o extrato da conta só pode conter o que saiu, ou a soma não fecha. Os dois estão certos, e estão certos por motivos opostos.

> **O custo está aceito:** quem abrir o extrato no dia 20 **não** vê a conta de luz lançada para o dia 25. O lugar dela é `GET /Expenses`, que tem filtro de status justamente para isso. Extrato é o que aconteceu; previsão é outra tela.

**2. Detalhada no cartão, agregada na conta — e não é dupla contagem.** É a mesma perna vista dos dois lados: linha a linha na fatura, e uma linha só na conta no mês em que a fatura venceu. `payInvoice` **não cria lançamento**, só vira o `Paid` de pernas que já existem.

**Conta e cartão arquivados continuam tendo extrato.** `Active = false` quer dizer "não use mais", não "não existiu": o mês em que a conta ainda tinha movimento é consultável, e a conta vem com `Active: false` para a tela poder rotular. A arquivada **sem** movimento no mês some da lista — ela não tem o que mostrar.

**Gasto cancelado não aparece em lugar nenhum**, e o mês em que foi cancelado continua fechando: cancelar um gasto quitado é o estorno dele.

**`ReferenceMonth`, e não `From`/`To`.** As duas pontas são posições: um extrato de 15 de agosto a 3 de setembro não tem saldo de abertura que signifique alguma coisa.

### `GET /Reports/Export`

**A planilha do período, gerada pelo servidor.** É a **única rota do contrato que não responde JSON**.

| Query | Tipo | Regra |
|---|---|---|
| `From` | CalendarDate | opcional, inclusivo |
| `To` | CalendarDate | opcional, inclusivo |

`From`/`To`, como todas as listagens de movimento — não `ReferenceMonth`: exportar é recortar, e um recorte de exportação não precisa ser um mês civil. **Sem nenhuma das duas pontas, sai o histórico inteiro.**

**Resposta:** o arquivo, não um JSON.

| Cabeçalho | Valor |
|---|---|
| `Content-Type` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `Content-Disposition` | `attachment; filename="Gastos Mensais - 2026-09-01 a 2026-09-30.xlsx"` |

> **Não trate a resposta como JSON.** No `fetch`, use `response.blob()`; no `axios`, `responseType: "blob"`. E **a chamada precisa mandar o cookie** (`credentials: "include"` no `fetch`) — uma `<a href>` simples funciona no mesmo domínio, mas não deixa você tratar o `401`.

**Três abas:**

| Aba | O que tem |
|---|---|
| `Resumo` | total de entradas, total de gastos e o resultado — **como fórmula**, não como número somado no servidor |
| `Entradas` | uma linha por entrada, com as contas de origem e destino pelo nome |
| `Gastos` | uma linha por **perna**, não por compra |

**A aba de gastos lista pernas.** 600 em 6× são seis linhas de 100, cada uma no mês em que pesa — a mesma unidade do `Spent` do orçamento e do `Expenses` de `GET /Reports/Month`. Uma planilha por compra jogaria 600 no mês da compra e não bateria com número nenhum da tela.

**O resumo é fórmula de propósito:** apagar uma linha dentro do Excel não pode deixar o total mentindo, e uma planilha exportada existe justamente para ser mexida.

**As datas saem como texto `dd/MM/yyyy`.** As colunas de data do sistema são dias de calendário, não instantes (seção 1.5): convertê-las para data do Excel reintroduziria o fuso e a planilha sairia com todo lançamento um dia atrás. O custo é que o Excel não ordena a coluna como data — é o lado certo do erro.

O período recorta pela **competência** nas duas abas, e o cancelado fica de fora.

---

## 16. Utils — `/Utils`

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

## 17. O que ainda não tem API

Existe no banco, mas **sem rota**: `UserDevices`, `Notifications`, `Plans`, `Subscriptions`.

**Gestão de membros ainda não existe:** listar quem é membro, trocar o papel de alguém, remover um membro, sair de um workspace e transferir propriedade. O convite (4.1) entrega só a entrada. Revogar um convite **não** desfaz matrícula já criada.

Também não existem: `GET` de `PaymentMethods` (vem embutido na conta), CRUD de `Tags` além de busca e arquivar, e `GET`/`POST` de `BudgetPeriods`.

A **rotina mensal do orçamento passou a existir** (2026-09-07) e roda no servidor, sem rota: ela não é chamável pelo front e não aparece neste contrato a não ser pelo efeito — o mês do orçamento existir no dia 1º sem ninguém ter cadastrado.

**Fora deste contrato:** `/Cache` (`GET /Cache/CacheName=:CacheName`, `POST /Cache`, `POST /Cache/Reset/CacheName=:CacheName`) é o subsistema interno de cache em memória sincronizado por socket. Não tem schema Joi, não é escopado por workspace e não faz parte do domínio do app — não consuma a partir das telas.

---

## 18. Cola rápida

| Método | Rota | Auth |
|---|---|---|
| POST | `/Users` | público |
| POST | `/Users/login` | público |
| POST | `/Users/logout` | público |
| POST | `/Users/forgotPassword` | público |
| POST | `/Users/resetPassword` | público |
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
| POST | `/Workspaces` | 🔒 |
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
| POST | `/PaymentMethods/IdPaymentMethod=:Id/payInvoice` | 🔒 |
| POST | `/PaymentMethods/IdPaymentMethod=:Id/unpayInvoice` | 🔒 |
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
| POST | `/ExpensePayments/IdExpensePayment=:Id/charge` | 🔒 |
| POST | `/ExpensePayments/IdExpensePayment=:Id/uncharge` | 🔒 |
| GET | `/Budgets` | 🔒 |
| POST | `/Budgets` | 🔒 |
| PUT | `/BudgetPeriods/IdBudgetPeriod=:Id` | 🔒 |
| DELETE | `/BudgetPeriods/IdBudgetPeriod=:Id` | 🔒 |
| GET | `/Reports/Month` | 🔒 |
| GET | `/Reports/Statement` | 🔒 |
| GET | `/Reports/Export` | 🔒 |
| GET | `/Utils/ServerTime` | público |
| GET | `/Utils/Health` | público |
| GET | `/Utils/Reload` | 🔒 |
| POST | `/Utils/Logs` | 🔒 |

---

## 19. Changelog

**O changelog não mora mais neste arquivo.** Ele foi quebrado **por leva de desenvolvimento**, um
arquivo por leva, em [`contrato Front-end/changelogs/`](contrato%20Front-end/changelogs/):

| Arquivo | O que tem | Quando |
|---|---|---|
| [Fase #3](contrato%20Front-end/changelogs/Fase%20%233.md) | a leva 3 — infra, e-mail, sessão, `CompetenceMode` e `/Reports` | 2026-09-07 |
| [Fase #2](contrato%20Front-end/changelogs/Fase%20%232.md) | a leva 2 — as correções que sobem junto com o MVP | 2026-09-04 → 2026-09-06 |
| [Fase #1](contrato%20Front-end/changelogs/Fase%20%231.md) | o MVP: **não tem entradas**, e o arquivo explica por quê | até 2026-08-30 |
| [Fora de leva](contrato%20Front-end/changelogs/Fora%20de%20leva.md) | o que mudou fora de qualquer plano | 2026-08-31 → 2026-09-06 |

**Por leva, e não num arquivo só, porque é assim que o front atualiza.** Ninguém lê changelog por
data: lê para saber *o que preciso mexer para acompanhar a versão nova*, e a unidade dessa
pergunta é a leva — ela sobe junta, e é dela que o front toma conhecimento de uma vez. O arquivo
único também crescia sem fim, e a leva 3 sozinha teria empurrado a metade antiga para fora de
qualquer leitura.

**Comece pela leva mais nova e vá descendo** até encontrar a última que você já tinha lido.

### O que entra, e como

Toda mudança da API **que o front enxerga** vira uma entrada, **no mesmo commit da mudança**:
rota nova ou removida, campo novo/removido/renomeado em requisição ou resposta, parâmetro de query
novo, status ou `msg` diferente, default diferente — e o caso que motivou tudo isto, **um número
que mantém o nome e muda de significado**. Uma mudança semântica silenciosa é a pior de todas,
porque nada no cliente estoura: ele só passa a mostrar outra coisa.

Mudança que o front **não** enxerga (refatoração interna, teste, índice de banco) não entra.

Uma entrada tem sempre as mesmas quatro partes: **a data**, **a rota afetada**, **o marcador** e
**a ação do front**. Entradas em ordem decrescente de data dentro do arquivo da leva.

| Marcador | Significado |
|---|---|
| 🔴 **Quebra** | Código do front que funcionava para de funcionar, ou passa a mostrar número errado. Exige ação |
| 🟡 **Comportamento** | Nada quebra na chamada, mas a resposta mudou de significado. Confira antes de ignorar |
| 🟢 **Adição** | Campo, rota ou parâmetro novo. Compatível com o que já existe |

**A seção da rota, aqui neste documento, é atualizada junto.** O changelog diz **o que mudou**; a
seção diz **o que é verdade agora**. Os dois não são intercambiáveis, e nenhum dos dois substitui
o outro.
