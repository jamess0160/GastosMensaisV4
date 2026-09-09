# Changelog do contrato — Fase #2

As mudanças da **leva 2** — *o que sobe junto com o MVP* —, da mais recente para a mais antiga.
Onze etapas, 2026-09-04 e 2026-09-05.

É a primeira leva inteira que o front leu por aqui, e a que mais quebrou coisa: ela é feita de
correções sobre rotas que a leva 1 já tinha publicado. Duas entradas estão datadas de 2026-09-06
porque foi quando o contrato foi escrito, um dia depois do commit.

Os três marcadores (🔴 quebra / 🟡 comportamento / 🟢 adição) estão definidos na seção 19 do
[contrato](../API%20-%20Contrato%20Front-end.md#19-changelog), junto com a regra do que entra
aqui e do que não entra.

> Este arquivo diz **o que mudou**. O que é **verdade hoje** está sempre no
> [contrato](../API%20-%20Contrato%20Front-end.md) — os dois não são intercambiáveis, e é por
> isso que toda entrada aponta para a seção do contrato que ela alterou.

**O que a leva 2 entregou** está em
[Levas executadas](../../API/Levas%20executadas.md#leva-2--o-que-sobe-junto-com-o-mvp), e o
**desenho** dela no [plano](../../API/levas/2.%20Plano%20de%20Desenvolvimento%20-%20Leva%202.md).

---

### 2026-09-06 — `POST /Expenses`: estorno, o gasto de valor **negativo**

🟢 **Adição** — ver a seção 11, e a subseção **11.3** que nasceu com ela.

**O que entrou.** `TotalValue` e os valores dos dois eixos passam a aceitar **negativo**. É como se lança um **estorno de compra** — aquilo que volta na fatura, às vezes na seguinte. Antes não havia como lançá-lo: a parede era tripla (o `.positive()` da validação e três `CHECK` do banco).

**Estorno não é entrada, e é por isso que ele é um gasto.** Se virasse um `Inflow`, o saldo da conta subiria no mês do estorno **e** a fatura continuaria sendo paga cheia — errado dos dois lados. Nenhum dinheiro entra na conta: **a fatura é que encolhe**. E o gasto negativo carrega de graça as cinco coisas que o estorno precisa — categoria, datas de fatura, competência, rateio por pessoa e linha da fatura.

**Quatro regras, todas `406`:** só em forma de pagamento `credit_card`; **um gasto é inteiro positivo ou inteiro negativo** (todas as partes, nos dois eixos, com o sinal do total); **`Kind='single'` apenas** — estorno de parcelado se lança um por parcela; e **zero continua proibido**, em `TotalValue` e em cada valor.

**Ação do front:** liberar o sinal no campo de valor **quando a forma escolhida for cartão de crédito**, e propagar o sinal para as linhas dos dois eixos que você montar. Em qualquer outra forma, mantenha o campo positivo — dinheiro que volta fora do cartão é `POST /Inflows`.

**Juros, anuidade e IOF não entram aqui:** são gastos **positivos** comuns, no cartão, numa categoria de tarifas. Só o estorno tem sinal invertido, porque só ele **reduz** o que você vai pagar.

🟡 **`Spent` pode vir negativo** em `GET /Budgets` (seção 13), num mês em que os estornos superam as compras. Não quebra nada, mas a barra de progresso precisa tratar o caso. **O crédito cai no mês de competência do estorno**, que costuma ser outro mês: agosto fica com a compra cheia e outubro recebe o crédito — corrigir agosto seria reescrever mês fechado.

**Não mudou nada para quem não lança estorno:** compra positiva segue idêntica em toda regra, e o estorno é quitado com a fatura (`payInvoice`) como qualquer linha de cartão.
### 2026-09-06 — O cartão de crédito ganha fatura, e `Paid` para de mentir

🔴 **Quebra** nas seções 11 e 12, 🟢 **adição** nas seções 6 e 12. **É a mudança mais visível desta leva** — a ação da linha de cartão, na tela de Gastos, muda de significado.

**O problema que ela conserta: o saldo da conta estava errado.** `Paid` significava duas coisas conforme a forma de pagamento. No pix e no débito quer dizer "o dinheiro saiu da conta" — e sai mesmo. No cartão, marcar uma perna como paga **não tira dinheiro de conta nenhuma**: quem tira é o pagamento da fatura, semanas depois. E como só existia o `pay` de **uma perna por vez**, ninguém marcava as 40 compras de uma fatura: as pernas ficavam `pending` para sempre e **o saldo nunca descia**, subindo mês a mês enquanto a conta real caía.

São **três fatos**, e dois deles dividiam o mesmo booleano:

| Fato | Pergunta | Onde vive agora |
|---|---|---|
| prevista | "a Netflix vai cobrar dia 15" | a ocorrência do gasto fixo, que já existia |
| **entrou na fatura** | "cobrou mesmo? veio no valor certo?" | **`Charged`/`ChargedAt`** — novo |
| **fatura paga** | "o dinheiro saiu da conta" | `Paid`/`PaidAt`, escrito só pelo **`payInvoice`** no cartão |

🟢 **Quatro rotas novas.** `POST /ExpensePayments/IdExpensePayment=:Id/charge` e `/uncharge` (seção 12) marcam que a cobrança entrou na fatura — **sem body, e sem mexer em saldo nenhum**. `POST /PaymentMethods/IdPaymentMethod=:Id/payInvoice` e `/unpayInvoice` (seção 6) recebem `{ "DueDate" }` e quitam a **fatura inteira**.

**A fatura não é cadastro, é consulta:** não há tabela nem id de fatura. Todas as pernas de um ciclo compartilham o **mesmo `DueDate` exato**, então a fatura é `(IdPaymentMethod, DueDate)` — pegue o `DueDate` da perna e mande de volta. A resposta traz `Payments`, quantas pernas mudaram; **repetir é inofensivo** (as já pagas são puladas), o que resolve lançar hoje uma compra esquecida de uma fatura já paga.

🔴 **`pay`/`unpay` recusam perna de cartão** (`406`, com a `msg` apontando o `payInvoice`). 🔴 **`Paid: true` no `POST /Expenses` com forma `credit_card` é `406`.** Fora do cartão os dois seguem exatamente como estavam — inclusive parcelado em carnê ou crediário, que continua sendo quitado parcela a parcela.

**Ação do front, e é trabalho de verdade:**

1. **A ação da linha de cartão troca de rota e de rótulo.** Onde ela dizia "quitar" e chamava `pay`, passa a dizer **"entrou na fatura"** e chamar `charge`. O botão não some — ele para de mentir. Para o usuário é troca de rótulo, não de gesto.
2. **Ganhe uma ação de fatura**, por cartão e por vencimento, chamando `payInvoice`. É ela que faz o saldo descer.
3. **Não ofereça `Paid` no formulário de lançamento quando a forma escolhida for cartão** — ele agora é recusado.
4. Depois de qualquer uma das duas, **releia `GET /Accounts`**: o `Balance` é somado dos lançamentos a cada leitura.

🟢 **A perna ganha três campos na resposta:** `Charged`, `ChargedAt` e **`CompetenceDate`**. `Charged` é **`null` fora do cartão** (é assim que você sabe se a linha tem botão de conferência). `CompetenceDate` é a data em que a perna pesa — `DueDate` quando existe, senão a data do gasto —, congelada no lançamento; é por ela que o saldo, o `Spent` do orçamento e `GET /ExpensePayments` recortam o mês. Nenhuma dessas três é aceita em corpo nenhum.

**Nada mudou de valor:** a `CompetenceDate` é exatamente o `coalesce(DueDate, ExpenseDate)` que as consultas já calculavam — nenhum número da tela muda por causa dela. E `Expenses.Status` continua derivado só do `Paid`: uma compra no cartão vira `paid` quando a fatura for paga, e a de 6× depois das seis. Que é a verdade.

**De brinde:** com `Charged` dá para responder o que nada respondia — "fatura de outubro: 1.230 previstos, 890 já lançados", a diferença entre o esperado e o que o cartão já registrou.
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
