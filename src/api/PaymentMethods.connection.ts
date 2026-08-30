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
     *  significado das compras já lançadas nele. Mandar null em
     *  ClosingDay/DueDay de um cartão dá 406. */
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
}

export const PaymentMethodsConnection = new Connection();
