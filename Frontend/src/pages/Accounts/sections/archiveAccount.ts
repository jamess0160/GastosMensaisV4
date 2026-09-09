import { errorMessage } from "@/api/client";
import { AccountsConnection } from "@/api/Accounts.connection";
import type { AccountsContext } from "../controller";

/** Arquivar uma conta.
 *
 *  Arquiva as formas de pagamento junto — inclusive os cartões — e o
 *  histórico continua apontando para a linha. Não é delete: o gasto de
 *  março não perde a forma com que foi pago porque a conta saiu do
 *  cadastro em agosto. */
export async function archiveAccount(context: AccountsContext, idAccount: number): Promise<void> {
    context.beginSubmit();

    try {
        await AccountsConnection.archive(idAccount);
        context.finishSubmit("Conta arquivada — as formas de pagamento dela foram junto.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
