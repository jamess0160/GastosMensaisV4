import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { ExpensesController, type ExpensesContext, type SeriesDraft } from "./controller";
import {
    useCategoryIndex,
    usePaymentMethodIndex,
    usePersonIndex,
    usePersons,
    useCategories,
} from "@/data/catalogs";
import { useExpenseDetail, useInvalidateMovement, useMonthExpenses } from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import {
    FilterBar,
    FilterChip,
    FilterSelect,
    FilterGroup,
    MonthPicker,
    ClearFilters,
} from "@/ui/controls";
import {
    FormError,
    FormField,
    FormGrid,
    InfoNote,
    Input,
    MoneyInput,
    Select,
    Textarea,
} from "@/ui/form";
import { SplitEditor } from "@/ui/SplitEditor";
import { ConfirmDialog, FooterSpacer, Modal, SlideOver } from "@/ui/overlay";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconCard, IconEdit, IconPlus, IconRepeat, IconTag } from "@/ui/icons";
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
import { impliedLeg, isLive, sumMoney } from "@/lib/aggregate";
import { categoryColor } from "@/lib/categoryColor";
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

    const [month, setMonth] = useState(currentMonth);
    const [status, setStatus] = useState<ApiTypes.ExpenseStatus | null>(null);
    const [kind, setKind] = useState<ApiTypes.ExpenseKind | null>(null);
    const [idCategory, setIdCategory] = useState<number | null>(null);
    const [openExpense, setOpenExpense] = useState<number | null>(null);
    const [seriesDraft, setSeriesDraft] = useState<SeriesDraft | null>(null);
    const [confirming, setConfirming] = useState<"cancel" | "cancelSeries" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const expenses = useMonthExpenses(month, status);
    const detail = useExpenseDetail(openExpense);
    const categories = useCategories();
    const categoryIndex = useCategoryIndex();
    const personIndex = usePersonIndex();
    const methodIndex = usePaymentMethodIndex();
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

    /* "Cancelados" é a única opção que vira query: sem `Status` a API já
       devolve a lista sem eles, e pedi-los é outra consulta. Em aberto e
       pago se separam aqui mesmo, sobre a lista que já veio. */
    const rows = useMemo(() => {
        const all = expenses.data ?? [];
        return all.filter((expense) => {
            if (status !== null && status !== "canceled" && expense.Status !== status) {
                return false;
            }
            if (kind !== null && expense.Kind !== kind) return false;
            if (idCategory !== null && expense.IdCategory !== idCategory) return false;
            return true;
        });
    }, [expenses.data, status, kind, idCategory]);

    const grouped = useMemo(
        () =>
            KIND_ORDER.map((groupKind) => ({
                kind: groupKind,
                items: rows.filter((expense) => expense.Kind === groupKind),
            })).filter((group) => group.items.length > 0),
        [rows],
    );

    const live = rows.filter(isLive);
    const totalPurchases = sumMoney(live.map((expense) => expense.TotalValue));
    const pendingCount = live.filter((expense) => expense.Status === "pending").length;
    const paidCount = live.filter((expense) => expense.Status === "paid").length;

    const hasFilters = status !== null || kind !== null || idCategory !== null;
    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    const expense = detail.data;

    return (
        <Page>
            <PageHead
                title="Gastos"
                subtitle={`${formatMonthLabel(month)} · a lista mostra a compra; o mês pesa por parcela`}
                actions={
                    <Button variant="primary" onClick={() => navigate("/gastos/novo")}>
                        <IconPlus />
                        Adicionar gasto
                    </Button>
                }
            />

            <div className={styles.toolbar}>
                <MonthPicker month={month} onChange={setMonth} />

                <FilterBar>
                    <FilterGroup label="Status">
                        <FilterChip active={status === null} onClick={() => setStatus(null)}>
                            Em aberto e pagos
                        </FilterChip>
                        <FilterChip
                            active={status === "pending"}
                            onClick={() => setStatus("pending")}
                        >
                            Em aberto
                        </FilterChip>
                        <FilterChip active={status === "paid"} onClick={() => setStatus("paid")}>
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
                            { value: "single" as const, label: "Avulso" },
                            { value: "installment" as const, label: "Parcelado" },
                            { value: "fixed" as const, label: "Fixo" },
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
                        }))}
                    />

                    {hasFilters && (
                        <ClearFilters
                            onClick={() => {
                                setStatus(null);
                                setKind(null);
                                setIdCategory(null);
                            }}
                        />
                    )}
                </FilterBar>
            </div>

            {notice && <div className={styles.notice}>{notice}</div>}
            <FormError>{error}</FormError>

            <div className={styles.strip}>
                <div className={styles.cell}>
                    <div className={styles.cellLabel}>Compras do mês</div>
                    <div className={styles.cellValue}>{live.length}</div>
                    <div className={styles.cellCaption}>lançamentos, não parcelas</div>
                </div>
                <div className={styles.cell}>
                    <div className={styles.cellLabel}>Valor lançado</div>
                    <div className={styles.cellValue}>{formatMoney(totalPurchases)}</div>
                    <div className={styles.cellCaption}>total das compras deste mês</div>
                </div>
                <div className={styles.cell}>
                    <div className={styles.cellLabel}>Em aberto</div>
                    <div className={styles.cellValue}>{pendingCount}</div>
                    <div className={styles.cellCaption}>ainda não quitados por inteiro</div>
                </div>
                <div className={styles.cell}>
                    <div className={styles.cellLabel}>Pagos</div>
                    <div className={styles.cellValue}>{paidCount}</div>
                    <div className={styles.cellCaption}>todas as pernas quitadas</div>
                </div>
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
                            <Button
                                onClick={() => {
                                    setStatus(null);
                                    setKind(null);
                                    setIdCategory(null);
                                }}
                            >
                                Limpar filtros
                            </Button>
                        ) : (
                            <Button variant="primary" onClick={() => navigate("/gastos/novo")}>
                                <IconPlus />
                                Adicionar gasto
                            </Button>
                        )
                    }
                />
            ) : (
                <Table columns="minmax(0,1.6fr) 130px minmax(0,1fr) 120px 150px">
                    <TableHead>
                        <span>Gasto</span>
                        <span>Data</span>
                        <span>Categoria</span>
                        <span>Status</span>
                        <span style={{ textAlign: "right" }}>Valor</span>
                    </TableHead>

                    {grouped.map((group) => {
                        const groupLive = group.items.filter(isLive);
                        return (
                            <div key={group.kind}>
                                <TableGroup
                                    title={KIND_LABEL[group.kind]}
                                    icon={KIND_ICON[group.kind]}
                                    count={group.items.length}
                                    pending={groupLive.filter((e) => e.Status === "pending").length}
                                    total={formatMoney(
                                        sumMoney(groupLive.map((e) => e.TotalValue)),
                                    )}
                                />
                                {group.items.map((row) => {
                                    const category = categoryIndex.get(row.IdCategory);
                                    const color = category
                                        ? categoryColor(category)
                                        : "var(--ink-3)";
                                    const leg = impliedLeg(row);

                                    return (
                                        <TableRow
                                            key={row.IdExpense}
                                            onClick={() => setOpenExpense(row.IdExpense)}
                                            selected={openExpense === row.IdExpense}
                                            faded={row.Status === "canceled"}
                                        >
                                            <RowTrigger label={`Abrir ${row.Description}`}>
                                                <TypeTile color={color}>
                                                    <CategoryIcon
                                                        iconKey={category?.IconKey ?? null}
                                                    />
                                                </TypeTile>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className={styles.description}>
                                                        {row.Description}
                                                    </div>
                                                    <div className={styles.meta}>
                                                        {row.Kind === "installment"
                                                            ? "Parcelado · abra para ver as parcelas"
                                                            : row.Kind === "fixed"
                                                              ? "Ocorrência de um gasto fixo"
                                                              : leg?.paid
                                                                ? "Quitado"
                                                                : "Em aberto"}
                                                    </div>
                                                </div>
                                            </RowTrigger>

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

                                            <Cell>
                                                <span className={styles.meta}>
                                                    {category?.Description ?? "—"}
                                                </span>
                                            </Cell>

                                            <Cell>
                                                <StatusBadge status={row.Status} />
                                            </Cell>

                                            <CellAmount>{formatMoney(row.TotalValue)}</CellAmount>
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

            <InfoNote>
                Este total é o das <b>compras lançadas neste mês</b>. O que o mês custa de verdade é
                a soma das <b>parcelas</b> que vencem nele — é esse o número do Início, e ele não
                bate com este de propósito.
            </InfoNote>

            {/* ── Detalhe ──────────────────────────────────────── */}
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
                                <span className={styles.sectionHint}>move o saldo</span>
                            </div>
                            <div className={styles.legs}>
                                {expense.Payments.map((leg) => {
                                    const method = methodIndex.get(leg.IdPaymentMethod);
                                    const overdue =
                                        !leg.Paid && leg.DueDate !== null && leg.DueDate < today();

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

                            {expense.Payments.length > 1 && (
                                <InfoNote>
                                    O gasto só fica <b>pago</b> quando todas as parcelas estiverem
                                    quitadas — quitar 1 de {expense.Payments.length} mantém a compra
                                    em aberto.
                                </InfoNote>
                            )}

                            {/* ── Rateio ─────────────────────────── */}
                            {expense.Persons.length > 0 && (
                                <>
                                    <div className={styles.sectionLabel}>
                                        <span>De quem é o custo</span>
                                        <span className={styles.sectionHint}>não move saldo</span>
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
                                <span>Última alteração em {formatDateTime(expense.UpdatedAt)}</span>
                            </div>
                        </>
                    )
                )}
            </SlideOver>

            {/* ── Esta e as seguintes ──────────────────────────── */}
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
                                            setSeriesDraft((c) => (c ? { ...c, TotalValue } : c))
                                        }
                                    />
                                )}
                            </FormField>
                            <FormField label="Categoria" required>
                                {(field) => (
                                    <Select
                                        {...field}
                                        value={seriesDraft.IdCategory ?? ""}
                                        onChange={(event) =>
                                            setSeriesDraft((c) =>
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
                                        {activeCategories.map((category) => (
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
                        </FormGrid>

                        <SplitEditor
                            label="De quem é o custo"
                            hint="Não move saldo"
                            optionLabel="Pessoa"
                            addLabel="Outra pessoa"
                            options={activePersons.map((person) => ({
                                id: person.IdPerson,
                                label: person.Name,
                            }))}
                            lines={seriesDraft.persons}
                            onChange={(persons) =>
                                setSeriesDraft((c) => (c ? { ...c, persons } : c))
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

                        <InfoNote>
                            Data e forma de pagamento não entram aqui: mexer na data moveria cada
                            ocorrência de mês, e a forma se troca ocorrência a ocorrência.
                        </InfoNote>
                    </form>
                )}
            </Modal>

            {/* ── Confirmações ─────────────────────────────────── */}
            <ConfirmDialog
                open={confirming === "cancel"}
                onClose={() => setConfirming(null)}
                onConfirm={() => {
                    setConfirming(null);
                    if (expense) void ExpensesController.cancelExpense(context, expense.IdExpense);
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
                    if (expense) void ExpensesController.cancelSeries(context, expense.IdExpense);
                }}
                title="Encerrar a série?"
                description="Esta ocorrência e todas as posteriores são canceladas. As que já passaram ficam como estão — elas aconteceram."
                confirmLabel="Encerrar série"
                cancelLabel="Voltar"
                danger
                pending={pending}
            />
        </Page>
    );
}
