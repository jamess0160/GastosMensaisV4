# Plano de desenvolvimento — Frontend

Plano de execução do frontend do Gastos mensais V4, do estado atual até o
MVP em produção.

**A regra que define o escopo:** o MVP implementa **apenas o que a API já
expõe hoje**, conforme [API - Contrato Front-end.md](API%20-%20Contrato%20Front-end.md).
Tudo que o layout desenha e a API ainda não atende está listado na
seção [Fora do MVP](#fora-do-mvp) — não é esquecimento, é corte
deliberado. Nenhuma etapa abaixo depende de rota nova.

Referências permanentes:

- Contrato: [API - Contrato Front-end.md](API%20-%20Contrato%20Front-end.md)
- Layout: `Layout/Hi-fi Desktop` e `Layout/Hi-fi Mobile`
- Convenções de código: [../README.md](../README.md)

---

## Como as etapas foram ordenadas

Não é a ordem do menu, é a ordem das dependências:

1. **Cadastro antes de lançamento.** Não dá para lançar um gasto sem ter
   conta, forma de pagamento, categoria e pessoa para escolher. Por isso
   Personalização e Contas vêm antes de Adicionar Gasto, mesmo sendo
   telas menos vistosas.
2. **Lançar antes de listar.** A lista de gastos só tem o que mostrar
   depois que dá para criar gasto. E é o formulário que produz o kit de
   componentes de entrada que as outras telas reaproveitam.
3. **Dashboard e Relatório por último.** Os dois são **agregação** do que
   as etapas anteriores produzem, e nenhum dos dois tem endpoint próprio:
   os números saem de `Expenses` + `Inflows` + `Accounts` + `Budgets`
   somados no cliente. Construí-los cedo significaria construí-los duas
   vezes.

Cada etapa entrega tela **funcionando ponta a ponta** — sem tela pela
metade esperando a etapa seguinte.

---

## Etapa 0 — Fundação · concluída

O que já está de pé e não precisa ser refeito.

| Entrega | Onde |
|---|---|
| Vite + React + TS, proxy de `/api` | `vite.config.ts` |
| Design tokens transcritos do layout | `src/styles/tokens.css` |
| Tipos do contrato inteiro | `src/types/api.ts` |
| axios + interceptor de erro tipado | `src/api/client.ts` |
| 14 connections, uma por rota | `src/api/*.connection.ts` |
| Chassi: sidebar, guard de sessão, rotas | `src/app/` |
| Primitivas visuais | `src/ui/primitives.tsx` |
| Helpers de dinheiro e data de calendário | `src/lib/` |
| Tela de Login (senha + biometria) | `src/pages/Login/` |

---

## Etapa 1 — Sessão e conta

**Objetivo:** entrar, sair e criar conta sem depender de dado semeado no
banco.

| Item | Detalhe |
|---|---|
| Telas | `01 - Login` (frame A feito; falta o cadastro) |
| Rotas | `Users` (signUp, getSelf, update, updatePassword), `UsersAuth` (registro de passkey), `Workspaces` |
| Componentes novos | `Input`, `FormField`, `PasswordInput`, `Checkbox` |

**Escopo:**

- Tela de cadastro sobre `POST /Users`, seguida de `login` — o
  cadastro não loga sozinho.
- Convite de biometria **depois** do login por senha, quando
  `checkDevice` responde `null`: `options/register` → `startRegistration()`
  → `register`, e guardar o `DeviceKey` devolvido. Recusa chama
  `skipDevice`, que faz o `checkDevice` passar a responder `false`.
- Tela de perfil mínima: editar nome/e-mail/telefone e trocar senha.
- Seletor de workspace só se `Workspaces/getSelf` devolver mais de um —
  hoje é um por usuário, então normalmente nem aparece.

**Cuidados do contrato:**

- Nunca pré-hashear a senha no cliente: o que a API recebe vira a
  credencial efetiva.
- Não usar `IdWorkspace` no cadastro — é pendência de segurança
  conhecida no backend (entra como `owner` sem convite).
- `switch` é a única rota que recebe `IdWorkspace`, e ela **reemite o
  cookie**: depois dela, invalidar todo o cache de queries.

**Pronto quando:** um usuário novo cria conta, entra, cadastra passkey,
sai e volta pela biometria.

---

## Etapa 2 — Cadastros base

**Objetivo:** ter o que escolher nos formulários de lançamento.

| Item | Detalhe |
|---|---|
| Telas | `06 - Personalização` (A e B), `08 - Contas` (frame A) |
| Rotas | `Categories`, `Persons`, `Accounts`, `PaymentMethods` |
| Componentes novos | `SlideOver`, `Modal`, `Table`, `IconPicker`, `ColorPicker`, `Toggle`, `ConfirmDialog` |

**Escopo:**

- Categorias: listar, criar, editar, arquivar.
- Pessoas: listar, criar, renomear, arquivar.
- Contas: tabela com saldo, criar, editar, arquivar.
- Cartões de crédito: criar, editar, arquivar, dentro do slide-over da
  conta.
- Catálogo de ícones do cliente, indexado por `IconKey`.

**Cuidados do contrato:**

- Categoria com `IdWorkspace: null` é **pré-definida do sistema**:
  desabilite editar e arquivar, senão a tela oferece um botão que sempre
  responde 406.
- `InitialBalance` **congela** depois do primeiro lançamento da conta —
  desabilite o campo quando houver movimento.
- `POST /PaymentMethods` só aceita `credit_card`. Pix e débito nascem com
  a conta; não ofereça criá-los.
- No `PUT` de forma de pagamento, `Kind` e `IdAccount` não são aceitos.
- Arquivar pessoa vinculada a um login responde 406 — esconda a ação.
- `Balance` é calculado na leitura: **não recalcule somando lançamentos
  no cliente.**

**Pronto quando:** dá para montar do zero o cenário de um casal — duas
contas, um cartão, duas pessoas, categorias — sem tocar no banco.

---

## Etapa 3 — Lançar gasto

A etapa mais pesada, e a que define o kit de formulário do resto do
sistema.

| Item | Detalhe |
|---|---|
| Telas | `03 - Adicionar Gasto` (A e B) |
| Rotas | `Expenses` (POST), `Tags` (search) |
| Componentes novos | `MoneyInput`, `DateInput`, `SplitEditor`, `TagInput`, `SegmentedControl`, `Stepper`, `InstallmentTimeline` |

**Escopo:**

- Os três formatos: `single`, `installment` (2–120 parcelas), `fixed`
  (recorrência com `Occurrences`, default 12).
- Os **dois eixos de rateio**, lado a lado e independentes.
- Autocomplete de tags sobre `Tags/search`.

**Cuidados do contrato — leia antes de desenhar o formulário:**

- **Os dois rateios nunca se cruzam.** `Payments` (financeiro: com qual
  forma foi pago — move saldo) e `Persons` (analítico: de quem é o custo
  — não move saldo). Duas formas + duas pessoas = **2 + 2 linhas, nunca
  4**. Cada eixo fecha com o `TotalValue` por conta própria.
- **Todo rateio é por valor absoluto, nunca porcentagem**, e a soma tem
  que bater em centavos. Use `splitClosesTotal` de `src/lib/money.ts`
  antes de habilitar o botão de salvar — errar aqui é 406 garantido.
- Em `installment`, `TotalValue` é o **total da compra**, não o da
  parcela. O centavo que sobra vai na **primeira**.
- `installment` aceita **uma única perna**.
- `InstallmentTotal` é obrigatório em `installment` e **proibido** nos
  outros; `RecurrenceDay`/`RecurrenceEndDate`/`Occurrences` só em `fixed`.
- `Tags` vai como **texto, não id** — é o único lugar onde uma tag nasce.
- `Status` não é aceito: é derivado.
- `Paid: true` é o caso do débito, que já sai pago no ato; no cartão a
  perna fica em aberto.

**Pronto quando:** os três formatos gravam, o rateio recusa soma que não
fecha antes de chamar a API, e a resposta de `fixed` reporta as
`Occurrences` criadas.

---

## Etapa 4 — Ver e quitar gastos

| Item | Detalhe |
|---|---|
| Telas | `04 - Visualização de Gasto` (A e B) |
| Rotas | `Expenses` (list, get, put, series, delete), `ExpensePayments` (pay, unpay) |
| Componentes novos | `MonthPicker`, `FilterBar`, `StatusBadge`, `EmptyState` |

**Escopo:**

- Lista do mês agrupada por tipo, com filtros de `Status`, `Kind` e
  `IdCategory`.
- Slide-over de detalhe com pernas, rateio, tags e histórico.
- Quitar e desquitar parcela.
- Editar gasto; editar série ("esta e as seguintes").
- Cancelar gasto; encerrar série.

**Cuidados do contrato:**

- A lista **não traz** pernas, rateio nem tags — o detalhe exige um
  `get(id)`.
- Sem `Status` na query, os cancelados ficam de fora.
- `Status` só vira `paid` quando **todas** as pernas estão pagas: quitar
  1 de 6 mantém a compra `pending`.
- **As parcelas de uma compra parcelada não se editam** (406, "cancele e
  lance de novo") — não ofereça o botão.
- Cancelar gasto já pago **é o estorno**: o dinheiro volta ao saldo.
  Confirme com o usuário.
- Em `PUT`, enviar `Payments`/`Persons`/`Tags` **substitui a lista
  inteira**; omitir mantém.
- `updateSeries` não aceita `ExpenseDate` nem `Payments`.

**Pronto quando:** dá para acompanhar uma compra parcelada de ponta a
ponta — criar, quitar parcela a parcela, ver o `Status` virar `paid` só
na última.

---

## Etapa 5 — Renda e transferências

| Item | Detalhe |
|---|---|
| Telas | `05 - Renda` (A e B) |
| Rotas | `Inflows` (list, get, post, put, receive, delete) |
| Componentes novos | reaproveita o kit da Etapa 3 |

**Escopo:**

- Lista do mês, criar entrada, criar transferência, receber, cancelar.
- Rateio de entrada entre pessoas.

**Cuidados do contrato:**

- **Transferência é neutra para o patrimônio.** Todo total de "quanto
  entrou" tem que filtrar `Kind !== "transfer"`, ou o mesmo dinheiro é
  contado de novo a cada movimentação entre contas. No **saldo da
  conta**, ao contrário, ela conta nos dois lados.
- `transfer` exige `IdFromAccount` (diferente do `To`) e **proíbe**
  rateio. `inflow` só aceita `IdFromAccount: null`.
- `POST /receive` é o que põe o dinheiro no saldo. **Tudo ou nada** — não
  existe recebimento parcial nem `ReceivedValue`.
- Editar entrada já recebida é permitido, e o rateio é reconferido contra
  o **novo** total mesmo quando não enviado.
- `DELETE` cancela; não há delete físico nesta tabela.

**Pronto quando:** salário entra, é recebido, aparece no saldo da conta;
transferência entre contas move as duas pontas e não infla o total
recebido do mês.

---

## Etapa 6 — Orçamentos

| Item | Detalhe |
|---|---|
| Telas | bloco "Orçamentos · Maio" do `02 - Dashboard` |
| Rotas | `Budgets` (list, upsert), `BudgetPeriods` (update, delete) |
| Componentes novos | `BudgetBar`, `ProgressMeter` |

**Escopo:**

- Listar o mês, definir teto por categoria, editar o mês, remover o mês.
- Estado visual de alerta e de estouro.

**Cuidados do contrato:**

- `ReferenceMonth` vai como `"YYYY-MM"` e **volta como `"YYYY-MM-01"`**.
- **`Spent` segue três regras próprias:** soma **pernas** (600 em 6×
  custa 100 ao mês), usa `coalesce(DueDate, ExpenseDate)` (compra no
  cartão cai no mês da fatura) e **conta pendente junto com pago** — o
  oposto do saldo da conta. Não tente reconciliar os dois números: eles
  respondem perguntas diferentes.
- **O alerta é do cliente:** a API devolve `LimitValue`, `Spent` e
  `AlertPercent`; comparar é trabalho da tela.
- Editar a **definição** muda o futuro; o mês passado guarda o teto que
  realmente valeu. Nunca leia o limite de um mês passado da definição.
- O cadastro do mês é **manual** — a rotina que materializaria o mês
  ainda não existe no backend. A tela precisa deixar isso explícito.

**Pronto quando:** o teto de uma categoria mostra consumo correto para
uma compra parcelada no cartão, com a parcela caindo no mês da fatura.

---

## Etapa 7 — Dashboard

Agregação pura. Só depois das etapas 3 a 6.

| Item | Detalhe |
|---|---|
| Telas | `02 - Dashboard` |
| Rotas | `Expenses`, `Inflows`, `Accounts`, `Budgets` (nenhuma nova) |
| Componentes novos | `KpiStrip`, `FlowStat`, `DeltaPill` |

**Escopo:** saldo restante do mês, total recebido, total gasto, fixos do
mês, parcelas, orçamentos, dias restantes.

**Cuidados:**

- **Nenhum destes números tem endpoint.** Todos saem de agregação no
  cliente, e é aqui que as regras de contagem se contradizem se
  aplicadas sem cuidado:
    - "quanto entrou" filtra `Kind !== "transfer"`;
    - "quanto gastou" soma **pernas**, não `TotalValue` de compra;
    - saldo de conta **ignora pendente**, orçamento **conta pendente**.
- Centralize essas somas em `src/lib/` com teste, não espalhadas pelos
  componentes — são as três contas que, erradas, fazem o usuário perder
  a confiança no sistema inteiro.
- Cada visita puxa o mês inteiro de gastos e entradas. Cachear por mês no
  React Query e reaproveitar nas telas de lista.

**Pronto quando:** os números do dashboard batem com a soma manual das
listas de Gastos e Renda do mesmo mês.

---

## Etapa 8 — Relatório

| Item | Detalhe |
|---|---|
| Telas | `07 - Relatório` (A e B) |
| Rotas | `Expenses`, `Categories` (nenhuma nova) |
| Componentes novos | `LineChart`, `DonutChart`, `ChartLegend` |

**Escopo:** linha por dia do mês e donut por categoria com drill.

**Cuidados:**

- Não há endpoint de relatório: as duas visões são agregação de
  `Expenses.list()`.
- Os gráficos do layout são **SVG desenhado à mão**, não uma lib. Escolha
  a lib nesta etapa e respeite a paleta de categorias dos tokens
  (`--cat-*`), senão o relatório sai com cor que não existe no sistema.
- A cor de cada categoria vem do campo `Color` quando preenchido; a
  paleta dos tokens é o fallback.

**Pronto quando:** o total do donut bate com o total gasto do mesmo mês
no Dashboard.

---

## Etapa 9 — Mobile

| Item | Detalhe |
|---|---|
| Telas | as 8, a partir de `Layout/Hi-fi Mobile` (25 frames) |
| Rotas | nenhuma nova |

**Escopo:** aplicar os layouts mobile. O export mobile tem **mais
estados** que o desktop em várias telas — Personalização tem 6 frames,
Adicionar Gasto tem 4 — então aqui aparecem interações que o desktop não
mostrava.

**Cuidados:**

- O `:root` do mobile omite alguns tokens (`--brand-press`,
  `--brand-tint`, `--cat-amarelo/verde/coral`, `--border-dashed`) e usa
  `--border` levemente diferente. O set do **desktop** é a fonte da
  verdade — já é o que está em `tokens.css`.
- Navegação: o desktop usa sidebar fixa; o mobile precisa de decisão
  própria (tab bar ou drawer), a partir dos frames.

**Pronto quando:** as 8 telas funcionam em 390px sem scroll horizontal.

---

## Etapa 10 — Endurecimento e pré-produção

**Objetivo:** o que separa "funciona na minha máquina" de "pode receber
usuário".

- **Estados de tela:** carregando, vazio e erro em toda lista. Hoje só
  existe o caminho feliz.
- **Mensagens de erro:** o 406 já chega com `msg` pronta; garantir que
  toda tela a mostre em vez de engolir.
- **Sessão expirada:** o `401` já derruba para o login; validar que não
  há tela que perca dado digitado nesse caminho.
- **Telemetria:** `POST /Utils/Logs` para erro não tratado.
- **Acessibilidade:** foco visível, navegação por teclado nos
  slide-overs e modais, `aria-label` nos botões só-ícone.
- **Testes:** a suíte cresce junto com as etapas, não no fim. Regra por
  etapa: toda função nova em `src/lib/` e toda `section/` nova saem com
  teste. Sem E2E no MVP — a validação de fluxo completo é manual antes
  de subir.
- **Build:** o bundle hoje está em ~106 kB gzip; revisar depois dos
  gráficos, que costumam dobrar isso.

---

## Fora do MVP

O layout desenha, a API ainda não atende. **Nada disso entra** — cada
item vira uma conversa com o backend, não uma gambiarra no cliente.

| Item | Onde aparece no layout | O que falta |
|---|---|---|
| Conciliação de extrato | `08 - Contas`, frame B | Rota nenhuma |
| Exportar para Excel | Sidebar | Rota nenhuma |
| Avisos / notificações | Topbar do Dashboard | Tabela existe, rota não |
| Esqueci minha senha | `01 - Login` | Rota nenhuma |
| Continuar com Google | `01 - Login` | Sem OAuth na API |
| Logout de verdade | Sidebar | Sem rota; cookie é HttpOnly |
| "Lembrar por 30 dias" | `01 - Login` | `Max-Age` é fixo em 24h |
| Planos / assinatura | — | Tabelas existem, rotas não |

Onde o botão faz parte da composição visual, ele fica **desabilitado e
rotulado**, não escondido — some do produto sem sumir do layout.

---

## Pendências para o backend

Levantadas em documento próprio, com proposta de contrato para cada uma:
[Pendencias Backend.md](Pendencias%20Backend.md).

As duas de segurança — **logout** e **`IdWorkspace` aceito sem convite no
cadastro** — valem ser resolvidas antes do MVP ir ao ar. As outras sete
são cortes conscientes, e o frontend já está desenhado para viver sem
elas.

---

## Resumo

| Etapa | Entrega | Depende de |
|---|---|---|
| 0 | Fundação | — |
| 1 | Sessão e conta | 0 |
| 2 | Cadastros base | 1 |
| 3 | Lançar gasto | 2 |
| 4 | Ver e quitar gastos | 3 |
| 5 | Renda e transferências | 2 |
| 6 | Orçamentos | 2 |
| 7 | Dashboard | 3, 4, 5, 6 |
| 8 | Relatório | 4 |
| 9 | Mobile | 1–8 |
| 10 | Endurecimento | 1–9 |

As etapas 5 e 6 não dependem de 3 e 4 — dá para paralelizar se houver
mais de uma pessoa. O caminho crítico é **2 → 3 → 4 → 7**.
