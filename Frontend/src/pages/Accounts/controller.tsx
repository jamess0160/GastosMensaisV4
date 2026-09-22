import { archiveAccount } from "./sections/archiveAccount";
import { archiveCard } from "./sections/archiveCard";
import { payInvoice } from "./sections/payInvoice";
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
    /** OS DOIS DIAS DO MÊS, como a pessoa os lê na fatura — e é isso que
     *  a API guarda, sem conversão no meio.
     *
     *  Até a leva 9 a tela pedia as duas DATAS da última fatura e
     *  derivava daí o par `DueDay` + folga em dias. A folga errava por
     *  construção — os meses têm tamanhos diferentes, e o mesmo cartão
     *  fechava em dias diferentes —, e a conversão existia só para
     *  alimentá-la. `null` é o campo ainda não preenchido. */
    ClosingDay: number | null;
    DueDay: number | null;
    /** Em qual mês a compra deste cartão PESA. Nasce em `purchase`, que
     *  é o default do servidor — e não uma escolha nossa diferente da
     *  dele. Ver `ApiTypes.CompetenceMode`. */
    CompetenceMode: ApiTypes.CompetenceMode;
    Color: ApiTypes.Color | null;
}

export interface AccountsContext {
    accountDraft: AccountDraft | null;
    cardDraft: CardDraft | null;
    beginSubmit(): void;
    failSubmit(message: string): void;
    finishSubmit(message: string): void;
    /** O fim de uma quitação de fatura, e ele é diferente do
     *  `finishSubmit` em duas coisas: o cache invalidado é o do
     *  MOVIMENTO (uma fatura mexe em dezenas de pernas, no `Status` de
     *  dezenas de gastos e no saldo da conta, que é somado a cada
     *  leitura), e a mensagem é para ser LIDA — "12 lançamentos saíram
     *  do saldo" é o número que o usuário confere. */
    finishInvoice(message: string): void;
    closeAccountForm(): void;
    closeCardForm(): void;
}

class Controller {
    readonly saveAccount = saveAccount;
    readonly archiveAccount = archiveAccount;
    readonly saveCard = saveCard;
    readonly archiveCard = archiveCard;
    readonly payInvoice = payInvoice;
}

export const AccountsController = new Controller();
