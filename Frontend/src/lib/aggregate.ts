import type { ApiTypes } from "@/types/api";
import { toReferenceMonth } from "@/lib/date";
import { fromCents, toCents } from "@/lib/money";

/* ════════════════════════════════════════════════════════════
   As três contas que, erradas, fazem o usuário perder a confiança
   no sistema inteiro. Ficam aqui, com teste, em vez de espalhadas
   pelos componentes.

   Nenhum número do Dashboard tem endpoint: todos saem daqui.
   ════════════════════════════════════════════════════════════ */

/** Soma em centavos e volta para reais só no fim: somar em ponto
 *  flutuante trinta vezes erra o centavo do total. */
export const sumMoney = (values: readonly ApiTypes.Money[]): ApiTypes.Money =>
    fromCents(values.reduce((cents, value) => cents + toCents(value), 0));

/* ── Entradas ─────────────────────────────────────────────── */

/** Transferência é neutra para o patrimônio: mover 1.000 do Nubank para
 *  o Itaú não é renda. Sem este filtro, o mesmo dinheiro é contado de
 *  novo a cada movimentação entre contas.
 *
 *  (No **saldo da conta** vale o oposto — lá ela conta nos dois lados —
 *  mas o saldo vem calculado da API, não daqui.) */
export const isRealInflow = (inflow: ApiTypes.Inflow): boolean => inflow.Kind !== "transfer";

/** "Quanto entrou de verdade no mês": só o que já foi recebido, e nunca
 *  transferência. Cancelada não entra. */
export const totalReceived = (inflows: readonly ApiTypes.Inflow[]): ApiTypes.Money =>
    sumMoney(
        inflows
            .filter((inflow) => isRealInflow(inflow) && inflow.Status === "received")
            .map((inflow) => inflow.TotalValue),
    );

/** O que ainda está previsto para entrar — a linha "a receber". */
export const totalExpectedInflow = (inflows: readonly ApiTypes.Inflow[]): ApiTypes.Money =>
    sumMoney(
        inflows
            .filter((inflow) => isRealInflow(inflow) && inflow.Status === "pending")
            .map((inflow) => inflow.TotalValue),
    );

/* ── Gastos: a unidade é a PERNA, não a compra ────────────── */

/** Uma perna com o gasto de onde ela veio e o rateio DELE.
 *
 *  É esta a unidade de todo total de gasto: 600 em 6x é UMA compra de
 *  600 e SEIS pernas de 100, e agosto custou 100. Somar `TotalValue` da
 *  lista contaria 600 no mês da compra.
 *
 *  A perna é sempre REAL — vem de `GET /ExpensePayments`, não é mais
 *  adivinhada da linha da compra. Foi o que dispensou a varredura de
 *  meses para trás atrás de parcelamentos abertos, e com ela a janela
 *  acima da qual a parcela sumia do total. */
export interface ExpenseLeg {
    expense: ApiTypes.Expense;
    payment: ApiTypes.ExpensePayment;
    /** ⚠️ O rateio do GASTO, não o da perna: numa compra de 600 em 6×,
     *  as seis pernas trazem o mesmo rateio de 600. Quem o transforma na
     *  fatia do mês é `spentByPerson`. */
    persons: readonly ApiTypes.ExpensePerson[];
    value: ApiTypes.Money;
    /** O mês em que esta perna pesa, "YYYY-MM". */
    month: ApiTypes.ReferenceMonth;
    paid: boolean;
}

/** A data que decide de que mês a perna é.
 *
 *  Não é mais calculada aqui: `CompetenceDate` é a `coalesce(DueDate,
 *  ExpenseDate)` congelada no lançamento, e a regra passou a vir do
 *  servidor — é por ela que o saldo da conta, o `Spent` do orçamento e
 *  a lista de pernas recortam o mês. Nenhum número mudou. */
export const legCompetence = (leg: ExpenseLeg): ApiTypes.CalendarDate => leg.payment.CompetenceDate;

/** Gasto cancelado não conta em lugar nenhum — nem no saldo, nem no
 *  orçamento, nem no relatório. */
export const isLive = (expense: ApiTypes.Expense): boolean => expense.Status !== "canceled";

/** As pernas que a lista do período devolveu, prontas para somar.
 *
 *  Uma requisição por mês, e nada aqui completa nada: a resposta já
 *  descreve o mês por inteiro, parcela de compra antiga inclusive.
 *
 *  O padrão DESCARTA o cancelado, e é isso que faz de `paymentLegs` a
 *  entrada de todo total: cancelado não conta em lugar nenhum. A
 *  consulta, essa, vem completa — a lista da tela de Gastos precisa
 *  mostrar o cancelado para que o chip "Cancelados" tenha o que
 *  mostrar —, e é só ela que pede `includeCanceled`. ⚠️ O que sai daqui
 *  com ele ligado NÃO se soma: passe por `isLive` antes. */
export function paymentLegs(
    rows: readonly ApiTypes.ExpensePaymentRow[],
    includeCanceled = false,
): ExpenseLeg[] {
    return rows
        .filter((row) => includeCanceled || isLive(row.Expense))
        .map((row) => ({
            expense: row.Expense,
            payment: row,
            persons: row.Persons,
            value: row.Value,
            month: toReferenceMonth(row.CompetenceDate),
            paid: row.Paid,
        }));
}

/** "Quanto gastou no mês" — soma de pernas, o número do Dashboard. */
export const totalSpent = (legs: readonly ExpenseLeg[]): ApiTypes.Money =>
    sumMoney(legs.map((leg) => leg.value));

/** O que já saiu da conta de verdade. */
export const totalPaid = (legs: readonly ExpenseLeg[]): ApiTypes.Money =>
    sumMoney(legs.filter((leg) => leg.paid).map((leg) => leg.value));

/** O que ainda vai sair — a previsão que o saldo da conta ignora. */
export const totalPending = (legs: readonly ExpenseLeg[]): ApiTypes.Money =>
    sumMoney(legs.filter((leg) => !leg.paid).map((leg) => leg.value));

/** Recorte por tipo de gasto, para as fatias "fixos do mês" e
 *  "parcelas" do Dashboard. */
export const legsOfKind = (legs: readonly ExpenseLeg[], kind: ApiTypes.ExpenseKind): ExpenseLeg[] =>
    legs.filter((leg) => leg.expense.Kind === kind);

/* ── Recortes do relatório ────────────────────────────────── */

/** Total por categoria — o donut. Ordenado do maior para o menor, que é
 *  como o layout desenha a legenda. */
export function spentByCategory(
    legs: readonly ExpenseLeg[],
): { IdCategory: number; value: ApiTypes.Money }[] {
    const byCategory = new Map<number, number>();
    for (const leg of legs) {
        const key = leg.expense.IdCategory;
        byCategory.set(key, (byCategory.get(key) ?? 0) + toCents(leg.value));
    }
    return [...byCategory.entries()]
        .map(([IdCategory, cents]) => ({ IdCategory, value: fromCents(cents) }))
        .sort((a, b) => b.value - a.value);
}

/** Total por forma de pagamento.
 *
 *  A perna sabe a forma dela, e é só isso: a fatia não espera mais por
 *  requisição nenhuma, e nenhum gasto fica de fora por falta de detalhe.
 *  O gasto pago com duas formas vira duas pernas, cada uma somando na
 *  sua — que é a razão de o eixo financeiro ser rateio, e não um campo. */
export function spentByPaymentMethod(
    legs: readonly ExpenseLeg[],
): { IdPaymentMethod: number; value: ApiTypes.Money }[] {
    const byMethod = new Map<number, number>();

    for (const leg of legs) {
        const key = leg.payment.IdPaymentMethod;
        byMethod.set(key, (byMethod.get(key) ?? 0) + toCents(leg.value));
    }

    return [...byMethod.entries()]
        .map(([IdPaymentMethod, cents]) => ({ IdPaymentMethod, value: fromCents(cents) }))
        .sort((a, b) => b.value - a.value);
}

/** Total por destino (pessoa).
 *
 *  ⚠️ O `Persons` que vem na perna é o do GASTO. Numa compra de 600 em
 *  6× dividida meio a meio, as seis pernas trazem os mesmos 300 de cada
 *  pessoa — somar perna a perna daria 3600, e nada estouraria: o número
 *  só ficaria errado. Por isso a fatia é proporcional,
 *  `Persons[i].Value × Payment.Value ÷ Expense.TotalValue`, que é a
 *  mesma fórmula do `Spent` de um orçamento de pessoa.
 *
 *  `IdPerson: null` é o gasto sem rateio nenhum, que é a maioria: ele
 *  não pertence a ninguém em particular e some se for descartado. */
export function spentByPerson(
    legs: readonly ExpenseLeg[],
): { IdPerson: number | null; value: ApiTypes.Money }[] {
    const byPerson = new Map<number | null, number>();

    const add = (idPerson: number | null, cents: number) =>
        byPerson.set(idPerson, (byPerson.get(idPerson) ?? 0) + cents);

    for (const leg of legs) {
        const split = leg.persons;

        if (split.length === 0 || leg.expense.TotalValue === 0) {
            add(null, toCents(leg.value));
            continue;
        }

        const legCents = toCents(leg.value);
        const totalCents = toCents(leg.expense.TotalValue);
        let distributed = 0;

        split.forEach((person, index) => {
            // O arredondamento acontece UMA vez, no fim: a última fatia é
            // o que sobrou, a mesma regra do `Spent` do servidor. Sem
            // isso a soma das fatias não fecha com o total do mês e o
            // gráfico mente no último dígito.
            const share =
                index === split.length - 1
                    ? legCents - distributed
                    : Math.round((toCents(person.Value) * legCents) / totalCents);
            distributed += share;
            add(person.IdPerson, share);
        });
    }

    return [...byPerson.entries()]
        .map(([IdPerson, cents]) => ({ IdPerson, value: fromCents(cents) }))
        .sort((a, b) => b.value - a.value);
}

/** Total por dia de competência — a linha do relatório. Devolve um valor
 *  por dia informado, zero incluído: o gráfico precisa do eixo inteiro,
 *  não só dos dias em que houve gasto. */
export function spentByDay(
    legs: readonly ExpenseLeg[],
    days: readonly ApiTypes.CalendarDate[],
): ApiTypes.Money[] {
    const byDay = new Map<string, number>();
    for (const leg of legs) {
        const day = legCompetence(leg).slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + toCents(leg.value));
    }
    return days.map((day) => fromCents(byDay.get(day) ?? 0));
}

/** Mês × categoria — as barras agrupadas do relatório por período.
 *
 *  Uma série por categoria, com um valor por mês do intervalo (zero
 *  onde não houve gasto): é assim que o ECharts desenha um grupo por
 *  mês com uma barra por categoria dentro. A ordem é por total no
 *  período, decrescente — quem mais pesa aparece primeiro na legenda.
 *
 *  Os meses vêm por parâmetro, e não do que os dados trouxerem: um mês
 *  sem gasto nenhum precisa existir no eixo, ou o período parece mais
 *  curto do que é. */
export function spentByMonthCategory(
    legs: readonly ExpenseLeg[],
    months: readonly ApiTypes.ReferenceMonth[],
): { IdCategory: number; total: ApiTypes.Money; values: ApiTypes.Money[] }[] {
    const index = new Map(months.map((month, position) => [month, position]));
    const byCategory = new Map<number, number[]>();

    for (const leg of legs) {
        const position = index.get(leg.month);
        if (position === undefined) continue;

        const row = byCategory.get(leg.expense.IdCategory) ?? months.map(() => 0);
        row[position] += toCents(leg.value);
        byCategory.set(leg.expense.IdCategory, row);
    }

    return [...byCategory.entries()]
        .map(([IdCategory, cents]) => ({
            IdCategory,
            total: fromCents(cents.reduce((sum, value) => sum + value, 0)),
            values: cents.map(fromCents),
        }))
        .sort((a, b) => b.total - a.total);
}

/* ── Saldo e orçamento ────────────────────────────────────── */

/** Patrimônio: a soma dos saldos das contas ativas.
 *
 *  `Balance` é calculado pela API a cada leitura e IGNORA pendente.
 *  Não recalcule somando lançamentos no cliente — o número não fecharia. */
export const totalBalance = (accounts: readonly ApiTypes.Account[]): ApiTypes.Money =>
    sumMoney(accounts.filter((account) => account.Active).map((account) => account.Balance));

/** O nome do alvo de uma fatia — pessoa, categoria, ou as DUAS.
 *
 *  São três formatos desde a leva 9, então o nome é COMPOSTO do que veio
 *  preenchido: "Luana", "Mercado", ou "Luana · Mercado". Não há mais um
 *  `Scope` dizendo qual par ler — com três formatos ele mentiria.
 *
 *  A pessoa vem primeiro porque é ela que qualifica a fatia: "Luana em
 *  mercado" é a leitura, não "mercado da Luana".
 *
 *  O alvo ARQUIVADO some da lista do mês, e por isso o fallback aqui é
 *  um caso que não deveria acontecer — e não o normal. */
export const budgetTargetName = (period: ApiTypes.BudgetPeriod): string =>
    [
        period.IdPerson !== null ? (period.Person?.Name ?? "Pessoa arquivada") : null,
        period.IdCategory !== null ? (period.Category?.Description ?? "Categoria arquivada") : null,
    ]
        .filter((part): part is string => part !== null)
        .join(" · ");

/** Estado de um teto de orçamento. A API devolve `LimitValue`, `Spent` e
 *  `AlertPercent`; COMPARAR É TRABALHO DA TELA — é isto.
 *
 *  `Spent` NEGATIVO (mês em que os estornos superam as compras) cai em
 *  `ok` sozinho, e é a leitura certa: não se estourou nada. */
export type BudgetState = "ok" | "alert" | "over";

export function budgetState(period: ApiTypes.BudgetPeriod): BudgetState {
    if (period.Spent > period.LimitValue) return "over";
    if (period.LimitValue > 0 && (period.Spent / period.LimitValue) * 100 >= period.AlertPercent) {
        return "alert";
    }
    return "ok";
}

/** Quanto do teto foi consumido, em porcentagem.
 *
 *  Passa de 100 sem problema — o estouro é informação, não erro, e quem
 *  apara na régua é a barra. Abaixo de zero, não: um mês em que os
 *  estornos superam as compras consumiu **0%** do teto, e não −12%. */
export const budgetPercent = (period: ApiTypes.BudgetPeriod): number =>
    period.LimitValue > 0 ? Math.max(0, (period.Spent / period.LimitValue) * 100) : 0;

/** O que sobra do teto. Negativo é estouro. */
export const budgetRemaining = (period: ApiTypes.BudgetPeriod): ApiTypes.Money =>
    fromCents(toCents(period.LimitValue) - toCents(period.Spent));
