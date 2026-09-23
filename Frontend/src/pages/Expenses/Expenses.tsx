import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { useExpenseDetail, useInvalidateMovement, useMonthLegs } from "@/data/month";
import { installmentLabel, isLegOverdue, legMatches, legStatus, type LegFilters } from "./src/rows";
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
    totalPaid,
    totalPending,
    totalSpent,
    type ExpenseLeg,
} from "@/lib/aggregate";
import { isCardLeg } from "@/lib/card";
import { accentColor, categoryColor } from "@/lib/categoryColor";
import { useIsMobile } from "@/lib/useMediaQuery";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, formatMonthLabel, formatMonthShort, today } from "@/lib/date";
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
 *  A lista do mês VEM com os cancelados (ver `useMonthLegs`), então
 *  "nenhum chip marcado" significa mesmo "tudo, inclusive cancelado" —
 *  e não é isso que se quer ver ao abrir o mês. O padrão é explícito, e
 *  é para ele que "limpar filtros" volta. */
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
    const navigate = useNavigate();
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
    /* O extrato manda para cá com `?IdExpense=`, e é a URL que decide o
       PRIMEIRO painel: depois disso quem manda é o clique na lista. */
    const [openExpense, setOpenExpense] = useState<number | null>(
        () => Number(urlQuery.get("IdExpense")) || null,
    );
    const [seriesDraft, setSeriesDraft] = useState<SeriesDraft | null>(null);
    /* A escolha de cartão do botão "Fatura". Só existe com MAIS DE UM
       cartão: com um só o botão vai direto, porque uma escolha de um
       item é um clique que só tem uma saída possível. */
    const [choosingCard, setChoosingCard] = useState(false);
    const [confirming, setConfirming] = useState<"cancel" | "cancelSeries" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

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
            openInvoiceFor(idPaymentMethod) {
                setChoosingCard(false);
                navigate(`/contas/fatura/${idPaymentMethod}`);
            },
            openCardChoice: () => setChoosingCard(true),
        }),
        [seriesDraft, invalidateMovement, navigate],
    );

    /* Os cartões de crédito ativos do espaço — a lista que o botão
       "Fatura" abre. Sai do cadastro que as telas de saldo já leram
       (`GET /Accounts` traz as formas dentro da conta), então é a mesma
       entrada de cache: nenhuma requisição a mais para desenhar o
       botão. */
    const cards = useMemo(
        () =>
            methods
                .filter((option) => option.method.Kind === "credit_card")
                .map((option) => option.method),
        [methods],
    );

    /* ── O filtro ──────────────────────────────────────────────
       Um só, e agora sobre UM conjunto: a linha da tabela e a faixa de
       indicadores são a mesma perna. Eram dois universos — a tabela
       listava compras e a faixa somava pernas —, e por isso setembro
       dizia "Total: 1.340" com uma tabela que somava 1.240. O predicado
       mora em `src/rows.ts`, sem React, e é testado lá. */
    const filters = useMemo<LegFilters>(
        () => ({ statuses, kinds, idCategories, idPersons, idMethods, search }),
        [statuses, kinds, idCategories, idPersons, idMethods, search],
    );

    /* A LINHA É A PERNA. `allLegs` traz os cancelados junto, porque o
       chip "Cancelados" precisa deles; nenhum total soma sobre ela. */
    const rows = useMemo(
        () => monthLegs.allLegs.filter((leg) => legMatches(leg, filters)),
        [monthLegs.allLegs, filters],
    );

    const grouped = useMemo(
        () =>
            KIND_ORDER.map((groupKind) => ({
                kind: groupKind,
                items: rows.filter((leg) => leg.expense.Kind === groupKind),
            })).filter((group) => group.items.length > 0),
        [rows],
    );

    /* ── Os cinco indicadores ──────────────────────────────────
       Todos somam PERNA, não compra: 600 em 6x custa 100 a este mês, e
       "Parcelados" é a soma das parcelas que vencem nele — não o total
       das compras parceladas em curso.

       É a MESMA lista da tabela, menos os cancelados: é isso que faz a
       soma da coluna fechar com o "Total" do topo ao centavo. */
    const legs: ExpenseLeg[] = useMemo(() => rows.filter((leg) => isLive(leg.expense)), [rows]);

    const total = totalSpent(legs);
    const paid = totalPaid(legs);
    const toPay = totalPending(legs);
    const fixed = totalSpent(legsOfKind(legs, "fixed"));
    const installments = totalSpent(legsOfKind(legs, "installment"));

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
       diferentes. O cálculo mora aqui, uma vez: as duas leem daqui.

       Tudo sai da PERNA, que já chegou completa: a categoria e o rateio
       são do gasto de origem, a forma de pagamento e as duas datas são
       dela. Nenhuma linha espera por requisição nenhuma, e não existe
       mais a linha "sem perna neste mês" — se ela está na lista, é
       porque a perna pesa aqui. */
    const rowInfo = (leg: ExpenseLeg) => {
        const category = categoryIndex.get(leg.expense.IdCategory);
        // O rateio é o do GASTO, e vem igual em toda perna dele.
        const persons = leg.persons;

        return {
            category,
            color: category ? categoryColor(category) : "var(--ink-3)",
            persons,
            firstPerson: persons.length > 0 ? personIndex.get(persons[0].IdPerson) : undefined,
            method: methodIndex.get(leg.payment.IdPaymentMethod),
            status: legStatus(leg),
            overdue: isLegOverdue(leg),
            installment: installmentLabel(leg.payment),
        };
    };

    /** A linha diz de que COMPRA a parcela veio — a data da compra, que
     *  deixou de ser a da coluna de vencimento. Num fixo não há compra a
     *  datar: a ocorrência é o lançamento. */
    const originOf = (leg: ExpenseLeg) =>
        leg.expense.Kind === "fixed"
            ? "Ocorrência de um gasto fixo"
            : `Compra de ${formatDate(leg.expense.ExpenseDate)}`;

    /** O botão de status, em TODA linha não cancelada.
     *
     *  Ele afirma coisas DIFERENTES conforme a forma de pagamento, e por
     *  isso troca de rótulo: fora do cartão diz "quitar" e o dinheiro sai
     *  da conta; no cartão diz "entrou na fatura" e não move saldo
     *  nenhum — quem faz o saldo descer é "Quitar fatura", na tela de
     *  Contas. O botão não some: ele para de mentir.
     *
     *  Ele age na perna DESTA linha, e é só isso: a ambiguidade de "este
     *  gasto tem mais de uma perna no mês" morreu com a lista de
     *  compras. Duas formas de pagamento são duas linhas, cada uma com o
     *  seu botão. */
    const payButtonOf = (leg: ExpenseLeg) => {
        if (!isLive(leg.expense)) return null;

        const payment = leg.payment;
        const card = isCardLeg(payment);

        return (
            <span onClick={(event) => event.stopPropagation()}>
                <PayButton
                    paid={card ? payment.Charged === true : payment.Paid}
                    pending={pending}
                    label={card ? "Entrou na fatura" : "Quitar"}
                    doneLabel={card ? "Desmarcar da fatura" : "Desfazer quitação"}
                    onToggle={() => void ExpensesController.toggleLegPayment(context, payment)}
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
                    <>
                        {/* A FATURA, aqui — e o lugar é a pergunta:
                            quem está olhando os gastos do mês é quem se
                            pergunta quanto foi parar no cartão. Até a
                            leva 9 a resposta só existia descendo por
                            Contas → Extrato → rolar até o cartão, com o
                            mês do chassi recortando a fatura no caminho.

                            Sem cartão nenhum ele não aparece: um botão
                            que abre uma escolha vazia é pior do que não
                            ter botão. Com um só, vai direto — ver
                            `sections/openInvoice.ts`.

                            Ele NÃO é `HideOnMobile`: ao contrário do
                            "Novo gasto", não há FAB nem outro caminho
                            para ele na barra inferior. */}
                        {cards.length > 0 && (
                            <Button onClick={() => ExpensesController.openInvoice(context, cards)}>
                                <IconCard />
                                Fatura
                            </Button>
                        )}

                        {/* No mobile quem lança gasto é o FAB da barra
                            inferior — ver `HideOnMobile`. */}
                        <HideOnMobile>
                            <Button variant="primary" onClick={() => openModal("/gastos/novo")}>
                                <IconPlus />
                                Novo gasto
                            </Button>
                        </HideOnMobile>
                    </>
                }
            />

            <Page>
                {/* Sem dinheiro no subtítulo: ele somava o `TotalValue`
                    das COMPRAS do mês, que com a lista de parcelas não
                    corresponde a nada visível na tela. O número do mês é
                    o "Total" da faixa, logo abaixo, e ele soma a mesma
                    coisa que a tabela. */}
                <PageHead
                    title="Gastos"
                    subtitle={`${formatMonthLabel(month)} · ${legs.length} lançamento${legs.length === 1 ? "" : "s"} no mês`}
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
                            {/* Os cancelados VÊM na lista do mês (ver
                                `useMonthLegs`), então este grupo os
                                esconde e os mostra sem nova consulta — e
                                "em aberto + pago" não obriga a escolher
                                um dos dois.

                                Os três chips falam da PARCELA: "Pagos"
                                em setembro é "a parcela de setembro está
                                quitada", e não "a compra inteira foi
                                paga" — que deixava um parcelado de seis
                                com três quitadas em aberto nos seis
                                meses. "Cancelados" é a exceção, e é do
                                gasto: ver `legStatus`. */}
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

                {monthLegs.isPending ? (
                    <Card padded={false}>
                        <LoadingRows rows={6} />
                    </Card>
                ) : monthLegs.isError ? (
                    <ErrorState error={monthLegs.error} onRetry={monthLegs.refetch} />
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
                            const groupLive = group.items.filter((leg) => isLive(leg.expense));
                            return (
                                <div key={group.kind}>
                                    <CardGroup
                                        title={KIND_LABEL[group.kind]}
                                        meta={`${group.items.length} · ${formatMoney(
                                            totalSpent(groupLive),
                                        )}`}
                                    />
                                    <CardList>
                                        {group.items.map((leg) => {
                                            const info = rowInfo(leg);
                                            return (
                                                <ItemCard
                                                    key={leg.payment.IdExpensePayment}
                                                    onClick={() =>
                                                        setOpenExpense(leg.expense.IdExpense)
                                                    }
                                                    faded={info.status === "canceled"}
                                                    label={`Abrir ${leg.expense.Description}`}
                                                    title={leg.expense.Description}
                                                    badges={
                                                        <>
                                                            <Badge>
                                                                {KIND_BADGE[leg.expense.Kind]}
                                                            </Badge>
                                                            {info.installment && (
                                                                <Badge>{info.installment}</Badge>
                                                            )}
                                                        </>
                                                    }
                                                    meta={
                                                        <>
                                                            <StatusBadge
                                                                status={info.status}
                                                                overdue={info.overdue}
                                                            />
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
                                                            {/* O vencimento DA PERNA, que é a
                                                                data em que o dinheiro sai da
                                                                conta — num cartão, a da
                                                                fatura. */}
                                                            <DueDate warn={info.overdue}>
                                                                {formatDate(leg.payment.CashDate)}
                                                            </DueDate>
                                                        </>
                                                    }
                                                    amount={formatMoney(leg.value)}
                                                    trailing={payButtonOf(leg)}
                                                />
                                            );
                                        })}
                                    </CardList>
                                </div>
                            );
                        })}

                        <div className={styles.cardFoot}>
                            <span>
                                {legs.length} lançamento{legs.length === 1 ? "" : "s"} em{" "}
                                {formatMonthLabel(month)}
                            </span>
                            <span>
                                Total do mês <b>{formatMoney(total)}</b>
                            </span>
                        </div>
                    </div>
                ) : (
                    /* Oito colunas, e a nova é a da PARCELA: sem ela a
                       linha de setembro de uma compra de junho não teria
                       como dizer que é a 3 de 6. */
                    <Table columns="minmax(0,1.4fr) minmax(0,0.95fr) minmax(0,0.85fr) minmax(0,1.1fr) 62px 110px 130px 150px">
                        <TableHead>
                            <span>Descrição</span>
                            <span>Categoria</span>
                            <span>Pessoa</span>
                            <span>Forma de pagamento</span>
                            <span>Parcela</span>
                            <span>Vencimento</span>
                            <span style={{ textAlign: "right" }}>Valor</span>
                            <span>Status</span>
                        </TableHead>

                        {grouped.map((group) => {
                            const groupLive = group.items.filter((leg) => isLive(leg.expense));
                            return (
                                <div key={group.kind}>
                                    <TableGroup
                                        title={KIND_LABEL[group.kind]}
                                        icon={KIND_ICON[group.kind]}
                                        count={group.items.length}
                                        pending={groupLive.filter((leg) => !leg.paid).length}
                                        total={formatMoney(totalSpent(groupLive))}
                                    />
                                    {group.items.map((leg) => {
                                        const info = rowInfo(leg);

                                        return (
                                            <TableRow
                                                key={leg.payment.IdExpensePayment}
                                                onClick={() =>
                                                    setOpenExpense(leg.expense.IdExpense)
                                                }
                                                selected={openExpense === leg.expense.IdExpense}
                                                faded={info.status === "canceled"}
                                            >
                                                <RowTrigger
                                                    label={`Abrir ${leg.expense.Description}`}
                                                >
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className={styles.description}>
                                                            {leg.expense.Description}
                                                        </div>
                                                        <div className={styles.meta}>
                                                            {originOf(leg)}
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
                                                        <span className={styles.meta}>—</span>
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

                                                {/* UMA forma de pagamento, porque a linha é uma
                                                    PERNA: o gasto pago com duas formas são duas
                                                    linhas, cada uma com a sua e com o seu valor —
                                                    que é a razão de o eixo financeiro ser rateio,
                                                    e não um campo. */}
                                                <Cell>
                                                    <span className={styles.who}>
                                                        <TypeTile
                                                            color={
                                                                info.method?.method.Color ??
                                                                info.method?.account.Color ??
                                                                "var(--ink-2)"
                                                            }
                                                        >
                                                            {
                                                                METHOD_ICON[
                                                                    info.method?.method.Kind ??
                                                                        "debit"
                                                                ]
                                                            }
                                                        </TypeTile>
                                                        <span className={styles.whoName}>
                                                            {info.method
                                                                ? `${info.method.account.Name} · ${info.method.method.Name}`
                                                                : "Forma arquivada"}
                                                        </span>
                                                    </span>
                                                </Cell>

                                                <Cell>
                                                    {info.installment ? (
                                                        <span className={styles.installment}>
                                                            {info.installment}
                                                        </span>
                                                    ) : (
                                                        <span className={styles.meta}>—</span>
                                                    )}
                                                </Cell>

                                                {/* A data é a `CashDate` — quando o dinheiro sai
                                                    da conta. Numa perna de cartão ela é o
                                                    vencimento da FATURA: a compra de 10/09 num
                                                    cartão que vence 04/10 só fica vermelha em
                                                    05/10. Comparar com a data da COMPRA pintava a
                                                    linha de vermelho no dia seguinte à compra,
                                                    com a fatura em dia. */}
                                                <Cell>
                                                    <DueDate warn={info.overdue}>
                                                        {formatDate(leg.payment.CashDate)}
                                                    </DueDate>
                                                </Cell>

                                                <CellAmount>{formatMoney(leg.value)}</CellAmount>

                                                <Cell className={styles.statusCell}>
                                                    <StatusBadge
                                                        status={info.status}
                                                        overdue={info.overdue}
                                                    />
                                                    {payButtonOf(leg)}
                                                </Cell>
                                            </TableRow>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* A soma da coluna é o "Total" da faixa do topo,
                            ao centavo: as duas somam a mesma lista de
                            pernas. */}
                        <TableFoot>
                            <span>
                                {legs.length} lançamento{legs.length === 1 ? "" : "s"} em{" "}
                                {formatMonthLabel(month)}
                            </span>
                            <span>
                                Total do mês <b>{formatMoney(total)}</b>
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
                                                        {/* As DUAS datas da perna, e só quando
                                                            elas discordam: num cartão
                                                            `purchase` a compra pesa em agosto
                                                            e sai da conta em 05/09, e uma data
                                                            só não responde às duas perguntas.
                                                            Fora dele as duas são idênticas — e
                                                            é por isso que só agora fez falta
                                                            separá-las. */}
                                                        {leg.CompetenceDate !== leg.CashDate &&
                                                            ` · pesa em ${formatMonthShort(leg.CompetenceDate)}`}
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
                                /* Mesmo eixo, mesma divisão automática do
                                   formulário de gasto. O rateio que já veio
                                   gravado não é mexido: quem nasce com valor
                                   não está intocado. */
                                autoSplit
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

                {/* ── Qual fatura? ─────────────────────────────────
                    Só aparece com MAIS DE UM cartão: dois cartões são
                    duas faturas diferentes, e abrir "a primeira"
                    levaria a pessoa à fatura errada sem dizer que
                    escolheu por ela. Com um só o botão nem passa por
                    aqui — ver `sections/openInvoice.ts`. */}
                <Modal
                    open={choosingCard}
                    onClose={() => setChoosingCard(false)}
                    title="Qual fatura?"
                    subtitle="A fatura é de um cartão, e cada um tem o seu ciclo."
                    footer={
                        <>
                            <FooterSpacer />
                            <Button onClick={() => setChoosingCard(false)}>Cancelar</Button>
                        </>
                    }
                >
                    <div className={styles.cardChoice}>
                        {cards.map((card) => (
                            <button
                                key={card.IdPaymentMethod}
                                type="button"
                                className={styles.cardChoiceRow}
                                onClick={() => context.openInvoiceFor(card.IdPaymentMethod)}
                            >
                                <span
                                    className={styles.cardChoiceMark}
                                    style={
                                        card.Color
                                            ? { background: `${card.Color}1f`, color: card.Color }
                                            : undefined
                                    }
                                >
                                    <IconCard />
                                </span>
                                <span className={styles.cardChoiceBody}>
                                    <span className={styles.cardChoiceName}>{card.Name}</span>
                                    {/* Os dois DIAS do mês, e eles valem
                                        em todo mês: o cartão é descrito
                                        por eles desde a etapa 2. */}
                                    <span className={styles.cardChoiceSub}>
                                        fecha dia {String(card.ClosingDay ?? 0).padStart(2, "0")} ·
                                        vence dia {String(card.DueDay ?? 0).padStart(2, "0")}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
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
