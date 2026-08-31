import { errorMessage } from "@/api/client";
import { AccountsConnection } from "@/api/Accounts.connection";
import type { AccountsContext } from "../controller";

/** Criar ou editar uma conta.
 *
 *  Duas coisas do contrato mandam na forma deste corpo:
 *
 *  - `InitialBalance` CONGELA depois do primeiro lançamento. Alterá-lo
 *    responde 406 ("Esta conta já tem lançamentos: o saldo inicial não
 *    pode mais ser alterado"). A tela desabilita o campo quando há
 *    movimento; aqui ele é OMITIDO nesse caso, porque no PUT campo
 *    omitido é campo mantido — mandar o mesmo valor de volta ainda
 *    contaria como alteração.
 *  - Saldo inicial NEGATIVO é válido: é o cheque especial. Não há
 *    conferência de sinal nem aqui nem na API.
 *
 *  A conta nasce com uma forma pix e uma débito, criadas pela própria
 *  API — por isso não há nada a fazer aqui depois do POST. */
export async function saveAccount(context: AccountsContext): Promise<void> {
    const draft = context.accountDraft;
    if (!draft) return;

    if (!draft.Name.trim()) {
        context.failSubmit("Informe o nome da conta.");
        return;
    }

    context.beginSubmit();

    try {
        if (draft.IdAccount === null) {
            await AccountsConnection.create({
                Name: draft.Name.trim(),
                Type: draft.Type,
                Color: draft.Color,
                InitialBalance: draft.InitialBalance ?? 0,
                InitialBalanceDate: draft.InitialBalanceDate,
            });
            context.finishSubmit("Conta criada — ela já nasce com pix e débito.");
        } else {
            await AccountsConnection.update(draft.IdAccount, {
                Name: draft.Name.trim(),
                Type: draft.Type,
                Color: draft.Color,
                // Congelado: omitir mantém. Reenviar seria uma alteração.
                ...(draft.balanceFrozen
                    ? {}
                    : {
                          InitialBalance: draft.InitialBalance ?? 0,
                          InitialBalanceDate: draft.InitialBalanceDate,
                      }),
            });
            context.finishSubmit("Conta atualizada.");
        }
        context.closeAccountForm();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
