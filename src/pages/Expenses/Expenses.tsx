import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { ExpensesController, type ExpensesContext, type SeriesDraft } from "./controller";
import { useSession } from "@/app/session";
import {
    useCategoryIndex,
    usePaymentMethodIndex,
    usePersonIndex,
    usePersons,
    useCategories,
    usePaymentMethods,
} from "@/data/catalogs";
import {
    useExpenseDetail,
    useInvalidateMovement,
    useMonthExpenseDetails,
    useMonthExpenses,
    useMonthLegs,
} from "@/data/month";
import { Avatar, Button, Card, Chip, PageHead, Workspace as Page } from "@/ui/primitives";
import { Topbar } from "@/ui/topbar";
import {
    ClearFilters,
    FilterBar,
    FilterChip,
    FilterGroup,
    FilterSelect,
    SearchInput,
} from "@/ui/controls";
import { FormError, FormField, FormGrid, Input, MoneyInput, Textarea } from "@/ui/form";
import { Select } from "@/ui/select";
import { SplitEditor } from "@/ui/SplitEditor";
import { ConfirmDialog, FooterSpacer, Modal, SlideOver } from "@/ui/overlay";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconCard, IconEdit, IconPlus, IconRepeat, IconTag, METHOD_ICON } from "@/ui/icons";
import {
    Cell,
    CellAmount,
    DueDate,
    PayButton,
    RowTrigger,
    Table,
    TableFoot,
    TableGroup,
    TableHead,
    TableRow,
    TypeTile,
} from "@/ui/table";
import { EmptyState, ErrorState, LoadingRows, StatusBadge } from "@/ui/states";
import {
    isLive,
    legsOf,
    legsOfKind,
    sumMoney,
    totalPaid,
    totalPending,
    totalSpent,
    type ExpenseLeg,
} from "@/lib/aggregate";
import { accentColor, categoryColor } from "@/lib/categoryColor";
import { formatMoney } from "@/lib/money";
import { currentMonth, formatDate, formatDateTime, formatMonthLabel, today } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

const KIND_LABEL: Record<ApiTypes.ExpenseKind, string> = {
    single: "Avulsos",
    installment: "Parcelados",
    fixed: "Fixos",
};

const KIND_ORDER: ApiTypes.ExpenseKind[] = ["fixed", "installment", "single"];

const KIND_ICON: Record<ApiTypes.ExpenseKind, ReactNode> = {
    single: <IconTag />,
    installment: <IconCard />,
    fixed: <IconRepeat />,
};

const emptySeriesDraft = (): SeriesDraft => ({
    Description: "",
    TotalValue: null,
    IdCategory: null,
    Notes: "",
    persons: [],
});

export function Expenses() {
    const navigate = useNavigate();
    const { user } = useSession();

    const [month, setMonth] = useState(currentMonth);
    const [status, setStatus] = useState<ApiTypes.ExpenseStatus | null>(null);
    const [kind, setKind] = useState<ApiTypes.ExpenseKind | null>(null);
    const [idCategory, setIdCategory] = useState<number | null>(null);
    const [idPerson, setIdPerson] = useState<number | null>(null);
    const [idPaymentMethod, setIdPaymentMethod] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [openExpense, setOpenExpense] = useState<number | null>(null);
    const [seriesDraft, setSeriesDraft] = useState<SeriesDraft | null>(null);
    const [confirming, setConfirming] = useState<"cancel" | "cancelSeries" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const expenses = useMonthExpenses(month, status);
    const monthLegs = useMonthLegs(month);
    const monthDetails = useMonthExpenseDetails(month);
    const detail = useExpenseDetail(openExpense);
    const categories = useCategories();
    const categoryIndex = useCategoryIndex();
    const personIndex = usePersonIndex();
    const methodIndex = usePaymentMethodIndex();
    const methods = usePaymentMethods();
    const persons = usePersons();
    const invalidateMovement = useInvalidateMovement();

    const context = useMemo<ExpensesContext>(
        () => ({
            seriesDraft: seriesDraft ?? emptySeriesDraft(),
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
            closeDetail: () => setOpenExpense(null),
            closeSeriesForm: () => setSeriesDraft(null),
        }),
        [seriesDraft, invalidateMovement],
    );

    /* ── O filtro ──────────────────────────────────────────────
       Um só, aplicado em DOIS conjuntos: a lista de compras (a
       tabela) e as pernas do mês (a faixa de indicadores). São
       universos diferentes de propósito — a parcela 8 de uma compra
       de março pesa em agosto sem estar na lista de agosto —, e é por
       isso que o predicado mora aqui, num lugar só.

       Destino e forma de pagamento vivem no DETALHE, que chega gasto
       a gasto: enquanto ele não chega, a linha não passa no filtro.
       Sem detalhe nenhum a lista ficaria vazia e pareceria erro, e é
       por isso que o filtro só se aplica depois que o detalhe existe. */
    const matches = useMemo(() => {
        const term = search.trim().toLowerCase();

        return (expense: ApiTypes.Expense): boolean => {
            if (status !== null && status !== "canceled" && expense.Status !== status) return false;
            if (kind !== null && expense.Kind !== kind) return false;
            if (idCategory !== null && expense.IdCategory !== idCategory) return false;
            if (term && !expense.Description.toLowerCase().includes(term)) return false;

            if (idPerson !== null || idPaymentMethod !== null) {
                const found = monthDetails.byId.get(expense.IdExpense);
                if (!found) return false;
                if (
                    idPerson !== null &&
                    !found.Persons.some((person) => person.IdPerson === idPerson)
                ) {
                    return false;
                }
                if (
                    idPaymentMethod !== null &&
                    !found.Payments.some((payment) => payment.IdPaymentMethod === idPaymentMethod)
                ) {
                    return false;
                }
            }

            return true;
        };
    }, [search, status, kind, idCategory, idPerson, idPaymentMethod, monthDetails.byId]);

    const rows = useMemo(() => (expenses.data ?? []).filter(matches), [expenses.data, matches]);

    const grouped = useMemo(
        () =>
            KIND_ORDER.map((groupKind) => ({
                kind: groupKind,
                items: rows.filter((expense) => expense.Kind === groupKind),
            })).filter((group) => group.items.length > 0),
        [rows],
    );

    /* ── Os cinco indicadores ──────────────────────────────────
       Todos somam PERNA, não compra: 600 em 6x custa 100 a este mês, e
       "Parcelados" é a soma das parcelas que vencem nele — não o total
       das compras parceladas em curso. */
    const legs: ExpenseLeg[] = useMemo(
        () => monthLegs.legs.filter((leg) => matches(leg.expense)),
        [monthLegs.legs, matches],
    );

    const total = totalSpent(legs);
    const paid = totalPaid(legs);
    const toPay = totalPending(legs);
    const fixed = totalSpent(legsOfKind(legs, "fixed"));
    const installments = totalSpent(legsOfKind(legs, "installment"));

    const live = rows.filter(isLive);
    const totalPurchases = sumMoney(live.map((expense) => expense.TotalValue));

    const hasFilters =
        status !== null ||
        kind !== null ||
        idCategory !== null ||
        idPerson !== null ||
        idPaymentMethod !== null ||
        search.trim() !== "";

    const clearAll = () => {
        setStatus(null);
        setKind(null);
        setIdCategory(null);
        setIdPerson(null);
        setIdPaymentMethod(null);
        setSearch("");
    };

    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    const expense = detail.data;

    return (
        <>
            <Topbar
                greeting={`Olá, ${user.Name.split(/\s+/)[0]}`}
                month={month}
                onMonthChange={setMonth}
                actions={
                    <Button variant="primary" onClick={() => navigate("/gastos/novo")}>
                        <IconPlus />
                        Novo gasto
                    </Button>
                }
            />

            <Page>
                <PageHead
                    title="Gastos"
                    subtitle={`${formatMonthLabel(month)} · ${live.length} lançamento${live.length === 1 ? "" : "s"} · ${formatMoney(totalPurchases)}`}
                />

                {notice && <div className={styles.notice}>{notice}</div>}
                <FormError>{error}</FormError>

                <div className={styles.strip}>
                    <div className={styles.cell}>
                        <div className={styles.cellLabel}>Total</div>
                        <div className={styles.cellValue}>{formatMoney(total)}</div>
                        <div className={styles.cellCaption}>
                            o que o mês custa, parcela a parcela
                        </div>
                    </div>
                    <div className={styles.cell}>
                        <div className={styles.cellLabel}>Já pagos</div>
                        <div className={`${styles.cellValue} ${styles.positive}`}>
                            {formatMoney(paid)}
                        </div>
                        <div className={styles.cellCaption}>já saiu do saldo</div>
                    </div>
                    <div className={`${styles.cell} ${toPay > 0 ? styles.attn : ""}`}>
                        <div className={styles.cellLabel}>A pagar</div>
                        <div className={styles.cellValue}>{formatMoney(toPay)}</div>
                        <div className={styles.cellCaption}>ainda em aberto neste mês</div>
                    </div>
                    <div className={styles.cell}>
                        <div className={styles.cellLabel}>Fixos</div>
                        <div className={styles.cellValue}>{formatMoney(fixed)}</div>
                        <div className={styles.cellCaption}>aluguel, assinaturas</div>
                    </div>
                    <div className={styles.cell}>
                        <div className={styles.cellLabel}>Parcelados</div>
                        <div className={styles.cellValue}>{formatMoney(installments)}</div>
                        <div className={styles.cellCaption}>só a parcela que vence no mês</div>
                    </div>
                </div>

                <div className={styles.toolbar}>
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar descrição…"
                    />

                    <FilterBar>
                        <FilterGroup label="Status">
                            <FilterChip active={status === null} onClick={() => setStatus(null)}>
                                Todos
                            </FilterChip>
                            <FilterChip
                                active={status === "pending"}
                                onClick={() => setStatus("pending")}
                            >
                                Em aberto
                            </FilterChip>
                            <FilterChip
                                active={status === "paid"}
                                onClick={() => setStatus("paid")}
                            >
                                Pagos
                            </FilterChip>
                            {/* Sem `Status` na query a API já esconde os
                                cancelados: vê-los é pedir por eles. */}
                            <FilterChip
                                active={status === "canceled"}
                                onClick={() => setStatus("canceled")}
                            >
                                Cancelados
                            </FilterChip>
                        </FilterGroup>

                        <FilterSelect
                            value={kind}
                            onChange={setKind}
                            ariaLabel="Formato"
                            allLabel="Todos os formatos"
                            options={[
                                {
                                    value: "single" as const,
                                    label: "Avulso",
                                    icon: KIND_ICON.single,
                                },
                                {
                                    value: "installment" as const,
                                    label: "Parcelado",
                                    icon: KIND_ICON.installment,
                                },
                                { value: "fixed" as const, label: "Fixo", icon: KIND_ICON.fixed },
                            ]}
                        />

                        <FilterSelect
                            value={idCategory}
                            onChange={setIdCategory}
                            ariaLabel="Categoria"
                            allLabel="Todas as categorias"
                            options={activeCategories.map((category) => ({
                                value: category.IdCategory,
                                label: category.Description,
                                icon: <CategoryIcon iconKey={category.IconKey} />,
                                color: categoryColor(category),
                            }))}
                        />

                        <FilterSelect
                            value={idPerson}
                            onChange={setIdPerson}
                            ariaLabel="Destino"
                            allLabel="Todos os destinos"
                            options={activePersons.map((person) => ({
                                value: person.IdPerson,
                                label: person.Name,
                            }))}
                        />

                        <FilterSelect
                            value={idPaymentMethod}
                            onChange={setIdPaymentMethod}
                            ariaLabel="Forma de pagamento"
                            allLabel="Todas as formas"
                            options={methods.map(({ method, account }) => ({
                                value: method.IdPaymentMethod,
                                label: `${account.Name} · ${method.Name}`,
                                icon: METHOD_ICON[method.Kind],
                                color: accentColor(method.Color ?? account.Color),
                            }))}
                        />

                        {hasFilters && <ClearFilters onClick={clearAll} />}
                    </FilterBar>
                </div>

                {expenses.isPending ? (
                    <Card padded={false}>
                        <LoadingRows rows={6} />
                    </Card>
                ) : expenses.isError ? (
                    <ErrorState error={expenses.error} onRetry={() => void expenses.refetch()} />
                ) : rows.length === 0 ? (
                    <EmptyState
                        title={hasFilters ? "Nada com esses filtros" : "Nenhum gasto neste mês"}
                        description={
                            hasFilters
                                ? "Limpe os filtros para ver o mês inteiro."
                                : "Lance o primeiro gasto do mês — ele aparece aqui na hora."
                        }
                        action={
                            hasFilters ? (
                                <Button onClick={clearAll}>Limpar filtros</Button>
                            ) : (
                                <Button variant="primary" onClick={() => navigate("/gastos/novo")}>
                                    <IconPlus />
                                    Novo gasto
                                </Button>
                            )
                        }
                    />
                ) : (
                    <Table columns="minmax(0,1.5fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,1.2fr) 110px 130px 150px">
                        <TableHead>
                            <span>Descrição</span>
                            <span>Categoria</span>
                            <span>Pessoa</span>
                            <span>Forma de pagamento</span>
                            <span>Data</span>
                            <span style={{ textAlign: "right" }}>Valor</span>
                            <span>Status</span>
                        </TableHead>

                        {grouped.map((group) => {
                            const groupLive = group.items.filter(isLive);
                            return (
                                <div key={group.kind}>
                                    <TableGroup
                                        title={KIND_LABEL[group.kind]}
                                        icon={KIND_ICON[group.kind]}
                                        count={group.items.length}
                                        pending={
                                            groupLive.filter((e) => e.Status === "pending").length
                                        }
                                        total={formatMoney(
                                            sumMoney(groupLive.map((e) => e.TotalValue)),
                                        )}
                                    />
                                    {group.items.map((row) => {
                                        const category = categoryIndex.get(row.IdCategory);
                                        const color = category
                                            ? categoryColor(category)
                                            : "var(--ink-3)";
                                        const found = monthDetails.byId.get(row.IdExpense);

                                        /* A perna quitável é a que vence NESTE
                                           mês. Uma só: com duas, qual delas o
                                           botão pagaria seria adivinhação — aí
                                           o caminho é abrir o detalhe. */
                                        const dueThisMonth = found
                                            ? legsOf(found).filter((leg) => leg.month === month)
                                            : [];
                                        const payable =
                                            row.Status !== "canceled" && dueThisMonth.length === 1
                                                ? dueThisMonth[0].payment
                                                : null;

                                        const rowPersons = found?.Persons ?? [];
                                        const firstPerson =
                                            rowPersons.length > 0
                                                ? personIndex.get(rowPersons[0].IdPerson)
                                                : undefined;

                                        const rowMethods = found?.Payments ?? [];
                                        const firstMethod =
                                            rowMethods.length > 0
                                                ? methodIndex.get(rowMethods[0].IdPaymentMethod)
                                                : undefined;

                                        return (
                                            <TableRow
                                                key={row.IdExpense}
                                                onClick={() => setOpenExpense(row.IdExpense)}
                                                selected={openExpense === row.IdExpense}
                                                faded={row.Status === "canceled"}
                                            >
                                                <RowTrigger label={`Abrir ${row.Description}`}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className={styles.description}>
                                                            {row.Description}
                                                        </div>
                                                        <div className={styles.meta}>
                                                            {row.Kind === "installment"
                                                                ? `Parcelado${
                                                                      dueThisMonth[0]?.payment
                                                                          ?.InstallmentNumber
                                                                          ? ` · ${dueThisMonth[0].payment?.InstallmentNumber}/${dueThisMonth[0].payment?.InstallmentTotal}`
                                                                          : ""
                                                                  }`
                                                                : row.Kind === "fixed"
                                                                  ? "Ocorrência de um gasto fixo"
                                                                  : "Compra à vista"}
                                                        </div>
                                                    </div>
                                                </RowTrigger>

                                                <Cell>
                                                    {category ? (
                                                        <Chip>
                                                            <span
                                                                className={styles.chipIcon}
                                                                style={{ color }}
                                                            >
                                                                <CategoryIcon
                                                                    iconKey={category.IconKey}
                                                                />
                                                            </span>
                                                            {category.Description}
                                                        </Chip>
                                                    ) : (
                                                        <span className={styles.meta}>—</span>
                                                    )}
                                                </Cell>

                                                <Cell>
                                                    {rowPersons.length === 0 ? (
                                                        <span className={styles.meta}>
                                                            {found ? "—" : ""}
                                                        </span>
                                                    ) : (
                                                        <span className={styles.who}>
                                                            <Avatar
                                                                name={firstPerson?.Name ?? "?"}
                                                                size={22}
                                                            />
                                                            <span className={styles.whoName}>
                                                                {firstPerson?.Name ?? "Arquivada"}
                                                                {rowPersons.length > 1 &&
                                                                    ` +${rowPersons.length - 1}`}
                                                            </span>
                                                        </span>
                                                    )}
                                                </Cell>

                                                <Cell>
                                                    {rowMethods.length === 0 ? (
                                                        <span className={styles.meta}>
                                                            {found ? "—" : ""}
                                                        </span>
                                                    ) : (
                                                        <span className={styles.who}>
                                                            <TypeTile
                                                                color={
                                                                    firstMethod?.method.Color ??
                                                                    firstMethod?.account.Color ??
                                                                    "var(--ink-2)"
                                                                }
                                                            >
                                                                {
                                                                    METHOD_ICON[
                                                                        firstMethod?.method.Kind ??
                                                                            "debit"
                                                                    ]
                                                                }
                                                            </TypeTile>
                                                            <span className={styles.whoName}>
                                                                {firstMethod
                                                                    ? `${firstMethod.account.Name} · ${firstMethod.method.Name}`
                                                                    : "Forma arquivada"}
                                                                {rowMethods.length > 1 &&
                                                                    ` +${rowMethods.length - 1}`}
                                                            </span>
                                                        </span>
                                                    )}
                                                </Cell>

                                                <Cell>
                                                    <DueDate
                                                        warn={
                                                            row.Status === "pending" &&
                                                            row.ExpenseDate < today()
                                                        }
                                                    >
                                                        {formatDate(row.ExpenseDate)}
                                                    </DueDate>
                                                </Cell>

                                                <CellAmount>
                                                    {formatMoney(row.TotalValue)}
                                                </CellAmount>

                                                <Cell className={styles.statusCell}>
                                                    <StatusBadge status={row.Status} />
                                                    {payable && (
                                                        <span
                                                            onClick={(event) =>
                                                                event.stopPropagation()
                                                            }
                                                        >
                                                            <PayButton
                                                                paid={payable.Paid}
                                                                pending={pending}
                                                                onToggle={() =>
                                                                    void ExpensesController.toggleLegPayment(
                                                                        context,
                                                                        payable.IdExpensePayment,
                                                                        payable.Paid,
                                                                    )
                                                                }
                                                            />
                                                        </span>
                                                    )}
                                                </Cell>
                                            </TableRow>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        <TableFoot>
                            <span>
                                {live.length} lançamento{live.length === 1 ? "" : "s"} em{" "}
                                {formatMonthLabel(month)}
                            </span>
                            <span>
                                Total lançado <b>{formatMoney(totalPurchases)}</b>
                            </span>
                        </TableFoot>
                    </Table>
                )}

                {/* ── Detalhe ──────────────────────────────────── */}
                <SlideOver
                    open={openExpense !== null}
                    onClose={() => setOpenExpense(null)}
                    title={expense?.Description ?? "Carregando…"}
                    subtitle={
                        expense
                            ? `${formatDate(expense.ExpenseDate)} · ${categoryIndex.get(expense.IdCategory)?.Description ?? "sem categoria"}`
                            : undefined
                    }
                    wide
                    footer={
                        expense && (
                            <>
                                {expense.Status !== "canceled" && (
                                    <>
                                        {/* Parcelado não se edita: a API responde
                                            "cancele e lance de novo". */}
                                        {expense.Kind !== "installment" && (
                                            <Button
                                                onClick={() =>
                                                    navigate(`/gastos/${expense.IdExpense}/editar`)
                                                }
                                            >
                                                <IconEdit />
                                                Editar
                                            </Button>
                                        )}
                                        {expense.Kind === "fixed" && (
                                            <Button
                                                onClick={() =>
                                                    setSeriesDraft({
                                                        Description: expense.Description,
                                                        TotalValue: expense.TotalValue,
                                                        IdCategory: expense.IdCategory,
                                                        Notes: expense.Notes ?? "",
                                                        persons: expense.Persons.map((person) => ({
                                                            id: person.IdPerson,
                                                            value: person.Value,
                                                        })),
                                                    })
                                                }
                                            >
                                                <IconRepeat />
                                                Esta e as seguintes
                                            </Button>
                                        )}
                                    </>
                                )}
                                <FooterSpacer />
                                {expense.Status !== "canceled" && (
                                    <>
                                        {expense.Kind === "fixed" && (
                                            <Button
                                                onClick={() => setConfirming("cancelSeries")}
                                                disabled={pending}
                                            >
                                                Encerrar série
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => setConfirming("cancel")}
                                            disabled={pending}
                                        >
                                            Cancelar gasto
                                        </Button>
                                    </>
                                )}
                            </>
                        )
                    }
                >
                    {detail.isPending ? (
                        <LoadingRows rows={3} />
                    ) : detail.isError ? (
                        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
                    ) : (
                        expense && (
                            <>
                                <FormError>{error}</FormError>

                                <div className={styles.detailHero}>
                                    <div>
                                        <div className={styles.detailValue}>
                                            {formatMoney(expense.TotalValue)}
                                        </div>
                                        <div className={styles.detailMeta}>
                                            {expense.Kind === "installment"
                                                ? `Total da compra · ${expense.Payments.length}× de ${formatMoney(expense.Payments[0]?.Value ?? 0)}`
                                                : expense.Kind === "fixed"
                                                  ? "Uma ocorrência de um gasto fixo"
                                                  : "Compra à vista"}
                                        </div>
                                    </div>
                                    <StatusBadge status={expense.Status} />
                                </div>

                                {/* ── Pernas ─────────────────────────── */}
                                <div className={styles.sectionLabel}>
                                    <span>Com o que foi pago</span>
                                </div>
                                <div className={styles.legs}>
                                    {expense.Payments.map((leg) => {
                                        const method = methodIndex.get(leg.IdPaymentMethod);
                                        const overdue =
                                            !leg.Paid &&
                                            leg.DueDate !== null &&
                                            leg.DueDate < today();

                                        return (
                                            <div
                                                key={leg.IdExpensePayment}
                                                className={`${styles.leg} ${leg.Paid ? styles.legPaid : ""}`}
                                            >
                                                <div className={styles.legBody}>
                                                    <div className={styles.legName}>
                                                        {leg.InstallmentNumber !== null &&
                                                            `${leg.InstallmentNumber}/${leg.InstallmentTotal} · `}
                                                        {method
                                                            ? `${method.account.Name} · ${method.method.Name}`
                                                            : "Forma arquivada"}
                                                    </div>
                                                    <div className={styles.legSub}>
                                                        {leg.DueDate
                                                            ? `Vence ${formatDate(leg.DueDate)}`
                                                            : "Sem vencimento próprio"}
                                                        {leg.PaidAt &&
                                                            ` · pago ${formatDateTime(leg.PaidAt)}`}
                                                        {overdue && " · vencida"}
                                                    </div>
                                                </div>
                                                <span className={styles.legValue}>
                                                    {formatMoney(leg.Value)}
                                                </span>
                                                <PayButton
                                                    paid={leg.Paid}
                                                    disabled={expense.Status === "canceled"}
                                                    pending={pending}
                                                    onToggle={() =>
                                                        void ExpensesController.toggleLegPayment(
                                                            context,
                                                            leg.IdExpensePayment,
                                                            leg.Paid,
                                                        )
                                                    }
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ── Rateio ─────────────────────────── */}
                                {expense.Persons.length > 0 && (
                                    <>
                                        <div className={styles.sectionLabel}>
                                            <span>De quem é o custo</span>
                                        </div>
                                        <div className={styles.splitRows}>
                                            {expense.Persons.map((person) => (
                                                <div
                                                    className={styles.splitRow}
                                                    key={person.IdExpensePerson}
                                                >
                                                    <span>
                                                        {personIndex.get(person.IdPerson)?.Name ??
                                                            "Pessoa arquivada"}
                                                    </span>
                                                    <span className={styles.splitValue}>
                                                        {formatMoney(person.Value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* ── Tags ───────────────────────────── */}
                                {expense.Tags.length > 0 && (
                                    <>
                                        <div className={styles.sectionLabel}>
                                            <span>Etiquetas</span>
                                        </div>
                                        <div className={styles.tags}>
                                            {expense.Tags.map((tag) => (
                                                <span className={styles.tag} key={tag.IdTag}>
                                                    {tag.Name}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {expense.Notes && (
                                    <>
                                        <div className={styles.sectionLabel}>
                                            <span>Observações</span>
                                        </div>
                                        <div className={styles.notes}>{expense.Notes}</div>
                                    </>
                                )}

                                <div className={styles.sectionLabel}>
                                    <span>Histórico</span>
                                </div>
                                <div className={styles.history}>
                                    <span>Lançado em {formatDateTime(expense.CreatedAt)}</span>
                                    <span>
                                        Última alteração em {formatDateTime(expense.UpdatedAt)}
                                    </span>
                                </div>
                            </>
                        )
                    )}
                </SlideOver>

                {/* ── Esta e as seguintes ──────────────────────── */}
                <Modal
                    open={seriesDraft !== null}
                    onClose={() => setSeriesDraft(null)}
                    title="Esta ocorrência e as seguintes"
                    subtitle="O que já passou fica como está — o corte é a data desta ocorrência, não o relógio."
                    wide
                    footer={
                        <>
                            <FooterSpacer />
                            <Button onClick={() => setSeriesDraft(null)} disabled={pending}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                type="submit"
                                form="series-form"
                                disabled={pending}
                            >
                                {pending ? "Salvando…" : "Aplicar daqui em diante"}
                            </Button>
                        </>
                    }
                >
                    {seriesDraft && expense && (
                        <form
                            id="series-form"
                            onSubmit={(event: FormEvent) => {
                                event.preventDefault();
                                void ExpensesController.updateSeries(context, expense.IdExpense);
                            }}
                            style={{ display: "flex", flexDirection: "column", gap: 16 }}
                        >
                            <FormError>{error}</FormError>

                            <FormField label="Descrição" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={255}
                                        value={seriesDraft.Description}
                                        onChange={(event) =>
                                            setSeriesDraft((c) =>
                                                c ? { ...c, Description: event.target.value } : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>

                            <FormGrid columns={2}>
                                <FormField label="Valor" required>
                                    {(field) => (
                                        <MoneyInput
                                            {...field}
                                            value={seriesDraft.TotalValue}
                                            onValueChange={(TotalValue) =>
                                                setSeriesDraft((c) =>
                                                    c ? { ...c, TotalValue } : c,
                                                )
                                            }
                                        />
                                    )}
                                </FormField>
                                <FormField label="Categoria" required>
                                    {(field) => (
                                        <Select
                                            {...field}
                                            value={seriesDraft.IdCategory}
                                            onChange={(IdCategory) =>
                                                setSeriesDraft((c) =>
                                                    c ? { ...c, IdCategory } : c,
                                                )
                                            }
                                            options={activeCategories.map((category) => ({
                                                value: category.IdCategory,
                                                label: category.Description,
                                                icon: <CategoryIcon iconKey={category.IconKey} />,
                                                color: categoryColor(category),
                                            }))}
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            <SplitEditor
                                label="De quem é o custo"
                                optionLabel="Pessoa"
                                addLabel="Outra pessoa"
                                options={activePersons.map((person) => ({
                                    id: person.IdPerson,
                                    label: person.Name,
                                }))}
                                lines={seriesDraft.persons}
                                onChange={(newPersons) =>
                                    setSeriesDraft((c) => (c ? { ...c, persons: newPersons } : c))
                                }
                                total={seriesDraft.TotalValue}
                            />

                            <FormField label="Observações">
                                {(field) => (
                                    <Textarea
                                        {...field}
                                        value={seriesDraft.Notes}
                                        onChange={(event) =>
                                            setSeriesDraft((c) =>
                                                c ? { ...c, Notes: event.target.value } : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>
                        </form>
                    )}
                </Modal>

                {/* ── Confirmações ─────────────────────────────── */}
                <ConfirmDialog
                    open={confirming === "cancel"}
                    onClose={() => setConfirming(null)}
                    onConfirm={() => {
                        setConfirming(null);
                        if (expense)
                            void ExpensesController.cancelExpense(context, expense.IdExpense);
                    }}
                    title="Cancelar este gasto?"
                    description={
                        expense?.Status === "paid" || expense?.Payments.some((leg) => leg.Paid) ? (
                            <>
                                Este gasto tem parcela já quitada: cancelar <b>é o estorno</b> — o
                                dinheiro volta para o saldo da conta. O lançamento continua no
                                histórico, marcado como cancelado.
                            </>
                        ) : (
                            "Ele continua no histórico, marcado como cancelado. Nada sai do saldo, porque nada tinha saído ainda."
                        )
                    }
                    confirmLabel="Cancelar gasto"
                    cancelLabel="Voltar"
                    danger
                    pending={pending}
                />

                <ConfirmDialog
                    open={confirming === "cancelSeries"}
                    onClose={() => setConfirming(null)}
                    onConfirm={() => {
                        setConfirming(null);
                        if (expense)
                            void ExpensesController.cancelSeries(context, expense.IdExpense);
                    }}
                    title="Encerrar a série?"
                    description="Esta ocorrência e todas as posteriores são canceladas. As que já passaram ficam como estão — elas aconteceram."
                    confirmLabel="Encerrar série"
                    cancelLabel="Voltar"
                    danger
                    pending={pending}
                />
            </Page>

            {/* O formulário de gasto — rota filha, slide-over sobre a
                lista. Ver `routes.tsx`. */}
            <Outlet />
        </>
    );
}
