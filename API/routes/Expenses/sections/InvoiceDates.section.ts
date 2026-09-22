import { Database } from "root/Utils/database"
import { Utils } from "root/Utils/Utils"

//  Quando o dinheiro sai — e, no cartão, em qual fatura a compra cai.
//
//  As datas vivem na **perna**, não no gasto, porque cada parcela vence no seu mês. Section
//  própria porque o parcelamento reusa a mesma conta: **um dia de diferença na compra vira um
//  mês de diferença no caixa**, e essa regra não pode ter duas cópias.
//
//  Toda a aritmética é sobre "YYYY-MM-DD" (Utils.addMonthsToDate/addDaysToDate, moment por
//  baixo), nunca sobre Date solto — em UTC-3 o dia 01 viraria o 31 do mês anterior.
class Controller {

    /**
     * A perna à vista: uma forma de pagamento, o valor inteiro.
     *
     * Só o cartão tem fatura. Em pix e débito o dinheiro sai no ato, então não há fechamento
     * nem vencimento a marcar — a data do gasto já diz tudo.
     */
    public forPayment(paymentMethod: Database.PaymentMethods, ExpenseDate: string) {
        if (!this.isCreditCard(paymentMethod)) {
            return this.withDates({ ClosingDate: null, DueDate: null }, paymentMethod, ExpenseDate, 0)
        }

        return this.withDates(this.creditCardInvoice(paymentMethod, ExpenseDate, 0), paymentMethod, ExpenseDate, 0)
    }

    /**
     * A parcela `index` (0 = a primeira) de uma compra parcelada.
     *
     * **Parcelar não é privilégio do cartão:** carnê, crediário e o racha com um amigo caem em
     * pix ou débito e mesmo assim têm parcela mensal. Fora do cartão não existe fatura, então
     * o fechamento fica nulo — mas o **vencimento existe**, e é o mesmo dia dos meses seguintes
     * a partir da compra. Sem ele não haveria como responder quanto vence em novembro.
     */
    public forInstallment(paymentMethod: Database.PaymentMethods, ExpenseDate: string, index: number) {
        if (!this.isCreditCard(paymentMethod)) {
            return this.withDates({ ClosingDate: null, DueDate: Utils.addMonthsToDate(ExpenseDate, index) }, paymentMethod, ExpenseDate, index)
        }

        return this.withDates(this.creditCardInvoice(paymentMethod, ExpenseDate, index), paymentMethod, ExpenseDate, index)
    }

    /**
     * **As duas datas que a perna carrega além da fatura** — e a etapa inteira do
     * `CompetenceMode` mora aqui, numa linha.
     *
     * Saem daqui, e não de cada escritor, porque todo escritor de perna já espalha o retorno
     * dos dois métodos acima (`...InvoiceDates.forPayment(...)`): nenhum deles pode esquecer
     * uma coluna, e mudar a regra não toca em leitor nenhum.
     *
     * **`CashDate` é quando o dinheiro sai da conta** — `coalesce(DueDate, ExpenseDate)`,
     * sempre, sem depender de modo nenhum. É o corte do saldo e do extrato.
     *
     * **`CompetenceDate` é quando a perna pesa**, e é ela que o cartão governa. Os dois modos
     * respondem a mesma pergunta sobre a **fatura** que pegou a compra, em dois pontos dela:
     *
     *     purchase   ->  o mês em que essa fatura FECHA
     *     invoice    ->  o mês em que essa fatura VENCE
     *
     * **Quem decide o mês é o ciclo, não a data da compra**, e é aí que o `cycleShift` entra.
     * Num cartão que fecha dia 30, a compra de 31/08 não está na fatura de agosto: ela chegou
     * depois do fechamento, vai ser cobrada com a fatura seguinte, e pesar em agosto consumiria
     * um orçamento que ela nunca tocou. `dia(ExpenseDate) > ClosingDay` é a linha entre os dois
     * casos — e ela cai **depois** do dia do fechamento, porque a compra feita *no* dia em que
     * a fatura fecha ainda é daquela fatura, a mesma convenção do `cycleOf` logo abaixo.
     *
     * Três coisas nessa fórmula, e todas mudam o resultado:
     *
     * - **o dia da compra é preservado, o mês é que anda.** Escrever a competência como o
     *   próprio `ClosingDate` daria o mesmo mês e arruinaria o único lugar que lê a competência
     *   como *dia* — o gráfico diário do Relatório —, empilhando o mês inteiro de compras num
     *   pico no dia do fechamento;
     * - **o `addMonthsToDate` grampeia**, e é por isso que ele é a operação certa aqui: 31/08
     *   mais um mês é 30/09, nunca 03/10. O dia que não existe no mês de destino vira o último
     *   dele e o mês — que é o que a competência quer dizer — sai certo;
     * - **o `cycleShift` nunca passa de 1.** Com o fechamento sendo um dia do mês, a compra ou
     *   pegou a fatura que fecha no mês dela ou pegou a do mês seguinte; não há terceiro caso.
     *
     * O avanço por parcela no modo `purchase` **não é detalhe**: sem ele, 600 em 6x jogaria
     * 600 inteiros no mês da compra e mataria a regra "a parcela pesa 100 por mês", que é a
     * razão de o orçamento somar pernas em vez de gastos. E é a mesma fórmula que o carnê e o
     * crediário fora do cartão já usam — o modo não inventa conceito nenhum.
     *
     * Fora do cartão o modo é nulo e não há o que escolher: sem fatura não há fechamento, o
     * `cycleShift` é sempre 0 e as duas datas coincidem, porque consumo e pagamento acontecem
     * no mesmo dia.
     */
    private withDates(
        dates: { ClosingDate: string | null, DueDate: string | null },
        paymentMethod: Database.PaymentMethods,
        ExpenseDate: string,
        index: number,
    ) {
        let CashDate = dates.DueDate ?? ExpenseDate

        let cycleShift = this.isCreditCard(paymentMethod) ? this.monthsToClosing(paymentMethod, ExpenseDate) : 0

        let CompetenceDate = paymentMethod.CompetenceMode === "purchase"
            ? Utils.addMonthsToDate(ExpenseDate, cycleShift + index)
            : CashDate

        return { ...dates, CashDate, CompetenceDate }
    }

    /**
     * O estado inicial do `Charged` de uma perna: **`true` no cartão**, nulo fora dele.
     *
     * **O campo diz "está na fatura", não "já conferi".** Lançar num cartão *quer dizer* que a
     * compra vai para a fatura daquele cartão — é o caso comum, e o caso comum não pode custar
     * um clique por linha: uma fatura de cartão concentrador tem dezenas delas, ninguém marca
     * dezenas, e um campo que ninguém marca para de significar coisa alguma. É a mesma falha
     * que o `payInvoice` corrigiu no `Paid`, um campo ao lado.
     *
     * O caso raro é o contrário — a compra que o emissor ainda não registrou, ou registrou com
     * outro valor —, e é ele que merece o clique: `uncharge` passa a ser o gesto de "isto ainda
     * não caiu na fatura de verdade".
     *
     * Nulo fora do cartão porque não há fatura em que entrar, exatamente como as datas — e é
     * essa nulidade que as rotas leem depois para saber se a perna é de cartão, sem reler a
     * forma de pagamento (que pode ter sido arquivada nesse meio-tempo).
     */
    public initialCharged(paymentMethod: Database.PaymentMethods) {
        return paymentMethod.Kind === "credit_card" ? true : null
    }

    /**
     * **O ciclo que uma fatura cobre** — a primeira compra que ela pega e a última.
     *
     * É a regra de cima lida ao contrário: lá a compra procura a fatura, aqui a fatura declara
     * quais compras são dela. A fatura que vence em 04/10 fecha no `ClosingDay` do mês que a
     * `monthShift` aponta e leva tudo que foi comprado **depois** do fechamento da fatura
     * anterior — daí o `+1`, porque a compra feita *no* dia do fechamento ainda entrou naquela
     * outra.
     *
     * Existe porque o extrato do cartão é recortado por vencimento: em setembro ele mostra uma
     * fatura feita de compras de agosto, e sem dizer o ciclo não há como saber, olhando, em
     * que mês aquelas linhas pesam.
     *
     * O vencimento anterior é contado **a partir do próprio vencimento**, com o `DueDay` posto
     * de volta — o mesmo cuidado do `dueIn`: vencendo dia 31, a fatura de março não pode
     * herdar o 28 que fevereiro grampeou.
     */
    public cycleOf(card: CardCycleSource, DueDate: string) {
        let previousDue = Utils.setDayOfMonth(Utils.addMonthsToDate(DueDate, -1), card.DueDay!)

        return {
            CycleStart: Utils.addDaysToDate(this.closingFrom(card, previousDue), 1),
            CycleEnd: this.closingFrom(card, DueDate),
        }
    }

    /**
     * **O cartão guarda os dois dias que a pessoa lê na fatura, e nenhum deles é derivado do
     * outro.** `ClosingDay` é o dia do mês em que o emissor fecha; `DueDay` é o dia em que ele
     * cobra. É assim que o emissor brasileiro funciona — ele **não** fecha N dias antes de
     * vencer, ele fecha num dia fixo do mês.
     *
     * O modelo anterior guardava a folga (`ClosingOffsetDays`) e derivava o fechamento por
     * subtração, e isso errava por construção: `04/09 − 8` é 27/08, mas `04/10 − 8` é 26/09 —
     * o mesmo cartão, dois dias de fechamento, porque os meses têm tamanhos diferentes. Quem
     * cadastrava lendo a fatura de agosto gravava a folga certa para agosto e errada para
     * setembro, e **um dia de erro na descrição vira um mês de erro no caixa**.
     *
     * A única coisa que este modelo ainda infere é a relação entre os dois dias, e ela é
     * estável porque compara dois dias **nominais**, não duas datas de meses de tamanhos
     * diferentes:
     *
     *     ClosingDay >  DueDay  ->  a fatura fecha no mês ANTERIOR ao do vencimento  (27 / 04)
     *     ClosingDay <= DueDay  ->  fecha e vence no MESMO mês                       (05 / 15)
     *
     * **O vencimento continua sendo a âncora do parcelamento:** a parcela `n` vence no `DueDay`
     * do mês `n`, com o grampeamento do mês curto vindo do `setDayOfMonth`. O que mudou é só
     * de onde sai o fechamento.
     */
    private creditCardInvoice(paymentMethod: Database.PaymentMethods, ExpenseDate: string, index: number) {
        //  **O mês em que a fatura desta compra fecha**, e o laço de rolagem morreu junto com a
        //  folga. Ele existia porque "uma rolagem só nem sempre basta" quando a folga é grande
        //  perto do dia de vencer; com o fechamento sendo um dia do mês, a pergunta "esta compra
        //  pegou a fatura que fecha neste mês?" é uma comparação respondida de uma vez.
        //
        //  A comparação é entre duas datas reais e o `setDayOfMonth` grampeia o dia que não
        //  existe no mês curto — a compra de 28/02 num cartão que fecha no dia 30 entra na
        //  fatura de fevereiro, que é a que o emissor fecha no último dia dele. Em "YYYY-MM-DD"
        //  a ordem lexicográfica é a ordem cronológica, que é o motivo de o formato ser esse.
        let closingMonth = Utils.addMonthsToDate(ExpenseDate, this.monthsToClosing(paymentMethod, ExpenseDate) + index)

        return {
            ClosingDate: Utils.setDayOfMonth(closingMonth, paymentMethod.ClosingDay!),
            DueDate: this.dueIn(paymentMethod, closingMonth),
        }
    }

    //  Zero quando a compra ainda pegou a fatura que fecha no mês dela, um quando ela passou do
    //  fechamento. Não há terceiro valor possível: o fechamento acontece uma vez por mês.
    //
    //  **Uma conta, dois leitores.** Ela diz em que mês a fatura desta compra fecha, e isso é o
    //  que o `creditCardInvoice` precisa para achar o vencimento *e* o que o `withDates` precisa
    //  para saber em que mês a compra pesa. Duas cópias divergiriam no único dia que importa.
    private monthsToClosing(card: CardCycleSource, ExpenseDate: string) {
        return ExpenseDate <= Utils.setDayOfMonth(ExpenseDate, card.ClosingDay!) ? 0 : 1
    }

    /**
     * O vencimento da fatura que fecha no mês de `closingMonth`.
     *
     * `monthShift` é a única inferência do modelo — e o `setDayOfMonth` depois do
     * `addMonthsToDate` é o que desfaz o arrasto do grampeamento: vencendo no dia 31, a parcela
     * de fevereiro cai no 28, e a de março tem que voltar ao 31.
     */
    private dueIn(card: CardCycleSource, closingMonth: string) {
        return Utils.setDayOfMonth(Utils.addMonthsToDate(closingMonth, this.monthShift(card)), card.DueDay!)
    }

    //  O caminho de volta do `dueIn`, para quem já tem o vencimento na mão — o extrato, que lê a
    //  fatura gravada em vez de derivá-la da compra. Uma cópia só da relação entre os dois dias.
    private closingFrom(card: CardCycleSource, DueDate: string) {
        return Utils.setDayOfMonth(Utils.addMonthsToDate(DueDate, -this.monthShift(card)), card.ClosingDay!)
    }

    //  **A relação entre os dois dias, derivada uma vez.** Fechando depois do dia de vencer, a
    //  fatura só pode ser cobrada no mês seguinte ao que ela fechou.
    private monthShift(card: CardCycleSource) {
        return card.ClosingDay! > card.DueDay! ? 1 : 0
    }

    //  Cartão sem vencimento ou sem dia de fechamento não existe (o PaymentMethodKind garante),
    //  mas a checagem das duas colunas é o que deixa o `!` acima honesto.
    private isCreditCard(paymentMethod: Database.PaymentMethods) {
        return paymentMethod.Kind === "credit_card" && Boolean(paymentMethod.DueDay) && Boolean(paymentMethod.ClosingDay)
    }
}

/**
 * O que basta para derivar o ciclo de uma fatura: **o cartão é os dois dias do mês**, e não há
 * terceira coluna nessa conta. Um `Pick` porque o extrato chega aqui com as duas colunas vindas
 * de um `join`, não com a linha inteira de `PaymentMethods`.
 */
type CardCycleSource = Pick<Database.PaymentMethods, "DueDay" | "ClosingDay">

export const InvoiceDates = new Controller()
