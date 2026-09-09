import { addDaysToDate, addMonths, dayInMonth, daysApart, formatShort, parts } from "./date";
import { sumMoney } from "./aggregate";
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
 *  E é por isso que o ciclo quase nunca cabe num mês só: vencendo dia 04
 *  com folga de 7, a fatura de setembro cobre de 29/07 a 28/08. Num
 *  cartão em `purchase` essas compras pesaram em agosto e a fatura está
 *  na tela de setembro — que é exatamente o que a linha do ciclo existe
 *  para dizer. */
export function invoiceCycle(
    month: ApiTypes.ReferenceMonth,
    dueDay: number | null,
    offsetDays: number | null,
): InvoiceCycle {
    const { closing } = invoiceDates(month, dueDay, offsetDays);
    const previous = invoiceDates(addMonths(month, -1), dueDay, offsetDays);

    return { start: addDaysToDate(previous.closing, 1), end: closing };
}

/** "compras de 29 jul a 28 ago" — a frase mora aqui, e não nas telas,
 *  porque Contas e Extrato mostram o MESMO ciclo da MESMA fatura: duas
 *  redações seriam duas respostas para a mesma pergunta. */
export const cycleLabel = (cycle: InvoiceCycle): string =>
    `compras de ${formatShort(cycle.start)} a ${formatShort(cycle.end)}`;

/** O modo, em uma frase curta. É a única configuração do cadastro que
 *  muda um número já exibido na tela, então ela precisa ser legível sem
 *  abrir o formulário — no painel do cartão e no cabeçalho da fatura. */
export const COMPETENCE_LABEL: Record<ApiTypes.CompetenceMode, string> = {
    purchase: "pesa no mês da compra",
    invoice: "pesa no mês da fatura",
};

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

/** O ciclo conferido contra a fatura que a pessoa tem na mão.
 *
 *  A FOLGA E O EMISSOR NÃO DESCREVEM A MESMA COISA. Aqui o fechamento é
 *  uma subtração de dias corridos a partir do vencimento; o emissor
 *  brasileiro fecha num DIA FIXO do mês. As duas descrições coincidem
 *  enquanto a subtração fica dentro do mês do vencimento, e discordam
 *  quando ela atravessa a virada — o mês anterior tem 28, 30 ou 31 dias,
 *  e o fechamento derivado anda junto:
 *
 *      fecha 27, vence 04  ->  27/08 a 04/09 = 8 dias
 *                              27/09 a 04/10 = 7 dias
 *
 *  Quem cadastrou lendo as duas datas de UM mês grava a folga daquele
 *  mês, e ela erra por um dia em metade do ano. Um dia de erro no
 *  fechamento é um mês de erro no caixa.
 *
 *  Trocar o modelo — guardar o fechamento como dia do mês — é migration,
 *  recálculo de perna já gravada e reescrita do `InvoiceDates` da API.
 *  O que cabe aqui é NÃO ACEITAR EM SILÊNCIO: a tela mostra o que a
 *  folga produz e diz quando isso discorda da fatura lida. */
export interface CycleCheck extends InvoiceDates {
    /** O dia do mês em que a fatura lida pela pessoa fechou. */
    typedClosingDay: number;
    /** Os dias em que o fechamento derivado cai nos doze meses a partir
     *  de `month`, sem repetição e em ordem. Um valor só = a folga
     *  descreve este cartão o ano inteiro. */
    closingDays: number[];
    /** Algum desses meses fecha num dia diferente do que foi lido. */
    drifts: boolean;
}

/** As duas datas do ciclo no mês pedido, mais a conferência acima. */
export function checkCardCycle(
    closing: ApiTypes.CalendarDate,
    due: ApiTypes.CalendarDate,
    month: ApiTypes.ReferenceMonth,
): CycleCheck {
    const { DueDay, ClosingOffsetDays } = cardCycleFromDates(closing, due);
    const typedClosingDay = parts(closing).day;
    const days = new Set<number>();

    /*  Doze meses, e não o mês pedido só: quem digitou a fatura DESTE mês
        acerta nele por construção — a divergência aparece nos vizinhos. */
    for (let index = 0; index < 12; index++) {
        const cycle = invoiceDates(addMonths(month, index), DueDay, ClosingOffsetDays);
        days.add(parts(cycle.closing).day);
    }

    const closingDays = [...days].sort((first, second) => first - second);

    return {
        ...invoiceDates(month, DueDay, ClosingOffsetDays),
        typedClosingDay,
        closingDays,
        drifts: closingDays.some((day) => day !== typedClosingDay),
    };
}

/** Os dias em que o fechamento cai, na forma mais curta que ainda diz a
 *  verdade: "no dia 20", "no dia 26 ou 27", "entre os dias 24 e 27". Mora
 *  aqui, e não na tela, porque a frase do formulário e a do `saveCard`
 *  têm que dizer o mesmo — são o mesmo aviso, em dois momentos. */
export function closingDaysLabel(days: readonly number[]): string {
    return days.length <= 2
        ? `no dia ${days.join(" ou ")}`
        : `entre os dias ${days[0]} e ${days[days.length - 1]}`;
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
    const { closing, due } = invoiceDates(month, method.DueDay, method.ClosingOffsetDays);
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
            : invoiceCycle(month, method.DueDay, method.ClosingOffsetDays),
        entries,
        total: card?.Total ?? 0,
        /* O previsto é somado aqui porque não é o que a fatura cobra:
           o servidor manda o `Total` do que ESTÁ na fatura, e este é o
           outro grupo. */
        expected: sumMoney(expected.map((entry) => entry.Value)),
        paid: entries.length > 0 && entries.every((entry) => entry.Paid),
    };
}
