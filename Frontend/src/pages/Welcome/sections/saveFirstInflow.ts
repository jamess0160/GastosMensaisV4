import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import { today } from "@/lib/date";
import type { WelcomeContext } from "../controller";

/** Passo 4 — a renda do mês.
 *
 *  Ela é o último passo que escreve porque **orçar é repartir a renda do
 *  mês**: sem ela lançada, o Orçamento que o painel final oferece
 *  repartiria zero.
 *
 *  `Kind: "inflow"` com `IdFromAccount: null` — o dinheiro veio de fora.
 *  Transferência é o outro `Kind`, e ela é neutra para o patrimônio;
 *  não é o que o assistente ensina.
 *
 *  **NÃO EXISTE `Persons` NO CORPO.** O rateio da entrada saiu do
 *  produto na leva 10, e quem responde "de quem é esse dinheiro" é o
 *  Orçamento — que é justamente a tela para onde o painel final leva.
 *
 *  `Status` também não vai: a entrada NASCE PENDENTE, e é o
 *  `POST /Inflows/:id/receive` que põe o dinheiro no saldo. O passo diz
 *  isso na tela, para o saldo da conta não parecer errado logo depois.
 *
 *  A `CompetenceDate` é HOJE, e não um campo: este passo é "a renda do
 *  mês", e o mês é o corrente. Ela é a data pela qual o gasto e o
 *  orçamento pesam — `ExpectedDate` fica em branco porque quando o
 *  dinheiro cai é outra pergunta, e a tela de Renda é quem a faz.
 *
 *  Passo OPCIONAL: pular não escreve nada. */
export async function saveFirstInflow(context: WelcomeContext): Promise<void> {
    const draft = context.inflowDraft;

    if (!draft.Description.trim()) {
        context.failSubmit("Informe a descrição da renda.");
        return;
    }
    if (draft.TotalValue === null || draft.TotalValue <= 0) {
        // Valor negativo seria saída, e saída é gasto.
        context.failSubmit("Informe um valor maior que zero.");
        return;
    }
    if (draft.IdToAccount === null) {
        context.failSubmit("Escolha a conta de destino.");
        return;
    }

    context.beginSubmit();

    try {
        await InflowsConnection.create({
            Description: draft.Description.trim(),
            TotalValue: draft.TotalValue,
            Kind: "inflow",
            IdFromAccount: null,
            IdToAccount: draft.IdToAccount,
            CompetenceDate: today(),
        });
        context.finishStep();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
