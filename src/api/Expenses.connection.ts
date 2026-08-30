import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Expenses`
 *
 *  Um gasto tem DOIS rateios independentes que nunca se cruzam:
 *  `Payments` (financeiro — com qual forma foi pago, move saldo) e
 *  `Persons` (analítico — de quem é o custo, não move saldo). Duas formas
 *  de pagamento + duas pessoas = 2 + 2 linhas, nunca 4, e cada eixo fecha
 *  com o `TotalValue` por conta própria. */
class Connection {
    private readonly route = "/Expenses";

    /** Filtra por `ExpenseDate`. Sem `Status`, os cancelados ficam de
     *  fora. A lista não traz pernas, rateio nem tags. */
    async list(query: ApiTypes.ExpenseListQuery = {}): Promise<ApiTypes.Expense[]> {
        const { data } = await http.get<ApiTypes.Expense[]>(this.route, { params: query });
        return data;
    }

    /** A mesma linha, mais `Payments`, `Persons` e `Tags`. */
    async get(idExpense: number): Promise<ApiTypes.ExpenseDetail> {
        const { data } = await http.get<ApiTypes.ExpenseDetail>(
            `${this.route}/IdExpense=${idExpense}`,
        );
        return data;
    }

    /** `Occurrences` na resposta = quantas linhas de gasto nasceram: 1, ou
     *  a série inteira em `fixed`. `Status` não é aceito. */
    async create(
        body: ApiTypes.ExpenseCreateBody,
    ): Promise<{ IdExpense: number; Occurrences: number }> {
        const { data } = await http.post<{ IdExpense: number; Occurrences: number }>(
            this.route,
            body,
        );
        return data;
    }

    /** Não se edita `Kind`, `Status` nem a recorrência. 406 em gasto
     *  cancelado e nas parcelas de uma compra parcelada ("cancele e lance
     *  de novo"). */
    async update(idExpense: number, body: ApiTypes.ExpenseUpdateBody): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(
            `${this.route}/IdExpense=${idExpense}`,
            body,
        );
        return data;
    }

    /** "Esta e as seguintes", como num calendário: age na ocorrência
     *  chamada e em todas as posteriores. O corte é a data dela, não o
     *  relógio — ocorrência passada guarda o valor que realmente valeu. */
    async updateSeries(
        idExpense: number,
        body: ApiTypes.ExpenseSeriesUpdateBody,
    ): Promise<{ msg: string; Occurrences: number }> {
        const { data } = await http.put<{ msg: string; Occurrences: number }>(
            `${this.route}/IdExpense=${idExpense}/series`,
            body,
        );
        return data;
    }

    /** Cancela. Cancelar um gasto já pago é o estorno: o dinheiro volta ao
     *  saldo. Já cancelado: 406. */
    async cancel(idExpense: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(`${this.route}/IdExpense=${idExpense}`);
        return data;
    }

    /** Cancela desta ocorrência para a frente. */
    async cancelSeries(idExpense: number): Promise<{ msg: string; Canceled: number }> {
        const { data } = await http.delete<{ msg: string; Canceled: number }>(
            `${this.route}/IdExpense=${idExpense}/series`,
        );
        return data;
    }
}

export const ExpensesConnection = new Connection();
