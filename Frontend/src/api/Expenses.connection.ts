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

    /* Não há `list` aqui, e a ausência é a correção da leva 9: `GET
       /Expenses` lista COMPRAS, recortadas por `ExpenseDate`. Uma
       geladeira de 600 em 6× comprada em junho tem UMA linha nessa
       lista, em junho — e a parcela que pesa em setembro não aparece em
       lugar nenhum dela. A tela de Gastos lista pernas
       (`ExpensePaymentsConnection.list`), que é o que faz a tabela e a
       faixa de indicadores do mesmo mês somarem o mesmo número.

       A rota continua existindo na API; o que acabou foi o front listar
       por ela. */

    /** A linha da compra, com `Payments`, `Persons` e `Tags` — o que o
     *  painel de detalhe abre a partir da perna clicada na lista. */
    async get(idExpense: number): Promise<ApiTypes.ExpenseDetail> {
        const { data } = await http.get<ApiTypes.ExpenseDetail>(
            `${this.route}/IdExpense=${idExpense}`,
        );
        return data;
    }

    /** `Occurrences` na resposta = quantas linhas de gasto nasceram: 1, ou
     *  a série inteira em `fixed`. É opcional porque a resposta pode
     *  omiti-lo quando o gasto é um só. O campo de ENTRADA de mesmo nome
     *  não existe mais: mandá-lo responde 406, e quem limita a série é a
     *  janela do servidor ou o `RecurrenceEndDate`. `Status` também não
     *  é aceito. */
    async create(
        body: ApiTypes.ExpenseCreateBody,
    ): Promise<{ IdExpense: number; Occurrences?: number }> {
        const { data } = await http.post<{ IdExpense: number; Occurrences?: number }>(
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
