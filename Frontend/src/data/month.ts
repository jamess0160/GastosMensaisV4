import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { BudgetsConnection } from "@/api/Budgets.connection";
import { ExpensePaymentsConnection } from "@/api/ExpensePayments.connection";
import { ExpensesConnection } from "@/api/Expenses.connection";
import { InflowsConnection } from "@/api/Inflows.connection";
import { ReportsConnection } from "@/api/Reports.connection";
import { paymentLegs, type ExpenseLeg } from "@/lib/aggregate";
import { monthRange, monthsBetween } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O movimento de um mês.

   Cada visita ao Dashboard puxa o mês inteiro de gastos e entradas;
   as telas de lista pedem exatamente as mesmas chaves e reaproveitam
   a resposta em vez de pedir de novo.
   ════════════════════════════════════════════════════════════ */

/** Os gastos de um mês — TODOS eles, cancelados inclusive.
 *
 *  UMA chave por mês, e nenhum filtro na query. O status virou
 *  multi-seleção na tela de Gastos, e um filtro que conversa com a API
 *  quebraria isso duas vezes: "em aberto + cancelados" não é uma
 *  consulta que exista, e cada combinação viraria uma chave de cache
 *  diferente — o Início, Gastos e o Relatório deixariam de reaproveitar
 *  a mesma lista e o mês seria baixado de novo a cada clique num chip.
 *
 *  Por isso a lista vem completa — `IncludeCanceled: true` — e os cinco
 *  filtros são aplicados no cliente.
 *
 *  ATENÇÃO a quem somar sobre esta lista: ela CONTÉM cancelados. Todo
 *  total precisa passar por `isLive` — `paymentLegs` já passa. */
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

/** Os nove números do mês, somados pelo servidor.
 *
 *  Nenhum deles se recalcula aqui para conferir: as quatro regras de
 *  agregação se contradizem de propósito, e era justamente a réplica
 *  delas no cliente que fazia a mesma pergunta ter dois totais na mesma
 *  tela. Se um número daqui divergir do da tela dele, é bug da API.
 *
 *  O mês vai SEMPRE, mesmo sendo opcional na rota: omitir devolveria o
 *  mês corrente enquanto o usuário olha março — o mesmo erro que o
 *  `ReferenceMonth` de `GET /Accounts` já consertou. */
export function useMonthReport(
    month: ApiTypes.ReferenceMonth,
): UseQueryResult<ApiTypes.MonthReport> {
    return useQuery({
        queryKey: queryKeys.monthReport(month),
        queryFn: () => ReportsConnection.month(month),
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

/** As pernas que pesam no mês — a unidade de todo total de gasto.
 *
 *  600 em 6x é uma compra de 600 e seis pernas de 100: agosto custou
 *  100. Somar `TotalValue` da lista contaria 600 no mês da compra e
 *  zero nos cinco seguintes.
 *
 *  UMA requisição, e ela descreve o mês por inteiro. `GET /Expenses`
 *  filtra por `ExpenseDate` e não enxerga a 6ª parcela de uma compra de
 *  março; esta filtra por `CompetenceDate`, que é a data em que a perna
 *  pesa. Foi o que apagou a varredura de 24 meses para trás e o
 *  `get(id)` por parcelado — e com eles a janela acima da qual a parcela
 *  simplesmente sumia do total, o único lugar em que o número na tela
 *  ficava *errado*, e não só ausente.
 *
 *  Note que isto NÃO é o `Spent` do orçamento, e não precisa bater com
 *  ele: o orçamento conta pendente junto com pago e recorta por
 *  categoria ou por pessoa. São perguntas diferentes — o contrato é
 *  explícito em não tentar reconciliá-las. */
export function useMonthLegs(month: ApiTypes.ReferenceMonth): {
    legs: ExpenseLeg[];
    isPending: boolean;
    isError: boolean;
    error: unknown;
} {
    const query = useQuery({
        queryKey: queryKeys.legs(month),
        queryFn: () => ExpensePaymentsConnection.list(monthRange(month)),
    });

    const legs = useMemo(() => paymentLegs(query.data ?? []), [query.data]);

    return { legs, isPending: query.isPending, isError: query.isError, error: query.error };
}

/* ── Pernas de um período ─────────────────────────────────── */

/* ════════════════════════════════════════════════════════════
   O Relatório olha PERÍODO, não mês — e o cache continua sendo por mês.

   Nada aqui inventa chave nova: cada mês do intervalo pede exatamente a
   mesma consulta que a tela de Gastos pediria sozinha, então abrir o
   Relatório depois de navegar por Início e Gastos reaproveita o que já
   está em memória, e o contrário também vale.

   O CUSTO deixou de ser o problema que era: um mês é UMA requisição, e
   doze meses são doze — não mais doze listas, doze varreduras de
   parcelados e um `get(id)` por parcelado de cada uma.
   ════════════════════════════════════════════════════════════ */

/** As pernas que pesam num intervalo de meses.
 *
 *  Uma consulta por mês, com a MESMA chave da tela de mês — a
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

    const queries = useQueries({
        queries: months.map((month) => ({
            queryKey: queryKeys.legs(month),
            queryFn: () => ExpensePaymentsConnection.list(monthRange(month)),
        })),
    });

    /* `queries` é um array novo a cada render. O carimbo carrega o
       `dataUpdatedAt` de cada consulta: sem ele, quitar uma parcela
       invalidaria a chave, os dados novos chegariam e a lista composta
       continuaria mostrando a versão antiga. */
    const stamp = queries.map((query) => query.dataUpdatedAt).join(",");

    const legs = useMemo(
        () => queries.flatMap((query) => paymentLegs(query.data ?? [])),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [stamp],
    );

    return {
        legs,
        months,
        isPending: queries.some((query) => query.isPending),
        isError: queries.some((query) => query.isError),
        error: queries.find((query) => query.error)?.error ?? null,
    };
}

/* ── Detalhes do mês ──────────────────────────────────────── */

/* O `get(id)` por gasto SAIU daqui. Ele existia para preencher as
   colunas de destino e forma de pagamento da lista de Gastos e os dois
   breakdowns do Início — uma requisição por gasto do mês —, e as duas
   coisas agora vêm dentro da perna. O que sobrou de exclusivo do
   detalhe são as TAGS, e elas só aparecem no slide-over de um gasto:
   `useExpenseDetail`, uma consulta, quando o painel abre.

   Entradas são outra história: `GET /Inflows` continua sem trazer
   `Persons`, e a coluna "Destino" da tela de Renda depende dele. */

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
        void queryClient.invalidateQueries({ queryKey: queryKeys.allLegs });
        void queryClient.invalidateQueries({ queryKey: ["expense"] });
        void queryClient.invalidateQueries({ queryKey: ["inflow"] });
        // O saldo é calculado na leitura: toda quitação e todo
        // recebimento mudam o número que a tela de Contas mostra — e em
        // TODOS os meses em cache, não só no visível, porque quitar hoje
        // uma parcela de novembro sai do saldo de novembro.
        void queryClient.invalidateQueries({ queryKey: queryKeys.allAccounts });
        // E os relatórios, pela MESMA razão do saldo: quitar uma parcela
        // muda seis dos nove números do mês — o gasto, o disponível, o
        // saldo, o vencido, a fatura em aberto — e muda em todos os meses
        // em cache, não só no visível.
        void queryClient.invalidateQueries({ queryKey: queryKeys.allReports });
    };
}
