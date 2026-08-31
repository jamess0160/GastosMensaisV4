import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { BudgetsConnection } from "@/api/Budgets.connection";
import { ExpensesConnection } from "@/api/Expenses.connection";
import { InflowsConnection } from "@/api/Inflows.connection";
import { monthLegs, type ExpenseLeg } from "@/lib/aggregate";
import { addMonths, monthRange } from "@/lib/date";
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

/** Os gastos de um mês.
 *
 *  `status` só é repassado à API quando a tela pede CANCELADOS: sem
 *  `Status` na query a resposta já vem sem eles, então "em aberto" e
 *  "pago" se separam no cliente, sobre a mesma lista — e é essa lista
 *  que o Início e o Relatório reaproveitam do cache. Pedir cancelados,
 *  ao contrário, é uma consulta diferente, e ganha chave própria. */
export function useMonthExpenses(
    month: ApiTypes.ReferenceMonth,
    status?: ApiTypes.ExpenseStatus | null,
): UseQueryResult<ApiTypes.Expense[]> {
    const canceled = status === "canceled";

    return useQuery({
        queryKey: canceled ? [...queryKeys.expenses(month), "canceled"] : queryKeys.expenses(month),
        queryFn: () =>
            ExpensesConnection.list({
                ...monthRange(month),
                ...(canceled ? { Status: "canceled" as const } : {}),
            }),
    });
}

export function useMonthInflows(month: ApiTypes.ReferenceMonth): UseQueryResult<ApiTypes.Inflow[]> {
    return useQuery({
        queryKey: queryKeys.inflows(month),
        queryFn: () => InflowsConnection.list(monthRange(month)),
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
