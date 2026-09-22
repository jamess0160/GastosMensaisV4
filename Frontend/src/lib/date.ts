import moment from "moment";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   CalendarDate ("YYYY-MM-DD") é string, e fica string.

   A aritmética é do `moment`, a mesma biblioteca que a API usa em
   `Utils.ts` — duas implementações da mesma regra de calendário é como
   os dois lados passam a discordar sobre onde 31/01 mais um mês cai. O
   que NÃO muda por causa da biblioteca é a superfície: toda função
   daqui recebe e devolve `CalendarDate`/`ReferenceMonth`, e nenhuma
   devolve `Moment`. Um `Moment` que escapa deste arquivo é um instante
   solto, e instante solto é o que o fuso estraga.

   Três cuidados que o moment não toma sozinho:

   - **modo estrito, com o formato explícito.** `moment(x)` adivinha o
     formato e aceita quase tudo; aqui uma string fora do padrão vira
     "Invalid date" na saída, e o erro aparece onde nasceu;
   - **nunca o parser ISO em UTC.** `new Date("2026-05-05")` é
     meia-noite UTC e volta como 04/05 em UTC-3. `moment(texto, formato)`
     constrói em horário LOCAL, que é o que a data de calendário quer;
   - **o moment não traduz nada aqui.** Os nomes de mês e de dia são as
     constantes abaixo, e `MMMM`/`MMM`/`ddd` não aparecem em nenhum
     formato deste arquivo. O locale `pt-br` era importado para isso e
     falhava em produção: o arquivo de locale é CommonJS e se registra
     fazendo `require("../moment")`, enquanto este módulo é ESM e faz
     `import moment from "moment"` — no build o interop pode dar dois
     registros do módulo, e o idioma acaba instalado numa instância que
     ninguém usa para formatar. O `moment.locale("pt-br")` seguinte não
     denunciava nada: quando o idioma não existe, o moment DEVOLVE o
     atual em vez de lançar, e o cabeçalho dizia "September · 2026" só
     no ar. Só a tradução saiu — a aritmética de calendário continua
     toda no moment, que é o que a API também usa.
   ════════════════════════════════════════════════════════════ */

/** Os doze nomes, em minúscula: em português mês é nome comum, e
 *  "5 de maio" se escreve assim. Quem quer título sobe a inicial na
 *  hora de escrever (ver `formatMonthLabel`). */
const MONTH_NAMES = [
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
];

/** As abreviações de mês, indexadas por `month()` (0-11). */
const MONTH_NAMES_SHORT = [
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
];

/** As abreviações de dia da semana, indexadas por `day()` — que é 0 no
 *  domingo em qualquer idioma, porque é índice e não tradução. */
const WEEKDAY_NAMES_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** O formato do `CalendarDate`, e o único que o parser estrito aceita. */
const CALENDAR = "YYYY-MM-DD";

/** O formato do `ReferenceMonth`. */
const MONTH = "YYYY-MM";

/** O moment de uma data de calendário, em horário local.
 *
 *  O `slice` é pelo `ReferenceMonth` que volta do servidor como
 *  "2026-05-01T00:00:00.000Z": o dia dele é o que interessa, e o
 *  instante depois do "T" é ruído de serialização. */
const calendar = (date: ApiTypes.CalendarDate) => moment(date.slice(0, 10), CALENDAR, true);

/** O moment do primeiro dia de um mês de referência. Aceita a
 *  `CalendarDate` inteira pelo mesmo motivo do `calendar`. */
const month = (value: ApiTypes.ReferenceMonth | ApiTypes.CalendarDate) =>
    moment(value.slice(0, 7), MONTH, true);

interface Parts {
    year: number;
    month: number; // 1-12
    day: number;
}

/** Quebra "YYYY-MM-DD" (ou "YYYY-MM-DDTxx", como o ReferenceMonth que
 *  volta do servidor) sem passar pelo parser ISO. */
export function parts(date: ApiTypes.CalendarDate): Parts {
    const value = calendar(date);
    return { year: value.year(), month: value.month() + 1, day: value.date() };
}

/** Date em horário local — seguro para aritmética de calendário. */
export function toLocalDate(date: ApiTypes.CalendarDate): Date {
    return calendar(date).toDate();
}

export function fromLocalDate(date: Date): ApiTypes.CalendarDate {
    return moment(date).format(CALENDAR);
}

export const today = (): ApiTypes.CalendarDate => moment().format(CALENDAR);

/* ── Formatação ───────────────────────────────────────────── */

/** "05/05/2026" */
export function formatDate(date: ApiTypes.CalendarDate): string {
    return calendar(date).format("DD/MM/YYYY");
}

/** "5 de maio" */
export function formatDayMonth(date: ApiTypes.CalendarDate): string {
    const value = calendar(date);
    return `${value.date()} de ${MONTH_NAMES[value.month()]}`;
}

/** "05 mai" */
export function formatShort(date: ApiTypes.CalendarDate): string {
    const value = calendar(date);
    return `${value.format("DD")} ${MONTH_NAMES_SHORT[value.month()]}`;
}

/** "seg" */
export function weekdayShort(date: ApiTypes.CalendarDate): string {
    return WEEKDAY_NAMES_SHORT[calendar(date).day()];
}

/** "Maio · 2026" — o cabeçalho de mês do layout.
 *
 *  A inicial maiúscula é nossa: em português o nome do mês é minúsculo,
 *  e a constante guarda "maio". O cabeçalho quer o título. */
export function formatMonthLabel(value: ApiTypes.ReferenceMonth | ApiTypes.CalendarDate): string {
    const target = month(value);
    const name = MONTH_NAMES[target.month()];
    return `${name[0].toUpperCase()}${name.slice(1)} · ${target.format("YYYY")}`;
}

/** "ago/2026" — o mês compacto, para a linha que já carrega uma data e
 *  não tem espaço para "Agosto · 2026".
 *
 *  Nasceu do `CompetenceMode`: uma perna de cartão `purchase` tem duas
 *  datas verdadeiras — "vence 05 set" e "pesa em ago/2026" —, e a linha
 *  do gasto mostra as duas quando elas discordam. */
export function formatMonthShort(value: ApiTypes.ReferenceMonth | ApiTypes.CalendarDate): string {
    const target = month(value);
    return `${MONTH_NAMES_SHORT[target.month()]}/${target.format("YYYY")}`;
}

/** DateTime é instante de verdade, e é o único deste arquivo que não
 *  passa pelo moment: aqui `new Date()` está certo, e o `Intl` formata
 *  no fuso de quem lê — que é o que um carimbo de "criado em" quer
 *  dizer. */
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
    calendar(date).format(MONTH);

export const currentMonth = (): ApiTypes.ReferenceMonth => moment().format(MONTH);

/** Primeiro e último dia do mês, para as query From/To das listagens. */
export function monthRange(value: ApiTypes.ReferenceMonth): {
    From: ApiTypes.CalendarDate;
    To: ApiTypes.CalendarDate;
} {
    const start = month(value);
    return {
        From: start.format(CALENDAR),
        To: start.clone().endOf("month").format(CALENDAR),
    };
}

export function addMonths(value: ApiTypes.ReferenceMonth, delta: number): ApiTypes.ReferenceMonth {
    return month(value).add(delta, "months").format(MONTH);
}

/** O mesmo salto, mas de uma DATA, aparando o dia no mês curto.
 *
 *  31/01 mais um mês é 28/02, e nunca 03/03 — o `add` do moment já
 *  grampeia no fim do mês, que é a regra de que a clonagem do mês de
 *  Renda precisa: um salário do dia 31 não pode nascer no dia 3 do mês
 *  seguinte. */
export function addMonthsToDate(date: ApiTypes.CalendarDate, delta: number): ApiTypes.CalendarDate {
    return calendar(date).add(delta, "months").format(CALENDAR);
}

/** O mesmo dia em outra data, sem passar pelo parser ISO. Dias negativos
 *  andam para trás, e o mês vira sozinho: 03/09 menos 7 é 27/08. */
export function addDaysToDate(date: ApiTypes.CalendarDate, delta: number): ApiTypes.CalendarDate {
    return calendar(date).add(delta, "days").format(CALENDAR);
}

/** Quantos dias de calendário separam duas datas — negativo se `to` vem
 *  antes de `from`. É a folga do cartão vista de fora: fechou 27/08,
 *  venceu 03/09, folga de 7. */
export function daysApart(from: ApiTypes.CalendarDate, to: ApiTypes.CalendarDate): number {
    return Math.round(calendar(to).diff(calendar(from), "days", true));
}

/** A data daquele dia naquele mês, APARADA no mês curto: dia 31 em
 *  fevereiro é 28, e nunca 3 de março.
 *
 *  O clamp é nosso: o `date()` do moment estoura para o mês seguinte
 *  quando o dia não existe. Mesmo cuidado do `addMonthsToDate` — um
 *  vencimento dia 31 não pode virar dia 3. */
export function dayInMonth(value: ApiTypes.ReferenceMonth, day: number): ApiTypes.CalendarDate {
    const target = month(value);
    return target.date(Math.min(day, target.daysInMonth())).format(CALENDAR);
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
    // "YYYY-MM" ordena como texto na mesma ordem em que ordena como
    // data, então a parada do laço é uma comparação de string.
    for (let current = from; current <= to; current = addMonths(current, 1)) {
        months.push(current);
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
    const last = calendar(to);
    // O moment muta no lugar: `day` é o mesmo objeto do começo ao fim.
    for (const day = calendar(from); !day.isAfter(last, "day"); day.add(1, "day")) {
        days.push(day.format(CALENDAR));
        if (days.length > 3660) break;
    }
    return days;
}

/** Todos os dias do mês, em ordem — o eixo X do relatório diário. */
export function daysOfMonth(value: ApiTypes.ReferenceMonth): ApiTypes.CalendarDate[] {
    const { From, To } = monthRange(value);
    return daysBetween(From, To);
}
