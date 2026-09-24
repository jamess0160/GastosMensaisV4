import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { BudgetPeriodsConnection } from "@/api/BudgetPeriods.connection";
import { ExpensePaymentsConnection } from "@/api/ExpensePayments.connection";
import { ExpensesConnection } from "@/api/Expenses.connection";
import { InflowsConnection } from "@/api/Inflows.connection";
import { PaymentMethodsConnection } from "@/api/PaymentMethods.connection";
import { ReportsConnection } from "@/api/Reports.connection";
import { budgetTargetKey, paymentLegs, type ExpenseLeg } from "@/lib/aggregate";
import { monthRange, monthsBetween } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O movimento de um mês.

   Cada visita ao Dashboard puxa o mês inteiro de gastos e entradas;
   as telas de lista pedem exatamente as mesmas chaves e reaproveitam
   a resposta em vez de pedir de novo.
   ════════════════════════════════════════════════════════════ */

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

/** O extrato do mês — a decomposição do saldo que a tela de Contas já
 *  mostra somado.
 *
 *  Mesma regra do `useMonthReport`, e aqui ela é ainda mais fácil de
 *  quebrar: NADA daqui se recalcula no cliente. O `ClosingBalance` é o
 *  que a API afirmou, e somar a coluna para "conferir" seria construir
 *  a segunda implementação da mesma pergunta — a que faz duas telas
 *  discordarem. Se a soma não fechar, é bug da API. */
export function useMonthStatement(
    month: ApiTypes.ReferenceMonth,
): UseQueryResult<ApiTypes.StatementReport> {
    return useQuery({
        queryKey: queryKeys.statement(month),
        queryFn: () => ReportsConnection.statement(month),
    });
}

/** O mês do orçamento: as fatias e o `Unbudgeted`.
 *
 *  **Um ENVELOPE, não uma lista** — o `Unbudgeted` é do mês, não de
 *  linha nenhuma, e ele existe porque o casamento do gasto com a fatia é
 *  estrito: cada porção consome uma fatia ou NENHUMA. Como todo número
 *  daqui, ele é da API: somar `Spent` no cliente para "conferir" é a
 *  segunda implementação da mesma pergunta.
 *
 *  `enabled` existe por causa de UM chamador: o estado vazio do Início
 *  lê também o mês ANTERIOR, para saber quantas fatias o botão de
 *  clonar vai trazer. Essa leitura só interessa quando o mês da tela
 *  está vazio, e sem o gate ela seria uma requisição a mais em toda
 *  visita ao Início. A CHAVE é a mesma de sempre — navegar para o mês
 *  anterior reaproveita a resposta em vez de pedir de novo. */
export function useMonthBudgets(
    month: ApiTypes.ReferenceMonth,
    enabled = true,
): UseQueryResult<ApiTypes.BudgetMonth> {
    return useQuery({
        queryKey: queryKeys.budgets(month),
        queryFn: () => BudgetPeriodsConnection.list(month),
        enabled,
    });
}

/** Um alvo do rascunho do rateio: os DOIS lados podem estar vazios
 *  enquanto a pessoa monta a linha, e é por isso que este tipo não é o
 *  `ApiTypes.BudgetPreviewTarget` — aquele já é o alvo válido. */
export interface BudgetPreviewTargetDraft {
    IdCategory: number | null;
    IdPerson: number | null;
}

/** A prévia do mês, do jeito que a tela a lê: o comprometido indexado pelo
 *  ALVO, porque é o alvo que a linha conhece — a fatia ainda não tem id. */
export interface BudgetPreview {
    /** `budgetTargetKey(IdCategory, IdPerson)` → o comprometido do alvo. */
    spentByTarget: Map<string, ApiTypes.Money>;
    /** O gasto do mês que não casou com nenhum dos alvos do corpo. É ele que
     *  faz o "fora do orçamento" se mover ANTES de salvar. */
    Unbudgeted: ApiTypes.Money;
}

/** **O comprometido dos alvos que a tela do Orçamento está MONTANDO.**
 *
 *  `useMonthBudgets` devolve o `Spent` por `IdBudgetPeriod`, e uma fatia só
 *  tem id depois de gravada: nenhum alvo recém-escolhido tinha gasto para
 *  mostrar, e o par `(pessoa, categoria)` — que ninguém gravou ainda —
 *  nunca teria. A régua ficava em zero exatamente no momento em que o
 *  número decide o valor que a pessoa vai digitar.
 *
 *  **O número continua sendo o da API**, como todo o resto daqui: o
 *  casamento porção → fatia é a regra de dinheiro mais delicada do
 *  orçamento, e refazê-la no navegador para "só mostrar uma prévia" seria a
 *  segunda implementação dela — cuja primeira divergência é uma prévia
 *  plausível e errada.
 *
 *  **A chave leva o mês e os ALVOS, nunca os valores**, e é isso que
 *  dispensa debounce: trocar um seletor é uma pergunta nova, digitar "250"
 *  não é. Os alvos entram normalizados — sem os vazios, sem repetição e em
 *  ordem estável —, e as três normalizações têm motivo:
 *
 *  - **o alvo vazio sai**: a linha em branco que o botão "adicionar fatia"
 *    cria tem os dois lados nulos, e o `or` da rota a recusaria com 406 —
 *    derrubando a prévia do resto da lista junto;
 *  - **o repetido sai**: dois alvos iguais são 406 na rota, e a tela passa
 *    por esse estado no meio de uma edição (trocar a categoria da segunda
 *    linha para a da primeira). Uma prévia que morre enquanto se edita é
 *    pior do que nenhuma;
 *  - **a ordem é estável** porque a ordem das linhas na tela não é uma
 *    pergunta diferente: mover uma fatia de lugar não muda o comprometido
 *    de ninguém, e sem isso seria uma entrada de cache nova a cada
 *    reordenação. */
export function useBudgetPreview(
    month: ApiTypes.ReferenceMonth,
    targets: readonly BudgetPreviewTargetDraft[],
): UseQueryResult<BudgetPreview> {
    const Targets = previewTargets(targets);

    return useQuery({
        /* A chave é o array de alvos normalizados, e não o array de linhas:
           o React Query compara a chave pelo CONTEÚDO, então duas rendas
           com os mesmos alvos são a mesma entrada — nenhuma requisição. */
        queryKey: queryKeys.budgetPreview(
            month,
            Targets.map((target) =>
                budgetTargetKey(target.IdCategory ?? null, target.IdPerson ?? null),
            ),
        ),
        queryFn: () => BudgetPeriodsConnection.preview({ ReferenceMonth: month, Targets }),
        /* A resposta vem na ordem do corpo e traz o alvo de cada linha; o
           índice dela não serve para nada aqui, porque a ordem do corpo é a
           normalizada e não a da tela. Quem reencontra a linha é o alvo. */
        select: (data): BudgetPreview => ({
            spentByTarget: new Map(
                data.Targets.map((target) => [
                    budgetTargetKey(target.IdCategory, target.IdPerson),
                    target.Spent,
                ]),
            ),
            Unbudgeted: data.Unbudgeted,
        }),
    });
}

/** Os alvos do rascunho virados no corpo da prévia: sem os vazios, sem
 *  repetição, e em ordem estável. Ver `useBudgetPreview` para o porquê dos
 *  três. */
function previewTargets(
    targets: readonly BudgetPreviewTargetDraft[],
): ApiTypes.BudgetPreviewTarget[] {
    const byKey = new Map<string, ApiTypes.BudgetPreviewTarget>();

    for (const draft of targets) {
        const target = previewTarget(draft);

        if (target === null) continue;

        byKey.set(budgetTargetKey(draft.IdCategory, draft.IdPerson), target);
    }

    return [...byKey.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([, target]) => target);
}

/** O alvo válido, ou `null` quando a linha ainda não escolheu nenhum dos
 *  dois lados. Os três ramos existem porque a união do tipo é o que impede
 *  a forma vazia de compilar — e é a mesma coisa que o `or` da rota diz. */
function previewTarget(draft: BudgetPreviewTargetDraft): ApiTypes.BudgetPreviewTarget | null {
    if (draft.IdCategory !== null && draft.IdPerson !== null) {
        return { IdCategory: draft.IdCategory, IdPerson: draft.IdPerson };
    }
    if (draft.IdCategory !== null) return { IdCategory: draft.IdCategory };
    if (draft.IdPerson !== null) return { IdPerson: draft.IdPerson };

    return null;
}

export function useExpenseDetail(idExpense: number | null): UseQueryResult<ApiTypes.ExpenseDetail> {
    return useQuery({
        queryKey: queryKeys.expense(idExpense ?? 0),
        queryFn: () => ExpensesConnection.get(idExpense as number),
        enabled: idExpense !== null,
    });
}

export function useInflowDetail(idInflow: number | null): UseQueryResult<ApiTypes.Inflow> {
    return useQuery({
        queryKey: queryKeys.inflow(idInflow ?? 0),
        queryFn: () => InflowsConnection.get(idInflow as number),
        enabled: idInflow !== null,
    });
}

/** UMA fatura de um cartão — o ciclo, o que há nela, o estado, as
 *  vizinhas e as próximas.
 *
 *  **Ela é a única leitura deste arquivo que não é de um MÊS**, e é o
 *  motivo de a tela existir: a fatura vai de fechamento a fechamento e
 *  quase nunca coincide com o mês civil. Enquanto ela só saía do extrato
 *  — recortado pelo mês do chassi —, "e a fatura passada?" custava
 *  trocar o mês da aplicação inteira, Início e Relatório junto.
 *
 *  `due` nulo é a fatura ABERTA, e quem responde qual é ela é o
 *  servidor: a conta depende do dia de hoje e das datas que ele mesmo
 *  gravou nas pernas. Refazê-la aqui seria a segunda implementação da
 *  regra de ciclo — a que discorda no dia do fechamento. */
export function useInvoice(
    idPaymentMethod: number | null,
    due: ApiTypes.CalendarDate | null,
): UseQueryResult<ApiTypes.Invoice> {
    return useQuery({
        queryKey: queryKeys.invoice(idPaymentMethod ?? 0, due),
        queryFn: () =>
            PaymentMethodsConnection.invoice(idPaymentMethod as number, due ?? undefined),
        enabled: idPaymentMethod !== null,
    });
}

/* ── Pernas do mês ────────────────────────────────────────── */

/** A consulta das pernas de um mês, uma só e compartilhada.
 *
 *  A chave de cache é `["legs", mês]` e ela é lida por três telas: se
 *  uma delas pedisse o mês com outro filtro, quem chegasse primeiro
 *  decidiria o que as outras enxergam — a mesma chave não pode ter duas
 *  respostas. Por isso o `IncludeCanceled` mora aqui, e não no ponto de
 *  uso: a resposta é sempre a completa, e quem descarta o cancelado é o
 *  `paymentLegs`. */
const monthLegsQuery = (month: ApiTypes.ReferenceMonth): ApiTypes.ExpensePaymentListQuery => ({
    ...monthRange(month),
    IncludeCanceled: true,
});

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
 *  explícito em não tentar reconciliá-las.
 *
 *  A consulta pede `IncludeCanceled: true` e devolve DUAS listas da
 *  mesma resposta. É a lista de Gastos que precisa do cancelado — é a
 *  tela que o mostra, atrás de um chip —, e sem ele na resposta o chip
 *  não teria o que mostrar. `legs` continua sendo a lista viva, e é ela
 *  que todo total soma; `allLegs` é a da tela, e quem somar sobre ela
 *  soma cancelado junto. */
export function useMonthLegs(month: ApiTypes.ReferenceMonth): {
    legs: ExpenseLeg[];
    allLegs: ExpenseLeg[];
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
} {
    const query = useQuery({
        queryKey: queryKeys.legs(month),
        queryFn: () => ExpensePaymentsConnection.list(monthLegsQuery(month)),
    });

    const legs = useMemo(() => paymentLegs(query.data ?? []), [query.data]);
    const allLegs = useMemo(() => paymentLegs(query.data ?? [], true), [query.data]);

    return {
        legs,
        allLegs,
        isPending: query.isPending,
        isError: query.isError,
        error: query.error,
        refetch: () => void query.refetch(),
    };
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
            queryFn: () => ExpensePaymentsConnection.list(monthLegsQuery(month)),
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

/* O `get(id)` por LINHA DO MÊS saiu daqui, dos dois lados.

   No gasto ele existia para preencher as colunas de destino e forma de
   pagamento da lista e os dois breakdowns do Início — uma requisição por
   gasto do mês —, e as duas coisas agora vêm dentro da perna. O que
   sobrou de exclusivo do detalhe são as TAGS, e elas só aparecem no
   slide-over de um gasto: `useExpenseDetail`, uma consulta, quando o
   painel abre.

   Na entrada o custo era o mesmo, por um campo que deixou de existir: o
   `useMonthInflowDetails` buscava `GET /Inflows/:id` de CADA entrada do
   mês para desenhar a coluna "Destino" da tela de Renda, que era o
   rateio entre pessoas. A leva 10 tirou o rateio da renda do produto, e
   a tela de Renda voltou a ser uma requisição de lista. */

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
        // E a fatura, que é a mesma perna vista por vencimento: quitar,
        // lançar ou cancelar muda o total de um ciclo que pode não ser o
        // exibido — um parcelado nasce com perna em doze faturas.
        void queryClient.invalidateQueries({ queryKey: queryKeys.allInvoices });
    };
}
