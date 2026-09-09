# Changelog do contrato — Fase #3

As mudanças da **leva 3** — *o que depende de infra ou de decisão* —, da mais recente para a mais
antiga. Dez etapas, 2026-09-07.

Duas etapas dela não aparecem aqui, e é o comportamento certo: o **motor de rotinas** e a **infra
de e-mail** são infra, e infra não muda nada que o front enxergue. Quando a rotina do orçamento
muda um número na tela, a entrada é da rotina — não do motor.

Os três marcadores (🔴 quebra / 🟡 comportamento / 🟢 adição) estão definidos na seção 19 do
[contrato](../../API%20-%20Contrato%20Front-end.md#19-changelog), junto com a regra do que entra
aqui e do que não entra.

> Este arquivo diz **o que mudou**. O que é **verdade hoje** está sempre no
> [contrato](../../API%20-%20Contrato%20Front-end.md) — os dois não são intercambiáveis, e é por
> isso que toda entrada aponta para a seção do contrato que ela alterou.

**O que a leva 3 entregou** está em
[Levas executadas](../../Levas%20executadas.md#leva-3--o-que-depende-de-infra-ou-de-decisão), e o
**desenho** dela no [plano](../../levas/3.%20Plano%20de%20Desenvolvimento%20-%20Leva%203.md).

---

### 2026-09-07 — `GET /Reports/Export`: a planilha passa a ser gerada pelo servidor

🟢 **Adição** — uma rota nova na seção 15, e **a primeira do contrato que não responde JSON**.

**O que entrou.** `GET /Reports/Export?From=&To=` devolve um `.xlsx` com três abas (Resumo, Entradas, Gastos). Sem `From`/`To`, sai o histórico inteiro.

**Quem monta o arquivo agora é a API.** No V3 o cliente pedia os dados e montava a planilha no navegador, o que significa **replicar as regras de agregação** — exatamente o risco que criou a seção 15. A planilha sai com os mesmos números da tela porque lê do mesmo lugar.

**Ação do front:**

1. **trate a resposta como binário** — `response.blob()` no `fetch`, `responseType: "blob"` no `axios`. Um `.json()` aqui estoura;
2. **mande o cookie** (`credentials: "include"`), como em qualquer rota 🔒;
3. use o `filename` do `Content-Disposition` ao salvar, ou monte o seu — mas o do servidor já carrega o período;
4. **apague o código de geração de planilha do cliente**, junto com a dependência que ele usava.
### 2026-09-07 — `GET /Reports/Statement`: extrato de conta e de cartão

🟢 **Adição** — uma rota nova na seção 15, com duas assimetrias que a seção descreve por extenso. Sem elas, o front monta a tela achando que os dois extratos seguem a mesma regra.

**O que entrou.** `GET /Reports/Statement?ReferenceMonth=YYYY-MM` (opcional, default o mês corrente): o extrato de **todas** as contas e de **todas** as faturas do mês, numa resposta só.

**O que ela promete, e é a única coisa que ela promete:** `OpeningBalance` + a soma dos `Value` das linhas = `ClosingBalance`, ao centavo — e o `ClosingBalance` é o **mesmo** `Balance` que `GET /Accounts?ReferenceMonth=` devolve para o mesmo mês. O extrato é a abertura do saldo, não uma segunda consulta sobre as mesmas tabelas.

**As duas assimetrias:**

1. **o extrato da conta só tem o liquidado; o do cartão tem pago e pendente** — uma fatura existe antes de ser paga, e um extrato de conta que contivesse pendente não fecharia;
2. **as compras do cartão saem agregadas numa linha `invoice` na conta e detalhadas no cartão** — quarenta compras não viram quarenta linhas no extrato bancário. Não é dupla contagem: é a mesma perna vista dos dois lados.

**Isto não é conciliação.** Não importa arquivo de banco, não casa lançamento com lançamento e não tem estado "conciliado" — é a abertura do que o sistema já calcula.

**Ação do front:** montar a tela de extrato a partir desta rota, e **não** somar `GET /Inflows` + `GET /ExpensePayments` para chegar ao mesmo lugar — as regras de estado e de data das duas listas são outras, e o resultado não fecha com o saldo.
### 2026-09-07 — `GET /Reports/Month`: os agregados do Dashboard saem do cliente

🟢 **Adição** — uma rota nova e uma seção própria (15). Nada do que existe muda de forma; o que muda é **de onde o número vem**.

**Por que ela existe.** As quatro regras de agregação do app **se contradizem de propósito** — a transferência conta no saldo e não conta no "quanto entrou"; o orçamento conta o pendente e o saldo não; o gasto se soma por perna, não por compra. Enquanto elas viviam replicadas no cliente, duas implementações da mesma pergunta terminavam mostrando dois totais diferentes na mesma tela.

**O que entrou.** `GET /Reports/Month?ReferenceMonth=YYYY-MM` (opcional, default o mês corrente), com nove números — ver a seção 15 para a tabela completa das regras.

**🔴 Um deles conserta um erro que o cliente tinha: `OpeningBalance`.** Somar só as entradas do mês para dizer quanto ainda dá para gastar ignora o dinheiro que já estava na conta no dia 1º — quem começa setembro com 1000 e recebe 3000 vê **3000**, tendo 4000. Não é problema de escala: dá errado com dois lançamentos no banco.

**`Available` e `CurrentBalance` vão discordar, e é a resposta certa.** Um é o mês que a pessoa está vivendo (competência, pendente conta, abre com o saldo anterior); o outro é o dinheiro que já saiu (caixa, só o realizado). `OpenInvoices` é o que liga os dois: quanto do saldo já tem dono.

**Ação do front:**

1. **apague as somas de agregação do cliente** e leia esta rota — inclusive quem só precisa do "posso gastar";
2. mostre `OverdueReceivable`/`OverduePayable` na tela ("R$ X vencidos"), com caminho para receber ou cancelar. Eles entram no `Available` de propósito, e uma previsão que nunca chega infla o indicador para sempre se ninguém a resolver;
3. quem usava o paliativo de somar `GET /Accounts?ReferenceMonth=<mês anterior>` para achar a abertura pode parar: o número é o mesmo, e agora vem pronto.
### 2026-09-07 — `/PaymentMethods`: `CompetenceMode`, o cartão que conta como débito

🟢 **Adição** na seção 6 (um campo no cadastro do cartão) e na 11/12 (a perna ganha `CashDate`) — e 🟡 **Comportamento** na 13: **o mesmo gasto passa a consumir o orçamento de outro mês**, dependendo do cartão. É o caso que esta seção existe para anunciar: o número mantém o nome e muda de significado.

**O problema.** Duas pessoas usam cartão de crédito de dois jeitos incompatíveis. Quem concentra o dia a dia e paga a fatura inteira todo mês trata o cartão como débito: o que passou nele em agosto **é gasto de agosto**. Quem usa como reserva passa no cartão justamente para pagar no mês seguinte. A API atendia só o segundo — e para o primeiro isso produzia exatamente a mentira que o indicador existe para evitar: em 20 de agosto, com metade do salário já passada no cartão, o "posso gastar" ainda mostrava o mês quase inteiro disponível.

**O que entrou.** `CompetenceMode`, só em `Kind='credit_card'`, `null` nas outras formas:

| Modo | A compra de **21/08** num cartão que vence dia 28 | 600 em 6× |
|---|---|---|
| `purchase` *(default)* | pesa em **agosto** | 100 por mês a partir de agosto |
| `invoice` | pesa em **setembro**, com a fatura | 100 por mês a partir de setembro |

**O default é `purchase`**, inclusive nos cartões que já existem — confirmado com o dono: não há base em produção, então nenhum número muda de significado para ninguém. **Se o seu cartão é de reserva, cadastre-o (ou edite-o) com `invoice`.**

**A perna passou a ter duas datas, e elas discordam de propósito:**

| Campo | O que é | Quem lê |
|---|---|---|
| `CompetenceDate` | quando a perna **pesa** | `Spent` do orçamento, `GET /ExpensePayments` |
| `CashDate` *(novo)* | quando o dinheiro **sai da conta** | `Balance` de `GET /Accounts` |

Fora de um cartão `purchase` as duas são idênticas — é por isso que só agora fez falta separá-las.

**O `Balance` não mudou, e não pode mudar.** O modo responde "quanto eu gastei", nunca "quanto eu tenho". Antes desta entrega o saldo cortava pela competência, e isso era inofensivo só porque as duas datas eram a mesma coisa — com `purchase`, uma compra de 20/08 quitada na fatura de 05/09 sairia do saldo **de agosto** e todo saldo de mês passado ficaria errado.

**Trocar o modo vale para o futuro.** As datas são congeladas na perna no lançamento: virar a chave em novembro não reescreve agosto.

**Ação do front:**

1. **um seletor no cadastro/edição do cartão** com os dois modos, e o texto que os separa ("pago a fatura toda todo mês" × "uso o cartão para pagar depois");
2. se você guarda a perna em cache, **grave a `CashDate` junto** e use-a em qualquer conta de saldo — a `CompetenceDate` só serve para "quanto pesou no mês";
3. e não estranhe o "posso gastar" e o "tenho em conta" discordarem num cartão `purchase`: eles respondem perguntas diferentes, e é a resposta certa.
### 2026-09-07 — `POST /Users/login`: sessão de 30 dias, no "manter conectado"

🟢 **Adição** — um campo opcional no corpo do login (seção 2) e o mesmo campo no `POST /UsersAuth/authenticate` (seção 3). Nada do que já existe muda: sem o campo, a sessão continua sendo a de 24 horas.

**O que entrou.** `RememberDevice`, booleano, default `false`:

| `RememberDevice` | Duração da sessão | `Max-Age` do cookie |
|---|---|---|
| ausente ou `false` | 24 horas | `86400` |
| `true` | 30 dias | `2592000` |

**O número que a tela já prometia agora é verdade.** A caixa "manter conectado" existia no login e não mudava nada: toda sessão morria em 24 horas.

**Vale para os dois logins.** O campo é o mesmo, com o mesmo nome e o mesmo default, no login por senha e no por biometria.

**Trocar de workspace não rebaixa a sessão.** `POST /Workspaces/switch` reemite a credencial, e a duração escolhida viaja dentro do token — uma sessão de 30 dias continua de 30 dias depois do switch. (Antes desta etapa não havia o que rebaixar: tudo era 24h.)

**Ação do front:** ligar a caixa "manter conectado" neste campo. Nada mais — não guarde nada do lado do cliente para lembrar a sessão: quem mantém o usuário logado é o cookie `HttpOnly`, e o JavaScript da página não o alcança.
### 2026-09-07 — `/Users`: confirmação de e-mail

🟢 **Adição** — duas rotas públicas na seção 2 — e 🟡 **Comportamento**: `GET /Users/getSelf` passa a devolver `EmailConfirmedAt`, e `PUT /Users` passa a ter um efeito colateral quando o `Email` muda.

**O que entrou.**

| Rota | Corpo | O que faz |
|---|---|---|
| `POST /Users/confirmEmail` | `{ Token }` | confirma o endereço a partir do link |
| `POST /Users/resendConfirmation` | `{ Email }` | manda o link de novo |

Até agora ninguém provava que o endereço cadastrado era seu. Duas consequências: uma conta nascia sobre um e-mail com erro de digitação e o dono nunca recebia a recuperação de senha — trancado para fora sem ter feito nada errado —, e o endereço de outra pessoa podia ser usado no cadastro.

**Quem não confirmou continua entrando e usando o app.** Nada é bloqueado por causa disso, e essa é uma decisão, não uma etapa pela metade: bloquear o login seria mais simples de raciocinar e é o que custa cadastro — quem não recebe o e-mail (spam, typo, provedor lento) ficaria do lado de fora dependendo de o reenvio funcionar.

**A tela que falta é sua.** O e-mail aponta para `APP_URL/confirmar-email?Token=…` — **o front**, não a API. Essa tela lê o `Token` da query e chama o `POST /Users/confirmEmail`. O link vale 48 horas, e clicar nele duas vezes responde `200` das duas.

**Três coisas para acertar:**

1. **A faixa da tela lê o `EmailConfirmedAt` do `getSelf`.** `null` = aparece.
2. **Trocar o e-mail no `PUT /Users` derruba a confirmação** e dispara um novo e-mail para o endereço novo. Releia o `getSelf` depois de um `PUT` que muda o endereço.
3. **`resendConfirmation` responde `200` sempre**, inclusive para e-mail sem conta e para quem já confirmou — e tem um freio de 2 minutos por endereço, que **não** muda a resposta. Segure o botão do seu lado com um contador.

**Ação do front:** montar a tela `/confirmar-email`, ler o `EmailConfirmedAt` no `getSelf` para decidir a faixa, e oferecer o reenvio com contador.
### 2026-09-07 — `/Users`: recuperação de senha

🟢 **Adição** — duas rotas públicas na seção 2. Nada do que já existe muda.

**O que entrou.**

| Rota | Corpo | O que faz |
|---|---|---|
| `POST /Users/forgotPassword` | `{ Email }` | manda o link por e-mail |
| `POST /Users/resetPassword` | `{ Token, NewPassword }` | grava a senha nova |

Até agora só existia o `updatePassword`, que exige a senha antiga: quem esqueceu não tinha caminho nenhum, e o link "Esqueci minha senha" estava na tela desabilitado.

**A tela que falta é sua.** O e-mail aponta para `APP_URL/recuperar-senha?Token=…` — **o front**, não a API. Essa tela lê o `Token` da query, pede a senha nova e chama o `POST /Users/resetPassword`. O link não é um `GET` que muda estado de propósito: assim o pré-carregador de link de um cliente de e-mail não gasta o token sem ninguém ter clicado.

**Três coisas para acertar na tela:**

1. **`forgotPassword` responde `200` sempre**, inclusive para e-mail sem conta, e com a mesma `msg`. Nunca mostre "e-mail não encontrado" — a resposta não diz isso, e é de propósito que não diga.
2. **O link vale 30 minutos e uma vez só.** Erro de token é sempre o mesmo `406`, com um texto pronto para a tela: mostre a `msg` e ofereça pedir outro link.
3. **Não vem `Set-Cookie`**: trocar a senha não abre sessão. Redirecione para o login.

**Ação do front:** habilitar o "Esqueci minha senha", montar a tela `/recuperar-senha` e, enquanto o servidor não tiver rate limiting, segurar o botão de envio com um intervalo do seu lado.
### 2026-09-07 — `/Budgets`: o mês do orçamento passa a nascer sozinho, e o mês anterior a fechar

🟡 **Comportamento** — ver as seções 13 e 14. Nenhuma rota mudou de forma: o que mudou é **o que existe no banco quando você lê**.

**O que entrou.** Duas rotinas no servidor, todo dia 1º:

| Rotina | O que faz |
|---|---|
| Materializar | cria o mês novo a partir de cada definição **ativa** de orçamento, com o teto que valia naquele dia |
| Fechar | carimba `Status: "closed"` e `ClosedAt` em todo período do mês que acabou |

**O recado que some da tela.** Até aqui o orçamento de junho simplesmente não existia até alguém cadastrá-lo, e a tela precisava dizer *"seu teto de alimentação existe, mas não para este mês"*. Não precisa mais: no dia 1º o mês está lá.

**`Status` agora muda sozinho.** Um período que você leu como `open` em 31 de agosto volta como `closed` em 1º de setembro, sem nenhuma chamada sua. Se a sua tela desenha algo a partir do `Status`, é este o ponto a conferir — **fechado não é travado**: o `PUT` de um mês fechado continua funcionando, porque corrigir o teto de um mês passado é o que a tabela do mês congelado existe para permitir.

**O que *não* mudou.** `POST /Budgets` continua igual, e continua sendo o caminho para orçar **agora** em vez de esperar a virada. Cadastrar um mês que a rotina já criou continua respondendo `406` `"Este orçamento já existe neste mês."` — o conserto continua sendo editar o mês (seção 14). E a rotina **nunca sobrescreve** um mês que já existe: o teto que você ajustou na mão fica.

**Mês passado que a rotina não pegou continua sem período**, e isso é de propósito: a resposta certa para "qual era meu limite em março" é *"esse mês não tem período"*, não um teto inventado hoje.

**Ação do front:** nenhuma, além de tirar da tela o aviso de mês não cadastrado e de conferir o que você desenha a partir de `Status`.
