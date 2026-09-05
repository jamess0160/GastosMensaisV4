import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/ExpensePayments` — a perna não tem POST de cadastro: ela nasce com
 *  o gasto. O que existe aqui é a LISTA do que cai num período e o verbo
 *  que move saldo. */
class Connection {
    private readonly route = "/ExpensePayments";

    /** A lista do que **cai** no período.
     *
     *  `GET /Expenses` é a lista do que foi COMPRADO (filtra por
     *  `ExpenseDate`); esta filtra por `CompetenceDate` — a mesma data
     *  que o `Spent` do orçamento e o `Balance` da conta já usam. É por
     *  isso que ela existe: uma compra parcelada de março não aparece na
     *  lista de gastos de agosto, mas a 6ª parcela dela PESA em agosto,
     *  e o contrato permite 120 parcelas — acima de qualquer janela de
     *  varredura, a parcela sumiria do total.
     *
     *  Cada perna vem com o gasto de origem e o rateio DELE (⚠️ o do
     *  gasto, não o da perna — ver `ApiTypes.ExpensePaymentRow`). A
     *  ordem é a da data em que a perna pesa, não a da compra. */
    async list(
        query: ApiTypes.ExpensePaymentListQuery = {},
    ): Promise<ApiTypes.ExpensePaymentRow[]> {
        const { data } = await http.get<ApiTypes.ExpensePaymentRow[]>(this.route, {
            params: query,
        });
        return data;
    }

    /** Sem body — o instante do pagamento quem grava é o servidor.
     *  Recalcula o `Status` do gasto na mesma transaction, e ele só vira
     *  `paid` quando TODAS as pernas estão pagas.
     *
     *  406 se a perna não existe, o gasto está cancelado, ou a parcela já
     *  está quitada. */
    async pay(idExpensePayment: number): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(
            `${this.route}/IdExpensePayment=${idExpensePayment}/pay`,
        );
        return data;
    }

    /** Desquita. Existe porque um clique errado, sem ele, tiraria dinheiro
     *  da conta sem volta. */
    async unpay(idExpensePayment: number): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(
            `${this.route}/IdExpensePayment=${idExpensePayment}/unpay`,
        );
        return data;
    }
}

export const ExpensePaymentsConnection = new Connection();
