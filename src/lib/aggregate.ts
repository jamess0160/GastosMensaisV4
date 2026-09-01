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

/** Uma perna com o gasto de onde ela veio.
 *
 *  É esta a unidade de todo total de gasto: 600 em 6x é UMA compra de
 *  600 e SEIS pernas de 100, e agosto custou 100. Somar `TotalValue` da
 *  lista contaria 600 no mês da compra. */
export interface ExpenseLeg {
    expense: ApiTypes.Expense;
    /** `null` quando a perna não foi carregada (a lista de gastos não
     *  traz pernas) e o gasto tem uma perna só — aí o valor da perna é o
     *  total da compra. */
    payment: ApiTypes.ExpensePayment | null;
    value: ApiTypes.Money;
    /** O mês em que esta perna pesa, "YYYY-MM". */
    month: ApiTypes.ReferenceMonth;
    paid: boolean;
}

/** A data que decide de que mês a perna é.
 *
 *  `coalesce(DueDate, ExpenseDate)` — a mesma regra do `Spent` do
 *  orçamento: uma parcela cai no mês em que a fatura vence, não no da
 *  compra. */
export const legCompetence = (
    expense: ApiTypes.Expense,
    payment: ApiTypes.ExpensePayment | null,
): ApiTypes.CalendarDate => payment?.DueDate ?? expense.ExpenseDate;

/** Explode um gasto detalhado nas suas pernas. */
export function legsOf(expense: ApiTypes.ExpenseDetail): ExpenseLeg[] {
    return expense.Payments.map((payment) => ({
        expense,
        payment,
        value: payment.Value,
        month: toReferenceMonth(legCompetence(expense, payment)),
        paid: payment.Paid,
    }));
}

/** A perna implícita de um gasto de que só se tem a linha da lista.
 *
 *  Vale para `single` e para `fixed`: os dois têm uma ocorrência por
 *  linha, então a soma das pernas é o próprio `TotalValue`. NÃO vale
 *  para `installment` — lá a compra tem N pernas e é preciso o
 *  `get(id)`. Por isso a função devolve `null` nesse caso, em vez de
 *  chutar. */
export function impliedLeg(expense: ApiTypes.Expense): ExpenseLeg | null {
    if (expense.Kind === "installment") return null;
    return {
        expense,
        payment: null,
        value: expense.TotalValue,
        month: toReferenceMonth(expense.ExpenseDate),
        paid: expense.Status === "paid",
    };
}

/** Gasto cancelado não conta em lugar nenhum — nem no saldo, nem no
 *  orçamento, nem no relatório. */
export const isLive = (expense: ApiTypes.Expense): boolean => expense.Status !== "canceled";

/** As pernas que pesam num mês, a partir do que o cliente conseguiu
 *  carregar.
 *
 *  `details` são os gastos que já vieram pelo `get(id)` (na prática, os
 *  parcelados, que são os únicos que a lista não descreve por inteiro);
 *  `expenses` é a lista crua do mês. Um gasto presente nos dois entra
 *  UMA vez só, pelo detalhe, que é a versão mais precisa. */
export function monthLegs(
    month: ApiTypes.ReferenceMonth,
    expenses: readonly ApiTypes.Expense[],
    details: readonly ApiTypes.ExpenseDetail[] = [],
): ExpenseLeg[] {
    const detailed = new Set(details.map((expense) => expense.IdExpense));

    const fromDetails = details
        .filter(isLive)
        .flatMap(legsOf)
        .filter((leg) => leg.month === month);

    const fromList = expenses
        .filter((expense) => isLive(expense) && !detailed.has(expense.IdExpense))
        .map(impliedLeg)
        .filter((leg): leg is ExpenseLeg => leg !== null && leg.month === month);

    return [...fromDetails, ...fromList];
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

/** Onde uma perna encontra o gasto detalhado a que pertence. A lista
 *  não traz `Payments` nem `Persons`; quem os tem é o `get(id)`, e é
 *  ele que estes dois recortes exigem. */
export type DetailLookup = (idExpense: number) => ApiTypes.ExpenseDetail | undefined;

/** Total por forma de pagamento.
 *
 *  A perna já sabe a forma quando veio do detalhe. Quando ela é a perna
 *  IMPLÍCITA da lista (`single` e `fixed`, que têm uma ocorrência por
 *  linha), a forma só existe no detalhe — e o gasto pode ter sido pago
 *  com duas formas, então o que se soma são as pernas dele, cuja soma é
 *  o próprio valor da perna implícita.
 *
 *  Gasto cujo detalhe ainda não chegou fica de fora em vez de virar uma
 *  fatia "desconhecido": a lista se completa sozinha em segundos, e uma
 *  fatia que encolhe sozinha é pior do que uma que aparece. */
export function spentByPaymentMethod(
    legs: readonly ExpenseLeg[],
    detailOf: DetailLookup,
): { IdPaymentMethod: number; value: ApiTypes.Money }[] {
    const byMethod = new Map<number, number>();

    const add = (idPaymentMethod: number, cents: number) =>
        byMethod.set(idPaymentMethod, (byMethod.get(idPaymentMethod) ?? 0) + cents);

    for (const leg of legs) {
        if (leg.payment) {
            add(leg.payment.IdPaymentMethod, toCents(leg.value));
            continue;
        }
        const detail = detailOf(leg.expense.IdExpense);
        if (!detail) continue;
        for (const payment of detail.Payments) add(payment.IdPaymentMethod, toCents(payment.Value));
    }

    return [...byMethod.entries()]
        .map(([IdPaymentMethod, cents]) => ({ IdPaymentMethod, value: fromCents(cents) }))
        .sort((a, b) => b.value - a.value);
}

/** Total por destino (pessoa).
 *
 *  O rateio entre pessoas é gravado sobre o TOTAL DA COMPRA, não sobre a
 *  perna: numa compra de 600 em 6x dividida meio a meio, cada pessoa tem
 *  300 gravados e o mês custa 50 a cada uma. Por isso a fatia da pessoa
 *  é proporcional — `valor da perna × (fatia da pessoa ÷ total)`.
 *
 *  `IdPerson: null` é o gasto sem rateio nenhum, que é a maioria: ele
 *  não pertence a ninguém em particular e some se for descartado. */
export function spentByPerson(
    legs: readonly ExpenseLeg[],
    detailOf: DetailLookup,
): { IdPerson: number | null; value: ApiTypes.Money }[] {
    const byPerson = new Map<number | null, number>();

    const add = (idPerson: number | null, cents: number) =>
        byPerson.set(idPerson, (byPerson.get(idPerson) ?? 0) + cents);

    for (const leg of legs) {
        const detail = detailOf(leg.expense.IdExpense);
        const split = detail?.Persons ?? [];

        if (split.length === 0 || leg.expense.TotalValue <= 0) {
            add(null, toCents(leg.value));
            continue;
        }

        const legCents = toCents(leg.value);
        const totalCents = toCents(leg.expense.TotalValue);
        let distributed = 0;

        split.forEach((person, index) => {
            // O centavo que sobra vai no primeiro, a mesma regra do
            // parcelamento — sem isso a soma das fatias não fecha com o
            // total do mês e o gráfico mente no último dígito.
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
        const day = legCompetence(leg.expense, leg.payment).slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + toCents(leg.value));
    }
    return days.map((day) => fromCents(byDay.get(day) ?? 0));
}

/* ── Saldo e orçamento ────────────────────────────────────── */

/** Patrimônio: a soma dos saldos das contas ativas.
 *
 *  `Balance` é calculado pela API a cada leitura e IGNORA pendente.
 *  Não recalcule somando lançamentos no cliente — o número não fecharia. */
export const totalBalance = (accounts: readonly ApiTypes.Account[]): ApiTypes.Money =>
    sumMoney(accounts.filter((account) => account.Active).map((account) => account.Balance));

/** Estado de um teto de orçamento. A API devolve `LimitValue`, `Spent` e
 *  `AlertPercent`; COMPARAR É TRABALHO DA TELA — é isto. */
export type BudgetState = "ok" | "alert" | "over";

export function budgetState(period: ApiTypes.BudgetPeriod): BudgetState {
    if (period.Spent > period.LimitValue) return "over";
    if (period.LimitValue > 0 && (period.Spent / period.LimitValue) * 100 >= period.AlertPercent) {
        return "alert";
    }
    return "ok";
}

/** Quanto do teto foi consumido, em porcentagem. Pode passar de 100 — o
 *  estouro é informação, não erro; quem apara na régua é a barra. */
export const budgetPercent = (period: ApiTypes.BudgetPeriod): number =>
    period.LimitValue > 0 ? (period.Spent / period.LimitValue) * 100 : 0;

/** O que sobra do teto. Negativo é estouro. */
export const budgetRemaining = (period: ApiTypes.BudgetPeriod): ApiTypes.Money =>
    fromCents(toCents(period.LimitValue) - toCents(period.Spent));
