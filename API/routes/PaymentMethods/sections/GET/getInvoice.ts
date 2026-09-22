import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { ExpensePayments_model } from "root/routes/ExpensePayments/ExpensePayments.model"
import { Expenses_model } from "root/routes/Expenses/Expenses.model"
import { InvoiceDates } from "root/routes/Expenses/sections/InvoiceDates.section"
import { APIError } from "root/Utils/Logs"
import { Utils } from "root/Utils/Utils"
import { PaymentMethods_model } from "../../PaymentMethods.model"
import { PaymentMethodsNamespace } from "../types"

/**
 * **Uma fatura, inteira** — o ciclo que ela cobre, o que há nela, em que estado está e quais
 * são as faturas ao lado.
 *
 * Até aqui a fatura só existia **dentro do extrato** (`GET /Reports/Statement`), recortada pelo
 * mês selecionado na tela. Três perguntas comuns não tinham onde ser feitas, e as três têm a
 * mesma causa: **a fatura não é um mês.** "Quanto já tem na fatura aberta" é uma pergunta sobre
 * hoje, não sobre agosto; "e a passada" obrigava a trocar o mês da aplicação inteira, mexendo
 * junto no Início, nos Gastos e no Relatório; e "e a próxima" não tinha tela nenhuma. Por isso
 * esta rota recebe um **vencimento**, e não um mês.
 *
 * **Nenhuma tabela nova, e isso é a decisão e não a economia.** A fatura continua sendo a tupla
 * `(IdPaymentMethod, DueDate)`, que é como o `payInvoice` e o extrato já a tratam — todas as
 * pernas de um ciclo compartilham o mesmo `DueDate` exato, porque é o `InvoiceDates` que o
 * calcula a partir do `DueDay` do cartão. Uma tabela `Invoices` se paga quando a fatura precisar
 * de estado próprio que não seja derivável (uma conciliação, um valor fechado pelo emissor
 * diferente da soma das compras), e nenhuma das duas coisas está no MVP. O que ela resolveria
 * aqui — dar um id à fatura — a tupla já resolve.
 *
 * **Toda aritmética de ciclo é do `InvoiceDates`**, que é onde a relação entre `ClosingDay` e
 * `DueDay` mora. Uma segunda cópia dela aqui erraria no único dia que importa, e erraria em
 * silêncio: o vencimento calculado deixaria de bater com o gravado nas pernas e a fatura viria
 * vazia.
 */
export class GetInvoice {
    public async run(SelectedIdWorkspace: number, IdPaymentMethod: number, IdUser: number, DueDate?: string) {
        //  Leitura: basta ser do espaço. Quem divide o espaço divide a fatura.
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        //  O id chega do cliente e é sequencial: sem a leitura escopada daria para ler a fatura
        //  do vizinho — e uma fatura é a lista de compras dele.
        let card = await PaymentMethods_model.getUnique(IdWorkspace, IdPaymentMethod)

        if (!card) {
            throw new APIError({
                msg: "Forma de pagamento não encontrada!",
                status: 406,
                data: { IdWorkspace, IdPaymentMethod },
            })
        }

        if (card.Kind !== "credit_card") {
            throw new APIError({
                msg: "Só cartão de crédito tem fatura: fora dele, o dinheiro sai no ato.",
                status: 406,
                data: { IdPaymentMethod, Kind: card.Kind },
            })
        }

        //  **A fatura aberta é a que uma compra feita hoje pegaria**, e é por isso que ela sai
        //  do mesmo `forPayment` que o lançamento usa: é a mesma pergunta ("em qual fatura isto
        //  cai?"), feita com a data de hoje. Derivar por outro caminho seria a segunda
        //  aritmética de ciclo, e ela discordaria justamente no dia do fechamento.
        let Today = Utils.today()
        let OpenDueDate = InvoiceDates.forPayment(card, Today).DueDate!

        //  Sem vencimento pedido, a fatura é a aberta: é a resposta da pergunta que trouxe o
        //  usuário até aqui, e poupa o cliente de recalcular um ciclo que é do servidor.
        let Due = DueDate ?? OpenDueDate

        let [legs, dues] = await Promise.all([
            ExpensePayments_model.getByInvoice(IdWorkspace, IdPaymentMethod, Due),
            ExpensePayments_model.getInvoiceDues(IdWorkspace, IdPaymentMethod),
        ])

        //  O gasto de onde cada perna saiu, numa consulta só — a descrição e a data da compra
        //  moram nele. `IncludeCanceled` é irrelevante aqui: o `getByInvoice` já decidiu quais
        //  pernas entram, e repetir o filtro deixaria a perna sem o gasto dela.
        let ids = [...new Set(legs.map((leg) => leg.IdExpense))]

        let expenses = ids.length
            ? await Expenses_model.getByWorkspace(IdWorkspace, { IncludeCanceled: true }).whereIn("IdExpense", ids)
            : []

        let expenseById = new Map(expenses.map((expense) => [expense.IdExpense, expense]))

        let Entries: PaymentMethodsNamespace.InvoiceEntry[] = []
        let Expected: PaymentMethodsNamespace.InvoiceEntry[] = []
        let Total = 0

        for (let leg of legs) {
            let expense = expenseById.get(leg.IdExpense)!

            let entry: PaymentMethodsNamespace.InvoiceEntry = {
                Date: expense.ExpenseDate,
                Description: expense.Description,
                Value: Number(leg.Value),
                IdExpense: leg.IdExpense,
                IdExpensePayment: leg.IdExpensePayment,
                InstallmentNumber: leg.InstallmentNumber,
                InstallmentTotal: leg.InstallmentTotal,
                Paid: leg.Paid,
                Charged: Boolean(leg.Charged),
            }

            //  **Só o que está na fatura entra no total dela**, a mesma regra do extrato do
            //  cartão. O previsto fica na resposta, em outra lista: ele é quitado junto quando a
            //  fatura for paga, e uma perna invisível que mesmo assim tira dinheiro da conta é o
            //  defeito que esta separação existe para não criar.
            if (entry.Charged) {
                Total = this.round(Total + entry.Value)
                Entries.push(entry)

                continue
            }

            Expected.push(entry)
        }

        //  Por data da compra, com o id desempatando: duas compras do mesmo dia precisam de
        //  ordem estável, senão a tela embaralha a cada requisição.
        Entries.sort(this.byDate)
        Expected.sort(this.byDate)

        let { CycleStart, CycleEnd } = InvoiceDates.cycleOf(card, Due)

        /**
         * **Por onde as setas andam.** O conjunto é o dos vencimentos que **têm perna**, mais
         * três que entram sempre:
         *
         * - a **aberta** e as duas vizinhas dela, para que ‹ e › funcionem num cartão recém
         *   cadastrado, em que nenhuma fatura tem compra ainda;
         * - o **pedido**, mesmo vazio, para quem chegou por link ter como voltar.
         *
         * Ordenado como texto porque em "YYYY-MM-DD" a ordem lexicográfica é a cronológica —
         * o motivo de o formato ser esse.
         */
        let navigable = [...new Set([
            ...dues.map((due) => due.DueDate),
            InvoiceDates.dueShift(card, OpenDueDate, -1),
            OpenDueDate,
            InvoiceDates.dueShift(card, OpenDueDate, 1),
            Due,
        ])].sort()

        let index = navigable.indexOf(Due)

        return {
            IdPaymentMethod: card.IdPaymentMethod,
            IdAccount: card.IdAccount,
            Name: card.Name,
            CompetenceMode: card.CompetenceMode!,
            DueDate: Due,
            //  **O fechamento e o fim do ciclo são a mesma data, e as duas ficam na resposta**
            //  porque respondem perguntas diferentes: `ClosingDate` é o prazo ("até quando dá
            //  para comprar nesta"), `CycleEnd` é a ponta do intervalo que o rodapé imprime.
            //  É do `ClosingDate` que o estado é lido.
            ClosingDate: CycleEnd,
            CycleStart,
            CycleEnd,
            Status: this.statusOf(legs, CycleEnd, Today),
            Total,
            Entries,
            Expected,
            /** Nulo na ponta: é o que desabilita a seta em vez de deixá-la levar a lugar nenhum. */
            PreviousDueDate: navigable[index - 1] ?? null,
            NextDueDate: navigable[index + 1] ?? null,
            /** O atalho do meio da navegação — "a aberta" —, e o que diz se já se está nela. */
            OpenDueDate,
            /**
             * **As próximas faturas**: os vencimentos depois do exibido que já têm perna, com o
             * total de cada um. É o que responde "quanto do meu mês que vem já está
             * comprometido", e sai de graça — as pernas futuras de um parcelamento estão
             * gravadas desde o lançamento dele.
             */
            Upcoming: dues
                .filter((due) => due.DueDate > Due && Number(due.Legs) > 0)
                .map((due) => ({ DueDate: due.DueDate, Total: Number(due.Total) })),
        }
    }

    /**
     * O estado, derivado e nunca guardado. Ver `PaymentMethodsNamespace.InvoiceStatus`.
     *
     * **`paid` ganha dos outros dois** porque é o único que fala de dinheiro, e a lista vazia é
     * o caso que tem que ser dito: `every` sobre lista vazia é `true`, e sem esta guarda uma
     * fatura sem compra nenhuma sairia como paga — o mesmo cuidado que o `ExpenseStatus` e o
     * `payInvoice` já carregam.
     *
     * O previsto conta aqui: ele é quitado junto com o resto do ciclo.
     */
    private statusOf(legs: { Paid: boolean }[], ClosingDate: string, Today: string): PaymentMethodsNamespace.InvoiceStatus {
        if (legs.length && legs.every((leg) => leg.Paid)) return "paid"

        //  Comparação de texto, e ela é cronológica no formato "YYYY-MM-DD". Inclusiva no dia
        //  do fechamento pela mesma convenção do `cycleOf`: a compra feita **no** dia em que a
        //  fatura fecha ainda é daquela fatura.
        return Today <= ClosingDate ? "open" : "closed"
    }

    private byDate(left: PaymentMethodsNamespace.InvoiceEntry, right: PaymentMethodsNamespace.InvoiceEntry) {
        if (left.Date !== right.Date) return left.Date < right.Date ? -1 : 1

        return left.IdExpensePayment - right.IdExpensePayment
    }

    private round(value: number) {
        return Math.round(value * 100) / 100
    }
}
