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

/** Dias que faltam até o fim do mês, contando hoje. O "13 dias restantes"
 *  do dashboard. Zero quando o mês já passou. */
export function daysLeftInMonth(month: ApiTypes.ReferenceMonth = currentMonth()): number {
    const now = today();
    const { From, To } = monthRange(month);
    if (now > To) return 0;
    if (now < From) return toLocalDate(To).getDate();
    return toLocalDate(To).getDate() - toLocalDate(now).getDate() + 1;
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
