import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./src/styles.module.css";
import { ExpensesController, type ExpensesContext, type SeriesDraft } from "./controller";
import { useMonthScope } from "@/app/monthScope";
import { useOpenModal } from "@/app/modalRoute";
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
    useMonthExpenses,
    useMonthLegs,
} from "@/data/month";
import { Avatar, Badge, Button, Card, Chip, PageHead, Workspace as Page } from "@/ui/primitives";
import { HideOnMobile, Topbar } from "@/ui/topbar";
import {
    ClearFilters,
    FilterBar,
    FilterChips,
    FilterGroup,
    FilterMultiSelect,
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
import { CardGroup, CardList, ItemCard } from "@/ui/cardList";
import { EmptyState, ErrorState, LoadingRows, StatusBadge } from "@/ui/states";
import {
    isLive,
    legsOfKind,
    sumMoney,
    totalPaid,
    totalPending,
    totalSpent,
    type ExpenseLeg,
} from "@/lib/aggregate";
import { isCardLeg } from "@/lib/card";
import { accentColor, categoryColor } from "@/lib/categoryColor";
import { useIsMobile } from "@/lib/useMediaQuery";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, formatMonthLabel, today } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

const KIND_LABEL: Record<ApiTypes.ExpenseKind, string> = {
    single: "Avulsos",
    installment: "Parcelados",
    fixed: "Fixos",
};

const KIND_ORDER: ApiTypes.ExpenseKind[] = ["fixed", "installment", "single"];

/** O rótulo curto, para o badge do card no mobile — onde não cabe a
 *  linha inteira de "Ocorrência de um gasto fixo". */
const KIND_BADGE: Record<ApiTypes.ExpenseKind, string> = {
    single: "Avulso",
    installment: "Parcelado",
    fixed: "Fixo",
};

/** O status em que a lista nasce: tudo menos cancelado.
 *
 *  A lista do mês agora VEM com os cancelados (ver `useMonthExpenses`),
 *  então "nenhum chip marcado" passou a significar mesmo "tudo,
 *  inclusive cancelado" — e não é isso que se quer ver ao abrir o mês.
 *  O padrão é explícito, e é para ele que "limpar filtros" volta. */
const LIVE_STATUSES: ApiTypes.ExpenseStatus[] = ["pending", "paid"];

/** O status que a URL pode pedir — é como o Início manda "me mostre o
 *  que ficou em aberto" ao clicar no vencido a pagar do mês.
 *
 *  Só na MONTAGEM: daí em diante quem manda são os chips. Reagir à
 *  query depois disso desfaria a escolha do usuário a cada render, e a
 *  URL não é o dono do filtro — ela é a porta de entrada dele. */
function statusesFromUrl(search: URLSearchParams): ApiTypes.ExpenseStatus[] | null {
    const asked = search
        .getAll("status")
        .filter(
            (value): value is ApiTypes.ExpenseStatus =>
                value === "pending" || value === "paid" || value === "canceled",
        );
    return asked.length > 0 ? asked : null;
}

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
    const openModal = useOpenModal();
    const { user } = useSession();

    const isMobile = useIsMobile();

    const [month, setMonth] = useMonthScope();
    /* Os cinco filtros são multi-seleção: ver "em aberto + pago" sem ver
       cancelado, ou duas categorias juntas, é a pergunta que se faz de
       verdade. Vazio = sem recorte. */
    const [urlQuery] = useSearchParams();
    const [statuses, setStatuses] = useState<ApiTypes.ExpenseStatus[]>(
        () => statusesFromUrl(urlQuery) ?? LIVE_STATUSES,
    );
    const [kinds, setKinds] = useState<ApiTypes.ExpenseKind[]>([]);
    const [idCategories, setIdCategories] = useState<number[]>([]);
    const [idPersons, setIdPersons] = useState<number[]>([]);
    const [idMethods, setIdMethods] = useState<number[]>([]);
    const [search, setSearch] = useState("");
    /* Os parcelados em que o usuário pediu para ver o total da compra no
       lugar da parcela do mês. */
    const [revealed, setRevealed] = useState<number[]>([]);
    const [openExpense, setOpenExpense] = useState<number | null>(null);
    const [seriesDraft, setSeriesDraft] = useState<SeriesDraft | null>(null);
    const [confirming, setConfirming] = useState<"cancel" | "cancelSeries" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const expenses = useMonthExpenses(month);
    const monthLegs = useMonthLegs(month);
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

    /* As pernas do mês, indexadas pelo gasto de origem.
       É daqui que a linha da tabela tira destino, forma de pagamento e
       o botão de status — as três coisas que custavam um `get(id)` por
       gasto do mês.

       Uma linha pode não ter perna nenhuma aqui, e isso é correto: a
       lista de compras filtra pela data da COMPRA e a de pernas pela
       data em que ela PESA. Uma compra de 25/08 no cartão que vence em
       27/09 aparece na lista de agosto e tem perna só em setembro. */
    const legsByExpense = useMemo(() => {
        const index = new Map<number, ExpenseLeg[]>();
        for (const leg of monthLegs.legs) {
            const found = index.get(leg.expense.IdExpense);
            if (found) found.push(leg);
            else index.set(leg.expense.IdExpense, [leg]);
        }
        return index;
    }, [monthLegs.legs]);

    /* ── O filtro ──────────────────────────────────────────────
       Um só, aplicado em DOIS conjuntos: a lista de compras (a
       tabela) e as pernas do mês (a faixa de indicadores). São
       universos diferentes de propósito — a parcela 8 de uma compra
       de março pesa em agosto sem estar na lista de agosto —, e é por
       isso que o predicado mora aqui, num lugar só.

       Destino e forma de pagamento vêm da PERNA, que já chegou junto
       com o resto: filtrar por eles não espera mais por requisição
       nenhuma. Uma compra cuja perna cai noutro mês não tem como
       responder aos dois, e por isso não passa nesses filtros. */
    const matches = useMemo(() => {
        const term = search.trim().toLowerCase();

        return (expense: ApiTypes.Expense): boolean => {
            if (statuses.length > 0 && !statuses.includes(expense.Status)) return false;
            if (kinds.length > 0 && !kinds.includes(expense.Kind)) return false;
            if (idCategories.length > 0 && !idCategories.includes(expense.IdCategory)) return false;
            if (term && !expense.Description.toLowerCase().includes(term)) return false;

            if (idPersons.length > 0 || idMethods.length > 0) {
                const found = legsByExpense.get(expense.IdExpense) ?? [];
                if (found.length === 0) return false;
                if (
                    idPersons.length > 0 &&
                    !found[0].persons.some((person) => idPersons.includes(person.IdPerson))
                ) {
                    return false;
                }
                if (
                    idMethods.length > 0 &&
                    !found.some((leg) => idMethods.includes(leg.payment.IdPaymentMethod))
                ) {
                    return false;
                }
            }

            return true;
        };
    }, [search, statuses, kinds, idCategories, idPersons, idMethods, legsByExpense]);

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

    /* "Sem filtro" é o padrão de status, não o vazio: com nenhum chip
       marcado a lista mostraria os cancelados. */
    const defaultStatuses =
        statuses.length === LIVE_STATUSES.length &&
        LIVE_STATUSES.every((value) => statuses.includes(value));

    const hasFilters =
        !defaultStatuses ||
        kinds.length > 0 ||
        idCategories.length > 0 ||
        idPersons.length > 0 ||
        idMethods.length > 0 ||
        search.trim() !== "";

    const clearAll = () => {
        setStatuses(LIVE_STATUSES);
        setKinds([]);
        setIdCategories([]);
        setIdPersons([]);
        setIdMethods([]);
        setSearch("");
    };

    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    const expense = detail.data;

    /* ── O que cada linha precisa saber ────────────────────────
       A tabela e a lista de cards mostram os mesmos dados em formatos
       diferentes. O cálculo mora aqui, uma vez: as duas leem daqui. */
    const rowInfo = (row: ApiTypes.Expense) => {
        const category = categoryIndex.get(row.IdCategory);

        /* As pernas deste gasto que PESAM no mês exibido — o único
           universo em que a linha do mês tem o que dizer. Com mais de
           uma candidata, adivinhar qual quitar seria pior do que não
           oferecer: o botão apaga e diz por quê. */
        const legs = legsByExpense.get(row.IdExpense) ?? [];
        const payable = legs.length === 1 ? legs[0] : null;

        // O rateio é o do GASTO, e vem igual em toda perna dele.
        const persons = legs[0]?.persons ?? [];
        const methods = legs.map((leg) => leg.payment);

        return {
            category,
            color: category ? categoryColor(category) : "var(--ink-3)",
            loaded: !monthLegs.isPending,
            legs,
            payable,
            payReason: monthLegs.isPending
                ? "Carregando as parcelas do mês…"
                : legs.length === 0
                  ? "Nenhuma parcela deste gasto pesa no mês exibido"
                  : legs.length > 1
                    ? "Este gasto tem mais de uma perna no mês — abra o detalhe para escolher"
                    : undefined,
            persons,
            firstPerson: persons.length > 0 ? personIndex.get(persons[0].IdPerson) : undefined,
            methods,
            firstMethod:
                methods.length > 0 ? methodIndex.get(methods[0].IdPaymentMethod) : undefined,
        };
    };

    type RowInfo = ReturnType<typeof rowInfo>;

    /** O valor da linha. Em parcelado é a PARCELA do mês, com "8/12"
     *  embaixo — o total da compra é outra pergunta, e um clique no
     *  próprio valor a responde ali mesmo, sem abrir o painel. */
    const amountOf = (row: ApiTypes.Expense, info: RowInfo) => {
        const leg = info.legs[0];
        const payment = leg?.payment;

        if (row.Kind !== "installment" || !payment?.InstallmentTotal) {
            return formatMoney(row.TotalValue);
        }

        const showTotal = revealed.includes(row.IdExpense);

        return (
            <button
                type="button"
                className={styles.amountReveal}
                title={showTotal ? "Ver a parcela do mês" : "Ver o total da compra"}
                onClick={(event) => {
                    event.stopPropagation();
                    setRevealed((current) =>
                        current.includes(row.IdExpense)
                            ? current.filter((id) => id !== row.IdExpense)
                            : [...current, row.IdExpense],
                    );
                }}
            >
                <span>{formatMoney(showTotal ? row.TotalValue : leg.value)}</span>
                <span className={styles.amountCaption}>
                    {showTotal
                        ? "total da compra"
                        : `${payment.InstallmentNumber}/${payment.InstallmentTotal}`}
                </span>
            </button>
        );
    };

    /** O botão de status, em TODA linha não cancelada.
     *
     *  Ele afirma coisas DIFERENTES conforme a forma de pagamento, e por
     *  isso troca de rótulo: fora do cartão diz "quitar" e o dinheiro sai
     *  da conta; no cartão diz "entrou na fatura" e não move saldo
     *  nenhum — quem faz o saldo descer é "Quitar fatura", na tela de
     *  Contas. O botão não some: ele para de mentir. */
    const payButtonOf = (row: ApiTypes.Expense, info: RowInfo) => {
        if (row.Status === "canceled") return null;

        const payment = info.payable?.payment ?? null;
        const card = payment !== null && isCardLeg(payment);

        return (
            <span onClick={(event) => event.stopPropagation()}>
                <PayButton
                    paid={(card ? payment.Charged : payment?.Paid) ?? row.Status === "paid"}
                    disabled={payment === null}
                    reason={info.payReason}
                    pending={pending}
                    label={card ? "Entrou na fatura" : "Quitar"}
                    doneLabel={card ? "Desmarcar da fatura" : "Desfazer quitação"}
                    onToggle={() => {
                        if (!payment) return;
                        void ExpensesController.toggleLegPayment(context, payment);
                    }}
                />
            </span>
        );
    };

    return (
        <>
            <Topbar
                greeting={`Olá, ${user.Name.split(/\s+/)[0]}`}
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
                            {/* Os cancelados agora VÊM na lista do mês
                                (ver `useMonthExpenses`), então este
                                grupo os esconde e os mostra sem nova
                                consulta — e "em aberto + pago" deixou de
                                obrigar a escolher um dos dois. */}
                            <FilterChips
                                values={statuses}
                                onChange={setStatuses}
                                allLabel="Todos"
                                options={[
                                    { value: "pending" as const, label: "Em aberto" },
                                    { value: "paid" as const, label: "Pagos" },
                                    { value: "canceled" as const, label: "Cancelados" },
                                ]}
                            />
                        </FilterGroup>

                        <FilterMultiSelect
                            values={kinds}
                            onChange={setKinds}
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

                        <FilterMultiSelect
                            values={idCategories}
                            onChange={setIdCategories}
                            ariaLabel="Categoria"
                            allLabel="Todas as categorias"
                            options={activeCategories.map((category) => ({
                                value: category.IdCategory,
                                label: category.Description,
                                icon: <CategoryIcon iconKey={category.IconKey} />,
                                color: categoryColor(category),
                            }))}
                        />

                        <FilterMultiSelect
                            values={idPersons}
                            onChange={setIdPersons}
                            ariaLabel="Pessoa"
                            allLabel="Todas as pessoas"
                            options={activePersons.map((person) => ({
                                value: person.IdPerson,
                                label: person.Name,
                            }))}
                        />

                        <FilterMultiSelect
                            values={idMethods}
                            onChange={setIdMethods}
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
                                <Button variant="primary" onClick={() => openModal("/gastos/novo")}>
                                    <IconPlus />
                                    Novo gasto
                                </Button>
                            )
                        }
                    />
                ) : isMobile ? (
                    /* Cada grupo é uma `CardList` — a lista de cards é a
                       forma que a tabela toma no telefone, e os
                       cabeçalhos de Fixos/Parcelados/Avulsos continuam
                       separando os três. */
                    <div>
                        {grouped.map((group) => {
                            const groupLive = group.items.filter(isLive);
                            return (
                                <div key={group.kind}>
                                    <CardGroup
                                        title={KIND_LABEL[group.kind]}
                                        meta={`${group.items.length} · ${formatMoney(
                                            sumMoney(groupLive.map((e) => e.TotalValue)),
                                        )}`}
                                    />
                                    <CardList>
                                        {group.items.map((row) => {
                                            const info = rowInfo(row);
                                            return (
                                                <ItemCard
                                                    key={row.IdExpense}
                                                    onClick={() => setOpenExpense(row.IdExpense)}
                                                    faded={row.Status === "canceled"}
                                                    label={`Abrir ${row.Description}`}
                                                    title={row.Description}
                                                    badges={<Badge>{KIND_BADGE[row.Kind]}</Badge>}
                                                    meta={
                                                        <>
                                                            <StatusBadge status={row.Status} />
                                                            {info.category && (
                                                                <Chip>
                                                                    <span
                                                                        className={styles.chipIcon}
                                                                        style={{
                                                                            color: info.color,
                                                                        }}
                                                                    >
                                                                        <CategoryIcon
                                                                            iconKey={
                                                                                info.category
                                                                                    .IconKey
                                                                            }
                                                                        />
                                                                    </span>
                                                                    {info.category.Description}
                                                                </Chip>
                                                            )}
                                                            {info.firstPerson && (
                                                                <Chip>
                                                                    {info.firstPerson.Name}
                                                                    {info.persons.length > 1 &&
                                                                        ` +${info.persons.length - 1}`}
                                                                </Chip>
                                                            )}
                                                            <span className={styles.meta}>
                                                                {formatDate(row.ExpenseDate)}
                                                            </span>
                                                        </>
                                                    }
                                                    amount={amountOf(row, info)}
                                                    trailing={payButtonOf(row, info)}
                                                />
                                            );
                                        })}
                                    </CardList>
                                </div>
                            );
                        })}

                        <div className={styles.cardFoot}>
                            <span>
                                {live.length} lançamento{live.length === 1 ? "" : "s"} em{" "}
                                {formatMonthLabel(month)}
                            </span>
                            <span>
                                Total lançado <b>{formatMoney(totalPurchases)}</b>
                            </span>
                        </div>
                    </div>
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
                                        const info = rowInfo(row);

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
                                                                ? "Parcelado"
                                                                : row.Kind === "fixed"
                                                                  ? "Ocorrência de um gasto fixo"
                                                                  : "Compra à vista"}
                                                        </div>
                                                    </div>
                                                </RowTrigger>

                                                <Cell>
                                                    {info.category ? (
                                                        <Chip>
                                                            <span
                                                                className={styles.chipIcon}
                                                                style={{ color: info.color }}
                                                            >
                                                                <CategoryIcon
                                                                    iconKey={info.category.IconKey}
                                                                />
                                                            </span>
                                                            {info.category.Description}
                                                        </Chip>
                                                    ) : (
                                                        <span className={styles.meta}>—</span>
                                                    )}
                                                </Cell>

                                                <Cell>
                                                    {info.persons.length === 0 ? (
                                                        <span className={styles.meta}>
                                                            {info.loaded ? "—" : ""}
                                                        </span>
                                                    ) : (
                                                        <span className={styles.who}>
                                                            <Avatar
                                                                name={info.firstPerson?.Name ?? "?"}
                                                                size={22}
                                                            />
                                                            <span className={styles.whoName}>
                                                                {info.firstPerson?.Name ??
                                                                    "Arquivada"}
                                                                {info.persons.length > 1 &&
                                                                    ` +${info.persons.length - 1}`}
                                                            </span>
                                                        </span>
                                                    )}
                                                </Cell>

                                                <Cell>
                                                    {info.methods.length === 0 ? (
                                                        <span className={styles.meta}>
                                                            {info.loaded ? "—" : ""}
                                                        </span>
                                                    ) : (
                                                        <span className={styles.who}>
                                                            <TypeTile
                                                                color={
                                                                    info.firstMethod?.method
                                                                        .Color ??
                                                                    info.firstMethod?.account
                                                                        .Color ??
                                                                    "var(--ink-2)"
                                                                }
                                                            >
                                                                {
                                                                    METHOD_ICON[
                                                                        info.firstMethod?.method
                                                                            .Kind ?? "debit"
                                                                    ]
                                                                }
                                                            </TypeTile>
                                                            <span className={styles.whoName}>
                                                                {info.firstMethod
                                                                    ? `${info.firstMethod.account.Name} · ${info.firstMethod.method.Name}`
                                                                    : "Forma arquivada"}
                                                                {info.methods.length > 1 &&
                                                                    ` +${info.methods.length - 1}`}
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

                                                <CellAmount>{amountOf(row, info)}</CellAmount>

                                                <Cell className={styles.statusCell}>
                                                    <StatusBadge status={row.Status} />
                                                    {payButtonOf(row, info)}
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
                                                    openModal(`/gastos/${expense.IdExpense}/editar`)
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
                                        const card = isCardLeg(leg);
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
                                                        {/* No cartão, `Charged` e `Paid` são
                                                            fatos diferentes: um diz que a
                                                            cobrança entrou na fatura, o outro
                                                            que a fatura foi paga. */}
                                                        {card &&
                                                            leg.ChargedAt &&
                                                            ` · na fatura desde ${formatDateTime(leg.ChargedAt)}`}
                                                        {leg.PaidAt &&
                                                            (card
                                                                ? ` · fatura quitada ${formatDateTime(leg.PaidAt)}`
                                                                : ` · pago ${formatDateTime(leg.PaidAt)}`)}
                                                        {overdue && " · vencida"}
                                                    </div>
                                                </div>
                                                <span className={styles.legValue}>
                                                    {formatMoney(leg.Value)}
                                                </span>
                                                <PayButton
                                                    paid={card ? leg.Charged === true : leg.Paid}
                                                    disabled={expense.Status === "canceled"}
                                                    pending={pending}
                                                    label={card ? "Entrou na fatura" : "Quitar"}
                                                    doneLabel={
                                                        card
                                                            ? "Desmarcar da fatura"
                                                            : "Desfazer quitação"
                                                    }
                                                    onToggle={() =>
                                                        void ExpensesController.toggleLegPayment(
                                                            context,
                                                            leg,
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
        </>
    );
}
