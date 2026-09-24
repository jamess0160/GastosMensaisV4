import { errorMessage } from "@/api/client";
import { PaymentMethodsConnection } from "@/api/PaymentMethods.connection";
import { MAX_DAY_OF_MONTH, MIN_DAY_OF_MONTH } from "@/lib/card";
import type { WelcomeContext } from "../controller";

/** Passo 2 — um cartão de crédito.
 *
 *  Ele é o segundo porque é a ÚNICA forma de pagamento que não nasce com
 *  a conta: pix e débito o `POST /Accounts` do passo 1 já criou, e o
 *  `POST /PaymentMethods` só aceita `credit_card`.
 *
 *  **OS DOIS DIAS SÃO OBRIGATÓRIOS E NENHUM TEM DEFAULT**, e é por isso
 *  que o passo pergunta os dois em vez de inventar um. Um dia do mês não
 *  se deduz de nada — os dois estão escritos na fatura. `ClosingDay >
 *  DueDay` é o cartão que fecha no mês anterior ao do vencimento (fecha
 *  27, vence 04) e `ClosingDay <= DueDay` é o que fecha e vence no mesmo
 *  mês: os dois casos existem no mundo, então não há ordem a recusar
 *  além do intervalo de 1 a 31.
 *
 *  `CompetenceMode` NÃO vai no corpo, ao contrário do que a tela de
 *  Contas faz — e a diferença é a regra, não o descuido: lá a tela
 *  pergunta, e o que ela pergunta ela manda; aqui o assistente não
 *  pergunta, e o default do servidor (`purchase`) é a resposta certa
 *  para quem está cadastrando o primeiro cartão. Mandar um valor que
 *  ninguém escolheu seria fingir uma escolha.
 *
 *  Passo OPCIONAL: quem não tem cartão pula, e pular não escreve nada. */
export async function saveFirstCard(context: WelcomeContext): Promise<void> {
    const draft = context.cardDraft;

    if (context.idAccount === null) {
        context.failSubmit("Cadastre a conta antes de cadastrar o cartão.");
        return;
    }
    if (!draft.Name.trim()) {
        context.failSubmit("Informe o nome do cartão.");
        return;
    }
    if (draft.ClosingDay === null || draft.DueDay === null) {
        context.failSubmit("Informe o dia em que a fatura fecha e o dia em que ela vence.");
        return;
    }
    if (!isDayOfMonth(draft.ClosingDay) || !isDayOfMonth(draft.DueDay)) {
        context.failSubmit(
            `Os dois dias têm que estar entre ${MIN_DAY_OF_MONTH} e ${MAX_DAY_OF_MONTH}.`,
        );
        return;
    }

    context.beginSubmit();

    try {
        await PaymentMethodsConnection.createCreditCard({
            IdAccount: context.idAccount,
            Kind: "credit_card",
            Name: draft.Name.trim(),
            ClosingDay: draft.ClosingDay,
            DueDay: draft.DueDay,
        });
        context.finishStep();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}

const isDayOfMonth = (day: number): boolean =>
    Number.isInteger(day) && day >= MIN_DAY_OF_MONTH && day <= MAX_DAY_OF_MONTH;
