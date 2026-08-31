import { cancelInflow } from "./sections/cancelInflow";
import { loadInflowForEdit } from "./sections/loadInflowForEdit";
import { receiveInflow } from "./sections/receiveInflow";
import { submitInflow } from "./sections/submitInflow";
import type { SplitLine } from "@/ui/SplitEditor";
import type { ApiTypes } from "@/types/api";

/** O rascunho do formulário de entrada.
 *
 *  `Kind` decide quase tudo: em `transfer`, `IdFromAccount` é obrigatório
 *  (e diferente do `To`) e o rateio é PROIBIDO; em `inflow`,
 *  `IdFromAccount` só aceita `null` — o dinheiro veio de fora. */
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
    persons: SplitLine[];
    /** Já recebida: `Kind` e contas não se editam, e o rateio é
     *  reconferido contra o NOVO total. */
    received: boolean;
}

export interface IncomeContext {
    draft: InflowDraft | null;
    beginSubmit(): void;
    failSubmit(message: string): void;
    finishSubmit(message: string): void;
    closeForm(): void;
    closeDetail(): void;
    setDraft(draft: InflowDraft): void;
}

class Controller {
    readonly submitInflow = submitInflow;
    readonly receiveInflow = receiveInflow;
    readonly cancelInflow = cancelInflow;
    readonly loadInflowForEdit = loadInflowForEdit;
}

export const IncomeController = new Controller();
