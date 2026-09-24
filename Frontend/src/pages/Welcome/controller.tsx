import { saveFirstAccount } from "./sections/saveFirstAccount";
import { saveFirstCard } from "./sections/saveFirstCard";
import { saveFirstInflow } from "./sections/saveFirstInflow";
import { saveFirstPersons } from "./sections/saveFirstPersons";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O assistente dos primeiros passos.

   Ele não é uma tela a mais: é a ORDEM das quatro escritas que já
   existem, e a ordem é imposta pela API, não pelo gosto de quem
   desenhou.

   1. A CONTA vem primeiro porque é o cadastro dela que cria as formas
      de pagamento — na mesma transaction
      (`API/routes/Accounts/sections/POST/create.ts` →
      `API/routes/PaymentMethods/sections/POST/createDefaults.ts`).
      Sem conta não existe forma, e sem forma não há onde lançar gasto
      nem renda. Por isso é o único passo obrigatório.
   2. O CARTÃO é o segundo porque é a única forma de pagamento que NÃO
      nasce com a conta, e porque ele tem dois dias do mês — fecha e
      vence — que não se deduzem de nada e por isso são perguntados.
   3. AS PESSOAS são o eixo analítico do gasto e do orçamento, e não
      dependem de nada do que veio antes.
   4. A RENDA vem antes do orçamento porque orçar é repartir a renda do
      mês: repartir antes de lançá-la é repartir zero. E ela cai na
      conta do passo 1, que é o que amarra o assistente inteiro.

   NADA É GUARDADO PARA SABER SE O ASSISTENTE JÁ PASSOU. Não há coluna
   `OnboardingCompleted` e não há bandeira no `localStorage`: o estado
   "este espaço está montado" já é respondido pelo dado — o espaço tem
   conta, ou não tem. Uma segunda fonte para a mesma pergunta é a
   armadilha do saldo em cache numa escala menor: dois lugares dizendo a
   mesma coisa, e um deles errado. É por isso que a retomada no Início
   (`src/pages/Dashboard/Dashboard.tsx`) olha o tamanho da lista de
   contas, e não uma marca de passagem.
   ════════════════════════════════════════════════════════════ */

/** Os quatro passos, mais o painel final — que não escreve nada. */
export type WelcomeStep = 1 | 2 | 3 | 4 | 5;

export const LAST_STEP: WelcomeStep = 5;

/** O passo 1. **Não tem `Type`, e a ausência é escolha:** o assistente
 *  cadastra uma conta corrente, que é a única que nasce com pix e
 *  débito e a única em que um cartão de crédito pode existir depois.
 *  Perguntar o tipo aqui abriria a porta para a pessoa escolher
 *  `cash` no primeiro passo e levar 406 no segundo, sem entender a
 *  ligação. Carteira e vale-alimentação se cadastram em Contas, que é
 *  onde o tipo é a pergunta certa. */
export interface AccountStepDraft {
    Name: string;
    Color: ApiTypes.Color | null;
    InitialBalance: ApiTypes.Money | null;
    InitialBalanceDate: ApiTypes.CalendarDate | null;
}

/** O passo 2. Nasce sem os dois dias — eles estão escritos na fatura, e
 *  chutar um par plausível aqui é gravar exatamente o dado errado. */
export interface CardStepDraft {
    Name: string;
    ClosingDay: number | null;
    DueDay: number | null;
}

/** O passo 3. Uma pessoa por linha, e a lista é o rascunho inteiro:
 *  `POST /Persons` cria uma de cada vez, então o que sobra depois de
 *  uma recusa é o que ainda não foi criado. */
export interface PersonsStepDraft {
    names: string[];
}

/** O passo 4. Sem rateio: a entrada não tem mais `Persons` (leva 10) —
 *  quem reparte a renda do mês por pessoa é o Orçamento.
 *
 *  A `CompetenceDate` não é campo: a renda deste passo é a DO MÊS, e o
 *  mês é o de hoje. Quem quiser lançar a de outubro em setembro faz
 *  isso na tela de Renda, onde a competência é a pergunta. */
export interface InflowStepDraft {
    Description: string;
    TotalValue: ApiTypes.Money | null;
    IdToAccount: number | null;
}

export interface WelcomeContext {
    accountDraft: AccountStepDraft;
    cardDraft: CardStepDraft;
    personsDraft: PersonsStepDraft;
    inflowDraft: InflowStepDraft;
    /** A conta que o passo 1 criou. É ela que recebe o cartão do passo
     *  2, e é ela que o passo 4 já traz escolhida como destino. `null`
     *  só enquanto o passo 1 não passou — e o passo 1 é obrigatório. */
    idAccount: number | null;
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** A escrita passou: invalida o cache e avança um passo. */
    finishStep(): void;
    /** O id da conta recém-criada. Os passos 2 e 4 escrevem nela, e é
     *  só por isso que o passo 1 é obrigatório. */
    setIdAccount(idAccount: number): void;
    /** O que ainda NÃO foi criado no passo 3. Chamado quando uma linha é
     *  recusada no meio da fila: sem isso, tentar de novo recriaria as
     *  que já passaram e a segunda tentativa morreria em "nome já
     *  usado", prendendo o passo para sempre. */
    setPersonNames(names: string[]): void;
}

class Controller {
    readonly saveFirstAccount = saveFirstAccount;
    readonly saveFirstCard = saveFirstCard;
    readonly saveFirstPersons = saveFirstPersons;
    readonly saveFirstInflow = saveFirstInflow;
}

export const WelcomeController = new Controller();
