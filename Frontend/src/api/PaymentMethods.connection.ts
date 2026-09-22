import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/PaymentMethods` — não há GET: a forma de pagamento sai
 *  embutida em `AccountsConnection.list()`. */
class Connection {
    private readonly route = "/PaymentMethods";

    /** Só cartão de crédito. Pix e débito nascem com a conta e não se
     *  criam pela mão. */
    async createCreditCard(
        body: ApiTypes.PaymentMethodCreateBody,
    ): Promise<{ IdPaymentMethod: number }> {
        const { data } = await http.post<{ IdPaymentMethod: number }>(this.route, body);
        return data;
    }

    /** `Kind` e `IdAccount` não são aceitos: um pix não vira cartão e um
     *  cartão não muda de conta — as duas trocas reescreveriam o
     *  significado das compras já lançadas nele. Mandar `null` em
     *  `DueDay`/`ClosingDay`/`CompetenceMode` de um cartão dá 406, e
     *  mandar qualquer um dos três FORA de um cartão dá 406 também.
     *
     *  Editar o cartão NÃO recalcula o que já foi lançado: `ClosingDate`,
     *  `DueDate`, `CompetenceDate` e `CashDate` moram na perna, gravadas
     *  no momento do lançamento. Corrigir o vencimento, o fechamento
     *  **ou o `CompetenceMode`** vale daqui para a frente; o já gravado
     *  só muda por um PUT no próprio gasto — virar a chave em novembro
     *  não reescreve agosto, e é de propósito: a alternativa seria mês
     *  fechado mudando de número sozinho. */
    async update(
        idPaymentMethod: number,
        body: ApiTypes.PaymentMethodUpdateBody,
    ): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(
            `${this.route}/IdPaymentMethod=${idPaymentMethod}`,
            body,
        );
        return data;
    }

    async archive(idPaymentMethod: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/IdPaymentMethod=${idPaymentMethod}`,
        );
        return data;
    }

    /** Quita a FATURA INTEIRA — é isto que tira o dinheiro do cartão da
     *  conta. No crédito, a perna sozinha não quita: `pay` a recusa.
     *
     *  A fatura não é cadastro, é consulta. Não há tabela nem id de
     *  fatura: todas as pernas de um ciclo compartilham o mesmo
     *  `DueDate` exato, e é ele que a identifica.
     *
     *  `Payments` na resposta é QUANTAS PERNAS mudaram de estado.
     *  Repetir a chamada é inofensivo — as já pagas são puladas e
     *  `Payments: 0` é resposta legítima ("a fatura já estava assim"). É
     *  isso que resolve lançar hoje uma compra esquecida que pertence a
     *  uma fatura já paga: chame de novo e só a que faltava é quitada.
     *  Pernas de gasto cancelado ficam de fora.
     *
     *  406 se a forma não existe no workspace, não é `credit_card`, ou
     *  não há fatura com esse vencimento — fatura sem perna nenhuma não
     *  é fatura paga, é fatura que não existe. */
    async payInvoice(
        idPaymentMethod: number,
        body: ApiTypes.InvoicePaymentBody,
    ): Promise<{ msg: string; Payments: number }> {
        const { data } = await http.post<{ msg: string; Payments: number }>(
            `${this.route}/IdPaymentMethod=${idPaymentMethod}/payInvoice`,
            body,
        );
        return data;
    }

    /** O sentido inverso, e ele existe pelo mesmo motivo que o `unpay` —
     *  e mais ainda: um clique errado aqui tira DEZENAS de pagamentos do
     *  saldo de uma vez. */
    async unpayInvoice(
        idPaymentMethod: number,
        body: ApiTypes.InvoicePaymentBody,
    ): Promise<{ msg: string; Payments: number }> {
        const { data } = await http.post<{ msg: string; Payments: number }>(
            `${this.route}/IdPaymentMethod=${idPaymentMethod}/unpayInvoice`,
            body,
        );
        return data;
    }
}

export const PaymentMethodsConnection = new Connection();
