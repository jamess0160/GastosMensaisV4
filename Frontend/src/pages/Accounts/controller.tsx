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
    /** As DATAS da última fatura, como o usuário as lê no app do banco.
     *  A API guarda outra coisa — `DueDay` + `ClosingOffsetDays` —, e a
     *  conversão acontece na saída (`src/lib/card.ts`): ninguém sabe de
     *  cabeça "quantos dias antes", mas todo mundo sabe quando a fatura
     *  fechou e quando ela venceu. */
    ClosingDate: ApiTypes.CalendarDate | null;
    DueDate: ApiTypes.CalendarDate | null;
    /** Em qual mês a compra deste cartão PESA. Nasce em `purchase`, que
     *  é o default do servidor — e não uma escolha nossa diferente da
     *  dele. Ver `ApiTypes.CompetenceMode`. */
    CompetenceMode: ApiTypes.CompetenceMode;
    Color: ApiTypes.Color | null;
    /** A pessoa já foi avisada de que a folga que essas duas datas
     *  produzem fecha noutro dia em parte do ano, e mesmo assim quis
     *  salvar. Nasce `false` na criação e `true` na edição — lá as datas
     *  saíram do próprio cadastro, e mexer numa delas volta a `false`.
     *
     *  Ele NÃO vai para a API: o que se guarda é o par vencimento +
     *  folga, e este campo é a memória de um aviso dentro do formulário
     *  aberto. */
    cycleAcknowledged: boolean;
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
    /** Marca o aviso do ciclo como lido, para o segundo envio passar. É
     *  o que separa "aceitou em silêncio" de "leu e decidiu". */
    acknowledgeCycleDrift(): void;
}

class Controller {
    readonly saveAccount = saveAccount;
    readonly archiveAccount = archiveAccount;
    readonly saveCard = saveCard;
    readonly archiveCard = archiveCard;
    readonly payInvoice = payInvoice;
}

export const AccountsController = new Controller();
