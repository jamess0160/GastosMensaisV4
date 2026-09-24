# Roadmap — Gastos Mensais V4

**Este é o documento único do projeto.** Ele responde três perguntas, e só elas:

1. **o que existe em código hoje**, dos dois lados;
2. **o que falta para o MVP entrar em produção**, na ordem em que deve ser feito;
3. **o que foi deliberadamente deixado de fora**, e por quê — para nada ser procurado numa
   leva onde não está.

O **desenho** de cada trabalho não mora aqui: mora em [Levas/](Levas/), um arquivo por leva. E
tudo que descrevia o projeto quando ele era **dois repositórios** está congelado em
[Old/](Old/), que continua versionado pelo porquê das decisões, não pelo estado que descreve.

> **09/09/2026 — os dois repositórios viraram um.** `API/` e `Frontend/` são agora duas pastas
> do mesmo repositório, com um histórico só. Isso matou dois documentos de uma vez: o
> **contrato Front-end**, que existia para o front enxergar uma API que ele não podia ler, e o
> **Pendencias Backend**, que era a fila de pedidos de um repositório para o outro. Os dois
> estão em [Old/](Old/). Daqui pra frente, uma pendência do front contra a API é **uma etapa
> de leva**, escrita no mesmo plano que a etapa do front que a consome.

---

## Onde estamos

### API — três levas, todas fechadas

O esquema está **completo**: as 23 tabelas existem em `API/migrations/` (as 22 de domínio mais
`RotineRuns`), e todas as de domínio têm código em cima.

| Leva | O que entregou | Estado |
| --- | --- | --- |
| **1 — MVP** | Contas e formas de pagamento, categorias, pessoas e tags, entradas e transferências, gasto simples, parcelamento, gasto fixo, orçamento | **fechada**, 8 de 10 etapas — a rotina mensal foi para a leva 3, e a gestão de membros continua aberta |
| **2 — o que sobe junto** | Logout, convite de workspace, pernas do período, conta "só cartão", orçamento por pessoa, `CompetenceDate`, estorno | **fechada**, 11 de 11 |
| **3 — infra e decisão** | Motor de rotinas, rotina mensal do orçamento, infra de e-mail, recuperação de senha, confirmação de e-mail, sessão configurável, `CompetenceMode`, agregados do mês, extrato, exportação `.xlsx` | **fechada**, 10 de 10 |

Etapa por etapa, com commit e data: [Old/API/Levas executadas.md](Old/API/Levas%20executadas.md).

**Fora de leva, depois disso:** dois fixes do `Available` em 08/09 (`6cdf0e6`, `037890b`) e, em
09/09, o `GET /Workspaces/self` passando a dizer **qual** espaço está selecionado (`7c0f11b`) —
que fecha a última pendência que o front tinha contra a API.

**16 suítes de integração**, sem um único teste unitário e sem nada mockado. A última contagem
registrada é **732 testes**, no fim da leva 7.

### Front — cinco levas, todas fechadas

**16 telas**, todas respondendo em 390px, todas ligadas na API de verdade — mais as três que a
leva 7 acrescentou, que não consomem rota nenhuma: `/termos`, `/privacidade` e a de 404.

| Leva | O que entregou | Estado |
| --- | --- | --- |
| **1 — Plano de desenvolvimento** | Do zero ao MVP do cliente: chassi, sessão, cadastros, lançamento, listas, dashboard, relatório | **fechada** |
| **2 — Ajustes** | A lista crua de correções de layout e de conteúdo das telas | **fechada** |
| **3 — Ajustes** | Mês compartilhado entre telas, navegação mobile, e a reescrita de Gastos, Renda e Contas | **fechada** |
| **4 — As mudanças de contrato de setembro** | Cartão por vencimento + folga, saldo do mês, fatura, estorno, orçamento por pessoa, logout, seletor de espaço e convites | **fechada**, 10 de 10 |
| **5 — Os números saem do cliente, e as telas que faltavam** | Orçamento que nasce sozinho, `GET /Reports/Month`, `CompetenceMode`, extrato, exportação `.xlsx`, sessão de 30 dias, recuperação de senha, confirmação de e-mail | **fechada**, 8 de 8 |

Plano da leva 5: [Old/Front/levas/5. Plano de Ajustes 5.md](Old/Front/levas/5.%20Plano%20de%20Ajustes%205.md).

### Leva 6 — a primeira unificada, fechada em 09/09

**18 de 18 etapas**, num plano só com os dois lados na mesma fila:
[Levas/6. O cartão, o uso real e a gestão de membros](Levas/6.%20O%20cartão,%20o%20uso%20real%20e%20a%20gestão%20de%20membros.md).
Ela entregou os três blocos que abriam a fila abaixo — o cartão em modo `purchase` (a fatura
que não montava, a compra no dia do fechamento, o `Charged`, o ciclo no extrato), as treze
anotações do uso real, e a gestão de membros inteira: listar, trocar papel, remover, sair e
transferir a propriedade.

As cinco etapas que faltavam foram fechadas em 09/09, em cinco commits: `Fase #5 | Etapa 4` a
`Etapa 8`. Com elas saíram do produto os **três botões rotulados "ainda sem API"** — o de
conciliar extrato virou **"Extrato"** (a rota não concilia nada, e o nome tinha que dizer
isso), o de exportar passou a baixar o `.xlsx` do servidor, e "Esqueci minha senha" virou
navegação de verdade. Nasceram quatro telas: `contas/extrato`, `/esqueci-senha`,
`/recuperar-senha` e `/confirmar-email`.

### Leva 7 — a primeira de produção, 12 etapas em 10/09 e a 13 em 11/09

**13 de 13 etapas**, num commit por etapa:
[Levas/7. O que a lei cobra e o que só quebra em produção](Levas/7.%20O%20que%20a%20lei%20cobra%20e%20o%20que%20só%20quebra%20em%20produção.md).
Ela fechou os dois blocos que abriam a fila abaixo — **compliance** e **o código de produção** —
e nada nela é feature.

Do lado da lei: `/termos` e `/privacidade` existem, com a data de versão no topo e o rodapé das
telas públicas linkando para as duas; o aceite deixou de morrer no navegador (`AcceptedTerms`
obrigatório em `POST /Users`, com `TermsAcceptedAt`/`TermsVersion` carimbados **pelo servidor**,
sem *backfill* de quem já existia); e `DELETE /Users` passou a existir, pedindo a senha, com a
guarda que recusa quem é dono de espaço compartilhado até transferir a propriedade.

Do lado do deploy saiu código, e é o mais importante: o **socket.io e o `/Cache` inteiro**
foram apagados (−838 linhas, duas dependências e uma porta a menos escutando), junto com o
`Utils/constants.json` herdado do outro projeto. Entraram `trust proxy`, `helmet`, corpo
limitado a 100kb e a saída do `cors()`; rate limiting por IP nas quatro rotas públicas de
`Users`; `NODE_ENV` como a **única** variável de ambiente, lida num lugar só
(`Utils/environment.ts`), com o log de produção indo para o stdout em vez do disco; o
desligamento limpo em `SIGTERM`/`SIGINT`, que espera a requisição em voo e o tick de rotina
antes de fechar; o `knexfile` com a chave `production` e o `build/knexfile.js` saindo do
`build`; e a tela de 404 dentro do chassi.

**A leva reabriu em 11/09, com a etapa 13, e fechou no mesmo dia.** No dia seguinte ao
fechamento das doze, a idade mínima dos dois documentos baixou de 18 para 16 anos (um
adolescente pode ser aprendiz aos 14 e ter dinheiro próprio; o que ele não pode, antes dos 16, é
assumir sozinho um contrato), a versão andou para `2026-09-11` — e **ninguém foi perguntado de
novo**. A 13 é a que lê a coluna que a 2 gravou: `GET /Users/getSelf` ganhou o `TermsOutdated`
**derivado** (calculado a cada leitura, como o `Balance` e o `Spent` — a comparação é da API, e
o cliente não refaz nenhuma), `POST /Users/acceptTerms` carimba a versão do servidor sem receber
corpo, e um modal **bloqueante** no chassi cobre o app para quem está numa versão antiga ou
nunca aceitou nada. As saídas dele são duas — aceitar, ou sair da conta —, e a decisão que o
plano original adiava está tomada: **toda** edição dos documentos pede aceite de novo, inclusive
a de uma vírgula, porque manter "mudança relevante" e "ajuste de redação" seria um julgamento a
cada commit, e errá-lo para menos é a própria falha que a etapa conserta.

### Leva 9 — a primeira que nasce de uso real, fechada em 23/09

**16 de 16 etapas**, escritas em 22/09 e executadas entre 22 e 23/09:
[Levas/9. O que voltou de quem usa](Levas/9.%20O%20que%20voltou%20de%20quem%20usa.md). Ela é a primeira
que não sai de uma lista interna: a entrada são treze retornos do dono depois do MVP no ar, e
por isso ela mistura defeito de uma linha com **duas trocas de modelo**.

**O cartão.** `ClosingOffsetDays` — a folga em dias corridos — saiu, e entrou **`ClosingDay`**, o
dia do mês em que o cartão fecha; a relação entre os dois dias (`ClosingDay > DueDay` ⇒ fecha no
mês anterior ao do vencimento) é a única coisa que o modelo infere, e o laço de rolagem do
`InvoiceDates` morreu com ela. Em cima disso, a competência de uma compra em modo `purchase`
passou a ser **o mês do ciclo que a pegou**, não o mês da compra: num cartão que fecha 30, o
gasto de 31/08 pesa em setembro, que é quando a fatura que o cobra fecha. As duas migrations
recalculam a perna já gravada, e isso **move dinheiro entre meses** para quem já tinha compra em
cartão — o ponto sendo que os números velhos estavam errados. A fatura ganhou tela própria
(`/contas/fatura/:id`), com navegação entre ciclos independente do mês global e o botão de
quitar onde ela aparece, tudo sobre a tupla `(cartão, vencimento)` — sem tabela nova.

**O orçamento.** A tabela `Budgets` morreu, e com ela o teto perene e a rotina que materializava
o mês no dia 1º. `BudgetPeriods` passou a carregar o alvo direto — categoria **e/ou** pessoa, o
que o `CHECK` antigo proibia —, e o orçamento virou **uma repartição da renda do mês**: qualquer
mês é montável, inclusive o que ainda não chegou, clonando o anterior ou rateando a renda na
tela nova `/orcamento`. Cada porção de gasto consome **uma** linha ou nenhuma, com precedência
`(pessoa, categoria)` → `(pessoa, —)`, e o que não casa aparece como `Unbudgeted` em vez de
sumir — sem isso a regra estrita seria silenciosa.

O resto: a lista de Gastos passou a mostrar **a parcela, e não a compra** (a tabela e a faixa de
indicadores voltaram a somar a mesma coisa, e o vermelho de atraso passou a olhar o `CashDate`);
a categoria global acabou, cada espaço tem as suas treze e pode arquivar e reordenar; o cadastro
por convite chega com o e-mail preenchido e travado; o rateio de pessoas nasce dividido; e o app
ganhou **tema escuro**, com "sistema" por padrão e o carimbo antes da primeira pintura.

---

## A fila até o MVP

**A fila está vazia desde 23/09/2026.** O único item que restava — o fechamento do cartão
guardado como dia do mês — saiu com a leva 9, e o texto dele fica abaixo pelo diagnóstico, não
pela pendência. O que chegar daqui pra frente vem de uso, como vieram os treze retornos da 9, e
não desta lista.

**A lacuna do cliente acabou.** Toda rota que a leva 5 consumia já existia com teste desde
07/09, e foi a junção dos repositórios ter pegado a leva no meio que a deixou aberta. O que
entrou na fila depois disso não era dívida de um lado contra o outro: era trabalho que nunca
tinha entrado em leva nenhuma, dos dois.

**"Produção: o ambiente" saiu daqui em 11/09**, quando virou a [leva 8](Levas/8.%20O%20que%20só%20se%20prova%20subindo.md)
inteira: imagem dos dois lados, `compose`, vhost do host, e-mail do domínio, os arquivos que o
navegador procura sozinho, backup com restore testado e o runbook. O que a leva ainda não fechou
está na tabela de etapas dela, e o que se faz com tudo isso está em [Deploy.md](Deploy.md) — um
item de fila não é o lugar de nenhum dos dois.

> **Esta fila diz o que falta, não o que cada leva faz.** Quem decide o recorte de uma leva é o
> plano dela, em [Levas/](Levas/) — um item daqui pode virar uma etapa, várias, ou atravessar
> duas levas. Amarrar item e leva neste documento foi o que fez uma leva ser definida por fora
> antes de existir.

### 1. O fechamento do cartão guardado como dia do mês

> **22/09/2026 — saiu da fila: virou as etapas 2 e 3 da [leva 9](Levas/9.%20O%20que%20voltou%20de%20quem%20usa.md),
> entregues em 22/09. Este item está fechado, e com ele a fila.**
> Não por decisão de planejamento, e sim porque o uso real caiu em cima dele: o primeiro retorno
> depois do MVP no ar foi um cartão que fecha dia 30, com o gasto de 31/08 pesando em agosto.
> A leva 9 troca `ClosingOffsetDays` por `ClosingDay` e, **em cima disso**, faz a compra pesar no
> mês do ciclo que a pegou — que é o que o retorno pedia e o que a folga em dias corridos não
> tinha como entregar certo. O texto abaixo é o diagnóstico original, e continua valendo como o
> porquê.

**Leva própria.** A etapa 2 da leva 6
reproduziu "a compra no dia do fechamento" e o defeito não é a comparação, que está certa: quem
erra é o modelo que descreve o cartão. Hoje o fechamento é o vencimento menos uma folga em
**dias corridos**, e o emissor brasileiro fecha num **dia fixo do mês** — as duas descrições não
são a mesma coisa. Com o cartão real que motivou a etapa (fecha 27, vence 04), quem cadastra
lendo a fatura de agosto grava `ClosingOffsetDays = 8`, porque 27/08 a 04/09 são 8 dias; em
setembro são 7, o fechamento derivado cai no dia **26**, e a compra de **27/09 é cobrada na
fatura de 04/11** em vez da de 04/10. Um dia de erro na descrição é um mês de erro no caixa, e
isso vale para todo cartão cuja folga atravessa a virada do mês. Trocar o modelo é migration,
recálculo de perna já gravada e reescrita do `InvoiceDates` — por isso é leva, não etapa. Até
lá, a tela do cartão mostra as duas datas do ciclo do mês corrente e avisa quando o fechamento
derivado anda de mês para mês, em vez de aceitar a folga em silêncio — o que a leva 6 entregou.

---

## Fora do MVP, e por quê

Cada linha saiu por decisão registrada, não por esquecimento. **Nada disso vira gambiarra no
cliente enquanto não voltar como etapa de leva.**

| Item | Por que saiu | O que já está levantado |
| --- | --- | --- |
| **Notificações** | Fora do MVP em 07/09. Falta **definir o que gera aviso** — parcela vencendo, orçamento estourado, entrada não recebida | A tabela existe com `ReadAt`, `ScheduledFor`/`SentAt` e os índices. O `CHECK` do `Type` só tem `system` e `security`: todo aviso de domínio precisa de valor novo |
| **Conciliação de extrato** | Fora do MVP em 07/09 — virou o extrato manual, entregue na leva 5 (`contas/extrato`), que é o que a tela precisa | Três perguntas sem resposta: **de onde vem o extrato** (OFX/CSV ou Open Finance — um parser contra uma integração com credencial e homologação), **o que é um item "a resolver"**, e **se conciliar cria lançamento ou só marca os existentes** — se cria, é migration em `Inflows` e `Expenses` |
| **`UserDevices`** | Só faz sentido junto com notificações | Tabela existe, rota não |
| **`Plans` / `Subscriptions`** | Cobrança não faz parte do fluxo de um mês | Tabelas existem, rotas não. **Quando isto voltar, os termos de uso e a política de privacidade têm que ser revisados antes**: muda o controlador (o CNPJ assina no lugar da pessoa física), entram pagamento, reembolso e cancelamento, e o processador de pagamento vira mais um operador na política |
| **Fatura de cartão como entidade** | As datas da fatura já vivem na perna (`ClosingDate`/`DueDate`), e o extrato mostra a fatura sem precisar de tabela. Só se pagaria com conciliação, que também saiu. **Reavaliada em 22/09** e mantida fora: a leva 9 dá à fatura tela própria, navegação entre ciclos e botão de quitar, tudo sobre a tupla `(cartão, vencimento)` que o `payInvoice` já usa. A tabela também foi levantada como alternativa ao `ClosingDay`, e recusada aí por um motivo mais forte — congelar a data não conserta a deriva, porque o que seria congelado é o resultado da mesma subtração errada | O gatilho para ela voltar é a fatura precisar de estado **não derivável**: o valor fechado pelo emissor divergindo da soma das compras, ou a conciliação |
| **"Continuar com Google"** | Não há OAuth na API | Desenhado no layout; o botão fica desabilitado |
| **Exportação de dados para portabilidade** | A exportação `.xlsx` da leva 3 já entrega o conteúdo financeiro, e é o que a política de privacidade cita | Um formato formal, com os dados cadastrais junto, só se paga quando alguém pedir |
| **Backup fora da máquina** | Decidido em 11/09, junto com a leva 8: o `pg_dump` fica no mesmo disco do banco. Cobre migration ruim, comando errado e corrupção lógica — as causas prováveis; **não cobre a perda do servidor**, que é a total. Aceitável enquanto o dado é de teste | O script (`deploy/backup.sh`), o agendamento (`deploy/gastosmensais-backup.timer`) e o procedimento de restore ([Deploy.md](Deploy.md#5-restaurar-o-backup)) já existem, entregues pela etapa 9 da leva 8; falta só o destino externo. **O gatilho para isto voltar é o primeiro usuário que não seja conhecido**, e certamente o lançamento com cobrança |

Onde um botão faz parte da composição visual, ele fica **desabilitado e rotulado**, nunca
escondido: some do produto sem sumir do layout. Depois da leva 5 sobrou **um só**: o "Continuar
com Google" do login.

---

## As decisões que não se rediscutem

Todas foram tomadas com o porquê escrito, e o texto completo está nos documentos de
[Old/](Old/). Estão aqui porque **mudar qualquer uma delas é refazer código em cima**, não
porque precisem de nova discussão.

| Decisão | Consequência prática |
| --- | --- |
| **O workspace viaja dentro do token assinado** | Nunca há um `IdWorkspace` vindo do cliente, exceto em `POST /Workspaces/switch`, que reemite o token |
| **Assinado não é o mesmo que ainda verdadeiro** | Autenticação o token resolve; autorização só o banco responde. Toda seção com escopo de tenant abre com `assertMember`/`assertRole` |
| **O saldo é calculado a cada leitura, sem cache** | Não existe coluna de saldo. Um saldo plausível e errado é a pior falha que este app tem, e cache é como ela nasce |
| **`Expenses.Status` é derivado, num lugar só** | `ExpenseStatus.section.ts`, dentro da mesma transação. Nunca aceito num corpo de requisição |
| **A perna tem duas datas que discordam de propósito** | `CompetenceDate` (quando o gasto pesa) e `CashDate` (quando o dinheiro sai). Confundir as duas tira uma compra de agosto do saldo de agosto |
| **O filtro de período é `?From=&To=`, inclusivo nas duas pontas** | Uma fatura de cartão nunca coincide com o mês do calendário. `ReferenceMonth=YYYY-MM` fica só onde o mês é mesmo o mês: orçamento, saldo e relatórios |
| **Não existe header `Authorization`** | Só o cookie `HttpOnly` + `SameSite=Strict`. Um token válido mandado no header responde 401, e há teste provando |
| **Sem compatibilidade com legado no MVP** | Campo que a API deixou de devolver **some do cliente também**. Nada de mapa de chave antiga nem leitura defensiva "por enquanto" |
| **Os dois eixos do gasto não se cruzam** | `ExpensePayments` (financeiro) e `ExpensePersons` (analítico): duas formas e duas pessoas são **2 + 2 linhas, nunca 4** |
| **Todo total de gasto soma pernas, não compras** | 600 em 6× custa 100 a agosto |

---

## As levas daqui pra frente

**A leva 6 foi a primeira unificada** — um plano só, com as etapas da API e as do front na mesma
fila — e fechou em 09/09 com 18 de 18 etapas.

**O número começou em 6 porque era o primeiro livre.** O backend chegou até a Fase #3 e o front
até a Fase #5, e os dois históricos agora são um: recomeçar em 1 faria
`Fase #1 | Etapa 2` existir duas vezes no mesmo `git log` querendo dizer coisas diferentes.

**A 7 fechou 12 etapas em 10/09, reabriu em 11/09 com a etapa 13 e fechou com ela no mesmo dia;
a 8 foi escrita em 11/09 e está em execução** — nove das dez etapas fechadas no mesmo dia,
faltando a do e-mail do domínio, que depende de conta no provedor e de registro no DNS. As duas
são a preparação para produção, e o corte entre elas é o que se prova de que jeito: a **7** —
compliance e o código que muda de comportamento em produção — se verifica com `npm test` e
`npm run typecheck`, e é o que está versionado em `API/` e `Frontend/`; a **8** — ambiente,
e-mail do domínio, arquivos
externos, infra e backup — é o que está em volta dos dois, e só subindo se sabe. Juntá-las faria
uma leva em que metade das etapas não tem critério de aceite até o dia do deploy.

**A 9 foi escrita em 22/09, fechou em 23/09 com 16 de 16, e é a primeira que não nasce de uma
lista interna.** As oito
anteriores saíram do que o projeto sabia que devia; esta sai de treze retornos de quem usou o
produto no ar. Por isso ela mistura o que nenhuma outra misturou: quatro defeitos de uma linha
(o mês em inglês, a data vermelha, o convite sem o e-mail, o ícone que estoura o botão de
biometria) ao lado de **duas trocas de modelo**
— o fechamento do cartão, que saiu da fila acima, e o orçamento, que deixa de ser um teto perene
por alvo e vira uma repartição da renda do mês, com a pessoa e a categoria na mesma linha. As
duas são migration sobre dado de produção, e é isso que define o tamanho da leva.

**A 10 foi escrita em 23/09, no mesmo dia em que a 9 fechou e foi validada no ar, e está em
execução** — 8 etapas, das quais uma só toca a API. Ela é o **segundo** retorno de uso, e o que
a separa da 9 é o tamanho: sem migration, sem troca de modelo, sete itens de cliente. O oitavo
é o que o produto nunca teve — **a porta de entrada**: quem se cadastra cai num espaço com as
treze categorias e mais nada, e a ordem em que ele precisa ser montado (conta antes de tudo,
porque é ela que cria as formas de pagamento; renda antes do orçamento, porque orçar é repartir
a renda) atravessa cinco telas que só sabem dizer que estão vazias. A 10 também é a primeira
leva que **inverte decisões escritas** em vez de acrescentar: as setas de ordenar categoria
viram arrasto pela alça, e a biometria sai do desktop. As duas inversões estão justificadas na
etapa que as faz — a primeira porque a alça responde à objeção original (o arrasto brigando com
o scroll em 390px), a segunda porque a oferta no desktop nunca foi uma decisão, foi o que o
WebAuthn expôs.

Cada leva ganha um arquivo em [Levas/](Levas/), no formato descrito lá. O que muda em relação
ao que existia antes:

- **Um plano cobre os dois lados.** Uma etapa que precisa de rota nova e de tela descreve as
  duas coisas e é entregue junta — era exatamente isso que o `Pendencias Backend.md` fazia
  atravessando dois repositórios, com semanas entre as duas metades.
- **Não há mais changelog de contrato.** O que mudava para o front era escrito porque o front
  não podia ler o código da API. Agora pode: o diff do commit é o changelog.
- **A execução é registrada no plano da própria leva**, na tabela de etapas, com commit e data.
  O `Levas executadas.md` separado existia porque plano e registro mudavam em ritmos diferentes
  em dois repositórios diferentes; com um histórico só, a linha da tabela e o commit ficam no
  mesmo lugar.
