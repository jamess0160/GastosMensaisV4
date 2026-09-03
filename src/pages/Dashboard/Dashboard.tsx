import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { DashboardController, type BudgetDraft, type DashboardContext } from "./controller";
import { useMonthScope } from "@/app/monthScope";
import { useSession } from "@/app/session";
import {
    useAccounts,
    useCategories,
    useCategoryIndex,
    usePaymentMethodIndex,
    usePersonIndex,
} from "@/data/catalogs";
import {
    useInvalidateMovement,
    useMonthBudgets,
    useMonthExpenseDetails,
    useMonthInflows,
    useMonthLegs,
} from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { HideOnMobile, Topbar } from "@/ui/topbar";
import { BreakdownRow, BudgetBar, DeltaPill, KpiCard, ProgressMeter } from "@/ui/budget";
import { FormError, FormField, FormGrid, Input, MoneyInput } from "@/ui/form";
import { Select } from "@/ui/select";
import { CategoryIcon } from "@/ui/iconCatalog";
import { ConfirmDialog, FooterSpacer, Modal } from "@/ui/overlay";
import { IconAlert, IconArrowDown, IconArrowUp, IconPlus } from "@/ui/icons";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import {
    budgetState,
    legsOfKind,
    spentByCategory,
    spentByPaymentMethod,
    spentByPerson,
    sumMoney,
    totalBalance,
    totalExpectedInflow,
    totalPending,
    totalReceived,
    totalSpent,
} from "@/lib/aggregate";
import { accentColor, categoryColor, paletteColor } from "@/lib/categoryColor";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { formatMonthLabel } from "@/lib/date";

const newBudgetDraft = (month: string): BudgetDraft => ({
    IdBudgetPeriod: null,
    IdCategory: null,
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
    const inflows = useMonthInflows(month);
    const budgets = useMonthBudgets(month);
    const accounts = useAccounts();
    const categories = useCategories();
    const categoryIndex = useCategoryIndex();
    const personIndex = usePersonIndex();
    const methodIndex = usePaymentMethodIndex();
    const monthDetails = useMonthExpenseDetails(month);
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

    /* ── Os números. Nenhum deles tem endpoint. ────────────── */

    const balance = totalBalance(accounts.data ?? []);
    const received = totalReceived(inflows.data ?? []);
    const expected = totalExpectedInflow(inflows.data ?? []);
    const spent = totalSpent(legs);
    const stillToPay = totalPending(legs);
    const fixed = totalSpent(legsOfKind(legs, "fixed"));
    const installments = totalSpent(legsOfKind(legs, "installment"));

    /** "Saldo restante do mês": o que entrou menos o que o mês custou.
     *  Note que ele NÃO é o saldo da conta — o saldo já descontou o que
     *  foi pago e ignora o que está em aberto; este número olha o mês
     *  inteiro, pago e pendente juntos. */
    const leftover = fromCents(toCents(received) - toCents(spent));

    const periods = budgets.data ?? [];
    const overBudget = periods.filter((period) => budgetState(period) === "over");
    const alerting = periods.filter((period) => budgetState(period) === "alert");
    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const budgeted = new Set(periods.map((period) => period.IdCategory));

    /* A régua do cartão principal. Com teto cadastrado ela mede o
       consumo do teto; sem teto nenhum, mede o quanto do que entrou já
       foi gasto — o rótulo muda junto, porque as duas perguntas são
       diferentes e trocá-las caladas seria mentir no número. */
    const budgetLimit = sumMoney(periods.map((period) => period.LimitValue));
    const budgetSpent = sumMoney(periods.map((period) => period.Spent));
    const hasBudget = budgetLimit > 0;
    const usedPercent = hasBudget
        ? (budgetSpent / budgetLimit) * 100
        : received > 0
          ? (spent / received) * 100
          : 0;

    /* ── As três quebras do layout ─────────────────────────── */
    const detailOf = useMemo(
        () => (idExpense: number) => monthDetails.byId.get(idExpense),
        [monthDetails.byId],
    );

    const byCategory = useMemo(() => spentByCategory(legs).slice(0, 5), [legs]);
    const byMethod = useMemo(
        () => spentByPaymentMethod(legs, detailOf).slice(0, 5),
        [legs, detailOf],
    );
    const byPerson = useMemo(() => spentByPerson(legs, detailOf).slice(0, 5), [legs, detailOf]);

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
                        <Button variant="primary" onClick={() => navigate("/gastos/novo")}>
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
                                className={`${styles.heroBig} ${leftover < 0 ? styles.heroNegative : ""}`}
                            >
                                {formatMoney(leftover).replace("R$", "").replace("-", "").trim()}
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
                                    <span className={styles.flowName}>Recebido</span>
                                </div>
                                <span
                                    className={styles.flowValue}
                                    style={{ color: "var(--pos-ink)" }}
                                >
                                    {formatMoney(received)}
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
                                    {formatMoney(spent)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    <div className={styles.kpiGrid}>
                        <KpiCard
                            label="Saldo nas contas"
                            value={balance}
                            caption="Já descontado o que foi pago. O que está em aberto não entra."
                        />
                        <KpiCard
                            label="Ainda a pagar"
                            value={stillToPay}
                            tone={stillToPay > 0 ? "neg" : "neutral"}
                            caption="Parcelas deste mês que ainda não foram quitadas."
                        />
                        <KpiCard
                            label="Fixos do mês"
                            value={fixed}
                            caption="Aluguel, assinaturas — o que se repete."
                            badge={
                                spent > 0 ? (
                                    <DeltaPill tone="mute">
                                        {Math.round((fixed / spent) * 100)}%
                                    </DeltaPill>
                                ) : undefined
                            }
                        />
                        <KpiCard
                            label="Parcelas do mês"
                            value={installments}
                            caption="Só a fatia que vence neste mês, não a compra inteira."
                            badge={
                                expected > 0 ? (
                                    <DeltaPill tone="mute" direction="up">
                                        {formatMoney(expected)} a receber
                                    </DeltaPill>
                                ) : undefined
                            }
                        />
                    </div>
                </div>

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
                                    {overBudget.length} categoria
                                    {overBudget.length === 1 ? "" : "s"} estourou o teto
                                </div>
                                <div className={styles.alertText}>
                                    {overBudget
                                        .map((period) => period.Category.Description)
                                        .join(" · ")}
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
                                    {alerting.length} categoria{alerting.length === 1 ? "" : "s"}{" "}
                                    perto do teto
                                </div>
                                <div className={styles.alertText}>
                                    {alerting
                                        .map((period) => period.Category.Description)
                                        .join(" · ")}
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
                            title="Nenhum teto neste mês"
                            description="O cadastro do mês é manual: a rotina que copiaria os tetos de um mês para o outro ainda não existe no servidor."
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
                        <div className={styles.budgets}>
                            {periods.map((period) => (
                                <BudgetBar
                                    key={period.IdBudgetPeriod}
                                    period={period}
                                    onClick={() =>
                                        setBudgetDraft({
                                            IdBudgetPeriod: period.IdBudgetPeriod,
                                            IdCategory: period.IdCategory,
                                            ReferenceMonth: month,
                                            LimitValue: period.LimitValue,
                                            AlertPercent: period.AlertPercent,
                                        })
                                    }
                                />
                            ))}
                        </div>
                    )}
                </Card>

                {/* ── As três quebras do mês ───────────────────── */}
                {legsPending ? (
                    <Card padded={false}>
                        <LoadingRows rows={4} />
                    </Card>
                ) : (
                    <div className={styles.breakdowns}>
                        <Breakdown
                            title="Por categoria"
                            total={spent}
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
                            total={spent}
                            empty={
                                monthDetails.isPending
                                    ? "Carregando as formas de pagamento…"
                                    : "Nenhum gasto neste mês."
                            }
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
                            total={spent}
                            empty={
                                monthDetails.isPending
                                    ? "Carregando os destinos…"
                                    : "Nenhum gasto neste mês."
                            }
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

                            <FormField label="Categoria" required>
                                {(field) => (
                                    <Select
                                        {...field}
                                        /* A categoria não se muda num mês já
                                           congelado: mover o teto de lugar é
                                           apagar este e cadastrar outro. */
                                        disabled={budgetDraft.IdBudgetPeriod !== null}
                                        value={budgetDraft.IdCategory}
                                        onChange={(IdCategory) =>
                                            setBudgetDraft((c) => (c ? { ...c, IdCategory } : c))
                                        }
                                        options={activeCategories
                                            .filter(
                                                (category) =>
                                                    budgetDraft.IdBudgetPeriod !== null ||
                                                    !budgeted.has(category.IdCategory),
                                            )
                                            .map((category) => ({
                                                value: category.IdCategory,
                                                label: category.Description,
                                                icon: <CategoryIcon iconKey={category.IconKey} />,
                                                color: categoryColor(category),
                                            }))}
                                        emptyLabel="Toda categoria já tem teto neste mês"
                                    />
                                )}
                            </FormField>

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
