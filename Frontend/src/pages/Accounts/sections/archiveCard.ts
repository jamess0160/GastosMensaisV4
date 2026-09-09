import { errorMessage } from "@/api/client";
import { PaymentMethodsConnection } from "@/api/PaymentMethods.connection";
import type { AccountsContext } from "../controller";

/** Arquivar uma forma de pagamento.
 *
 *  Vale para o cartão e, em tese, para o pix e o débito que nasceram com
 *  a conta — mas a tela só oferece a ação no cartão: arquivar o débito
 *  de uma conta ativa deixaria a conta sem como pagar nada, e não há
 *  rota para recriá-lo. */
export async function archiveCard(
    context: AccountsContext,
    idPaymentMethod: number,
): Promise<void> {
    context.beginSubmit();

    try {
        await PaymentMethodsConnection.archive(idPaymentMethod);
        context.finishSubmit("Cartão arquivado.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
