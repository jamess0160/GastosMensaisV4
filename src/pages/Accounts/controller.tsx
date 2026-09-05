import { archiveAccount } from "./sections/archiveAccount";
import { archiveCard } from "./sections/archiveCard";
import { saveAccount } from "./sections/saveAccount";
import { saveCard } from "./sections/saveCard";
import type { ApiTypes } from "@/types/api";

/** Rascunho de conta. `IdAccount` nulo é criação. */
export interface AccountDraft {
    IdAccount: number | null;
    Name: string;
    Type: ApiTypes.AccountType;
    Color: ApiTypes.Color | null;
    InitialBalance: ApiTypes.Money | null;
    InitialBalanceDate: ApiTypes.CalendarDate | null;
    /** `InitialBalance` congela depois do primeiro lançamento: alterá-lo
     *  responde 406. A tela desabilita o campo em vez de deixar salvar. */
    balanceFrozen: boolean;
}

/** Rascunho de cartão. Só cartão de crédito se cria pela mão — pix e
 *  débito nascem com a conta. */
export interface CardDraft {
    IdPaymentMethod: number | null;
    IdAccount: number;
    Name: string;
    /** As DATAS da última fatura, como o usuário as lê no app do banco.
     *  A API guarda outra coisa — `DueDay` + `ClosingOffsetDays` —, e a
     *  conversão acontece na saída (`src/lib/card.ts`): ninguém sabe de
     *  cabeça "quantos dias antes", mas todo mundo sabe quando a fatura
     *  fechou e quando ela venceu. */
    ClosingDate: ApiTypes.CalendarDate | null;
    DueDate: ApiTypes.CalendarDate | null;
    Color: ApiTypes.Color | null;
}

export interface AccountsContext {
    accountDraft: AccountDraft | null;
    cardDraft: CardDraft | null;
    beginSubmit(): void;
    failSubmit(message: string): void;
    finishSubmit(message: string): void;
    closeAccountForm(): void;
    closeCardForm(): void;
}

class Controller {
    readonly saveAccount = saveAccount;
    readonly archiveAccount = archiveAccount;
    readonly saveCard = saveCard;
    readonly archiveCard = archiveCard;
}

export const AccountsController = new Controller();
