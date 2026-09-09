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
     * **`CompetenceDate` é quando a perna pesa**, e é ela que o cartão governa:
     *
     *     invoice    ->  o vencimento — a compra de 20/08 pesa no mês da fatura
     *     purchase   ->  ExpenseDate + (n−1) meses — o cartão contado como débito
     *
     * O avanço por parcela no modo `purchase` **não é detalhe**: sem ele, 600 em 6x jogaria
     * 600 inteiros no mês da compra e mataria a regra "a parcela pesa 100 por mês", que é a
     * razão de o orçamento somar pernas em vez de gastos. E é a mesma fórmula que o carnê e o
     * crediário fora do cartão já usam — o modo novo não inventa conceito nenhum.
     *
     * Fora do cartão o modo é nulo e não há o que escolher: sem fatura, consumo e pagamento
     * acontecem no mesmo dia e as duas datas coincidem.
     */
    private withDates(
        dates: { ClosingDate: string | null, DueDate: string | null },
        paymentMethod: Database.PaymentMethods,
        ExpenseDate: string,
        index: number,
    ) {
        let CashDate = dates.DueDate ?? ExpenseDate

        let CompetenceDate = paymentMethod.CompetenceMode === "purchase"
            ? Utils.addMonthsToDate(ExpenseDate, index)
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
     * quais compras são dela. A fatura que vence em 04/09 fecha `ClosingOffsetDays` dias antes
     * e leva tudo que foi comprado **depois** do fechamento da fatura anterior — daí o `+1`,
     * porque a compra feita *no* dia do fechamento ainda entrou naquela outra.
     *
     * Existe porque o extrato do cartão é recortado por vencimento: em setembro ele mostra uma
     * fatura feita de compras de agosto, e sem dizer o ciclo não há como saber, olhando, em
     * que mês aquelas linhas pesam.
     *
     * O vencimento anterior é contado **a partir do próprio vencimento**, com o `DueDay` posto
     * de volta — o mesmo cuidado do `dueOf`: vencendo dia 31, a fatura de março não pode
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
     * **O vencimento é a âncora; o fechamento nasce dele.** É assim que o emissor funciona — o
     * cliente escolhe o dia de vencer e o banco fecha a fatura N dias antes — e é o que deixa
     * as duas datas sempre coerentes entre si.
     *
     * Guardar o fechamento como dia do mês custava dois defeitos que a folga não tem. O dia 30
     * precisava ser grampeado em fevereiro, enquanto a comparação que decide a fatura seguia
     * usando o nominal: as duas metades da regra passavam a falar de datas diferentes. E a
     * rolagem do vencimento tinha que ser **inferida** de dois números soltos, porque o modelo
     * não guardava a relação entre eles — aqui ela é a própria subtração.
     */
    private creditCardInvoice(paymentMethod: Database.PaymentMethods, ExpenseDate: string, index: number) {
        //  Regra do fechamento: a compra entra na **primeira fatura que ainda não fechou**. É a
        //  linha que separa a compra do dia 20 da do dia 21 num cartão que fecha no 20 — e agora
        //  são duas datas reais sendo comparadas, não um dia nominal contra uma data grampeada.
        //  Em "YYYY-MM-DD" a ordem lexicográfica é a ordem cronológica, que é o motivo de o
        //  formato ser esse.
        //
        //  O laço existe porque **uma rolagem só nem sempre basta**: quando a folga é grande
        //  perto do dia de vencer, a fatura que vence no mês seguinte também já fechou (vence
        //  no dia 5 com folga de 7 e a compra é do dia 27 — a de março fechou em 26/02). Duas
        //  rodadas sempre bastam, e é o teto de 28 dias da folga no Joi que garante isso: a
        //  fatura de dois meses à frente fecha, no pior caso, no dia seguinte ao último dia do
        //  mês da compra.
        let monthsAhead = 0

        while (monthsAhead < 2 && ExpenseDate > this.closingOf(paymentMethod, ExpenseDate, monthsAhead)) {
            monthsAhead++
        }

        return {
            ClosingDate: this.closingOf(paymentMethod, ExpenseDate, monthsAhead + index),
            DueDate: this.dueOf(paymentMethod, ExpenseDate, monthsAhead + index),
        }
    }

    /**
     * O vencimento `monthsAhead` meses depois da compra.
     *
     * Sempre contado **a partir da data da compra**, nunca encadeado no vencimento anterior: o
     * `setDayOfMonth` depois do `addMonthsToDate` desfaz o arrasto do grampeamento. Vencendo no
     * dia 31, a parcela de fevereiro cai no 28 — e a de março tem que voltar ao 31, o que só
     * acontece porque o 28 nunca vira a nova âncora.
     */
    private dueOf(paymentMethod: Database.PaymentMethods, ExpenseDate: string, monthsAhead: number) {
        return Utils.setDayOfMonth(Utils.addMonthsToDate(ExpenseDate, monthsAhead), paymentMethod.DueDay!)
    }

    //  O fechamento é o vencimento menos a folga, e nada mais. Nunca grampeia, porque uma
    //  contagem de dias corridos sempre cai num dia que existe.
    private closingOf(paymentMethod: Database.PaymentMethods, ExpenseDate: string, monthsAhead: number) {
        return this.closingFrom(paymentMethod, this.dueOf(paymentMethod, ExpenseDate, monthsAhead))
    }

    //  A subtração em si, isolada num lugar só: quem já tem o vencimento na mão — o extrato,
    //  que lê a fatura gravada em vez de derivá-la da compra — chega ao fechamento por aqui,
    //  sem uma segunda cópia da regra que este arquivo existe para concentrar.
    private closingFrom(card: CardCycleSource, DueDate: string) {
        return Utils.addDaysToDate(DueDate, -card.ClosingOffsetDays!)
    }

    //  Cartão sem vencimento ou sem folga de fechamento não existe (o PaymentMethodKind
    //  garante), mas a checagem das duas colunas é o que deixa o `!` acima honesto.
    private isCreditCard(paymentMethod: Database.PaymentMethods) {
        return paymentMethod.Kind === "credit_card" && Boolean(paymentMethod.DueDay) && Boolean(paymentMethod.ClosingOffsetDays)
    }
}

/**
 * O que basta para derivar o ciclo de uma fatura: **o cartão é o vencimento e a folga**, e não
 * há terceira coluna nessa conta. Um `Pick` porque o extrato chega aqui com as duas colunas
 * vindas de um `join`, não com a linha inteira de `PaymentMethods`.
 */
type CardCycleSource = Pick<Database.PaymentMethods, "DueDay" | "ClosingOffsetDays">

export const InvoiceDates = new Controller()
