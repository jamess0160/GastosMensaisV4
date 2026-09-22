# O banco do produto final — decisões de 21/09/2026

**Este documento não é um plano de leva.** Plano de leva nasce em [../Levas/](../Levas/), com
etapas, dependências e critério de aceite, e nenhum deles se escreve ainda: em 21/09/2026 o MVP
não subiu, a leva 8 está em execução, e planejar as levas do produto final agora seria desenhar
em cima de um produto que ainda vai mudar. O que este arquivo faz é **guardar as respostas
enquanto elas estão frescas**, para que o plano, quando for escrito, não recomece a discussão.

Ele responde a uma pergunta só: **o que o banco tem que virar para o produto final existir.** O
que o banco é hoje está em `API/migrations/` (24 tabelas), e o que falta para o MVP está na
[fila do RoadMap](../RoadMap%20MVP.md#a-fila-até-o-mvp).

**A decisão comercial não mora aqui.** Ela mora em
[../estratégia/2026-09-18 Preço por workspace/Decisões.md](../estratégia/2026-09-18%20Preço%20por%20workspace/Decisões.md),
e este documento só carrega o que ela **obriga** no modelo. Onde os dois falarem do mesmo
assunto, vale aquele: copiar o preço para cá criaria a segunda cópia, que é sempre a que
desatualiza.

---

## 1. O que o produto final é

Quatro respostas, e cada uma decide tabelas:

| Pergunta | Resposta | O que ela obriga no banco |
| --- | --- | --- |
| É SaaS pago? | **Sim** | `Plans` e `Subscriptions` saem do limbo. Não são apagadas |
| Cobra por workspace ou por assento? | **Nem um nem outro** | A assinatura é do **usuário pagante**; workspaces e membros são ilimitados e grátis. O preço variável é **conexão bancária** |
| Tem app nativo? | **Sim** — e falta decidir *como* | `UserDevices` é promovida, com `PushToken` e `Platform` (`ios`/`android`/`web`, que a tabela já tem) |
| Multiusuário de verdade ou casal? | **Multiusuário** | `WorkspaceMembers.Role` (`owner`/`editor`/`viewer`) continua servindo. O console multi-workspace do contador é ano 2 e **exige mudar o token** — não é `viewer` com outro nome |

**O app nativo é a resposta com a maior consequência e a menor pegada em banco**, e por isso
está registrada aqui em vez de ficar implícita. Ela encosta numa das decisões que o RoadMap lista
como não-rediscutíveis — *não existe header `Authorization`, só o cookie `HttpOnly` +
`SameSite=Strict`*:

- **wrapper de WebView na mesma origem** — o cookie continua funcionando exatamente como hoje, e
  nada na sessão muda. O push chega pela camada nativa, que é o único motivo de embalar;
- **cliente nativo de verdade** (React Native e afins) — não existe "mesma origem", o cookie
  `SameSite=Strict` deixa de fazer sentido e a decisão de uma porta de entrada só **cai**. Isso é
  reescrever a autenticação, não portar a interface.

Não está decidido, e é a pergunta que precisa de resposta mais cedo: ela muda o que `UserDevices`
guarda e se sobra alguma sessão para guardar.

### O wrapper não custa notificação nem biometria — custa uma ponte

Levantado em 21/09, e derruba a leitura de que embalar em WebView seria abrir mão das duas:

**Notificação nativa: sim, integralmente.** A casca registra no FCM/APNs e recebe o push; a WebView
não participa. E não é opcional — **Web Push não existe dentro de `WKWebView`** (no iOS ele só
funciona em PWA na tela inicial), então receber push é justamente o motivo de embalar em vez de
deixar como site. `UserDevices` já tem a forma: `PushToken`, `Platform`, `DeviceKey`, `LastSeenAt`.
E cada um dos três gatilhos precisa de uma **rota de destino**, porque tocar no aviso tem que abrir
a tela certa dentro da WebView.

**Biometria: a que existe hoje quebra, e a substituta não custa servidor.** São três coisas
diferentes com o mesmo nome:

1. **WebAuthn rodando dentro da WebView** — o que o `UsersAuth` entregou. **Não funciona:**
   `android.webkit.WebView` não expõe a API de credenciais (Chrome e TWA expõem; a WebView crua
   não), e `WKWebView` não a oferece a app de terceiro. Reconferir contra as versões alvo na hora de
   implementar — a área se move —, mas não planejar em cima;
2. **Face ID / BiometricPrompt como tranca local** — funciona e é trivial, mas é só prova de
   presença: nenhuma assinatura que o servidor verifique. Protege o acesso a uma sessão que já está
   no aparelho, e é **mais fraco** do que existe hoje;
3. **Passkey nativo por ponte** — a casca chama a API de plataforma (Credential Manager no Android,
   `ASAuthorization` no iOS) e entrega a asserção para a camada web, que a envia. **A verificação é
   a que já existe**, com o mesmo `UsersAuth.CredentialId` e `Counter`.

**E a API já foi escrita prevendo isso.** `WebAuthnConfig.origins`
(`routes/UsersAuth/sections/WebAuthnConfig.section.ts`) é uma lista separada por vírgula com o
comentário *"o app web e o app nativo têm origins diferentes"* — o servidor já aceita asserção de
autenticador nativo. **Nada muda na API e nada muda no banco.** O custo são os dois arquivos de
domínio bem-conhecido (`assetlinks.json` no Android, *app site association* no iOS), mesma classe de
arquivo da etapa 3 da leva 8.

**O padrão dos dois é o mesmo, e é ele que preserva a decisão da sessão:** a casca nativa **só
obtém o artefato de plataforma** — token de push, asserção biométrica — e **a camada web sempre faz
a chamada HTTP**. É o que mantém uma porta de entrada só e um pote de cookies só. Fazer o contrário
é a armadilha concreta: casca fazendo `POST` por fora não tem sessão, e se fizer login por fora o
`Set-Cookie` cai no pote nativo em vez do da WebView.

**Ressalva de Android:** o **TWA** roda o motor do Chrome, então WebAuthn funciona dentro dele sem
ponte. O iOS não tem equivalente — e TWA no Android com wrapper no iOS deixa dois caminhos de
biometria diferentes, pior que a ponte nos dois.

## 2. As convenções, congeladas

| Ponto | Decisão |
| --- | --- |
| Chave primária | **`increments()` continua.** Sem id público ao lado do interno |
| Dinheiro | **`decimal(15,2)`.** A regra de rateio segue fechando em centavos — quem converte é o código, não a coluna |
| Moeda | **Não entra multi-moeda.** Sem coluna de moeda, sem tabela de câmbio |
| Enum | **`enu()` continua** — `text` + `CHECK`. Cada valor novo é uma migration de `DROP`/`ADD CONSTRAINT`, e isso é aceito: já aconteceu três vezes e custou uma migration cada |
| Fuso | **`timestamptz` para instante, `date` para `CalendarDate`.** Confirmado no servidor. É convenção, não coincidência |
| Exclusão | **Soft delete só onde é arquivamento** (abaixo). O resto é hard delete |
| Cascata | **Apagar usuário ou workspace apaga tudo que pende dele.** O `onDelete("CASCADE")` do `IdWorkspace` já está em todas as tabelas de domínio |

### O que "soft delete só onde é arquivamento" significa em colunas

Arquivamento existe em **quatro** tabelas, e são as quatro que um lançamento antigo referencia e
que o usuário ainda quer parar de ver na hora de lançar: **`Accounts`**, **`Persons`**,
**`PaymentMethods`** e **`Categories`**. É por isso que o `RESTRICT` nas FKs dessas três primeiras
está certo e deve ficar: sem arquivamento, a única saída seria apagar o histórico junto.

Hoje existem **nove** colunas `Active`. Cinco sobram fora da política e precisam de veredito:

- **`Tags` e `Budgets`** — são as duas genuinamente em aberto. Tag e orçamento não são
  referenciados por lançamento fechado do mesmo jeito, então provavelmente viram hard delete. Os
  orçamentos serão revistos ainda no MVP, e a decisão de `Budgets.Active` vai junto com essa
  revisão;
- **`Users`, `UsersAuth` e `TrustedDevices`** — não são arquivamento, são **revogação** de conta e
  de credencial. Semanticamente outra coisa, e ficam.

**A cascata só é segura por causa da guarda da leva 7.** `Workspaces.IdOwnerUser` é `CASCADE`:
apagar o dono apaga o espaço e todo dado dos outros membros dentro dele. O que impede isso de ser
um acidente é o `DELETE /Users` recusando quem é dono de espaço compartilhado até transferir a
propriedade — a guarda é parte da política de exclusão, não um detalhe da rota.

## 3. O cartão — a sua correção derruba metade do item 1 da fila

**O modelo atual está certo para o seu cartão, e o RoadMap estava errado ao chamá-lo de defeito.**
Nubank vence dia 7 e fecha dia 30, 31 ou 28 conforme o mês. A folga em dias corridos descreve isso
**exatamente** — `07/09 − 7 = 31/08`, `07/03 − 7 = 28/02`, `07/10 − 7 = 30/09`. Um dia fixo do mês
não descreveria: o dia muda todo mês, e é justamente o que a folga absorve.

**O que sobra é que os dois modelos estão certos, para emissores diferentes:**

| Cartão | Folga fixa em dias | Dia fixo do mês |
| --- | --- | --- |
| Vence 7, fecha 30/31/28 (Nubank) | **descreve** | não descreve — o dia varia |
| Fecha 27, vence 04 (o da leva 6) | não descreve — a folga é 8 em agosto e 7 em setembro | **descreve** |

Então a conclusão da fila do RoadMap — *"trocar o modelo, e é leva própria"* — **cai**: trocar
resolveria um cartão e quebraria o outro. O que continua verdade é que o segundo cartão segue mal
descrito, e a saída que sobra é a mesma forma que o `CompetenceMode` usou para resolver um empate
parecido: **uma coluna de âncora** (`offset` ou `day_of_month`), com as colunas do modo escolhido
preenchidas e a do outro nula.

**Isso é pergunta, não decisão.** Fica registrado para o plano decidir, e o custo é muito menor que
o da leva que a fila previa: acrescentar uma âncora não recalcula perna já gravada, porque os
cartões existentes continuam no modo que já têm.

## 4. O que sai do escopo, de vez

Cada linha é uma coisa que **não se procura** num plano futuro:

| Item | Decisão |
| --- | --- |
| **Limite do cartão** | Não teremos. Sai do escopo |
| **Anexo / comprovante** | Não teremos. Nenhuma tabela, nenhum armazenamento de arquivo |
| **Meta de economia / objetivo** | Não teremos |
| **Dívida entre pessoas** | Não existe como entidade. Ninguém cadastra uma pessoa só para registrar que deve — isso **é um gasto ou uma renda pendente**, e o modelo já sabe representar os dois |
| **Hierarquia de categoria** | Apagada de vez. A coluna já caiu em 29/08/2026 e não volta — o que morre agora é a pergunta |
| **Multi-moeda** | Não entra |
| **Id público (uuid/nanoid)** | Não entra |
| **Recorrência de renda** | Não entra, e o motivo é do domínio: salário muda de valor com desconto e hora extra. Quem repete é o usuário, pela **clonagem**, que lhe deixa o controle do valor |

## 5. Os dois esqueletos, promovidos

### `Notifications`

**Três gatilhos, e só eles:**

1. um gasto novo foi integrado pelo Open Banking;
2. o consentimento do usuário está vencendo;
3. deu problema na forma de pagamento.

Duas consequências diretas no que a tabela é hoje:

- o `CHECK` do `Type` só tem `system` e `security`. Os três gatilhos pedem valores novos — e
  observe que eles não são do mesmo tipo: **o 1 é de domínio, os 2 e 3 são de cobrança**;
- **`IdWorkspace` é `notNullable`, e os gatilhos 2 e 3 não têm workspace.** Consentimento vencendo
  e pagamento falhando são do **assinante**, não do espaço. Ou a coluna vira anulável, ou os dois
  avisos são outra coisa que não uma `Notification`. Precisa de veredito antes da primeira linha
  de código.

`UserDevices` é promovida junto — é o destino dos três avisos no app.

### `Plans` / `Subscriptions`

**Dois planos: mensal e anual.** Mas **cada inscrição tem o seu próprio preço**, porque o valor
depende de quantas conexões bancárias o assinante tem. Isso muda o papel das duas tabelas:

- `Plans` guarda o **preço de tabela** (é o que `PriceMonthly`/`PriceYearly` já são);
- `Subscriptions` passa a guardar o **valor efetivamente cobrado** e a **contagem de conexões que
  o gerou** — sem a contagem, o preço da renovação não tem insumo, e é o buraco de margem que o
  documento de preço descreve.

Três coisas mais que o modelo de hoje não representa, todas vindas do documento de preço:

- **a assinatura é do pagante.** Hoje `Subscriptions.IdWorkspace` é `notNullable` e `IdUser` é
  anulável — está invertido em relação à decisão;
- **os estados de cobrança**: a régua de falha (retentativa nos dias 3, 5 e 7; somente-leitura e
  consentimento cortado no dia 10), os **30 dias de somente-leitura** depois do cancelamento, a
  **titularidade assumível por qualquer membro**, a **cortesia de uma conexão por termo**, a
  cobrança única de conexão no meio do termo, e a cotação de renovação com **clique ativo**;
- **`Users.TrialStartAt`/`TrialEndAt` duplica `Subscriptions.Status = 'trialing'`.** Uma das duas
  tem que morrer. Com o trial exigindo pagamento autorizado no cadastro, ele **é** uma assinatura —
  o que aponta para a inscrição como fonte única, e as colunas em `Users` saindo.

## 6. O que entra novo

### Open Finance / consentimento — tabela separada, como você pediu

A separação que você propôs é a certa, e vale escrever o porquê: **são dois objetos com leitores
diferentes.**

- **a conexão** — instituição, status, quem conectou, a qual workspace alimenta. É lida por tela,
  aparece em lista, e é ela que a cobrança conta;
- **o consentimento** — o token e a validade (12 meses). Lido **só** pelo sincronizador, por
  nenhuma rota de leitura, e nunca devolvido numa resposta.

Quatro pontos que o plano vai ter que resolver:

- **é a primeira vez que o projeto guarda credencial de terceiro em banco.** Todo segredo até
  hoje é assinado, não guardado (o JWT da sessão, o da recuperação de senha). Precisa decidir a
  cifra em repouso e onde vive a chave;
- **a conexão pertence ao workspace, mas é cobrada do pagante** — e `editor`/`viewer` **não
  conectam banco**, que é a trava 1 do documento de preço. São duas colunas de dono diferentes na
  mesma linha;
- **a contagem de conexões ativas é a fonte do preço.** "Ativo" e "revogado" deixam de ser estado
  de integração e passam a ter consequência financeira;
- **o que o banco devolve precisa de um lugar.** Item de extrato bruto, a regra de deduplicação, e
  a pergunta que a fila do RoadMap já fazia: **o item importado cria lançamento ou espera numa
  caixa de entrada?** O gatilho de notificação nº 1 — *"um gasto novo foi integrado"* — indica que
  **cria e avisa**, mas isso precisa estar escrito antes de virar código.

### Identidade externa — o levantamento do login com Google

Pedido explicitamente. O que é preciso, em ordem de quem depende de quem:

**No banco:**

- **`UserIdentities`** — `IdUser`, `Provider` (`google`), `Subject` (o `sub` do Google, que é o
  identificador estável — **não** o e-mail, que o usuário troca), `Email`, `CreatedAt`, com
  `unique(Provider, Subject)`. Tabela nova, e não colunas em `Users`, porque uma conta pode ter mais
  de uma identidade;
- **`Users.Password` vira anulável.** Hoje é `notNullable`, e uma conta que só entra pelo Google não
  tem senha;
- **`Users.Phone` vira anulável, ou ganha um passo de completar cadastro.** Hoje é
  `bigInteger notNullable` e **o Google não devolve telefone** — é o detalhe que trava o fluxo no
  primeiro `INSERT`;
- **`EmailConfirmedAt`** é carimbado na hora quando o provedor afirma que o e-mail é verificado.

**No fluxo, três coisas que não são schema mas quebram se não forem decididas junto:**

- **o aceite dos termos.** `POST /Users` exige `AcceptedTerms`, com `TermsAcceptedAt`/`TermsVersion`
  carimbados pelo servidor. O login com Google precisa de uma tela de aceite **antes** de criar a
  conta — presumir o aceite é exatamente o que a leva 7 consertou;
- **a vinculação de conta que já existe.** E-mail do Google igual ao de uma conta com senha: **pedir
  a senha para vincular.** Vincular só porque o e-mail bate é tomada de conta por provedor que não
  verifica e-mail;
- **a recuperação de senha de uma conta sem senha.** O token de reset carrega a impressão digital do
  hash da senha atual — é o que o torna de uso único. Conta sem senha não tem impressão: o fluxo
  precisa recusar com mensagem clara, não estourar.

**E o ponto que liga com o app nativo:** o `state`/`nonce` do OAuth não pode viajar num cookie
`SameSite=Strict`, porque o retorno do Google é uma navegação de outro site e o navegador **não
manda** o cookie de volta. Ou ele é um JWT curto assinado — o padrão que o projeto já usa duas
vezes —, ou é um cookie `SameSite=Lax` só para esse passo. E se o app nativo for cliente de
verdade, o fluxo é outro (PKCE com esquema próprio), o que é mais uma razão para a pergunta do
app vir antes desta.

### Auditoria

Entra. O que precisa ser definido:

- **o que se audita.** Os candidatos são os eventos em que duas pessoas discordam do que
  aconteceu: criar/alterar/apagar lançamento, mudar papel de membro, conectar e revogar banco,
  assumir titularidade;
- **`AuditLogs`** com `IdWorkspace` (anulável, pelos eventos de cobrança), `IdUser` de quem fez
  (`SET NULL`, porque o log sobrevive ao usuário), ação, entidade, id da entidade e o instante. Se
  guarda o valor anterior, o diff ou nada além da ação é decisão de plano;
- **o conflito com a cascata, e ele é real.** A política diz que apagar workspace apaga tudo que
  pende dele — o log inclusive. Se a auditoria existe para resolver disputa, apagá-la junto tira
  dela o único momento em que ela valeria. Por outro lado é o que a exclusão de dados pessoais
  pede. Precisa de decisão explícita, não de default de FK;
- **auditoria não substitui `Expenses.IdUser`.** Aquela coluna é "quem lançou" e é lida pela
  interface; o log é outro assunto.

### Recorrência de gasto fixo

**Precisa de rotina, e o motivo é concreto:** `Kind = 'fixed'` materializa uma corrente de
**12 ocorrências reais** no momento do cadastro (`OCCURRENCE_WINDOW`, em
`routes/Expenses/sections/POST/createSeries.ts`), limitada por essa janela **ou** pelo
`RecurrenceEndDate`, o que vier primeiro. Uma série declarada sem fim, portanto, **acaba em 12
meses** — e não existe rotina nenhuma que estenda a janela. O motor de rotinas já existe e já roda
duas (`MaterializeBudgetPeriods`, `CloseBudgetMonth`); falta a terceira.

Isso é ampliação de rotina, não mudança de modelo: a corrente de ocorrências reais continua sendo
o desenho, e nenhuma tabela nova nasce disso.

## 7. O que o MVP resolve antes, e o produto final herda

Não se decide aqui, e é de propósito:

| Assunto | Estado |
| --- | --- |
| **Fatura como entidade** | Entra **ainda no MVP**. O produto final já a encontra pronta |
| **Entrada assimétrica ao gasto** | Alinhada ainda no MVP — a entrada não tem categoria, forma de pagamento nem o par `CompetenceDate`/`CashDate` |
| **Orçamentos** | Revistos ainda no MVP. A decisão de `Budgets.Active` vai junto |

**`Inflows` continua acumulando entrada e transferência** (`Kind = 'transfer'`). Sem tabela
`Transfers`, e o `CHECK` que amarra as duas contas fica.

### "Nada é parcialmente liquidado" — mantido, com uma exceção que não é exceção

A regra fica. A fatura é o único caso em que se paga um pedaço, e a saída **não** é uma coluna de
valor pago nem um status `partial`: são **dois lançamentos inteiros** — "Fatura pt 1" e
"Fatura pt 2" —, cada um liquidado por completo. O modelo não aprende a palavra "parcial", e é isso
que preserva a regra em vez de furá-la.

---

## O que segue aberto

O que as respostas de 21/09 **abriram**, e que nenhum plano pode começar sem fechar:

1. **O app nativo é wrapper de WebView ou cliente nativo?** Decide se a sessão por cookie
   `SameSite=Strict` sobrevive — e portanto se a decisão "não existe header `Authorization`" cai.
   É a pergunta de maior alcance da lista. **O levantamento de 21/09 tirou o argumento que puxava
   para o cliente nativo:** notificação e biometria existem no wrapper, por ponte, sem mexer na API
   nem no banco (ver acima). O que sobra a decidir é o escopo da ponte, não o modelo do app;
2. **A âncora do fechamento do cartão** — acrescentar `offset`/`day_of_month`, ou aceitar que o
   cartão fecha-27-vence-04 fica mal descrito (com o aviso de tela que a leva 6 já entregou);
3. **`Notifications.IdWorkspace` anulável**, ou os avisos de cobrança viram outra coisa;
4. **`Users.TrialStartAt`/`TrialEndAt` ou `Subscriptions.Status = 'trialing'`** — qual das duas
   morre;
5. **O item importado do banco cria lançamento ou espera numa caixa de entrada?**
6. **O log de auditoria cai na cascata do workspace, ou sobrevive a ela?**
7. **`Tags.Active` e `Budgets.Active`** — hard delete ou arquivamento;
8. **A cifra em repouso do token de consentimento**, e onde vive a chave.

---

*Anotado em 21/09/2026, a partir da conversa do mesmo dia. **Não é plano de leva** — nenhuma leva
do produto final foi escrita, e não se escreve nenhuma antes do MVP subir. Preço e cobrança:
[../estratégia/2026-09-18 Preço por workspace/Decisões.md](../estratégia/2026-09-18%20Preço%20por%20workspace/Decisões.md).*
