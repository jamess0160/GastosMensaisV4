import { errorMessage } from "@/api/client";
import { AccountsConnection } from "@/api/Accounts.connection";
import type { WelcomeContext } from "../controller";

/** Passo 1 — onde seu dinheiro fica.
 *
 *  É o MESMO corpo que `pages/Accounts/sections/saveAccount.ts` monta na
 *  criação, e de propósito: um segundo jeito de cadastrar a mesma coisa
 *  é o começo de duas contas com formas de pagamento diferentes.
 *
 *  `Type: "checking"` vai EXPLÍCITO, e não omitido. Ele é o default do
 *  servidor, então o efeito é o mesmo — mas é ele que decide quais
 *  formas de pagamento nascem junto (pix + débito), e o assistente não
 *  pergunta o tipo justamente porque depende dessa resposta: o passo 2
 *  cria um cartão de crédito nesta conta, e cartão só existe em conta
 *  `checking`. Deixar o campo implícito esconderia a amarração.
 *
 *  Saldo inicial NEGATIVO é válido — é o cheque especial —, então não há
 *  conferência de sinal aqui nem na API.
 *
 *  Este é o único passo OBRIGATÓRIO: sem conta não há forma de
 *  pagamento, e sem forma de pagamento não há onde lançar o cartão do
 *  passo 2 nem a renda do passo 4. */
export async function saveFirstAccount(context: WelcomeContext): Promise<void> {
    const draft = context.accountDraft;

    if (!draft.Name.trim()) {
        context.failSubmit("Informe o nome da conta.");
        return;
    }

    context.beginSubmit();

    try {
        const { IdAccount } = await AccountsConnection.create({
            Name: draft.Name.trim(),
            Type: "checking",
            Color: draft.Color,
            InitialBalance: draft.InitialBalance ?? 0,
            InitialBalanceDate: draft.InitialBalanceDate,
        });

        context.setIdAccount(IdAccount);
        context.finishStep();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
