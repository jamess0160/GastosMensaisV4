import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import styles from "./src/styles.module.css";
import { DashboardController, type BudgetDraft, type DashboardContext } from "./controller";
import { useMonthScope } from "@/app/monthScope";
import { useOpenModal } from "@/app/modalRoute";
import { useSession } from "@/app/session";
import {
    useAccounts,
    useCategories,
    useCategoryIndex,
    usePaymentMethodIndex,
    usePersonIndex,
    usePersons,
} from "@/data/catalogs";
import {
    useInvalidateMovement,
    useMonthBudgets,
    useMonthInflows,
    useMonthLegs,
} from "@/data/month";
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
    const activePersons = (persons.data ?? []).filter((person) => person.Active);
    /* Só existe UM teto por alvo em cada mês: orçar o mesmo duas vezes é
       406. Os dois conjuntos são separados porque o alvo é de um tipo ou
       do outro — categoria 4 e pessoa 4 não são o mesmo alvo. */
    const budgetedCategories = new Set(
        periods.filter((period) => period.Scope === "category").map((period) => period.IdCategory),
    );
    const budgetedPersons = new Set(
        periods.filter((period) => period.Scope === "person").map((period) => period.IdPerson),
    );
    const hasPersonBudget = periods.some((period) => period.Scope === "person");

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
                            caption={`Posição em ${formatMonthLabel(month)} — por isso ele muda ao trocar de mês. O que está em aberto não entra.`}
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
                            title="Nenhum teto neste mês"
                            /* O vazio MUDOU DE SIGNIFICADO: desde que a
                               rotina do dia 1º materializa o mês a partir
                               das definições ativas, não ver nada aqui
                               quer dizer "não há definição nenhuma" — e
                               não "o mês ainda não foi cadastrado". */
                            description="Nenhum teto cadastrado ainda. A partir do primeiro, o mês novo nasce sozinho: todo dia 1º o servidor copia os tetos ativos para o mês que começa."
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
                                                Scope: period.Scope,
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
                            total={spent}
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
