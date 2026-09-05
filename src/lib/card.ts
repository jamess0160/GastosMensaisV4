import { addDaysToDate, dayInMonth, daysApart, parts } from "./date";
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
