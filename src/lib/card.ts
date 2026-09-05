import { addDaysToDate, dayInMonth, daysApart, parts } from "./date";
import { sumMoney, type ExpenseLeg } from "./aggregate";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O ciclo da fatura, nos dois sentidos.

   A API descreve o cartão por VENCIMENTO e FOLGA (`DueDay` +
   `ClosingOffsetDays`), que é o dado que o emissor pede ao cliente —
   nenhum banco brasileiro deixa escolher o dia do fechamento.

   O usuário, na tela, tem outra coisa na mão: as duas DATAS da última
   fatura, que ele lê no app do banco. Este arquivo é a tradução entre
   as duas formas, e é onde fica visível que a data de fechamento NÃO é
   um dia fixo do calendário: ela muda de mês para mês.
   ════════════════════════════════════════════════════════════ */

/** O que o servidor aplica quando a folga é omitida. Não há padrão de
 *  mercado — fica tipicamente entre 6 e 10 dias, e 7 é o meio. */
export const DEFAULT_CLOSING_OFFSET_DAYS = 7;

/** O intervalo que o Joi aceita em `ClosingOffsetDays`. */
export const MIN_CLOSING_OFFSET_DAYS = 1;
export const MAX_CLOSING_OFFSET_DAYS = 28;

export interface InvoiceDates {
    closing: ApiTypes.CalendarDate;
    due: ApiTypes.CalendarDate;
}

/** As duas datas da fatura QUE VENCE naquele mês.
 *
 *  Vencendo dia 5 com folga de 7, a fatura fecha em 26/02 e em 29/03 —
 *  é a subtração que muda, não o cartão. O vencimento é aparado no mês
 *  curto (dia 31 em fevereiro é 28), e o fechamento pode cair no mês
 *  anterior, que é o normal em vencimento no começo do mês. */
export function invoiceDates(
    month: ApiTypes.ReferenceMonth,
    dueDay: number | null,
    offsetDays: number | null,
): InvoiceDates {
    const due = dayInMonth(month, dueDay ?? 1);
    return { closing: addDaysToDate(due, -(offsetDays ?? DEFAULT_CLOSING_OFFSET_DAYS)), due };
}

/** O caminho de volta: as duas datas que o usuário leu na fatura viram
 *  o par que a API guarda.
 *
 *  O dia do vencimento é o da data, e a folga é a distância entre as
 *  duas — nenhum dos dois depende do mês em que ele digitou. */
export function cardCycleFromDates(
    closing: ApiTypes.CalendarDate,
    due: ApiTypes.CalendarDate,
): { DueDay: number; ClosingOffsetDays: number } {
    return { DueDay: parts(due).day, ClosingOffsetDays: daysApart(closing, due) };
}

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
    legs: ExpenseLeg[];
    /** O que a fatura cobra — já com o sinal do estorno, que a reduz. */
    total: ApiTypes.Money;
    /** Quanto do total o usuário já conferiu como lançado na fatura. A
     *  diferença para o total é o que ele esperava e o cartão ainda não
     *  registrou. */
    charged: ApiTypes.Money;
    /** A fatura já saiu da conta? No cartão, quem escreve o `Paid` das
     *  pernas é só o `payInvoice`. */
    paid: boolean;
}

/** As pernas do cartão que caem na fatura que vence naquele mês.
 *
 *  O recorte é pelo `DueDate` exato do ciclo, e não pelo mês: duas
 *  faturas do mesmo cartão nunca vencem no mesmo dia, e é o dia que o
 *  servidor usa para achar as pernas. */
export function invoiceOf(
    legs: readonly ExpenseLeg[],
    method: ApiTypes.PaymentMethod,
    month: ApiTypes.ReferenceMonth,
): Invoice {
    const { closing, due } = invoiceDates(month, method.DueDay, method.ClosingOffsetDays);

    const mine = legs.filter(
        (leg) =>
            leg.payment.IdPaymentMethod === method.IdPaymentMethod && leg.payment.DueDate === due,
    );

    return {
        closing,
        due,
        legs: mine,
        total: sumMoney(mine.map((leg) => leg.value)),
        charged: sumMoney(
            mine.filter((leg) => leg.payment.Charged === true).map((leg) => leg.value),
        ),
        paid: mine.length > 0 && mine.every((leg) => leg.paid),
    };
}
