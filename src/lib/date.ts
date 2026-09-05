import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   CalendarDate ("YYYY-MM-DD") é string, e fica string.
   `new Date("2026-05-05")` é interpretado como UTC: em UTC-3 volta
   como 04/05. Todas as operações aqui são sobre a string ou sobre um
   Date construído em horário LOCAL, nunca sobre o parser ISO.
   ════════════════════════════════════════════════════════════ */

const MESES = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
] as const;

const MESES_CURTOS = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
] as const;

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

interface Parts {
    year: number;
    month: number; // 1-12
    day: number;
}

/** Quebra "YYYY-MM-DD" (ou "YYYY-MM-DDTxx", como o ReferenceMonth que
 *  volta do servidor) sem passar pelo parser de Date. */
export function parts(date: ApiTypes.CalendarDate): Parts {
    const [year, month, day] = date.slice(0, 10).split("-").map(Number);
    return { year, month, day };
}

/** Date em horário local — seguro para aritmética de calendário. */
export function toLocalDate(date: ApiTypes.CalendarDate): Date {
    const { year, month, day } = parts(date);
    return new Date(year, month - 1, day);
}

export function fromLocalDate(date: Date): ApiTypes.CalendarDate {
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export const today = (): ApiTypes.CalendarDate => fromLocalDate(new Date());

/* ── Formatação ───────────────────────────────────────────── */

/** "05/05/2026" */
export function formatDate(date: ApiTypes.CalendarDate): string {
    const { year, month, day } = parts(date);
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** "5 de maio" */
export function formatDayMonth(date: ApiTypes.CalendarDate): string {
    const { month, day } = parts(date);
    return `${day} de ${MESES[month - 1]}`;
}

/** "05 mai" */
export function formatShort(date: ApiTypes.CalendarDate): string {
    const { month, day } = parts(date);
    return `${String(day).padStart(2, "0")} ${MESES_CURTOS[month - 1]}`;
}

/** "seg" */
export function weekdayShort(date: ApiTypes.CalendarDate): string {
    return DIAS_CURTOS[toLocalDate(date).getDay()];
}

/** "Maio · 2026" — o cabeçalho de mês do layout. */
export function formatMonthLabel(month: ApiTypes.ReferenceMonth | ApiTypes.CalendarDate): string {
    const [year, monthNumber] = month.slice(0, 7).split("-").map(Number);
    const name = MESES[monthNumber - 1];
    return `${name[0].toUpperCase()}${name.slice(1)} · ${year}`;
}

/** DateTime é instante de verdade: aqui `new Date()` é correto. */
export function formatDateTime(value: ApiTypes.DateTime): string {
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

/* ── Mês ──────────────────────────────────────────────────── */

/** "YYYY-MM" a partir de qualquer CalendarDate. É o formato que o
 *  endpoint de orçamento espera na entrada. */
export const toReferenceMonth = (date: ApiTypes.CalendarDate): ApiTypes.ReferenceMonth =>
    date.slice(0, 7);

export const currentMonth = (): ApiTypes.ReferenceMonth => toReferenceMonth(today());

/** Primeiro e último dia do mês, para as query From/To das listagens. */
export function monthRange(month: ApiTypes.ReferenceMonth): {
    From: ApiTypes.CalendarDate;
    To: ApiTypes.CalendarDate;
} {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const mm = String(monthNumber).padStart(2, "0");
    return {
        From: `${year}-${mm}-01`,
        To: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    };
}

export function addMonths(month: ApiTypes.ReferenceMonth, delta: number): ApiTypes.ReferenceMonth {
    const [year, monthNumber] = month.split("-").map(Number);
    const shifted = new Date(year, monthNumber - 1 + delta, 1);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

/** O mesmo salto, mas de uma DATA, aparando o dia no mês curto.
 *
 *  31/01 mais um mês é 28/02, e nunca 03/03: `new Date(2026, 1, 31)`
 *  transborda para março sozinho. É o que a clonagem do mês de Renda
 *  precisa — um salário do dia 31 não pode nascer no dia 3 do mês
 *  seguinte. */
export function addMonthsToDate(date: ApiTypes.CalendarDate, delta: number): ApiTypes.CalendarDate {
    const { year, month, day } = parts(date);
    // Dia 0 do mês seguinte = último dia do mês de destino.
    const lastDay = new Date(year, month + delta, 0).getDate();
    return fromLocalDate(new Date(year, month - 1 + delta, Math.min(day, lastDay)));
}

/** O mesmo dia em outra data, sem passar pelo parser ISO. Dias negativos
 *  andam para trás, e o mês vira sozinho: 03/09 menos 7 é 27/08. */
export function addDaysToDate(date: ApiTypes.CalendarDate, delta: number): ApiTypes.CalendarDate {
    const { year, month, day } = parts(date);
    return fromLocalDate(new Date(year, month - 1, day + delta));
}

/** Quantos dias de calendário separam duas datas — negativo se `to` vem
 *  antes de `from`. É a folga do cartão vista de fora: fechou 27/08,
 *  venceu 03/09, folga de 7. */
export function daysApart(from: ApiTypes.CalendarDate, to: ApiTypes.CalendarDate): number {
    const millis = toLocalDate(to).getTime() - toLocalDate(from).getTime();
    return Math.round(millis / 86_400_000);
}

/** A data daquele dia naquele mês, APARADA no mês curto: dia 31 em
 *  fevereiro é 28, e nunca 3 de março. Mesmo cuidado do
 *  `addMonthsToDate` — um vencimento dia 31 não pode virar dia 3. */
export function dayInMonth(month: ApiTypes.ReferenceMonth, day: number): ApiTypes.CalendarDate {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return fromLocalDate(new Date(year, monthNumber - 1, Math.min(day, lastDay)));
}

/** Os meses de um intervalo, das duas pontas inclusive.
 *
 *  É a unidade em que o cache de movimento é guardado (uma chave por
 *  mês), então é assim que um período vira requisições. */
export function monthsBetween(
    from: ApiTypes.ReferenceMonth,
    to: ApiTypes.ReferenceMonth,
): ApiTypes.ReferenceMonth[] {
    const months: ApiTypes.ReferenceMonth[] = [];
    for (let month = from; month <= to; month = addMonths(month, 1)) {
        months.push(month);
        // Trava de sanidade: intervalo invertido ou absurdo não vira laço
        // infinito nem dez mil requisições.
        if (months.length > 120) break;
    }
    return months;
}

/** Todos os dias de um intervalo, em ordem — o eixo X do relatório. */
export function daysBetween(
    from: ApiTypes.CalendarDate,
    to: ApiTypes.CalendarDate,
): ApiTypes.CalendarDate[] {
    const days: ApiTypes.CalendarDate[] = [];
    const last = toLocalDate(to);
    for (const day = toLocalDate(from); day <= last; day.setDate(day.getDate() + 1)) {
        days.push(fromLocalDate(day));
        if (days.length > 3660) break;
    }
    return days;
}

/** Todos os dias do mês, em ordem — o eixo X do relatório diário. */
export function daysOfMonth(month: ApiTypes.ReferenceMonth): ApiTypes.CalendarDate[] {
    const { From, To } = monthRange(month);
    const last = toLocalDate(To).getDate();
    const prefix = From.slice(0, 8);
    return Array.from(
        { length: last },
        (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`,
    );
}
