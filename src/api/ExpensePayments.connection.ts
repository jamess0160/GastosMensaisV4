import { http } from "./client";

/** `/ExpensePayments` — a perna não tem GET nem POST de cadastro:
 *  ela nasce com o gasto e sai embutida nele. O que existe aqui é o verbo
 *  que move saldo. */
class Connection {
    private readonly route = "/ExpensePayments";

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
