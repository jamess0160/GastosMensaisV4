import { errorMessage } from "@/api/client";
import { AccountsConnection } from "@/api/Accounts.connection";
import type { AccountsContext } from "../controller";

/** Criar ou editar uma conta.
 *
 *  Duas coisas do contrato mandam na forma deste corpo:
 *
 *  - `InitialBalance` e `Type` CONGELAM depois do primeiro lançamento,
 *    pela mesma pergunta ("esta conta tem movimento?"). Alterá-los
 *    responde 406. A tela desabilita os dois campos quando há
 *    movimento; aqui eles são OMITIDOS nesse caso, porque no PUT campo
 *    omitido é campo mantido — mandar o mesmo valor de volta ainda
 *    contaria como alteração.
 *  - Saldo inicial NEGATIVO é válido: é o cheque especial. Não há
 *    conferência de sinal nem aqui nem na API.
 *
 *  AS FORMAS DE PAGAMENTO NASCEM COM A CONTA, e quais delas é o `Type`
 *  que decide: `checking` nasce com pix + débito, `cash` com uma forma
 *  "Dinheiro" e `card` — o vale-alimentação — com uma forma de débito
 *  com o nome da conta. Quem as cria é a própria API, por isso não há
 *  nada a fazer aqui depois do POST. Trocar o tipo depois NÃO as refaz,
 *  nem numa conta vazia onde a troca é aceita. */
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
                Color: draft.Color,
                // Congelados JUNTOS: omitir mantém, e reenviar o mesmo
                // valor ainda contaria como alteração.
                ...(draft.balanceFrozen
                    ? {}
                    : {
                          Type: draft.Type,
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
