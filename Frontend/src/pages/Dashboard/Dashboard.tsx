import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { DashboardController, type BudgetDraft, type DashboardContext } from "./controller";
import { useMonthScope } from "@/app/monthScope";
import { useOpenModal } from "@/app/modalRoute";
import { useSession } from "@/app/session";
import {
    useCategories,
    useCategoryIndex,
    usePaymentMethodIndex,
    usePersonIndex,
    usePersons,
} from "@/data/catalogs";
import { useInvalidateMovement, useMonthBudgets, useMonthLegs, useMonthReport } from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { HideOnMobile, Topbar } from "@/ui/topbar";
import { BreakdownRow, BudgetBar, DeltaPill, KpiCard, ProgressMeter } from "@/ui/budget";
import { FormError, FormField, FormGrid, Input, MoneyInput, SegmentedControl } from "@/ui/form";
import { Select } from "@/ui/select";
import { CategoryIcon } from "@/ui/iconCatalog";
import { ConfirmDialog, FooterSpacer, Modal } from "@/ui/overlay";
import { IconAlert, IconArrowDown, IconArrowUp, IconPlus } from "@/ui/icons";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import {
    budgetState,
    budgetTargetName,
    legsOfKind,
    spentByCategory,
    spentByPaymentMethod,
    spentByPerson,
    sumMoney,
    totalSpent,
} from "@/lib/aggregate";
import { accentColor, categoryColor, paletteColor } from "@/lib/categoryColor";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { formatMonthLabel } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

const newBudgetDraft = (month: string): BudgetDraft => ({
    IdBudgetPeriod: null,
    Scope: "category",
    IdCategory: null,
    IdPerson: null,
    ReferenceMonth: month,
    LimitValue: null,
    AlertPercent: 80,
});

/** Um dos três painéis de quebra do layout: título, total e as linhas
 *  em ordem decrescente. A porcentagem é sobre o TOTAL do painel, que é
 *  o que faz as três colunas serem lidas do mesmo jeito. */
function Breakdown({
    title,
    total,
    rows,
    empty,
}: {
    title: string;
    total: number;
    rows: { key: string; label: string; color: string; amount: number; iconKey?: string | null }[];
    empty: ReactNode;
}) {
    return (
        <Card className={styles.breakdownCard}>
            <div className={styles.breakdownHead}>
                <div>
                    <div className={styles.sectionTitle}>{title}</div>
                    <div className={styles.breakdownTotal}>{formatMoney(total)}</div>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className={styles.breakdownEmpty}>{empty}</div>
            ) : (
                <div className={styles.breakdown}>
                    {rows.map((row) => (
                        <BreakdownRow
                            key={row.key}
                            label={row.label}
                            iconKey={row.iconKey}
                            color={row.color}
                            amount={row.amount}
                            percent={total > 0 ? (row.amount / total) * 100 : 0}
                        />
                    ))}
                </div>
            )}
        </Card>
    );
}

export function Dashboard() {
    const { user } = useSession();
    const openModal = useOpenModal();
    const navigate = useNavigate();

    const [month, setMonth] = useMonthScope();
    const [budgetDraft, setBudgetDraft] = useState<BudgetDraft | null>(null);
    const [removing, setRemoving] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const {
        legs,
        isPending: legsPending,
        isError: legsError,
        error: legsErrorValue,
    } = useMonthLegs(month);
    /* Os nove números do mês, somados no servidor. A tela deixou de
       pedir `useMonthInflows`: ela puxava o mês inteiro de entradas
       para somar dois números que agora vêm prontos. */
    const report = useMonthReport(month);
    const budgets = useMonthBudgets(month);
    /* `useAccounts` continua sendo lido nesta tela — por dentro de
       `usePaymentMethodIndex`, que é quem dá nome à fatia "Por forma de
       pagamento". O que saiu foi a leitura DIRETA, que existia só para
       somar o `totalBalance`: esse número agora é o `CurrentBalance` da
       rota. Mesma chave de cache, nenhuma requisição a mais. */
    const categories = useCategories();
    const categoryIndex = useCategoryIndex();
    const persons = usePersons();
    const personIndex = usePersonIndex();
    const methodIndex = usePaymentMethodIndex();
    const invalidateMovement = useInvalidateMovement();

    const context = useMemo<DashboardContext>(
        () => ({
            budgetDraft,
            beginSubmit() {
                setPending(true);
                setError(null);
                setNotice(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishSubmit(message) {
                setPending(false);
                setNotice(message);
                invalidateMovement();
            },
            closeBudgetForm: () => setBudgetDraft(null),
        }),
        [budgetDraft, invalidateMovement],
    );

    /* ── Os números do mês, e todos vêm da rota ──────────────
       Nenhum deles se soma aqui — nem para conferir. As quatro regras
       de agregação se contradizem de propósito, e era a réplica delas
       no cliente que fazia a mesma pergunta ter dois totais na mesma
       tela. Se um número daqui divergir do da tela dele, é bug da API.

       O "Restante" era `recebido − gasto`, e faltava nele o
       `OpeningBalance`: somar só as entradas do mês para dizer quanto
       ainda dá para gastar ignora o dinheiro que já estava na conta no
       dia 1º. Não era questão de escala — dava errado com dois
       lançamentos no banco. */
    const available = report.data?.Available ?? 0;
    const inflows = report.data?.Inflows ?? 0;
    const expenses = report.data?.Expenses ?? 0;
    const currentBalance = report.data?.CurrentBalance ?? 0;
    const openInvoices = report.data?.OpenInvoices ?? 0;
    const overdueReceivable = report.data?.OverdueReceivable ?? 0;
    const overduePayable = report.data?.OverduePayable ?? 0;

    /** Enquanto a rota não respondeu, o traço — um zero aqui seria um
     *  número, e um número errado. */
    const money = (value: ApiTypes.Money): string => (report.isPending ? "—" : formatMoney(value));

    /* O que FICA no cliente: os dois recortes por tipo de gasto e as
       três quebras de baixo. A rota não responde nenhum deles, e todos
       saem da lista de pernas que a tela já tem em cache. O que mudou é
       o DENOMINADOR — o total dos painéis passou a ser o `Expenses` da
       rota, e não o `totalSpent` das pernas: dois totais de gasto na
       mesma tela é exatamente o que ela veio evitar. */
    const fixed = totalSpent(legsOfKind(legs, "fixed"));
    const installments = totalSpent(legsOfKind(legs, "installment"));

    const periods = budgets.data ?? [];
    const overBudget = periods.filter((period) => budgetState(period) === "over");
    const alerting = periods.filter((period) => budgetState(period) === "alert");
    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);
    /* Só existe UMA fatia por alvo em cada mês: repetir o alvo INTEIRO é
       406. Os dois conjuntos são separados porque categoria 4 e pessoa 4
       não são o mesmo alvo — e as fatias de alvo DUPLO ficam de fora dos
       dois de propósito: "Luana em Mercado" não ocupa nem "Mercado" nem
       "Luana", as três convivem. O formulário ainda monta um alvo por
       vez; a tela é reescrita na etapa 12. */
    const budgetedCategories = new Set(
        periods.filter((period) => period.IdPerson === null).map((period) => period.IdCategory),
    );
    const budgetedPersons = new Set(
        periods.filter((period) => period.IdCategory === null).map((period) => period.IdPerson),
    );
    const hasPersonBudget = periods.some((period) => period.IdPerson !== null);

    /* A régua do cartão principal. Com teto cadastrado ela mede o
       consumo do teto; sem teto nenhum, mede o quanto do que entrou já
       foi gasto — o rótulo muda junto, porque as duas perguntas são
       diferentes e trocá-las caladas seria mentir no número. */
    const budgetLimit = sumMoney(periods.map((period) => period.LimitValue));
    const budgetSpent = sumMoney(periods.map((period) => period.Spent));
    const hasBudget = budgetLimit > 0;
    const usedPercent = hasBudget
        ? (budgetSpent / budgetLimit) * 100
        : inflows > 0
          ? (expenses / inflows) * 100
          : 0;

    /* ── As três quebras do layout ───────────────────────────
       As três saem da MESMA lista de pernas: categoria vem do gasto,
       forma de pagamento vem da própria perna e destino é o rateio do
       gasto rateado pela perna. Nenhuma delas espera por requisição
       nenhuma — era daqui que saíam os `get(id)` por linha. */
    const byCategory = useMemo(() => spentByCategory(legs).slice(0, 5), [legs]);
    const byMethod = useMemo(() => spentByPaymentMethod(legs).slice(0, 5), [legs]);
    const byPerson = useMemo(() => spentByPerson(legs).slice(0, 5), [legs]);

    const firstName = user.Name.split(/\s+/)[0];

    return (
        <>
            <Topbar
                greeting={`Olá, ${firstName}`}
                month={month}
                onMonthChange={setMonth}
                actions={
                    /* No mobile quem lança gasto é o FAB da barra
                       inferior — ver `HideOnMobile`. */
                    <HideOnMobile>
                        <Button variant="primary" onClick={() => openModal("/gastos/novo")}>
                            <IconPlus />
                            Novo gasto
                        </Button>
                    </HideOnMobile>
                }
            />

            <Page>
                <PageHead title={`Início - ${formatMonthLabel(month)}`} />

                {notice && <div className={styles.notice}>{notice}</div>}
                <FormError>{error}</FormError>

                {/* ── Faixa principal ──────────────────────────── */}
                <div className={styles.hero}>
                    <Card className={styles.heroCard}>
                        <div className={styles.heroLabel}>Restante</div>
                        <div className={styles.heroValue}>
                            <span className={styles.heroCurrency}>R$</span>
                            <span
                                className={`${styles.heroBig} ${available < 0 ? styles.heroNegative : ""}`}
                            >
                                {report.isPending
                                    ? "—"
                                    : formatMoney(available).replace("R$", "").trim()}
                            </span>
                        </div>

                        <div className={styles.heroMeter}>
                            <ProgressMeter
                                percent={usedPercent}
                                state={
                                    usedPercent > 100 ? "over" : usedPercent >= 80 ? "alert" : "ok"
                                }
                                height={8}
                            />
                            <div className={styles.heroMeterCaption}>
                                <b>{Math.round(usedPercent)}%</b>{" "}
                                {hasBudget ? "do orçamento usado" : "do que entrou já foi gasto"}
                            </div>
                        </div>

                        <div className={styles.flows}>
                            <div className={styles.flow}>
                                <div className={styles.flowLabel}>
                                    <span className={`${styles.arrow} ${styles.arrowUp}`}>
                                        <IconArrowUp />
                                    </span>
                                    {/* O rótulo mudou junto com o número: a rota
                                        conta a entrada PENDENTE junto com a
                                        recebida — é competência, não caixa.
                                        Trocar o número por baixo de um rótulo
                                        que diz "Recebido" seria a mentira que
                                        esta rota veio consertar. */}
                                    <span className={styles.flowName}>Entradas do mês</span>
                                </div>
                                <span
                                    className={styles.flowValue}
                                    style={{ color: "var(--pos-ink)" }}
                                >
                                    {money(inflows)}
                                </span>
                            </div>
                            <div className={styles.flow}>
                                <div className={styles.flowLabel}>
                                    <span className={`${styles.arrow} ${styles.arrowDown}`}>
                                        <IconArrowDown />
                                    </span>
                                    <span className={styles.flowName}>Gasto</span>
                                </div>
                                <span className={styles.flowValue} style={{ color: "var(--neg)" }}>
                                    {money(expenses)}
                                </span>
                            </div>
                        </div>

                        {/* ── O atrasado, exposto ────────────────────
                            Os dois vencidos entram no "Restante" de propósito:
                            sem eles, a perna de julho que ninguém honrou some
                            do indicador — ela não está no saldo de julho (não
                            foi paga) nem na janela de agosto (a competência é
                            de julho). O custo está aceito de olhos abertos, e
                            é por isso que eles não ficam escondidos dentro do
                            total: uma previsão que nunca chega infla o número
                            PARA SEMPRE se ninguém a resolver. Daí cada linha
                            levar para onde se resolve. */}
                        {(overdueReceivable > 0 || overduePayable > 0) && (
                            <div className={styles.overdue}>
                                {overdueReceivable > 0 && (
                                    <button
                                        type="button"
                                        className={styles.overdueRow}
                                        onClick={() => navigate("/renda")}
                                    >
                                        <span className={styles.overdueName}>
                                            A receber vencido
                                        </span>
                                        <span className={styles.overdueValue}>
                                            {formatMoney(overdueReceivable)}
                                        </span>
                                    </button>
                                )}
                                {overduePayable > 0 && (
                                    <button
                                        type="button"
                                        className={styles.overdueRow}
                                        onClick={() => navigate("/gastos?status=pending")}
                                    >
                                        <span className={styles.overdueName}>A pagar vencido</span>
                                        <span
                                            className={`${styles.overdueValue} ${styles.overdueNeg}`}
                                        >
                                            {formatMoney(overduePayable)}
                                        </span>
                                    </button>
                                )}
                                <div className={styles.overdueNote}>
                                    Já contam no Restante, e continuam contando enquanto ninguém os
                                    receber ou cancelar.
                                </div>
                            </div>
                        )}
                    </Card>

                    <div className={styles.kpiGrid}>
                        <KpiCard
                            label="Saldo nas contas"
                            value={report.isPending ? "—" : currentBalance}
                            caption={`Posição em ${formatMonthLabel(month)}. Só o que foi pago, o que está em aberto não entra.`}
                        />
                        <KpiCard
                            label="Faturas em aberto"
                            value={report.isPending ? "—" : openInvoices}
                            tone={openInvoices > 0 ? "neg" : "neutral"}
                            caption="Compras de cartão que vencem até o fim do mês e ainda não foram pagas."
                        />
                        <KpiCard
                            label="Fixos do mês"
                            value={fixed}
                            caption="Aluguel, assinaturas e contas gerais."
                            badge={
                                expenses > 0 ? (
                                    <DeltaPill tone="mute">
                                        {Math.round((fixed / expenses) * 100)}%
                                    </DeltaPill>
                                ) : undefined
                            }
                        />
                        <KpiCard label="Parcelas do mês" value={installments} />
                    </div>
                </div>

                {report.isError && (
                    <ErrorState error={report.error} onRetry={() => void report.refetch()} />
                )}

                {legsError && <ErrorState error={legsErrorValue} />}

                {/* ── Orçamentos: painel próprio, largura inteira ── */}
                <Card className={styles.panel}>
                    <div className={styles.sectionHead}>
                        <div>
                            <div className={styles.sectionTitle}>
                                Orçamentos · {formatMonthLabel(month)}
                            </div>
                            <div className={styles.sectionSub}>
                                {periods.length} orçamento{periods.length === 1 ? "" : "s"} ativo
                                {periods.length === 1 ? "" : "s"}
                                {overBudget.length > 0 && ` · ${overBudget.length} estourado`}
                                {hasBudget &&
                                    ` · ${formatMoney(
                                        fromCents(toCents(budgetLimit) - toCents(budgetSpent)),
                                    )} disponíveis no total`}
                            </div>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setBudgetDraft(newBudgetDraft(month))}
                        >
                            <IconPlus />
                            Adicionar orçamento
                        </Button>
                    </div>

                    {overBudget.length > 0 && (
                        <div className={`${styles.alert} ${styles.alertSolid}`}>
                            <span className={styles.alertIcon}>
                                <IconAlert />
                            </span>
                            <div>
                                <div className={styles.alertTitle}>
                                    {overBudget.length} orçamento
                                    {overBudget.length === 1 ? "" : "s"} estourou o teto
                                </div>
                                <div className={styles.alertText}>
                                    {overBudget.map(budgetTargetName).join(" · ")}
                                </div>
                            </div>
                        </div>
                    )}

                    {overBudget.length === 0 && alerting.length > 0 && (
                        <div className={styles.alert}>
                            <span className={styles.alertIcon}>
                                <IconAlert />
                            </span>
                            <div>
                                <div className={styles.alertTitle}>
                                    {alerting.length} orçamento{alerting.length === 1 ? "" : "s"}{" "}
                                    perto do teto
                                </div>
                                <div className={styles.alertText}>
                                    {alerting.map(budgetTargetName).join(" · ")}
                                </div>
                            </div>
                        </div>
                    )}

                    {budgets.isPending ? (
                        <LoadingRows rows={3} />
                    ) : budgets.isError ? (
                        <ErrorState
                            inline
                            error={budgets.error}
                            onRetry={() => void budgets.refetch()}
                        />
                    ) : periods.length === 0 ? (
                        <EmptyState
                            inline
                            title="Nenhum orçamento neste mês"
                            action={
                                <Button
                                    variant="primary"
                                    onClick={() => setBudgetDraft(newBudgetDraft(month))}
                                >
                                    <IconPlus />
                                    Adicionar orçamento
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <div className={styles.budgets}>
                                {periods.map((period) => (
                                    <BudgetBar
                                        key={period.IdBudgetPeriod}
                                        period={period}
                                        onClick={() =>
                                            setBudgetDraft({
                                                IdBudgetPeriod: period.IdBudgetPeriod,
                                                /* Estado de tela, não da API: o
                                                   seletor de alvo some na edição
                                                   (o alvo não se muda), então aqui
                                                   ele só diz qual dos dois campos
                                                   o formulário mostra. Na fatia de
                                                   alvo duplo manda a pessoa. */
                                                Scope:
                                                    period.IdPerson !== null
                                                        ? "person"
                                                        : "category",
                                                IdCategory: period.IdCategory,
                                                IdPerson: period.IdPerson,
                                                ReferenceMonth: month,
                                                LimitValue: period.LimitValue,
                                                AlertPercent: period.AlertPercent,
                                            })
                                        }
                                    />
                                ))}
                            </div>

                            {/* A conferência que vira chamado se não estiver
                                escrita: o rateio por pessoa é OPCIONAL no
                                gasto, então um gasto sem `Persons` não entra
                                em orçamento de pessoa nenhum. E o mesmo gasto
                                conta nos dois tipos de teto sem ser dupla
                                contagem — são duas perguntas sobre o mesmo
                                dinheiro. O que não se pode é somar os dois. */}
                            {hasPersonBudget && (
                                <div className={styles.budgetNote}>
                                    Os tetos de pessoa somam só o que foi <b>atribuído</b> a alguém,
                                    e o rateio é opcional no gasto — por isso eles não fecham com o
                                    total gasto do mês. Um mesmo gasto conta no teto da categoria e
                                    no da pessoa: são duas perguntas sobre o mesmo dinheiro, e somar
                                    os dois é que seria contar duas vezes.
                                </div>
                            )}
                        </>
                    )}
                </Card>

                {/* ── As três quebras do mês ─────────────────────
                    As LINHAS saem das pernas que a tela já tem em cache — a
                    rota não responde nenhuma delas. O TOTAL de cada painel é
                    o `Expenses` da rota: dois totais de gasto na mesma tela é
                    exatamente o que ela veio evitar, e se eles divergirem é
                    bug da API, não duas leituras legítimas. Nada é
                    arredondado para "fechar" a soma. */}
                {legsPending ? (
                    <Card padded={false}>
                        <LoadingRows rows={4} />
                    </Card>
                ) : (
                    <div className={styles.breakdowns}>
                        <Breakdown
                            title="Por categoria"
                            total={expenses}
                            empty="Nenhum gasto neste mês."
                            rows={byCategory.map((slice) => {
                                const category = categoryIndex.get(slice.IdCategory);
                                return {
                                    key: `c${slice.IdCategory}`,
                                    label: category?.Description ?? "Sem categoria",
                                    iconKey: category?.IconKey ?? null,
                                    color: category
                                        ? categoryColor(category)
                                        : paletteColor(slice.IdCategory),
                                    amount: slice.value,
                                };
                            })}
                        />

                        <Breakdown
                            title="Por forma de pagamento"
                            total={expenses}
                            empty="Nenhum gasto neste mês."
                            rows={byMethod.map((slice) => {
                                const option = methodIndex.get(slice.IdPaymentMethod);
                                return {
                                    key: `m${slice.IdPaymentMethod}`,
                                    label: option
                                        ? `${option.account.Name} · ${option.method.Name}`
                                        : "Forma arquivada",
                                    color: accentColor(
                                        option?.method.Color ?? option?.account.Color ?? null,
                                    ),
                                    amount: slice.value,
                                };
                            })}
                        />

                        <Breakdown
                            title="Por destino"
                            total={expenses}
                            empty="Nenhum gasto neste mês."
                            rows={byPerson.map((slice) => ({
                                key: `p${slice.IdPerson ?? "none"}`,
                                label:
                                    slice.IdPerson === null
                                        ? "Sem destino"
                                        : (personIndex.get(slice.IdPerson)?.Name ??
                                          "Pessoa arquivada"),
                                color:
                                    slice.IdPerson === null
                                        ? "var(--ink-3)"
                                        : paletteColor(slice.IdPerson),
                                amount: slice.value,
                            }))}
                        />
                    </div>
                )}

                {/* ── Formulário de teto ───────────────────────── */}
                <Modal
                    open={budgetDraft !== null}
                    onClose={() => setBudgetDraft(null)}
                    title={
                        budgetDraft?.IdBudgetPeriod === null
                            ? "Adicionar orçamento"
                            : "Corrigir o teto deste mês"
                    }
                    subtitle={formatMonthLabel(month)}
                    footer={
                        <>
                            {budgetDraft?.IdBudgetPeriod !== null && budgetDraft && (
                                <Button
                                    onClick={() => setRemoving(budgetDraft.IdBudgetPeriod)}
                                    disabled={pending}
                                >
                                    Remover deste mês
                                </Button>
                            )}
                            <FooterSpacer />
                            <Button onClick={() => setBudgetDraft(null)} disabled={pending}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                type="submit"
                                form="budget-form"
                                disabled={pending}
                            >
                                {pending ? "Salvando…" : "Salvar teto"}
                            </Button>
                        </>
                    }
                >
                    {budgetDraft && (
                        <form
                            id="budget-form"
                            onSubmit={(event: FormEvent) => {
                                event.preventDefault();
                                void DashboardController.saveBudget(context);
                            }}
                            style={{ display: "flex", flexDirection: "column", gap: 16 }}
                        >
                            <FormError>{error}</FormError>

                            {/* O alvo é uma categoria OU uma pessoa, e os dois
                                são exclusivos: mandar os dois, ou nenhum, é
                                406. Como o teto do mês já congelado não muda
                                de alvo, o seletor some na edição. */}
                            {budgetDraft.IdBudgetPeriod === null && (
                                <FormField
                                    label="O teto é de"
                                    help="Categoria soma o gasto inteiro; pessoa soma só o que foi atribuído a ela, rateado pela parcela."
                                >
                                    {() => (
                                        <SegmentedControl
                                            value={budgetDraft.Scope}
                                            ariaLabel="Alvo do orçamento"
                                            onChange={(Scope) =>
                                                setBudgetDraft((c) => (c ? { ...c, Scope } : c))
                                            }
                                            options={[
                                                { value: "category", label: "Uma categoria" },
                                                { value: "person", label: "Uma pessoa" },
                                            ]}
                                        />
                                    )}
                                </FormField>
                            )}

                            {budgetDraft.Scope === "person" ? (
                                <FormField label="Pessoa" required>
                                    {(field) => (
                                        <Select
                                            {...field}
                                            /* O alvo não se muda num mês já
                                               congelado: mover o teto de lugar
                                               é apagar este e cadastrar outro. */
                                            disabled={budgetDraft.IdBudgetPeriod !== null}
                                            value={budgetDraft.IdPerson}
                                            onChange={(IdPerson) =>
                                                setBudgetDraft((c) => (c ? { ...c, IdPerson } : c))
                                            }
                                            options={activePersons
                                                .filter(
                                                    (person) =>
                                                        budgetDraft.IdBudgetPeriod !== null ||
                                                        !budgetedPersons.has(person.IdPerson),
                                                )
                                                .map((person) => ({
                                                    value: person.IdPerson,
                                                    label: person.Name,
                                                    color: paletteColor(person.IdPerson),
                                                }))}
                                            emptyLabel="Toda pessoa já tem teto neste mês"
                                        />
                                    )}
                                </FormField>
                            ) : (
                                <FormField label="Categoria" required>
                                    {(field) => (
                                        <Select
                                            {...field}
                                            disabled={budgetDraft.IdBudgetPeriod !== null}
                                            value={budgetDraft.IdCategory}
                                            onChange={(IdCategory) =>
                                                setBudgetDraft((c) =>
                                                    c ? { ...c, IdCategory } : c,
                                                )
                                            }
                                            options={activeCategories
                                                .filter(
                                                    (category) =>
                                                        budgetDraft.IdBudgetPeriod !== null ||
                                                        !budgetedCategories.has(
                                                            category.IdCategory,
                                                        ),
                                                )
                                                .map((category) => ({
                                                    value: category.IdCategory,
                                                    label: category.Description,
                                                    icon: (
                                                        <CategoryIcon iconKey={category.IconKey} />
                                                    ),
                                                    color: categoryColor(category),
                                                }))}
                                            emptyLabel="Toda categoria já tem teto neste mês"
                                        />
                                    )}
                                </FormField>
                            )}

                            <FormGrid columns={2}>
                                <FormField label="Teto do mês" required>
                                    {(field) => (
                                        <MoneyInput
                                            {...field}
                                            value={budgetDraft.LimitValue}
                                            onValueChange={(LimitValue) =>
                                                setBudgetDraft((c) =>
                                                    c ? { ...c, LimitValue } : c,
                                                )
                                            }
                                        />
                                    )}
                                </FormField>
                                <FormField
                                    label="Avisar em"
                                    hint="%"
                                    help="O aviso aparece quando o consumo chega nesta fatia do teto."
                                >
                                    {(field) => (
                                        <Input
                                            {...field}
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={budgetDraft.AlertPercent}
                                            onChange={(event) =>
                                                setBudgetDraft((c) =>
                                                    c
                                                        ? {
                                                              ...c,
                                                              AlertPercent: Number(
                                                                  event.target.value,
                                                              ),
                                                          }
                                                        : c,
                                                )
                                            }
                                        />
                                    )}
                                </FormField>
                            </FormGrid>
                        </form>
                    )}
                </Modal>

                <ConfirmDialog
                    open={removing !== null}
                    onClose={() => setRemoving(null)}
                    onConfirm={() => {
                        const id = removing;
                        setRemoving(null);
                        if (id !== null) void DashboardController.removeBudgetPeriod(context, id);
                    }}
                    title="Remover o teto deste mês?"
                    description="A definição continua valendo — some só o teto deste mês. Nenhum lançamento é afetado: um período é plano, não dinheiro."
                    confirmLabel="Remover"
                    danger
                    pending={pending}
                />
            </Page>
        </>
    );
}
