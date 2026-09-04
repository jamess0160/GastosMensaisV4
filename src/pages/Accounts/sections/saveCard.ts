import { errorMessage } from "@/api/client";
import { PaymentMethodsConnection } from "@/api/PaymentMethods.connection";
import type { AccountsContext } from "../controller";

/** Criar ou editar um cartão de crédito.
 *
 *  O POST só aceita `credit_card`: pix e débito nascem com a conta e não
 *  se criam pela mão — por isso a tela nem oferece escolher o tipo.
 *
 *  No PUT, `Kind` e `IdAccount` NÃO são aceitos: um pix não vira cartão
 *  e um cartão não muda de conta. As duas trocas reescreveriam o
 *  significado de todas as compras já lançadas nele. É por isso que o
 *  corpo do PUT abaixo é menor que o do POST, e não por esquecimento.
 *
 *  Bandeira e final do cartão SAÍRAM (pendência 16): não entram em
 *  regra nenhuma do sistema, e "últimos 4 dígitos" é dado de cartão
 *  guardado à toa. Não há leitura defensiva nem campo legado — o banco
 *  é ajustado junto.
 *
 *  `ClosingDay` e `DueDay` são obrigatórios no cartão, e mandar `null`
 *  neles no PUT responde 406 — daí a conferência local antes. Eles não
 *  são detalhe: em cartão, um dia de diferença na compra vira um mês de
 *  diferença no caixa. */
export async function saveCard(context: AccountsContext): Promise<void> {
    const draft = context.cardDraft;
    if (!draft) return;

    if (!draft.Name.trim()) {
        context.failSubmit("Informe o nome do cartão.");
        return;
    }
    if (!Number.isInteger(draft.ClosingDay) || draft.ClosingDay < 1 || draft.ClosingDay > 31) {
        context.failSubmit("O dia de fechamento vai de 1 a 31.");
        return;
    }
    if (!Number.isInteger(draft.DueDay) || draft.DueDay < 1 || draft.DueDay > 31) {
        context.failSubmit("O dia de vencimento vai de 1 a 31.");
        return;
    }
    context.beginSubmit();

    const common = {
        Name: draft.Name.trim(),
        ClosingDay: draft.ClosingDay,
        DueDay: draft.DueDay,
        Color: draft.Color,
    };

    try {
        if (draft.IdPaymentMethod === null) {
            await PaymentMethodsConnection.createCreditCard({
                IdAccount: draft.IdAccount,
                Kind: "credit_card",
                ...common,
            });
            context.finishSubmit("Cartão criado.");
        } else {
            // Sem `Kind` e sem `IdAccount`: a API não os aceita aqui.
            await PaymentMethodsConnection.update(draft.IdPaymentMethod, common);
            context.finishSubmit("Cartão atualizado.");
        }
        context.closeCardForm();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
