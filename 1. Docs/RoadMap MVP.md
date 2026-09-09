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
registrada é **654 testes**, no fim da leva 3.

### Front — cinco levas, todas fechadas

**16 telas**, todas respondendo em 390px, todas ligadas na API de verdade.

| Leva | O que entregou | Estado |
| --- | --- | --- |
| **1 — Plano de desenvolvimento** | Do zero ao MVP do cliente: chassi, sessão, cadastros, lançamento, listas, dashboard, relatório | **fechada** |
| **2 — Ajustes** | A lista crua de correções de layout e de conteúdo das telas | **fechada** |
| **3 — Ajustes** | Mês compartilhado entre telas, navegação mobile, e a reescrita de Gastos, Renda e Contas | **fechada** |
| **4 — As mudanças de contrato de setembro** | Cartão por vencimento + folga, saldo do mês, fatura, estorno, orçamento por pessoa, logout, seletor de espaço e convites | **fechada**, 10 de 10 |
| **5 — Os números saem do cliente, e as telas que faltavam** | Orçamento que nasce sozinho, `GET /Reports/Month`, `CompetenceMode`, extrato, exportação `.xlsx`, sessão de 30 dias, recuperação de senha, confirmação de e-mail | **fechada**, 8 de 8 |

Plano da leva 5: [Old/Front/levas/5. Plano de Ajustes 5.md](Old/Front/levas/5.%20Plano%20de%20Ajustes%205.md).

As cinco etapas que faltavam foram fechadas em 09/09, em cinco commits: `Fase #5 | Etapa 4` a
`Etapa 8`. Com elas saíram do produto os **três botões rotulados "ainda sem API"** — o de
conciliar extrato virou **"Extrato"** (a rota não concilia nada, e o nome tinha que dizer
isso), o de exportar passou a baixar o `.xlsx` do servidor, e "Esqueci minha senha" virou
navegação de verdade. Nasceram quatro telas: `contas/extrato`, `/esqueci-senha`,
`/recuperar-senha` e `/confirmar-email`.

---

## A fila até o MVP

**A lacuna do cliente acabou.** Toda rota que a leva 5 consumia já existia com teste desde
07/09, e foi a junção dos repositórios ter pegado a leva no meio que a deixou aberta. O que
sobra na fila não é dívida de um lado contra o outro: é trabalho que nunca entrou em leva
nenhuma, dos dois.

### 1. Gestão de membros — API e front, na mesma leva

É o que sobrou do compartilhamento de workspace: **listar membros, trocar papel, remover, sair
e transferir propriedade**. O convite e o aceite foram feitos na leva 2 do backend e na leva 4
do front; o resto nunca entrou em leva nenhuma, de nenhum dos dois lados.

`WorkspaceMembers` já existe com papel, e `assertRole` já é chamado em 7 dos 9 pontos de
acesso — a tabela e a checagem estão prontas, faltam as rotas e a tela.

**É o primeiro trabalho que nasce unificado**, e por isso é o teste do formato novo de leva: um
plano só, com as etapas da API e as do front na mesma fila de dependências.

### 2. Produção

Nada aqui é código de feature, e cada item já quebrou alguma coisa uma vez:

- **`NODE_ENV=production` de verdade no deploy** — sem isso o `secure` nunca é setado no cookie
  de sessão;
- **`TZ=America/Sao_Paulo` no processo** — `moment` sem timezone usa o relógio do servidor, e
  em UTC uma rotina de "dia 1º às 00:30" dispara às 21:30 do dia 31 no Brasil e materializa o
  mês errado;
- **nginx servindo front e API na mesma origem** (`/` e `/api`) — é o que faz o
  `sameSite: 'strict'` funcionar sem CORS. Em dev o equivalente é o proxy do Vite, e a saída
  errada dos dois é afrouxar o cookie;
- **SPF/DKIM no domínio** — enviar como `@gastosmensais.com.br` por um SMTP não autorizado cai
  em spam, e nenhuma arquitetura conserta isso;
- **Rate limiting, que não existe em lugar nenhum do projeto.** A primeira rota que dói é a
  pública que manda e-mail (`forgotPassword`). Hoje há **dois freios parciais e nenhum deles é
  rate limiting**: o `MailCooldown` da API, que é um `Map` em memória e só protege o
  `resendConfirmation`, e o `useCooldown` do cliente, que mora no navegador e qualquer um
  contorna com `curl`. O `forgotPassword` continua sem freio nenhum do lado do servidor.

---

## Fora do MVP, e por quê

Cada linha saiu por decisão registrada, não por esquecimento. **Nada disso vira gambiarra no
cliente enquanto não voltar como etapa de leva.**

| Item | Por que saiu | O que já está levantado |
| --- | --- | --- |
| **Notificações** | Fora do MVP em 07/09. Falta **definir o que gera aviso** — parcela vencendo, orçamento estourado, entrada não recebida | A tabela existe com `ReadAt`, `ScheduledFor`/`SentAt` e os índices. O `CHECK` do `Type` só tem `system` e `security`: todo aviso de domínio precisa de valor novo |
| **Conciliação de extrato** | Fora do MVP em 07/09 — virou o extrato manual, entregue na leva 5 (`contas/extrato`), que é o que a tela precisa | Três perguntas sem resposta: **de onde vem o extrato** (OFX/CSV ou Open Finance — um parser contra uma integração com credencial e homologação), **o que é um item "a resolver"**, e **se conciliar cria lançamento ou só marca os existentes** — se cria, é migration em `Inflows` e `Expenses` |
| **`UserDevices`** | Só faz sentido junto com notificações | Tabela existe, rota não |
| **`Plans` / `Subscriptions`** | Cobrança não faz parte do fluxo de um mês | Tabelas existem, rotas não |
| **Fatura de cartão como entidade** | As datas da fatura já vivem na perna (`ClosingDate`/`DueDate`), e o extrato mostra a fatura sem precisar de tabela. Só se pagaria com conciliação, que também saiu | — |
| **"Continuar com Google"** | Não há OAuth na API | Desenhado no layout; o botão fica desabilitado |

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

**A próxima é a leva 6**, e ela é a primeira unificada: um plano só, com as etapas da API e as
do front na mesma fila.

**O número começa em 6 porque é o primeiro livre.** O backend chegou até a Fase #3 e o front
até a Fase #5, e os dois históricos agora são um: recomeçar em 1 faria
`Fase #1 | Etapa 2` existir duas vezes no mesmo `git log` querendo dizer coisas diferentes.

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
