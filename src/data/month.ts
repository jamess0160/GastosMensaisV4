import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { BudgetsConnection } from "@/api/Budgets.connection";
import { ExpensesConnection } from "@/api/Expenses.connection";
import { InflowsConnection } from "@/api/Inflows.connection";
import { monthLegs, type ExpenseLeg } from "@/lib/aggregate";
import { addMonths, monthRange, monthsBetween } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O movimento de um mês.

   Cada visita ao Dashboard puxa o mês inteiro de gastos e entradas;
   as telas de lista pedem exatamente as mesmas chaves e reaproveitam
   a resposta em vez de pedir de novo.
   ════════════════════════════════════════════════════════════ */

/** Quantos meses para trás procurar parcelamentos abertos.
 *
 *  A lista do mês filtra por `ExpenseDate`, então uma compra de 6x feita
 *  em março não aparece na lista de agosto — mas a 6ª parcela dela pesa
 *  em agosto. Esta janela é o que traz essas compras de volta.
 *
 *  O contrato permite até 120 parcelas; varrer dez anos a cada carga de
 *  tela sairia caro para um caso raro. 24 meses cobre parcelamento de
 *  eletrodoméstico e de viagem, que é o que existe de verdade. Acima
 *  disso, a parcela some do total — e é por isso que este número está
 *  aqui, com nome, e não escondido numa chamada. */
export const INSTALLMENT_LOOKBACK_MONTHS = 24;

/** Os gastos de um mês — TODOS eles, cancelados inclusive.
 *
 *  UMA chave por mês, e nenhum filtro na query. O status virou
 *  multi-seleção na tela de Gastos, e um filtro que conversa com a API
 *  quebraria isso duas vezes: "em aberto + cancelados" não é uma
 *  consulta que exista, e cada combinação viraria uma chave de cache
 *  diferente — o Início, Gastos e o Relatório deixariam de reaproveitar
 *  a mesma lista e o mês seria baixado de novo a cada clique num chip.
 *
 *  Por isso a lista vem completa e os cinco filtros são aplicados no
 *  cliente. `IncludeCanceled` é a pendência 13; enquanto a rota não a
 *  aceitar, o parâmetro é ignorado e a resposta continua vindo sem
 *  cancelados — marcar "Cancelados" simplesmente não traz nada, e o
 *  resto funciona igual.
 *
 *  ATENÇÃO a quem somar sobre esta lista: ela CONTÉM cancelados. Todo
 *  total precisa passar por `isLive` — `monthLegs` já passa. */
export function useMonthExpenses(
    month: ApiTypes.ReferenceMonth,
): UseQueryResult<ApiTypes.Expense[]> {
    return useQuery({
        queryKey: queryKeys.expenses(month),
        queryFn: () => ExpensesConnection.list({ ...monthRange(month), IncludeCanceled: true }),
    });
}

/** `enabled` existe para o mês ANTERIOR: a clonagem de Renda precisa
 *  dele, e só quando o usuário abre o painel de escolha — buscá-lo a
 *  cada visita à tela seria uma requisição a mais em toda carga, por um
 *  botão que quase nunca se clica. Mesma chave de sempre: se o mês
 *  passado já estiver no cache por ter sido visitado, não há requisição
 *  nenhuma. */
export function useMonthInflows(
    month: ApiTypes.ReferenceMonth,
    enabled = true,
): UseQueryResult<ApiTypes.Inflow[]> {
    return useQuery({
        queryKey: queryKeys.inflows(month),
        queryFn: () => InflowsConnection.list(monthRange(month)),
        enabled,
    });
}

export function useMonthBudgets(
    month: ApiTypes.ReferenceMonth,
): UseQueryResult<ApiTypes.BudgetPeriod[]> {
    return useQuery({
        queryKey: queryKeys.budgets(month),
        queryFn: () => BudgetsConnection.list(month),
    });
}

export function useExpenseDetail(idExpense: number | null): UseQueryResult<ApiTypes.ExpenseDetail> {
    return useQuery({
        queryKey: queryKeys.expense(idExpense ?? 0),
        queryFn: () => ExpensesConnection.get(idExpense as number),
        enabled: idExpense !== null,
    });
}

export function useInflowDetail(idInflow: number | null): UseQueryResult<ApiTypes.InflowDetail> {
    return useQuery({
        queryKey: queryKeys.inflow(idInflow ?? 0),
        queryFn: () => InflowsConnection.get(idInflow as number),
        enabled: idInflow !== null,
    });
}

/* ── Pernas do mês ────────────────────────────────────────── */

/** Os parcelados que podem ter perna caindo neste mês.
 *
 *  A lista traz a compra, não as pernas — por isso cada um precisa de um
 *  `get(id)`. São poucos por natureza (compra parcelada é evento raro no
 *  mês), e o React Query guarda cada detalhe pela sua própria chave, que
 *  é a mesma que o slide-over de detalhe usa: abrir um gasto parcelado
 *  depois disso não faz requisição nenhuma. */
function useInstallmentDetails(month: ApiTypes.ReferenceMonth) {
    const { To } = monthRange(month);
    const from = monthRange(addMonths(month, -INSTALLMENT_LOOKBACK_MONTHS)).From;

    const list = useQuery({
        queryKey: queryKeys.installments(month),
        queryFn: () => ExpensesConnection.list({ From: from, To, Kind: "installment" }),
    });

    const details = useQueries({
        queries: (list.data ?? []).map((expense) => ({
            queryKey: queryKeys.expense(expense.IdExpense),
            queryFn: () => ExpensesConnection.get(expense.IdExpense),
        })),
    });

    return {
        data: details
            .map((query) => query.data)
            .filter((detail): detail is ApiTypes.ExpenseDetail => detail !== undefined),
        isPending: list.isPending || details.some((query) => query.isPending),
        isError: list.isError || details.some((query) => query.isError),
        error: list.error ?? details.find((query) => query.error)?.error ?? null,
    };
}

/** As pernas que pesam no mês — a unidade de todo total de gasto.
 *
 *  600 em 6x é uma compra de 600 e seis pernas de 100: agosto custou
 *  100. Somar `TotalValue` da lista contaria 600 no mês da compra e
 *  zero nos cinco seguintes.
 *
 *  Note que isto NÃO é o `Spent` do orçamento, e não deve bater com ele:
 *  o orçamento conta pelo vencimento da fatura E conta pendente junto
 *  com pago; aqui a competência da perna também é
 *  `coalesce(DueDate, ExpenseDate)`, mas o universo é o que a janela
 *  acima alcançou. São perguntas diferentes — o contrato é explícito em
 *  não tentar reconciliá-las. */
export function useMonthLegs(month: ApiTypes.ReferenceMonth): {
    legs: ExpenseLeg[];
    expenses: ApiTypes.Expense[];
    isPending: boolean;
    isError: boolean;
    error: unknown;
} {
    const expenses = useMonthExpenses(month);
    const installments = useInstallmentDetails(month);

    const legs = useMemo(
        () => monthLegs(month, expenses.data ?? [], installments.data),
        [month, expenses.data, installments.data],
    );

    return {
        legs,
        expenses: expenses.data ?? [],
        isPending: expenses.isPending || installments.isPending,
        isError: expenses.isError || installments.isError,
        error: expenses.error ?? installments.error,
    };
}

/* ── Pernas de um período ─────────────────────────────────── */

/* ════════════════════════════════════════════════════════════
   O Relatório olha PERÍODO, não mês — e o cache continua sendo por mês.

   Nada aqui inventa chave nova: cada mês do intervalo pede exatamente a
   mesma consulta que a tela de Gastos pediria sozinha, então abrir o
   Relatório depois de navegar por Início e Gastos reaproveita o que já
   está em memória, e o contrário também vale.

   O CUSTO. Cada mês do intervalo carrega a lista, a busca de
   parcelamentos abertos e um `get(id)` por parcelado — o N+1 da
   pendência 12, multiplicado pelo tamanho do período. Doze meses é uma
   dúzia de vezes o custo de uma tela de mês. É por isso que o preset
   padrão do Relatório é curto, e por isso que a rota que devolvesse a
   lista já com os filhos vale ainda mais aqui do que lá.
   ════════════════════════════════════════════════════════════ */

/** As listas de gasto de vários meses, indexadas pelo mês. */
function useRangeExpenses(months: readonly ApiTypes.ReferenceMonth[]) {
    const queries = useQueries({
        queries: months.map((month) => ({
            queryKey: queryKeys.expenses(month),
            queryFn: () => ExpensesConnection.list({ ...monthRange(month), IncludeCanceled: true }),
        })),
    });

    const stamp = queries.map((query) => query.dataUpdatedAt).join(",");

    const byMonth = useMemo(() => {
        const index = new Map<ApiTypes.ReferenceMonth, ApiTypes.Expense[]>();
        months.forEach((month, position) => index.set(month, queries[position]?.data ?? []));
        return index;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stamp, months.join(",")]);

    return {
        byMonth,
        isPending: queries.some((query) => query.isPending),
        isError: queries.some((query) => query.isError),
        error: queries.find((query) => query.error)?.error ?? null,
    };
}

/** Os parcelados que podem ter perna caindo em algum mês do intervalo.
 *
 *  Uma busca por mês, com a mesma chave de `useInstallmentDetails` — os
 *  intervalos se sobrepõem muito, e é o cache que paga a conta. */
function useRangeInstallments(months: readonly ApiTypes.ReferenceMonth[]) {
    const lists = useQueries({
        queries: months.map((month) => ({
            queryKey: queryKeys.installments(month),
            queryFn: () =>
                ExpensesConnection.list({
                    From: monthRange(addMonths(month, -INSTALLMENT_LOOKBACK_MONTHS)).From,
                    To: monthRange(month).To,
                    Kind: "installment" as const,
                }),
        })),
    });

    const ids = [
        ...new Set(lists.flatMap((query) => (query.data ?? []).map((row) => row.IdExpense))),
    ];

    const details = useQueries({
        queries: ids.map((idExpense) => ({
            queryKey: queryKeys.expense(idExpense),
            queryFn: () => ExpensesConnection.get(idExpense),
        })),
    });

    return {
        data: details
            .map((query) => query.data)
            .filter((detail): detail is ApiTypes.ExpenseDetail => detail !== undefined),
        isPending: lists.some((query) => query.isPending) || details.some((q) => q.isPending),
        isError: lists.some((query) => query.isError) || details.some((q) => q.isError),
        error: lists.find((q) => q.error)?.error ?? details.find((q) => q.error)?.error ?? null,
    };
}

/** As pernas que pesam num intervalo de meses.
 *
 *  Cada mês é resolvido pela MESMA `monthLegs` da tela de mês — a
 *  competência de uma perna é dela, não do intervalo, e é isso que faz
 *  a parcela 8 de uma compra de março aparecer em agosto sem aparecer
 *  duas vezes. */
export function useRangeLegs(
    from: ApiTypes.ReferenceMonth,
    to: ApiTypes.ReferenceMonth,
): {
    legs: ExpenseLeg[];
    months: ApiTypes.ReferenceMonth[];
    isPending: boolean;
    isError: boolean;
    error: unknown;
} {
    const months = useMemo(() => monthsBetween(from, to), [from, to]);

    const expenses = useRangeExpenses(months);
    const installments = useRangeInstallments(months);

    const legs = useMemo(
        () =>
            months.flatMap((month) =>
                monthLegs(month, expenses.byMonth.get(month) ?? [], installments.data),
            ),
        [months, expenses.byMonth, installments.data],
    );

    return {
        legs,
        months,
        isPending: expenses.isPending || installments.isPending,
        isError: expenses.isError || installments.isError,
        error: expenses.error ?? installments.error,
    };
}

/* ── Detalhes do mês ──────────────────────────────────────── */

/** Os detalhes dos gastos do mês, indexados por id.
 *
 *  A lista NÃO traz pernas, rateio nem tags — quem os traz é o
 *  `get(id)`. Sem eles não há como mostrar "de quem é" nem "com o que
 *  foi pago" numa linha de tabela, que é justamente o que o layout
 *  desenha na lista de Gastos e nos dois breakdowns do Início.
 *
 *  É uma requisição por gasto do mês, e é caro de propósito ser
 *  explícito: **uma rota que devolvesse a lista já com os filhos
 *  eliminaria este bloco inteiro** (candidata a Pendencias Backend).
 *  O que o torna suportável é a chave: cada detalhe é guardado sob
 *  `queryKeys.expense(id)`, a mesma que o slide-over de detalhe usa —
 *  então abrir um gasto depois disso não faz requisição nenhuma, e
 *  trocar de tela reaproveita tudo.
 *
 *  A tela nunca espera por eles: as colunas que dependem do detalhe
 *  aparecem conforme chegam, e o resto da lista já está de pé. */
export function useMonthExpenseDetails(month: ApiTypes.ReferenceMonth): {
    byId: Map<number, ApiTypes.ExpenseDetail>;
    isPending: boolean;
} {
    const list = useMonthExpenses(month);

    const details = useQueries({
        queries: (list.data ?? []).map((expense) => ({
            queryKey: queryKeys.expense(expense.IdExpense),
            queryFn: () => ExpensesConnection.get(expense.IdExpense),
        })),
    });

    /* `details` é um array novo a cada render, e o índice não pode ser
       remontado junto — ele alimenta o filtro da lista inteira. A chave
       carrega o `dataUpdatedAt` de cada consulta, e não só os ids: sem
       ele, quitar uma parcela invalidaria a consulta, os dados novos
       chegariam e o índice continuaria mostrando a versão antiga. */
    const stamp = details
        .map((query) => `${query.data?.IdExpense ?? 0}:${query.dataUpdatedAt}`)
        .join(",");

    const byId = useMemo(() => {
        const index = new Map<number, ApiTypes.ExpenseDetail>();
        for (const query of details) {
            if (query.data) index.set(query.data.IdExpense, query.data);
        }
        return index;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stamp]);

    return { byId, isPending: list.isPending || details.some((query) => query.isPending) };
}

/** Os detalhes de um conjunto de gastos, por id.
 *
 *  A versão do Relatório, que olha período e não mês. `enabled` é o que
 *  mantém o custo honesto: destino e forma de pagamento só existem no
 *  `get(id)`, então a tela só paga por eles quando algum desses dois
 *  filtros está em uso — nas outras vezes, nenhuma requisição sai. */
export function useExpenseDetails(
    idExpenses: readonly number[],
    enabled = true,
): { byId: Map<number, ApiTypes.ExpenseDetail>; isPending: boolean } {
    const details = useQueries({
        queries: (enabled ? idExpenses : []).map((idExpense) => ({
            queryKey: queryKeys.expense(idExpense),
            queryFn: () => ExpensesConnection.get(idExpense),
        })),
    });

    // Ver o comentário do `stamp` acima.
    const stamp = details
        .map((query) => `${query.data?.IdExpense ?? 0}:${query.dataUpdatedAt}`)
        .join(",");

    const byId = useMemo(() => {
        const index = new Map<number, ApiTypes.ExpenseDetail>();
        for (const query of details) {
            if (query.data) index.set(query.data.IdExpense, query.data);
        }
        return index;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stamp]);

    return { byId, isPending: details.some((query) => query.isPending) };
}

/** O mesmo para entradas: só o `get(id)` traz `Persons`, e é dele que
 *  sai a coluna "Destino" da tela de Renda. */
export function useMonthInflowDetails(month: ApiTypes.ReferenceMonth): {
    byId: Map<number, ApiTypes.InflowDetail>;
    isPending: boolean;
} {
    const list = useMonthInflows(month);

    const details = useQueries({
        queries: (list.data ?? []).map((inflow) => ({
            queryKey: queryKeys.inflow(inflow.IdInflow),
            queryFn: () => InflowsConnection.get(inflow.IdInflow),
        })),
    });

    // Ver o comentário do `stamp` acima.
    const stamp = details
        .map((query) => `${query.data?.IdInflow ?? 0}:${query.dataUpdatedAt}`)
        .join(",");

    const byId = useMemo(() => {
        const index = new Map<number, ApiTypes.InflowDetail>();
        for (const query of details) {
            if (query.data) index.set(query.data.IdInflow, query.data);
        }
        return index;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stamp]);

    return { byId, isPending: list.isPending || details.some((query) => query.isPending) };
}

/* ── Invalidação ──────────────────────────────────────────── */

/** Depois de escrever em gasto, entrada ou orçamento.
 *
 *  Invalida a RAIZ de cada domínio, não o mês da tela: um parcelado
 *  nasce com perna em doze meses, cancelar um gasto pago devolve
 *  dinheiro ao saldo, e "esta e as seguintes" reescreve o futuro
 *  inteiro. Invalidar só o mês visível deixaria os outros mentindo. */
export function useInvalidateMovement() {
    const queryClient = useQueryClient();

    return () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.allExpenses });
        void queryClient.invalidateQueries({ queryKey: queryKeys.allInflows });
        void queryClient.invalidateQueries({ queryKey: queryKeys.allBudgets });
        void queryClient.invalidateQueries({ queryKey: ["installments"] });
        void queryClient.invalidateQueries({ queryKey: ["expense"] });
        void queryClient.invalidateQueries({ queryKey: ["inflow"] });
        // O saldo é calculado na leitura: toda quitação e todo
        // recebimento mudam o número que a tela de Contas mostra.
        void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    };
}
