import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./src/styles.module.css";
import {
    AccountsController,
    type AccountDraft,
    type AccountsContext,
    type CardDraft,
} from "./controller";
import { useMonthScope } from "@/app/monthScope";
import { useSession } from "@/app/session";
import { useAccounts, useInvalidateCatalogs } from "@/data/catalogs";
import { useInvalidateMovement, useMonthStatement } from "@/data/month";
import { Badge, Button, Card, Overline, PageHead, Workspace as Page } from "@/ui/primitives";
import { Topbar } from "@/ui/topbar";
import {
    FormError,
    FormField,
    FormGrid,
    FormNotice,
    Input,
    MoneyInput,
    DateInput,
    SegmentedControl,
} from "@/ui/form";
import { ColorPicker } from "@/ui/controls";
import { ConfirmDialog, FooterSpacer, SlideOver } from "@/ui/overlay";
import { IconArchive, IconBank, IconCard, IconCash, IconEdit, IconPix, IconPlus } from "@/ui/icons";
import {
    Cell,
    CellActions,
    CellAmount,
    CellMute,
    IconButton,
    RowTrigger,
    Table,
    TableHead,
    TableRow,
} from "@/ui/table";
import { CardList, ItemCard } from "@/ui/cardList";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import { totalBalance } from "@/lib/aggregate";
import {
    COMPETENCE_LABEL,
    cycleLabel,
    invoiceOf,
    MAX_DAY_OF_MONTH,
    MIN_DAY_OF_MONTH,
} from "@/lib/card";
import { accentColor } from "@/lib/categoryColor";
import { useIsMobile } from "@/lib/useMediaQuery";
import { formatMoney } from "@/lib/money";
import { currentMonth, formatMonthLabel, formatShort, today } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

const initials = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase();

const TYPE_LABEL: Record<ApiTypes.AccountType, string> = {
    checking: "Conta corrente",
    cash: "Dinheiro",
    card: "Vale",
};

/** O que nasce junto com a conta, por tipo — o texto de ajuda muda com o
 *  seletor porque a resposta muda com ele. */
const TYPE_HELP: Record<ApiTypes.AccountType, string> = {
    checking: "Nasce com uma forma pix e uma de débito. É a única que aceita cartão de crédito.",
    cash: 'Dinheiro na carteira: nasce com uma forma de débito chamada "Dinheiro". Sem cartão.',
    card: "Vale-alimentação: saldo próprio, sem conta bancária atrás e sem fatura. Nasce com uma forma de débito com o nome da conta.",
};

/** Cartão de crédito só existe em conta corrente: `cash` e `card` são
 *  contas de SALDO FECHADO, e uma fatura nelas não teria de onde sair —
 *  o cartão de crédito é uma dívida que vence contra uma conta bancária.
 *  A API responde 406; a tela nem oferece o caminho. */
const acceptsCreditCard = (account: ApiTypes.Account): boolean => account.Type === "checking";

const newAccountDraft = (): AccountDraft => ({
    IdAccount: null,
    Name: "",
    Type: "checking",
    Color: null,
    InitialBalance: 0,
    InitialBalanceDate: today(),
    balanceFrozen: false,
});

/** Nasce sem os dois dias: eles estão escritos na fatura, e chutar um
 *  par plausível aqui só faria o usuário salvar o chute — que é
 *  exatamente o que o modelo da folga fazia. */
const newCardDraft = (idAccount: number): CardDraft => ({
    IdPaymentMethod: null,
    IdAccount: idAccount,
    Name: "",
    ClosingDay: null,
    DueDay: null,
    // O default do SERVIDOR, e não uma escolha nossa diferente da dele:
    // um cartão criado sem tocar no seletor tem que sair igual a um
    // criado sem o campo no corpo.
    CompetenceMode: "purchase",
    Color: null,
});

/** "fecha dia 27 · vence dia 04" — e agora são os dois DIAS, e não as
 *  duas datas da fatura daquele mês.
 *
 *  A tela mostrava datas porque o fechamento andava de mês para mês: ele
 *  era uma subtração, e os meses têm tamanhos diferentes. Com os dois
 *  dias gravados a resposta é a mesma em todos os meses, e mostrá-la com
 *  data do mês exibido faria parecer que ela depende dele. */
const cardCycle = (method: ApiTypes.PaymentMethod): string =>
    `fecha dia ${pad(method.ClosingDay)} · vence dia ${pad(method.DueDay)}`;

const pad = (day: number | null): string => String(day ?? 0).padStart(2, "0");

/** O que foi digitado no campo de dia, como número — ou `null` enquanto
 *  o campo está vazio. Só dígitos entram: o teclado do celular oferece
 *  "-" e "." no `inputMode="numeric"`, e um dia do mês não tem nenhum
 *  dos dois. O intervalo quem confere é o `CycleHint`, junto do
 *  `saveCard`, para a frase da tela e a do envio serem a mesma. */
const dayOrNull = (typed: string): number | null => {
    const digits = typed.replace(/\D/g, "").slice(0, 2);
    return digits === "" ? null : Number(digits);
};

/** O formulário de edição é o cadastro lido de volta, sem conta nenhuma
 *  no meio: os dois dias que a API guarda são os dois dias que a tela
 *  pergunta, e por isso o mês exibido não entra mais aqui. */
const editCardDraft = (method: ApiTypes.PaymentMethod, idAccount: number): CardDraft => ({
    IdPaymentMethod: method.IdPaymentMethod,
    IdAccount: idAccount,
    Name: method.Name,
    ClosingDay: method.ClosingDay,
    DueDay: method.DueDay,
    // `CompetenceMode` é `null` FORA do cartão, e este caminho só abre
    // em cartão — o `??` fecha o tipo, não é leitura defensiva de
    // formato: todo cartão tem modo, inclusive os que existiam antes do
    // campo (o servidor aplicou `purchase` neles).
    CompetenceMode: method.CompetenceMode ?? "purchase",
    Color: method.Color,
});

/** O rascunho de edição de uma conta — a tabela e a lista de cards
 *  abrem o mesmo. `balanceFrozen`: saldo diferente do inicial quer dizer
 *  que já houve lançamento, e aí a API congela o campo.
 *
 *  O PALPITE SÓ VALE NO MÊS CORRENTE. Desde que o `Balance` passou a ser
 *  o saldo de um mês, uma conta aberta em agosto vem com `Balance: 0` em
 *  março — igual ao inicial em nenhum dos dois casos, e diferente dele
 *  em meses em que nada aconteceu. Fora do mês de hoje o campo fica
 *  habilitado e quem recusa é a API, cujo 406 a tela já mostra com a
 *  mensagem do servidor. */
const editDraft = (account: ApiTypes.Account, month: ApiTypes.ReferenceMonth): AccountDraft => ({
    IdAccount: account.IdAccount,
    Name: account.Name,
    Type: account.Type,
    Color: account.Color,
    InitialBalance: account.InitialBalance,
    InitialBalanceDate: account.InitialBalanceDate,
    balanceFrozen: month === currentMonth() && account.Balance !== account.InitialBalance,
});

function MethodChip({ method }: { method: ApiTypes.PaymentMethod }) {
    const icon =
        method.Kind === "credit_card" ? (
            <IconCard />
        ) : method.Kind === "pix" ? (
            <IconPix />
        ) : (
            <IconCash />
        );
    return (
        <span className={styles.method}>
            {icon}
            {method.Name}
        </span>
    );
}

/** O ciclo que os dois dias descrevem, e o aviso de conferência.
 *
 *  Não é mais uma conversão exibida: o cartão guarda exatamente estes
 *  dois números. O que a linha faz é mostrar a CONSEQUÊNCIA deles — se a
 *  fatura é cobrada no mês em que fechou ou no seguinte —, porque é a
 *  única coisa que o modelo infere e é o que separa "fecha 27, vence 04"
 *  de "fecha 05, vence 15".
 *
 *  Sumiu daqui o aviso da leva 6, que dizia em quais dias o fechamento
 *  DERIVADO cairia ao longo do ano: ele existia porque a folga produzia
 *  dias diferentes em meses diferentes, e não há mais deriva sobre a
 *  qual avisar. */
function CycleHint({ draft }: { draft: CardDraft }) {
    if (draft.ClosingDay === null || draft.DueDay === null) {
        return (
            <div className={styles.cycleHint}>
                Os dois dias estão escritos na sua fatura — o app do banco mostra os dois. É assim
                que o cartão é guardado, sem conta nenhuma no meio.
            </div>
        );
    }

    const outOfRange = [draft.ClosingDay, draft.DueDay].some(
        (day) => day < MIN_DAY_OF_MONTH || day > MAX_DAY_OF_MONTH,
    );

    if (outOfRange) {
        return (
            <div className={`${styles.cycleHint} ${styles.cycleHintBad}`}>
                Os dois dias têm que estar entre {MIN_DAY_OF_MONTH} e {MAX_DAY_OF_MONTH}.
            </div>
        );
    }

    /*  A única inferência do modelo, dita em português. Fechando depois
        do dia de vencer, a fatura só pode ser cobrada no mês seguinte ao
        que ela fechou — é o caso do cartão que fecha 27 e vence 04. */
    const nextMonth = draft.ClosingDay > draft.DueDay;

    return (
        <div className={styles.cycleHint}>
            Fecha dia <b>{draft.ClosingDay}</b> e vence dia <b>{draft.DueDay}</b>,{" "}
            {nextMonth ? (
                <>
                    todo mês — e a fatura que fecha num mês é cobrada no <b>mês seguinte</b>.
                </>
            ) : (
                <>
                    todo mês — fechamento e vencimento caem no <b>mesmo mês</b>.
                </>
            )}
        </div>
    );
}

export function Accounts() {
    const isMobile = useIsMobile();
    const { user } = useSession();
    /* O mesmo mês das outras telas: ele recorta o `Balance` de cada
       conta e escolhe a fatura mostrada em cada cartão. Sem ele aqui, o
       total de Contas divergiria do de Início a cada troca de mês. */
    const [month, setMonth] = useMonthScope();
    const accounts = useAccounts();
    /* O extrato do mês, sob a mesma chave de cache que a tela de Extrato
       já buscou: é dele que sai a fatura de cada cartão — quanto vence e
       quanto ainda está só previsto.
       NÃO são as pernas do mês: elas vêm recortadas por competência, e
       num cartão em modo `purchase` a compra de agosto vence em
       setembro. Perguntando por competência e mandando quitar por
       vencimento, a fatura ficava vazia nos dois meses. `Cards` já é o
       par (cartão, vencimento) — o mesmo recorte do `payInvoice`. */
    const statement = useMonthStatement(month);
    /* Uma fatura por cartão no mês, indexada pelo id do cartão. */
    const invoiceByCard = useMemo(
        () => new Map((statement.data?.Cards ?? []).map((card) => [card.IdPaymentMethod, card])),
        [statement.data],
    );
    const invalidateCatalogs = useInvalidateCatalogs();
    const invalidateMovement = useInvalidateMovement();

    const navigate = useNavigate();
    /* O extrato manda para cá com `?IdPaymentMethod=`: a linha "Fatura"
       dele não tem um lançamento único atrás, então o destino do clique
       é o CARTÃO. O cartão mora dentro do painel da conta dele, e é por
       isso que o parâmetro é resolvido em conta antes de abrir. */
    const [urlQuery] = useSearchParams();

    const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
    const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
    const [openAccount, setOpenAccount] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    /* A confirmação de "Desfazer quitação": um clique errado ali tira
       dezenas de pagamentos do saldo de uma vez. */
    const [unpaying, setUnpaying] = useState<{
        idPaymentMethod: number;
        name: string;
        due: ApiTypes.CalendarDate;
    } | null>(null);
    const [archiving, setArchiving] = useState<{
        kind: "account" | "card";
        id: number;
        name: string;
    } | null>(null);

    const context = useMemo<AccountsContext>(
        () => ({
            accountDraft,
            cardDraft,
            beginSubmit() {
                setPending(true);
                setError(null);
                setNotice(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishSubmit() {
                setPending(false);
                invalidateCatalogs();
            },
            finishInvoice(message) {
                setPending(false);
                setNotice(message);
                // Uma fatura mexe em dezenas de pernas, no `Status` de
                // dezenas de gastos e no saldo da conta — que é somado a
                // cada leitura, em todos os meses em cache.
                invalidateMovement();
            },
            closeAccountForm: () => setAccountDraft(null),
            closeCardForm: () => setCardDraft(null),
        }),
        [accountDraft, cardDraft, invalidateCatalogs, invalidateMovement],
    );

    const active = (accounts.data ?? []).filter((account) => account.Active);
    const balance = totalBalance(active);
    const largest = [...active].sort((a, b) => b.Balance - a.Balance)[0];
    const cardCount = active.reduce(
        (count, account) =>
            count +
            account.PaymentMethods.filter((m) => m.Active && m.Kind === "credit_card").length,
        0,
    );
    /* A conta do cartão pedido na URL. Ela abre o painel enquanto o
       usuário não clicar em outra coisa: `openAccount` continua sendo o
       estado da tela, e a URL só decide a PRIMEIRA. */
    const askedMethod = Number(urlQuery.get("IdPaymentMethod")) || null;
    const askedAccount = askedMethod
        ? ((accounts.data ?? []).find((account) =>
              account.PaymentMethods.some((method) => method.IdPaymentMethod === askedMethod),
          )?.IdAccount ?? null)
        : null;

    const shownAccount = openAccount ?? askedAccount;
    const detail = active.find((account) => account.IdAccount === shownAccount) ?? null;

    /* Fechar o painel LIMPA a URL junto. Sem isso, quem chegou pelo
       extrato fecharia e o `?IdPaymentMethod=` reabriria o painel no
       mesmo instante — o painel que não fecha. */
    const closeAccount = () => {
        setOpenAccount(null);
        if (askedMethod) navigate("/contas", { replace: true });
    };

    return (
        <>
            <Topbar
                greeting={`Olá, ${user.Name.split(/\s+/)[0]}`}
                month={month}
                onMonthChange={setMonth}
                actions={
                    <>
                        {/* O botão TROCOU DE NOME junto com a rota que
                            o ligou. `GET /Reports/Statement` não é a
                            conciliação do frame B: não importa arquivo
                            do banco, não casa lançamento com lançamento
                            e não tem estado "conciliado". É a abertura
                            do saldo — e chamá-lo de "Conciliar" seria
                            prometer o que a tela não faz. */}
                        <Button onClick={() => navigate("/contas/extrato")}>Extrato</Button>
                        <Button
                            variant="primary"
                            onClick={() => setAccountDraft(newAccountDraft())}
                        >
                            <IconPlus />
                            Nova conta
                        </Button>
                    </>
                }
            />

            <Page>
                <PageHead title="Contas" />

                <div className={styles.summary}>
                    <Card className={styles.total}>
                        <Overline>Saldo em {formatMonthLabel(month)}</Overline>
                        <div className={styles.totalValue}>
                            <span className={styles.totalCurrency}>R$</span>
                            <span className={styles.totalBig}>
                                {formatMoney(balance).replace("R$", "").trim()}
                            </span>
                        </div>
                        <div className={styles.totalCaption}>
                            Somando as {active.length} contas até o último dia do mês · o que está
                            pendente não entra
                        </div>
                    </Card>

                    <Card className={styles.kpi}>
                        <div className={styles.kpiLabel}>Maior conta</div>
                        <div className={styles.kpiValue}>
                            {largest ? formatMoney(largest.Balance) : "—"}
                        </div>
                        <div className={styles.kpiCaption}>
                            {largest?.Name ?? "Nenhuma conta ainda"}
                        </div>
                    </Card>

                    <Card className={styles.kpi}>
                        <div className={styles.kpiLabel}>Cartões de crédito</div>
                        <div className={styles.kpiValue}>{cardCount}</div>
                        <div className={styles.kpiCaption}>Cadastrados dentro das contas</div>
                    </Card>
                </div>

                {accounts.isPending ? (
                    <Card padded={false}>
                        <LoadingRows rows={4} />
                    </Card>
                ) : accounts.isError ? (
                    <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
                ) : active.length === 0 ? (
                    <EmptyState
                        icon={<IconBank />}
                        title="Nenhuma conta ainda"
                        description="A conta nasce com as formas de pagamento do tipo dela: conta corrente com pix e débito, dinheiro e vale com uma forma de débito. O cartão de crédito você cria dentro da conta corrente."
                        action={
                            <Button
                                variant="primary"
                                onClick={() => setAccountDraft(newAccountDraft())}
                            >
                                <IconPlus />
                                Criar a primeira conta
                            </Button>
                        }
                    />
                ) : isMobile ? (
                    <CardList>
                        {active.map((account) => (
                            <ItemCard
                                key={account.IdAccount}
                                onClick={() => setOpenAccount(account.IdAccount)}
                                label={`Abrir ${account.Name}`}
                                title={
                                    <>
                                        <span
                                            className={styles.mark}
                                            style={{ background: accentColor(account.Color) }}
                                        >
                                            {initials(account.Name)}
                                        </span>
                                        {account.Name}
                                    </>
                                }
                                badges={<Badge>{TYPE_LABEL[account.Type]}</Badge>}
                                meta={account.PaymentMethods.filter((method) => method.Active).map(
                                    (method) => (
                                        <MethodChip key={method.IdPaymentMethod} method={method} />
                                    ),
                                )}
                                amount={formatMoney(account.Balance)}
                                trailing={
                                    <span className={styles.cardActions}>
                                        <IconButton
                                            label="Editar conta"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setAccountDraft(editDraft(account, month));
                                            }}
                                        >
                                            <IconEdit />
                                        </IconButton>
                                        <IconButton
                                            label="Arquivar conta"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setArchiving({
                                                    kind: "account",
                                                    id: account.IdAccount,
                                                    name: account.Name,
                                                });
                                            }}
                                        >
                                            <IconArchive />
                                        </IconButton>
                                    </span>
                                }
                            />
                        ))}

                        <div className={styles.cardFoot}>
                            <span>Total · {active.length} contas</span>
                            <b>{formatMoney(balance)}</b>
                        </div>
                    </CardList>
                ) : (
                    <Table columns="minmax(0,1.4fr) 130px minmax(0,1.1fr) 150px 100px">
                        <TableHead>
                            <span>Conta</span>
                            <span style={{ textAlign: "right" }}>Saldo inicial</span>
                            <span>Formas de pagamento</span>
                            <span style={{ textAlign: "right" }}>Saldo atual</span>
                            <span style={{ textAlign: "right" }}>Ações</span>
                        </TableHead>

                        {active.map((account) => {
                            const color = accentColor(account.Color);
                            return (
                                <TableRow
                                    key={account.IdAccount}
                                    onClick={() => setOpenAccount(account.IdAccount)}
                                    selected={shownAccount === account.IdAccount}
                                >
                                    <RowTrigger label={`Abrir ${account.Name}`}>
                                        <span className={styles.mark} style={{ background: color }}>
                                            {initials(account.Name)}
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <div className={styles.accountName}>{account.Name}</div>
                                            <div className={styles.accountSub}>
                                                {TYPE_LABEL[account.Type]}
                                            </div>
                                        </div>
                                    </RowTrigger>

                                    <CellMute>
                                        <span style={{ display: "block", textAlign: "right" }}>
                                            {formatMoney(account.InitialBalance)}
                                        </span>
                                    </CellMute>

                                    <Cell>
                                        <span className={styles.methods}>
                                            {account.PaymentMethods.filter((m) => m.Active).map(
                                                (method) => (
                                                    <MethodChip
                                                        key={method.IdPaymentMethod}
                                                        method={method}
                                                    />
                                                ),
                                            )}
                                        </span>
                                    </Cell>

                                    <CellAmount>{formatMoney(account.Balance)}</CellAmount>

                                    <CellActions>
                                        <IconButton
                                            label="Editar conta"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setAccountDraft(editDraft(account, month));
                                            }}
                                        >
                                            <IconEdit />
                                        </IconButton>
                                        <IconButton
                                            label="Arquivar conta"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setArchiving({
                                                    kind: "account",
                                                    id: account.IdAccount,
                                                    name: account.Name,
                                                });
                                            }}
                                        >
                                            <IconArchive />
                                        </IconButton>
                                    </CellActions>
                                </TableRow>
                            );
                        })}

                        <TableRow className={styles.totalRow}>
                            <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                                Total · {active.length} contas
                            </span>
                            <span />
                            <span />
                            <CellAmount>{formatMoney(balance)}</CellAmount>
                            <span />
                        </TableRow>
                    </Table>
                )}

                {/* ── Slide-over: cartões da conta ─────────────────── */}
                <SlideOver
                    open={detail !== null}
                    onClose={closeAccount}
                    title={detail?.Name ?? ""}
                    subtitle={
                        detail
                            ? `${TYPE_LABEL[detail.Type]} · saldo ${formatMoney(detail.Balance)}`
                            : undefined
                    }
                    footer={
                        <>
                            <FooterSpacer />
                            <Button onClick={closeAccount}>Fechar</Button>
                            {detail && acceptsCreditCard(detail) && (
                                <Button
                                    variant="primary"
                                    onClick={() => setCardDraft(newCardDraft(detail.IdAccount))}
                                >
                                    <IconPlus />
                                    Novo cartão
                                </Button>
                            )}
                        </>
                    }
                >
                    {detail && (
                        <>
                            <FormError>{error}</FormError>
                            <FormNotice>{notice}</FormNotice>

                            <div className={styles.sectionLabel}>
                                <span>Formas que nasceram com a conta</span>
                            </div>
                            <div className={styles.cards}>
                                {detail.PaymentMethods.filter(
                                    (method) => method.Active && method.Kind !== "credit_card",
                                ).map((method) => (
                                    <div className={styles.card} key={method.IdPaymentMethod}>
                                        <span className={styles.cardMark}>
                                            {method.Kind === "pix" ? <IconPix /> : <IconCash />}
                                        </span>
                                        <div className={styles.cardBody}>
                                            <div className={styles.cardName}>{method.Name}</div>
                                            <div className={styles.cardSub}>
                                                {method.Kind === "pix" ? "Pix" : "Débito"} · move o
                                                saldo no ato
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className={styles.sectionLabel}>
                                <span>Cartões de crédito</span>
                            </div>

                            {!acceptsCreditCard(detail) ? (
                                /* Contas de saldo fechado — dinheiro na
                                   carteira e vale-alimentação — não aceitam
                                   cartão: uma fatura nelas não teria de onde
                                   sair. A API responde 406, e a tela diz por
                                   quê em vez de oferecer o botão. */
                                <EmptyState
                                    inline
                                    icon={<IconCard />}
                                    title="Cartão de crédito só existe em conta corrente"
                                    description={`${TYPE_LABEL[detail.Type]} é conta de saldo fechado: o gasto sai no ato e não há fatura de onde o cartão pudesse ser pago.`}
                                />
                            ) : detail.PaymentMethods.filter(
                                  (method) => method.Active && method.Kind === "credit_card",
                              ).length === 0 ? (
                                <EmptyState
                                    inline
                                    icon={<IconCard />}
                                    title="Nenhum cartão nesta conta"
                                    description="A fatura do cartão é o que faz uma compra de agosto cair no caixa de setembro."
                                />
                            ) : (
                                <div className={styles.cards}>
                                    {detail.PaymentMethods.filter(
                                        (method) => method.Active && method.Kind === "credit_card",
                                    ).map((method) => {
                                        const invoice = invoiceOf(
                                            invoiceByCard.get(method.IdPaymentMethod),
                                            method,
                                            month,
                                        );

                                        return (
                                            <div
                                                className={styles.cardStack}
                                                key={method.IdPaymentMethod}
                                            >
                                                <div className={styles.card}>
                                                    <span
                                                        className={styles.cardMark}
                                                        style={
                                                            method.Color
                                                                ? {
                                                                      background: `${method.Color}1f`,
                                                                      color: method.Color,
                                                                  }
                                                                : undefined
                                                        }
                                                    >
                                                        <IconCard />
                                                    </span>
                                                    <div className={styles.cardBody}>
                                                        <div className={styles.cardName}>
                                                            {method.Name}
                                                        </div>
                                                        {/* Os dois dias do mês, e eles valem em
                                                        TODOS os meses — era a folga que fazia o
                                                        fechamento andar, e por isso a linha
                                                        mostrava a data da fatura do mês exibido. */}
                                                        <div className={styles.cardSub}>
                                                            {cardCycle(method)}
                                                        </div>
                                                        {/* O modo, sem precisar abrir o
                                                        formulário: ele muda o mês em que a
                                                        compra pesa, e é o que explica o
                                                        "Restante" e o "Saldo nas contas"
                                                        do Início discordarem. */}
                                                        {method.CompetenceMode && (
                                                            <div className={styles.cardMode}>
                                                                {
                                                                    COMPETENCE_LABEL[
                                                                        method.CompetenceMode
                                                                    ]
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                    <IconButton
                                                        label="Editar cartão"
                                                        onClick={() =>
                                                            setCardDraft(
                                                                editCardDraft(
                                                                    method,
                                                                    detail.IdAccount,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        <IconEdit />
                                                    </IconButton>
                                                    <IconButton
                                                        label="Arquivar cartão"
                                                        onClick={() =>
                                                            setArchiving({
                                                                kind: "card",
                                                                id: method.IdPaymentMethod,
                                                                name: method.Name,
                                                            })
                                                        }
                                                    >
                                                        <IconArchive />
                                                    </IconButton>
                                                </div>

                                                {/* A FATURA, e é ela que faz o saldo descer. No cartão,
                                                marcar uma compra como paga não tira dinheiro de conta
                                                nenhuma — quem tira é este botão. A fatura não tem id:
                                                ela é (cartão, vencimento), e é esse vencimento que vai
                                                no corpo. */}
                                                <div className={styles.invoice}>
                                                    <div className={styles.invoiceBody}>
                                                        <div className={styles.invoiceLabel}>
                                                            Fatura que vence{" "}
                                                            {formatShort(invoice.due)}
                                                        </div>
                                                        <div className={styles.invoiceValue}>
                                                            {formatMoney(invoice.total)}
                                                        </div>
                                                        {/* De quais compras ela é feita — a
                                                        mesma linha do Extrato, pelo mesmo
                                                        motivo: o ciclo não é o mês, e num
                                                        cartão em `purchase` essas compras
                                                        pesaram no mês em que foram feitas. */}
                                                        <div className={styles.invoiceCycle}>
                                                            {cycleLabel(invoice.cycle)}
                                                        </div>
                                                        <div className={styles.invoiceCaption}>
                                                            {statement.isPending
                                                                ? "Carregando os lançamentos do mês…"
                                                                : invoice.entries.length === 0
                                                                  ? "Nenhum lançamento nesta fatura"
                                                                  : invoice.paid
                                                                    ? `Quitada · ${invoice.entries.length} lançamento${invoice.entries.length === 1 ? "" : "s"}`
                                                                    : /* O gasto no cartão já nasce
                                                                       na fatura, então "conferido"
                                                                       deixou de ser notícia — o que
                                                                       sobra de interessante é o
                                                                       previsto, que é o que o
                                                                       emissor ainda não registrou.
                                                                       Zero previsto não vira linha:
                                                                       é o caso comum. */
                                                                      invoice.expected !== 0
                                                                      ? `${formatMoney(invoice.expected)} previsto · ${invoice.entries.length} lançamento${invoice.entries.length === 1 ? "" : "s"}`
                                                                      : `${invoice.entries.length} lançamento${invoice.entries.length === 1 ? "" : "s"}`}
                                                        </div>
                                                    </div>
                                                    <span className={styles.invoiceActions}>
                                                        {invoice.paid ? (
                                                            <Button
                                                                size="sm"
                                                                disabled={pending}
                                                                onClick={() =>
                                                                    setUnpaying({
                                                                        idPaymentMethod:
                                                                            method.IdPaymentMethod,
                                                                        name: method.Name,
                                                                        due: invoice.due,
                                                                    })
                                                                }
                                                            >
                                                                Desfazer quitação
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="primary"
                                                                disabled={
                                                                    pending ||
                                                                    invoice.entries.length === 0
                                                                }
                                                                title={
                                                                    invoice.entries.length === 0
                                                                        ? "Fatura sem lançamento nenhum não é fatura"
                                                                        : undefined
                                                                }
                                                                onClick={() =>
                                                                    void AccountsController.payInvoice(
                                                                        context,
                                                                        method.IdPaymentMethod,
                                                                        invoice.due,
                                                                    )
                                                                }
                                                            >
                                                                Quitar fatura
                                                            </Button>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </SlideOver>

                {/* ── Slide-over: conta ────────────────────────────── */}
                <SlideOver
                    open={accountDraft !== null}
                    onClose={() => setAccountDraft(null)}
                    title={accountDraft?.IdAccount === null ? "Nova conta" : "Editar conta"}
                    footer={
                        <>
                            <FooterSpacer />
                            <Button onClick={() => setAccountDraft(null)} disabled={pending}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                form="account-form"
                                type="submit"
                                disabled={pending}
                            >
                                {pending ? "Salvando…" : "Salvar conta"}
                            </Button>
                        </>
                    }
                >
                    {accountDraft && (
                        <form
                            id="account-form"
                            onSubmit={(event: FormEvent) => {
                                event.preventDefault();
                                void AccountsController.saveAccount(context);
                            }}
                            style={{ display: "flex", flexDirection: "column", gap: 16 }}
                        >
                            <FormError>{error}</FormError>

                            <FormField label="Nome" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={255}
                                        placeholder="Nubank, Carteira…"
                                        value={accountDraft.Name}
                                        onChange={(event) =>
                                            setAccountDraft((c) =>
                                                c ? { ...c, Name: event.target.value } : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>

                            {/* O tipo decide QUAIS FORMAS DE PAGAMENTO nascem
                                com a conta, e por isso o texto de ajuda muda
                                junto com ele. Congela pela mesma trava do
                                saldo inicial — mesma pergunta ("esta conta tem
                                movimento?"), mesmo 406. */}
                            <FormField
                                label="Tipo"
                                help={
                                    accountDraft.balanceFrozen
                                        ? "Esta conta já tem lançamentos: o tipo dela não pode mais mudar."
                                        : TYPE_HELP[accountDraft.Type]
                                }
                            >
                                {() => (
                                    <SegmentedControl
                                        value={accountDraft.Type}
                                        onChange={(Type) =>
                                            setAccountDraft((c) => (c ? { ...c, Type } : c))
                                        }
                                        ariaLabel="Tipo da conta"
                                        options={[
                                            {
                                                value: "checking",
                                                label: TYPE_LABEL.checking,
                                                disabled: accountDraft.balanceFrozen,
                                            },
                                            {
                                                value: "cash",
                                                label: TYPE_LABEL.cash,
                                                disabled: accountDraft.balanceFrozen,
                                            },
                                            {
                                                value: "card",
                                                label: TYPE_LABEL.card,
                                                disabled: accountDraft.balanceFrozen,
                                            },
                                        ]}
                                    />
                                )}
                            </FormField>

                            <FormGrid columns={2}>
                                <FormField
                                    label="Saldo inicial"
                                    help={
                                        accountDraft.balanceFrozen
                                            ? "Esta conta já tem lançamentos: o saldo inicial não pode mais mudar."
                                            : ""
                                    }
                                >
                                    {(field) => (
                                        <MoneyInput
                                            {...field}
                                            value={accountDraft.InitialBalance}
                                            disabled={accountDraft.balanceFrozen}
                                            onValueChange={(InitialBalance) =>
                                                setAccountDraft((c) =>
                                                    c ? { ...c, InitialBalance } : c,
                                                )
                                            }
                                        />
                                    )}
                                </FormField>

                                <FormField label="Data do saldo inicial">
                                    {(field) => (
                                        <DateInput
                                            {...field}
                                            value={accountDraft.InitialBalanceDate}
                                            disabled={accountDraft.balanceFrozen}
                                            onValueChange={(InitialBalanceDate) =>
                                                setAccountDraft((c) =>
                                                    c ? { ...c, InitialBalanceDate } : c,
                                                )
                                            }
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            <FormField label="Cor">
                                {() => (
                                    <ColorPicker
                                        value={accountDraft.Color}
                                        onChange={(Color) =>
                                            setAccountDraft((c) => (c ? { ...c, Color } : c))
                                        }
                                    />
                                )}
                            </FormField>
                        </form>
                    )}
                </SlideOver>

                {/* ── Slide-over: cartão ───────────────────────────── */}
                <SlideOver
                    open={cardDraft !== null}
                    onClose={() => setCardDraft(null)}
                    title={cardDraft?.IdPaymentMethod === null ? "Novo cartão" : "Editar cartão"}
                    footer={
                        <>
                            <FooterSpacer />
                            <Button onClick={() => setCardDraft(null)} disabled={pending}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                form="card-form"
                                type="submit"
                                disabled={pending}
                            >
                                {pending ? "Salvando…" : "Salvar cartão"}
                            </Button>
                        </>
                    }
                >
                    {cardDraft && (
                        <form
                            id="card-form"
                            onSubmit={(event: FormEvent) => {
                                event.preventDefault();
                                void AccountsController.saveCard(context);
                            }}
                            style={{ display: "flex", flexDirection: "column", gap: 16 }}
                        >
                            <FormError>{error}</FormError>

                            <FormField label="Nome do cartão" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={255}
                                        placeholder="Cartão Roxo"
                                        value={cardDraft.Name}
                                        onChange={(event) =>
                                            setCardDraft((c) =>
                                                c ? { ...c, Name: event.target.value } : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>

                            {/* Os dois dias do mês, como estão escritos na
                            fatura. A tela pedia as duas DATAS da última fatura
                            e derivava delas uma folga em dias — e a folga
                            errava por construção, porque os meses têm tamanhos
                            diferentes. Agora não há conversão: o que se digita
                            é o que a API guarda. */}
                            <FormGrid columns={2}>
                                <FormField label="Dia em que a fatura fecha" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            inputMode="numeric"
                                            maxLength={2}
                                            placeholder="27"
                                            value={cardDraft.ClosingDay ?? ""}
                                            onChange={(event) =>
                                                setCardDraft((c) =>
                                                    c
                                                        ? {
                                                              ...c,
                                                              ClosingDay: dayOrNull(
                                                                  event.target.value,
                                                              ),
                                                          }
                                                        : c,
                                                )
                                            }
                                        />
                                    )}
                                </FormField>
                                <FormField label="Dia em que ela vence" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            inputMode="numeric"
                                            maxLength={2}
                                            placeholder="04"
                                            value={cardDraft.DueDay ?? ""}
                                            onChange={(event) =>
                                                setCardDraft((c) =>
                                                    c
                                                        ? {
                                                              ...c,
                                                              DueDay: dayOrNull(event.target.value),
                                                          }
                                                        : c,
                                                )
                                            }
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            {/* CONFIRA O FECHAMENTO COM A SUA FATURA. Os
                            cartões que existiam antes desta leva foram
                            convertidos de uma folga em dias, e a folga não
                            carrega qual dos dois dias do mês era o certo — a
                            conversão acerta o mês em que ela rodou e pode
                            errar por um dia nos outros. É uma vez por cartão,
                            e um dia de erro aqui é um mês de erro no caixa. */}
                            {cardDraft.IdPaymentMethod !== null && (
                                <FormNotice>
                                    Confira o dia de fechamento com a sua fatura: cartões
                                    cadastrados antes guardavam uma folga em dias, e a conversão
                                    para dia do mês pode ter errado por um dia.
                                </FormNotice>
                            )}

                            {/* A consequência dos dois dias, à vista: em qual
                            mês a fatura é cobrada. */}
                            <CycleHint draft={cardDraft} />

                            {/* A ÚNICA configuração daqui que muda um número já
                            exibido na tela. O `help` mostra a consequência em
                            vez do nome do campo: ninguém escolhe entre
                            "competência da compra" e "competência da fatura",
                            mas todo mundo sabe dizer se paga a fatura inteira
                            todo mês. */}
                            <FormField
                                label="Como você usa esse cartão?"
                                help={
                                    cardDraft.CompetenceMode === "purchase"
                                        ? "As compras diminuem o dinheiro que você pode gastar no mês em que a fatura delas fecha. O que você passar depois do dia do fechamento já conta no mês seguinte."
                                        : "As compras diminuem o dinheiro que você pode gastar no mês em que a fatura delas vence, que é quando você vai pagar por elas."
                                }
                            >
                                {() => (
                                    <SegmentedControl
                                        value={cardDraft.CompetenceMode}
                                        ariaLabel="Como você usa esse cartão?"
                                        onChange={(CompetenceMode) =>
                                            setCardDraft((c) => (c ? { ...c, CompetenceMode } : c))
                                        }
                                        options={[
                                            {
                                                value: "purchase",
                                                label: "Para compras do dia a dia",
                                            },
                                            {
                                                value: "invoice",
                                                label: "Para emergências",
                                            },
                                        ]}
                                    />
                                )}
                            </FormField>

                            {/* Trocar o modo vale para o FUTURO, e a tela diz
                            isso: as datas são congeladas na perna no
                            lançamento. A alternativa seria mês fechado mudando
                            de número sozinho. */}
                            {cardDraft.IdPaymentMethod !== null && (
                                <div className={styles.cycleHint}>
                                    Trocar o modo vale para as compras novas. As datas de cada
                                    parcela são congeladas no lançamento.
                                </div>
                            )}

                            <FormField label="Cor">
                                {() => (
                                    <ColorPicker
                                        value={cardDraft.Color}
                                        onChange={(Color) =>
                                            setCardDraft((c) => (c ? { ...c, Color } : c))
                                        }
                                    />
                                )}
                            </FormField>
                        </form>
                    )}
                </SlideOver>

                <ConfirmDialog
                    open={unpaying !== null}
                    onClose={() => setUnpaying(null)}
                    onConfirm={() => {
                        const target = unpaying;
                        setUnpaying(null);
                        if (!target) return;
                        void AccountsController.payInvoice(
                            context,
                            target.idPaymentMethod,
                            target.due,
                            true,
                        );
                    }}
                    title={`Desfazer a quitação da fatura de ${unpaying?.name ?? ""}?`}
                    description="Todos os lançamentos dessa fatura voltam a pesar no saldo da conta — podem ser dezenas de uma vez. Nenhum gasto é apagado: o que muda é só o estado da fatura."
                    confirmLabel="Desfazer quitação"
                    danger
                    pending={pending}
                />

                <ConfirmDialog
                    open={archiving !== null}
                    onClose={() => setArchiving(null)}
                    onConfirm={() => {
                        const target = archiving;
                        setArchiving(null);
                        if (!target) return;
                        if (target.kind === "account") {
                            void AccountsController.archiveAccount(context, target.id);
                            closeAccount();
                        } else {
                            void AccountsController.archiveCard(context, target.id);
                        }
                    }}
                    title={`Arquivar ${archiving?.name ?? ""}?`}
                    description={
                        archiving?.kind === "account"
                            ? "As formas de pagamento dela são arquivadas junto. Os lançamentos antigos continuam apontando para a conta — o histórico não se perde."
                            : "Ele sai das escolhas de pagamento. As compras já lançadas nele continuam como estão."
                    }
                    confirmLabel="Arquivar"
                    danger
                    pending={pending}
                />
            </Page>
        </>
    );
}
