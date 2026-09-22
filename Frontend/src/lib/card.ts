import { addDaysToDate, addMonths, dayInMonth, formatShort } from "./date";
import { sumMoney } from "./aggregate";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O ciclo da fatura, nos dois sentidos.

   A API descreve o cartão por DOIS DIAS DO MÊS — `ClosingDay` e
   `DueDay` —, que é o que a pessoa lê na própria fatura. Nenhum dos
   dois é derivado do outro.

   Até a leva 9 o cartão guardava o vencimento e uma FOLGA em dias, e o
   fechamento saía da subtração. Isso errava por construção, porque os
   meses têm tamanhos diferentes: num cartão que fecha 27 e vence 04,
   `04/09 − 8` é 27/08 (certo) e `04/10 − 8` é 26/09 (errado). Com isso
   a compra de 27/09 era dada como perdida naquela fatura e cobrada na
   de 04/11 — um dia de erro na descrição virando um mês no caixa.

   Sumiram daqui a conversão `cardCycleFromDates` e o aviso
   `checkCardCycle`: a primeira existia só para alimentar o modelo da
   folga, e o segundo avisava sobre uma deriva que não existe mais.
   ════════════════════════════════════════════════════════════ */

/** O intervalo que o Joi aceita nos dois dias. É o mesmo nos dois
 *  porque é a mesma coisa: um dia do mês. */
export const MIN_DAY_OF_MONTH = 1;
export const MAX_DAY_OF_MONTH = 31;

/** A única coisa que o modelo infere, e ela é estável porque compara
 *  dois dias NOMINAIS — não duas datas de meses de tamanhos diferentes,
 *  que era o defeito da folga.
 *
 *      ClosingDay >  DueDay -> fecha no mês ANTERIOR ao do vencimento
 *      ClosingDay <= DueDay -> fecha e vence no MESMO mês
 *
 *  Os dois casos existem no mundo: "fecha 27, vence 04" e "fecha 05,
 *  vence 15". */
const monthShift = (closingDay: number, dueDay: number): number => (closingDay > dueDay ? 1 : 0);

export interface InvoiceDates {
    closing: ApiTypes.CalendarDate;
    due: ApiTypes.CalendarDate;
}

/** As duas datas da fatura QUE VENCE naquele mês.
 *
 *  Os dois dias são aparados no mês curto (dia 31 em fevereiro é 28), e
 *  o fechamento cai no mês anterior quando ele é depois do dia de
 *  vencer — que é o normal em vencimento no começo do mês. */
export function invoiceDates(
    month: ApiTypes.ReferenceMonth,
    dueDay: number | null,
    closingDay: number | null,
): InvoiceDates {
    const due = dueDay ?? 1;
    const closing = closingDay ?? due;

    return {
        closing: dayInMonth(addMonths(month, -monthShift(closing, due)), closing),
        due: dayInMonth(month, due),
    };
}

export interface InvoiceCycle {
    start: ApiTypes.CalendarDate;
    end: ApiTypes.CalendarDate;
}

/** O CICLO que a fatura daquele mês cobre — a primeira compra que ela
 *  pega e a última.
 *
 *  É a `invoiceDates` lida ao contrário: lá a fatura declara quando
 *  fecha, aqui ela declara de quais compras é feita. Ela leva tudo que
 *  foi comprado DEPOIS do fechamento da fatura anterior — daí o `+1`,
 *  porque a compra feita NO dia do fechamento ainda entrou naquela
 *  outra.
 *
 *  E é por isso que o ciclo quase nunca cabe num mês só: fechando 28 e
 *  vencendo 04, a fatura de setembro cobre de 29/07 a 28/08. Num cartão
 *  em `purchase` essas compras pesaram em agosto e a fatura está na tela
 *  de setembro — que é exatamente o que a linha do ciclo existe para
 *  dizer. */
export function invoiceCycle(
    month: ApiTypes.ReferenceMonth,
    dueDay: number | null,
    closingDay: number | null,
): InvoiceCycle {
    const { closing } = invoiceDates(month, dueDay, closingDay);
    const previous = invoiceDates(addMonths(month, -1), dueDay, closingDay);

    return { start: addDaysToDate(previous.closing, 1), end: closing };
}

/** "compras de 29 jul a 28 ago" — a frase mora aqui, e não nas telas,
 *  porque Contas e Extrato mostram o MESMO ciclo da MESMA fatura: duas
 *  redações seriam duas respostas para a mesma pergunta. */
export const cycleLabel = (cycle: InvoiceCycle): string =>
    `compras de ${formatShort(cycle.start)} a ${formatShort(cycle.end)}`;

/** O modo, em uma frase curta. É a única configuração do cadastro que
 *  muda um número já exibido na tela, então ela precisa ser legível sem
 *  abrir o formulário — no painel do cartão e no cabeçalho da fatura.
 *
 *  Os dois falam da MESMA fatura, em dois pontos dela — e é por isso
 *  que "pesa no mês da compra" saiu: quem decide o mês é o ciclo, não a
 *  data. A compra de 28/09 num cartão que fecha 27 pegou a fatura que
 *  fecha em 27/10 e vence em 04/11, então ela pesa em outubro no
 *  `purchase` e em novembro no `invoice`. Em nenhum dos dois ela pesa
 *  em setembro, por mais que tenha sido comprada em setembro. */
export const COMPETENCE_LABEL: Record<ApiTypes.CompetenceMode, string> = {
    purchase: "pesa no mês em que a fatura fecha",
    invoice: "pesa no mês em que a fatura vence",
};

/* ── A fatura ─────────────────────────────────────────────── */

/** A perna é de cartão de crédito?
 *
 *  `Charged` é `null` fora do cartão, e é essa nulidade — e não o `Kind`
 *  da forma de pagamento, que a perna não carrega — que diz se a linha
 *  tem botão de conferência em vez de botão de quitação. */
export const isCardLeg = (payment: ApiTypes.ExpensePayment): boolean => payment.Charged !== null;

/** A fatura de um cartão num ciclo.
 *
 *  Ela não é um cadastro: não há tabela nem id de fatura. Todas as
 *  pernas de um ciclo compartilham o MESMO `DueDate` exato, então uma
 *  fatura é `(IdPaymentMethod, DueDate)` — e é esse `DueDate` que o
 *  `payInvoice` recebe de volta. */
export interface Invoice {
    closing: ApiTypes.CalendarDate;
    due: ApiTypes.CalendarDate;
    /** De quais compras esta fatura é feita. É o que separa "a fatura de
     *  setembro" de "os gastos de setembro" — num cartão em `purchase`
     *  os dois nunca são a mesma coisa. */
    cycle: InvoiceCycle;
    /** TODAS as linhas do ciclo — as que estão na fatura e as previstas
     *  —, como o extrato as devolveu. A `Date` de cada uma é a da
     *  COMPRA, não a do vencimento.
     *
     *  As duas juntas porque é o ciclo inteiro que o `payInvoice` quita:
     *  quem separa os dois grupos na tela é o Extrato, que lê o `Cards`
     *  direto. Aqui o que interessa é quantas linhas saem da conta. */
    entries: readonly ApiTypes.StatementCardEntry[];
    /** O que a fatura cobra — já com o sinal do estorno, que a reduz.
     *  Vem somado do servidor: é o mesmo número da linha `Fatura` do
     *  extrato, e não uma segunda soma que pode divergir dela. */
    total: ApiTypes.Money;
    /** O que foi lançado no cartão e o usuário desmarcou porque ainda
     *  não apareceu na fatura do emissor. **Fica fora do `total`** e sai
     *  da conta junto com ele quando a fatura for quitada. */
    expected: ApiTypes.Money;
    /** A fatura já saiu da conta? No cartão, quem escreve o `Paid` das
     *  pernas é só o `payInvoice`. */
    paid: boolean;
}

/** A fatura que vence naquele mês, montada a partir do extrato.
 *
 *  A entrada NÃO são as pernas do mês, e essa é a correção inteira.
 *  Elas chegam recortadas por `CompetenceDate`, e num cartão em modo
 *  `purchase` competência e vencimento divergem de propósito: a compra
 *  de 20/08 num cartão que vence dia 04 pesa em agosto e é cobrada em
 *  04/09. Nenhum dos dois meses tinha ao mesmo tempo a perna carregada
 *  e o `DueDate` procurado — a fatura ficava vazia nos dois, sempre.
 *
 *  `GET /Reports/Statement` responde a pergunta certa: `Cards` já é o
 *  par `(cartão, vencimento)` recortado por `DueDate`, com pago e
 *  pendente juntos. É o MESMO recorte que o `payInvoice` faz na
 *  escrita, e é isso que impede o botão de mandar um vencimento cujos
 *  lançamentos ele nunca viu.
 *
 *  `card` é `undefined` quando nenhuma fatura daquele cartão vence
 *  naquele mês: total zero, nenhuma linha, botão desabilitado — e
 *  agora isso é verdade. */
export function invoiceOf(
    card: ApiTypes.StatementCard | undefined,
    method: ApiTypes.PaymentMethod,
    month: ApiTypes.ReferenceMonth,
): Invoice {
    const { closing, due } = invoiceDates(month, method.DueDay, method.ClosingDay);
    const expected = card?.Expected ?? [];
    /* O ciclo inteiro: é ele que o `payInvoice` quita, e é por ele que
       o painel conta as linhas e decide se a fatura já saiu da conta. */
    const entries = [...(card?.Entries ?? []), ...expected];

    return {
        closing,
        /* O vencimento do extrato ganha do calculado: é dele que as
           linhas vieram, e é ele que o `payInvoice` recebe de volta. */
        due: card?.DueDate ?? due,
        /* E o ciclo pela mesma razão: quando há fatura, quem diz de que
           compras ela é feita é quem as recortou. O calculado é o mês
           sem fatura nenhuma, em que não há linha para explicar. */
        cycle: card
            ? { start: card.CycleStart, end: card.CycleEnd }
            : invoiceCycle(month, method.DueDay, method.ClosingDay),
        entries,
        total: card?.Total ?? 0,
        /* O previsto é somado aqui porque não é o que a fatura cobra:
           o servidor manda o `Total` do que ESTÁ na fatura, e este é o
           outro grupo. */
        expected: sumMoney(expected.map((entry) => entry.Value)),
        paid: entries.length > 0 && entries.every((entry) => entry.Paid),
    };
}
