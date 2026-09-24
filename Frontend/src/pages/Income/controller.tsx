import { cancelInflow } from "./sections/cancelInflow";
import { cloneMonth } from "./sections/cloneMonth";
import { loadInflowForEdit } from "./sections/loadInflowForEdit";
import { receiveInflow } from "./sections/receiveInflow";
import { unreceiveInflow } from "./sections/unreceiveInflow";
import { submitInflow } from "./sections/submitInflow";
import type { ApiTypes } from "@/types/api";

/** O rascunho do formulário de entrada.
 *
 *  `Kind` decide o que a conta de origem aceita: em `transfer`,
 *  `IdFromAccount` é obrigatório e diferente do `To`; em `inflow`, ele
 *  só aceita `null` — o dinheiro veio de fora.
 *
 *  Não há eixo de pessoas aqui: o rateio da renda saiu do produto na
 *  leva 10, e quem responde "de quem é esse dinheiro" é o Orçamento. */
export interface InflowDraft {
    IdInflow: number | null;
    Description: string;
    TotalValue: ApiTypes.Money | null;
    Kind: ApiTypes.InflowKind;
    IdFromAccount: number | null;
    IdToAccount: number | null;
    CompetenceDate: ApiTypes.CalendarDate;
    ExpectedDate: ApiTypes.CalendarDate | null;
    Notes: string;
    /** Já recebida: `Kind` e contas não se editam. */
    received: boolean;
}

export interface IncomeContext {
    draft: InflowDraft | null;
    beginSubmit(): void;
    failSubmit(message: string): void;
    finishSubmit(message: string): void;
    closeForm(): void;
    closeDetail(): void;
    closeCloneMonth(): void;
    setDraft(draft: InflowDraft): void;
}

class Controller {
    readonly submitInflow = submitInflow;
    readonly receiveInflow = receiveInflow;
    readonly unreceiveInflow = unreceiveInflow;
    readonly cloneMonth = cloneMonth;
    readonly cancelInflow = cancelInflow;
    readonly loadInflowForEdit = loadInflowForEdit;
}

export const IncomeController = new Controller();
