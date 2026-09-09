# Changelog do contrato — fora de leva

Mudanças que o front enxergou e que **não pertencem a leva nenhuma**: correções e acréscimos
aplicados soltos, entre 2026-08-31 e 2026-09-08.

Elas existem pelo mesmo motivo pelo qual
[Levas executadas](../../Levas%20executadas.md#fora-de-leva) tem uma seção com esse nome — não
adianta fingir que todo commit nasce dentro de um plano. Ficam aqui para não serem procuradas
numa leva onde não estão.

Duas delas são ajustes sobre a etapa 1 da leva 1 (o cadastro de conta e de cartão), uma é a
correção do saldo — que é maior do que "ajuste pontual", e mesmo assim não era etapa de ninguém —,
uma é a criação de workspace, que encosta na etapa 9 da leva 1 sem ser ela, e a última é o
`Current` do `getSelf`, que nasceu de um bug visto na tela depois de a leva 3 já ter fechado.

Os três marcadores (🔴 quebra / 🟡 comportamento / 🟢 adição) estão definidos na seção 19 do
[contrato](../../API%20-%20Contrato%20Front-end.md#19-changelog), junto com a regra do que entra
aqui e do que não entra.

> Este arquivo diz **o que mudou**. O que é **verdade hoje** está sempre no
> [contrato](../../API%20-%20Contrato%20Front-end.md) — os dois não são intercambiáveis, e é por
> isso que toda entrada aponta para a seção do contrato que ela alterou.

---

### 2026-09-08 — `GET /Workspaces/getSelf`: `Current` diz em qual workspace a sessão está

🟢 **Adição** — ver a seção 4.

**O que entrou.** Um booleano `Current` em cada item de `GET /Workspaces/getSelf`, e o mesmo campo na resposta do `POST /Workspaces/switch` (lá ele é sempre `true`). Exatamente um item da lista vem `true`: o do token que chegou na requisição.

**Por que ele existe.** A seleção de workspace vive dentro do JWT e o cookie é `HttpOnly` — o cliente **não tinha como saber** em qual espaço estava. A lista vinha sem marcação nenhuma, então o front guardava o que o último `switch` respondeu e, no primeiro carregamento, chutava o primeiro da lista. O chute acerta enquanto o usuário tem um workspace só; com dois, quem entra no segundo e recarrega a página lê o nome do **primeiro** na tela enquanto o cookie continua no segundo. É a pior forma do erro: a tela afirma um espaço e o lançamento vai para outro.

**`Current` não é coluna, e nem podia ser.** Ele não descreve o workspace, descreve o token: o mesmo workspace é `true` numa aba e `false` na outra, e ele vira sozinho quando o `switch` reemite o cookie. Quem continuar mandando o token antigo continua vendo a seleção antiga — o que está certo, porque é nela que aquele token opera.

**Ação do front:** leia `Current` e **apague a memória local de qual era o espaço atual**. A ordenação da lista continua por `IdWorkspace` e não significa nada — o primeiro item não é o atual.

**Nada quebra:** os campos que já existiam continuam iguais, e quem ignorar o `Current` se comporta como antes.

### 2026-09-06 — `POST /Workspaces`: criar um workspace novo

🟢 **Adição** — ver a seção 4.

**O que entrou.** `POST /Workspaces` com `{ Name }`, respondendo `{ IdWorkspace }`. Até agora um workspace só nascia dentro do cadastro, então quem já tinha conta e queria separar as finanças em dois lugares (a casa e a empresa, o pessoal e o do casal) não tinha caminho nenhum — a saída era criar outra conta com outro e-mail, o que espalha o login em vez de organizar o dinheiro.

**Quem cria é `owner`**, e o `IdOwnerUser` vem do token: não há campo no corpo por onde apontá-lo para outra pessoa. O workspace nasce **vazio** — sem contas, sem categorias próprias, sem lançamentos —, com a matrícula e com a **sua pessoa (`Persons`) já criada dentro dele**, porque todo rateio é entre pessoas e sem ela você não apareceria no próprio gasto.

**Ação do front:** depois do `POST`, chame **`POST /Workspaces/switch`** com o `IdWorkspace` que voltou. **Criar não troca a sessão**, pela mesma razão do `join` (seção 4.1): trocar o workspace debaixo da tela que o usuário estava usando é pior do que um clique a mais. Sem o `switch`, o usuário cria o workspace e continua vendo o antigo — é o mesmo bug provável que o do aceite de convite.

**Nada mudou** para quem tem um workspace só: o cadastro continua criando o primeiro, e nenhuma resposta existente mudou de forma.
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
