import { useMemo, useState, type FormEvent } from "react";
import styles from "./src/styles.module.css";
import {
    AccountsController,
    type AccountDraft,
    type AccountsContext,
    type CardDraft,
} from "./controller";
import { useAccounts, useInvalidateCatalogs } from "@/data/catalogs";
import { Badge, Button, Card, Overline, PageHead, Workspace as Page } from "@/ui/primitives";
import {
    FormError,
    FormField,
    FormGrid,
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
    cardCycleFromDates,
    invoiceDates,
    MAX_CLOSING_OFFSET_DAYS,
    MIN_CLOSING_OFFSET_DAYS,
} from "@/lib/card";
import { accentColor } from "@/lib/categoryColor";
import { useIsMobile } from "@/lib/useMediaQuery";
import { formatMoney } from "@/lib/money";
import { currentMonth, formatDate, formatShort, today } from "@/lib/date";
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
};

const newAccountDraft = (): AccountDraft => ({
    IdAccount: null,
    Name: "",
    Type: "checking",
    Color: null,
    InitialBalance: 0,
    InitialBalanceDate: today(),
    balanceFrozen: false,
});

/** Nasce sem as datas: elas são lidas da última fatura, no app do banco,
 *  e chutar um par plausível aqui só faria o usuário salvar o chute. */
const newCardDraft = (idAccount: number): CardDraft => ({
    IdPaymentMethod: null,
    IdAccount: idAccount,
    Name: "",
    ClosingDate: null,
    DueDate: null,
    Color: null,
});

/** "fecha 03 ago · vence 10 ago" — a fatura DAQUELE mês. */
const cardCycle = (method: ApiTypes.PaymentMethod, month: ApiTypes.ReferenceMonth): string => {
    const { closing, due } = invoiceDates(month, method.DueDay, method.ClosingOffsetDays);
    return `fecha ${formatShort(closing)} · vence ${formatShort(due)}`;
};

/** O caminho de volta: o cartão guarda vencimento + folga, e o
 *  formulário fala em datas. `month` é o mês exibido — a fatura de
 *  agosto e a de setembro fecham em dias diferentes. */
const editCardDraft = (
    method: ApiTypes.PaymentMethod,
    idAccount: number,
    month: ApiTypes.ReferenceMonth,
): CardDraft => {
    const { closing, due } = invoiceDates(month, method.DueDay, method.ClosingOffsetDays);
    return {
        IdPaymentMethod: method.IdPaymentMethod,
        IdAccount: idAccount,
        Name: method.Name,
        ClosingDate: closing,
        DueDate: due,
        Color: method.Color,
    };
};

/** O rascunho de edição de uma conta — a tabela e a lista de cards
 *  abrem o mesmo. `balanceFrozen`: saldo diferente do inicial quer dizer
 *  que já houve lançamento, e aí a API congela o campo. */
const editDraft = (account: ApiTypes.Account): AccountDraft => ({
    IdAccount: account.IdAccount,
    Name: account.Name,
    Type: account.Type,
    Color: account.Color,
    InitialBalance: account.InitialBalance,
    InitialBalanceDate: account.InitialBalanceDate,
    balanceFrozen: account.Balance !== account.InitialBalance,
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

/** O que as duas datas do formulário viraram.
 *
 *  O usuário digita datas; a API guarda vencimento + folga. Sem esta
 *  linha, a conversão seria invisível até o cartão já estar salvo — e a
 *  data de fechamento, que muda de mês para mês, pareceria fixa. */
function CycleHint({ draft, month }: { draft: CardDraft; month: ApiTypes.ReferenceMonth }) {
    if (!draft.ClosingDate || !draft.DueDate) {
        return (
            <div className={styles.cycleHint}>
                As duas datas estão na sua última fatura — o app do banco mostra as duas. É delas
                que saem o dia do vencimento e a folga de fechamento do cartão.
            </div>
        );
    }

    const { DueDay, ClosingOffsetDays } = cardCycleFromDates(draft.ClosingDate, draft.DueDate);

    if (
        ClosingOffsetDays < MIN_CLOSING_OFFSET_DAYS ||
        ClosingOffsetDays > MAX_CLOSING_OFFSET_DAYS
    ) {
        return (
            <div className={`${styles.cycleHint} ${styles.cycleHintBad}`}>
                A fatura precisa fechar de {MIN_CLOSING_OFFSET_DAYS} a {MAX_CLOSING_OFFSET_DAYS}{" "}
                dias antes de vencer.
            </div>
        );
    }

    const { closing, due } = invoiceDates(month, DueDay, ClosingOffsetDays);

    return (
        <div className={styles.cycleHint}>
            Vence dia <b>{DueDay}</b> e fecha <b>{ClosingOffsetDays} dias antes</b>. A data do
            fechamento muda de mês para mês: a fatura que vence em {formatDate(due)} fecha em{" "}
            {formatDate(closing)}.
        </div>
    );
}

export function Accounts() {
    const isMobile = useIsMobile();
    /* O mês da fatura mostrada nos cartões. Na etapa 2 ele passa a ser o
       do chassi, junto com o saldo por mês. */
    const month = currentMonth();
    const accounts = useAccounts();
    const invalidateCatalogs = useInvalidateCatalogs();

    const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
    const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
    const [openAccount, setOpenAccount] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
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
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishSubmit() {
                setPending(false);
                invalidateCatalogs();
            },
            closeAccountForm: () => setAccountDraft(null),
            closeCardForm: () => setCardDraft(null),
        }),
        [accountDraft, cardDraft, invalidateCatalogs],
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
    const detail = active.find((account) => account.IdAccount === openAccount) ?? null;

    return (
        <Page>
            <PageHead
                title="Contas"
                subtitle={`${active.length} conta${active.length === 1 ? "" : "s"} · saldo calculado a cada leitura`}
                actions={
                    <>
                        {/* Sem rota: a conciliação de extrato não existe no
                            contrato. O botão fica desabilitado e rotulado,
                            porque faz parte da composição do layout. */}
                        <Button disabled title="Ainda sem API">
                            Conciliar extrato
                        </Button>
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

            <div className={styles.summary}>
                <Card className={styles.total}>
                    <Overline>Saldo em todas as contas</Overline>
                    <div className={styles.totalValue}>
                        <span className={styles.totalCurrency}>R$</span>
                        <span className={styles.totalBig}>
                            {formatMoney(balance).replace("R$", "").trim()}
                        </span>
                    </div>
                    <div className={styles.totalCaption}>
                        Somando as {active.length} contas · o que está pendente não entra
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
                    description="Toda conta nasce com uma forma pix e uma de débito. O cartão de crédito você cria dentro dela."
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
                                            setAccountDraft(editDraft(account));
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
                                selected={openAccount === account.IdAccount}
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
                                            setAccountDraft(editDraft(account));
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
                onClose={() => setOpenAccount(null)}
                title={detail?.Name ?? ""}
                subtitle={
                    detail
                        ? `${TYPE_LABEL[detail.Type]} · saldo ${formatMoney(detail.Balance)}`
                        : undefined
                }
                footer={
                    <>
                        <FooterSpacer />
                        <Button onClick={() => setOpenAccount(null)}>Fechar</Button>
                        {detail && (
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

                        {detail.PaymentMethods.filter(
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
                                ).map((method) => (
                                    <div className={styles.card} key={method.IdPaymentMethod}>
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
                                            <div className={styles.cardName}>{method.Name}</div>
                                            {/* Não existe "dia do fechamento": ele é
                                                `DueDay − ClosingOffsetDays` e muda de mês
                                                para mês — então o que se mostra é a fatura
                                                deste mês, com data. */}
                                            <div className={styles.cardSub}>
                                                {cardCycle(method, month)}
                                            </div>
                                        </div>
                                        <IconButton
                                            label="Editar cartão"
                                            onClick={() =>
                                                setCardDraft(
                                                    editCardDraft(method, detail.IdAccount, month),
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
                                ))}
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
                subtitle="Cartão de crédito não é conta — ele é forma de pagamento, e vive dentro dela."
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

                        <FormField label="Tipo">
                            {() => (
                                <SegmentedControl
                                    value={accountDraft.Type}
                                    onChange={(Type) =>
                                        setAccountDraft((c) => (c ? { ...c, Type } : c))
                                    }
                                    ariaLabel="Tipo da conta"
                                    options={[
                                        { value: "checking", label: "Conta corrente" },
                                        { value: "cash", label: "Dinheiro" },
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
                subtitle="Em cartão, um dia de diferença na compra vira um mês de diferença no caixa."
                footer={
                    <>
                        <FooterSpacer />
                        <Button onClick={() => setCardDraft(null)} disabled={pending}>
                            Cancelar
                        </Button>
                        <Button variant="primary" form="card-form" type="submit" disabled={pending}>
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

                        {/* O cartão é descrito por vencimento + folga, mas
                            ninguém sabe a folga de cabeça: o que se lê no app
                            do banco são as duas datas da última fatura. A
                            conversão é `cardCycleFromDates`, em `saveCard`. */}
                        <FormGrid columns={2}>
                            <FormField label="Fechamento da última fatura" required>
                                {(field) => (
                                    <DateInput
                                        {...field}
                                        value={cardDraft.ClosingDate}
                                        onValueChange={(ClosingDate) =>
                                            setCardDraft((c) => (c ? { ...c, ClosingDate } : c))
                                        }
                                    />
                                )}
                            </FormField>
                            <FormField label="Vencimento dessa fatura" required>
                                {(field) => (
                                    <DateInput
                                        {...field}
                                        value={cardDraft.DueDate}
                                        onValueChange={(DueDate) =>
                                            setCardDraft((c) => (c ? { ...c, DueDate } : c))
                                        }
                                    />
                                )}
                            </FormField>
                        </FormGrid>

                        {/* O que foi derivado das duas datas, à vista: o
                            fechamento não é um dia fixo do calendário, e a
                            conta fica auditável em vez de mágica. */}
                        <CycleHint draft={cardDraft} month={month} />

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
                open={archiving !== null}
                onClose={() => setArchiving(null)}
                onConfirm={() => {
                    const target = archiving;
                    setArchiving(null);
                    if (!target) return;
                    if (target.kind === "account") {
                        void AccountsController.archiveAccount(context, target.id);
                        setOpenAccount(null);
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
    );
}
