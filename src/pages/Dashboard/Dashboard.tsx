import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { DashboardController, type BudgetDraft, type DashboardContext } from "./controller";
import { useSession } from "@/app/session";
import { useAccounts, useCategories, useCategoryIndex } from "@/data/catalogs";
import {
    useInvalidateMovement,
    useMonthBudgets,
    useMonthInflows,
    useMonthLegs,
} from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { MonthPicker } from "@/ui/controls";
import { BreakdownRow, BudgetBar, DeltaPill, KpiCard } from "@/ui/budget";
import { FormError, FormField, FormGrid, InfoNote, Input, MoneyInput, Select } from "@/ui/form";
import { ConfirmDialog, FooterSpacer, Modal } from "@/ui/overlay";
import { IconAlert, IconArrowDown, IconArrowUp, IconPlus } from "@/ui/icons";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import {
    budgetState,
    legsOfKind,
    spentByCategory,
    totalBalance,
    totalExpectedInflow,
    totalPending,
    totalReceived,
    totalSpent,
} from "@/lib/aggregate";
import { categoryColor } from "@/lib/categoryColor";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { currentMonth, daysLeftInMonth, formatMonthLabel } from "@/lib/date";

const newBudgetDraft = (month: string): BudgetDraft => ({
    IdBudgetPeriod: null,
    IdCategory: null,
    ReferenceMonth: month,
    LimitValue: null,
    AlertPercent: 80,
});

export function Dashboard() {
    const { user } = useSession();
    const navigate = useNavigate();

    const [month, setMonth] = useState(currentMonth);
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
    const daysLeft = daysLeftInMonth(month);

    /** "Quanto sobra do mês": o que entrou menos o que o mês custou.
     *  Note que ele NÃO é o saldo da conta — o saldo já descontou o que
     *  foi pago e ignora o que está em aberto; este número olha o mês
     *  inteiro, pago e pendente juntos. */
    const leftover = fromCents(toCents(received) - toCents(spent));

    const byCategory = useMemo(() => spentByCategory(legs), [legs]);
    const topCategories = byCategory.slice(0, 6);
    const biggest = topCategories[0]?.value ?? 0;

    const periods = budgets.data ?? [];
    const overBudget = periods.filter((period) => budgetState(period) === "over");
    const alerting = periods.filter((period) => budgetState(period) === "alert");
    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const budgeted = new Set(periods.map((period) => period.IdCategory));

    const firstName = user.Name.split(/\s+/)[0];

    return (
        <Page>
            <div className={styles.topbar}>
                <PageHead
                    title={`Olá, ${firstName}`}
                    subtitle={`${formatMonthLabel(month)} · ${daysLeft} dia${daysLeft === 1 ? "" : "s"} restante${daysLeft === 1 ? "" : "s"} no mês`}
                />
                <MonthPicker month={month} onChange={setMonth} />
            </div>

            {notice && <div className={styles.notice}>{notice}</div>}
            <FormError>{error}</FormError>

            {/* ── Faixa principal ──────────────────────────────── */}
            <div className={styles.hero}>
                <Card className={styles.heroCard}>
                    <div className={styles.heroLabel}>Sobra do mês</div>
                    <div className={styles.heroValue}>
                        <span className={styles.heroCurrency}>R$</span>
                        <span
                            className={`${styles.heroBig} ${leftover < 0 ? styles.heroNegative : ""}`}
                        >
                            {formatMoney(leftover).replace("R$", "").replace("-", "").trim()}
                        </span>
                    </div>
                    <div className={styles.heroCaption}>
                        O que entrou menos o que o mês custou — pago e em aberto juntos. Não é o
                        saldo da conta.
                    </div>

                    <div className={styles.flows}>
                        <div className={styles.flow}>
                            <div className={styles.flowLabel}>
                                <span className={`${styles.arrow} ${styles.arrowUp}`}>
                                    <IconArrowUp />
                                </span>
                                <span className={styles.flowName}>Entrou no mês</span>
                            </div>
                            <span className={styles.flowValue} style={{ color: "var(--pos-ink)" }}>
                                {formatMoney(received)}
                            </span>
                        </div>
                        <div className={styles.flow}>
                            <div className={styles.flowLabel}>
                                <span className={`${styles.arrow} ${styles.arrowDown}`}>
                                    <IconArrowDown />
                                </span>
                                <span className={styles.flowName}>Gastou no mês</span>
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

            <div className={styles.columns}>
                {/* ── Orçamentos ───────────────────────────────── */}
                <div className={styles.section}>
                    <div className={styles.sectionHead}>
                        <div>
                            <div className={styles.sectionTitle}>
                                Orçamentos · {formatMonthLabel(month)}
                            </div>
                            <div className={styles.sectionSub}>
                                O consumo conta parcela por mês da fatura, e soma o que está em
                                aberto junto com o que já foi pago.
                            </div>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setBudgetDraft(newBudgetDraft(month))}
                        >
                            <IconPlus />
                            Definir teto
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
                        <Card padded={false}>
                            <LoadingRows rows={3} />
                        </Card>
                    ) : budgets.isError ? (
                        <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} />
                    ) : periods.length === 0 ? (
                        <EmptyState
                            title="Nenhum teto neste mês"
                            description="O cadastro do mês é manual: a rotina que copiaria os tetos de um mês para o outro ainda não existe no servidor."
                            action={
                                <Button
                                    variant="primary"
                                    onClick={() => setBudgetDraft(newBudgetDraft(month))}
                                >
                                    <IconPlus />
                                    Definir o primeiro teto
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

                    <InfoNote>
                        Cada mês guarda o teto que <b>realmente valeu</b> nele. Mudar a definição
                        vale do próximo em diante — o passado não se reescreve.
                    </InfoNote>
                </div>

                {/* ── Onde o dinheiro foi ──────────────────────── */}
                <div className={styles.section}>
                    <div className={styles.sectionHead}>
                        <div>
                            <div className={styles.sectionTitle}>Onde o dinheiro foi</div>
                            <div className={styles.sectionSub}>
                                As seis categorias que mais pesaram no mês.
                            </div>
                        </div>
                        <Link to="/relatorio">
                            <Button size="sm">Ver relatório</Button>
                        </Link>
                    </div>

                    <Card>
                        {legsPending ? (
                            <LoadingRows rows={4} />
                        ) : topCategories.length === 0 ? (
                            <EmptyState
                                inline
                                title="Nenhum gasto neste mês"
                                description="Lance o primeiro e ele aparece aqui."
                                action={
                                    <Button
                                        variant="primary"
                                        onClick={() => navigate("/gastos/novo")}
                                    >
                                        <IconPlus />
                                        Adicionar gasto
                                    </Button>
                                }
                            />
                        ) : (
                            <div className={styles.breakdown}>
                                {topCategories.map((slice) => {
                                    const category = categoryIndex.get(slice.IdCategory);
                                    return (
                                        <BreakdownRow
                                            key={slice.IdCategory}
                                            label={category?.Description ?? "Sem categoria"}
                                            iconKey={category?.IconKey ?? null}
                                            color={
                                                category ? categoryColor(category) : "var(--ink-3)"
                                            }
                                            amount={slice.value}
                                            percent={
                                                biggest > 0 ? (slice.value / biggest) * 100 : 0
                                            }
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                    <InfoNote>
                        Estes números somam <b>parcelas</b>, não compras: 600 em 6× custa 100 a este
                        mês. É por isso que eles não batem com o total lançado na tela de Gastos.
                    </InfoNote>
                </div>
            </div>

            {/* ── Formulário de teto ───────────────────────────── */}
            <Modal
                open={budgetDraft !== null}
                onClose={() => setBudgetDraft(null)}
                title={
                    budgetDraft?.IdBudgetPeriod === null
                        ? "Definir teto do mês"
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
                                    value={budgetDraft.IdCategory ?? ""}
                                    onChange={(event) =>
                                        setBudgetDraft((c) =>
                                            c
                                                ? {
                                                      ...c,
                                                      IdCategory: event.target.value
                                                          ? Number(event.target.value)
                                                          : null,
                                                  }
                                                : c,
                                        )
                                    }
                                >
                                    <option value="">Escolha…</option>
                                    {activeCategories
                                        .filter(
                                            (category) =>
                                                budgetDraft.IdBudgetPeriod !== null ||
                                                !budgeted.has(category.IdCategory),
                                        )
                                        .map((category) => (
                                            <option
                                                key={category.IdCategory}
                                                value={category.IdCategory}
                                            >
                                                {category.Description}
                                            </option>
                                        ))}
                                </Select>
                            )}
                        </FormField>

                        <FormGrid columns={2}>
                            <FormField label="Teto do mês" required>
                                {(field) => (
                                    <MoneyInput
                                        {...field}
                                        value={budgetDraft.LimitValue}
                                        onValueChange={(LimitValue) =>
                                            setBudgetDraft((c) => (c ? { ...c, LimitValue } : c))
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
                                                          AlertPercent: Number(event.target.value),
                                                      }
                                                    : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>
                        </FormGrid>

                        <InfoNote>
                            {budgetDraft.IdBudgetPeriod === null ? (
                                <>
                                    Salvar aqui define o teto vigente <b>e</b> materializa este mês.
                                    Os meses seguintes precisam ser cadastrados um a um — a rotina
                                    que faria isso sozinha ainda não existe no servidor.
                                </>
                            ) : (
                                <>
                                    Isto corrige <b>só este mês</b>. A definição vigente segue como
                                    estava e continua valendo para os próximos.
                                </>
                            )}
                        </InfoNote>
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
    );
}
