import { useMemo, useState, type FormEvent } from "react";
import styles from "./src/styles.module.css";
import {
    AccountsController,
    type AccountDraft,
    type AccountsContext,
    type CardDraft,
} from "./controller";
import { useAccounts, useInvalidateCatalogs } from "@/data/catalogs";
import { Button, Card, Overline, PageHead, Workspace as Page } from "@/ui/primitives";
import {
    FormError,
    FormField,
    FormGrid,
    InfoNote,
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
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import { totalBalance } from "@/lib/aggregate";
import { accentColor } from "@/lib/categoryColor";
import { formatMoney } from "@/lib/money";
import { today } from "@/lib/date";
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

const newCardDraft = (idAccount: number): CardDraft => ({
    IdPaymentMethod: null,
    IdAccount: idAccount,
    Name: "",
    ClosingDay: 20,
    DueDay: 27,
    Brand: "",
    LastDigits: "",
    Color: null,
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

export function Accounts() {
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
                                            setAccountDraft({
                                                IdAccount: account.IdAccount,
                                                Name: account.Name,
                                                Type: account.Type,
                                                Color: account.Color,
                                                InitialBalance: account.InitialBalance,
                                                InitialBalanceDate: account.InitialBalanceDate,
                                                // Saldo diferente do inicial = já houve
                                                // lançamento, e a API congela o campo.
                                                balanceFrozen:
                                                    account.Balance !== account.InitialBalance,
                                            });
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

            <InfoNote>
                O saldo é calculado pela API a cada leitura: saldo inicial, mais o que já foi
                recebido, menos as parcelas já quitadas. <b>O que está em aberto não entra</b> — é
                previsão, não dinheiro.
            </InfoNote>

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

                        <InfoNote>
                            Pix e débito nascem com a conta e não se criam nem se apagam pela mão —
                            o contrato só aceita cadastrar cartão de crédito.
                        </InfoNote>

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
                                            <div className={styles.cardName}>
                                                {method.Name}
                                                {method.LastDigits && ` ····${method.LastDigits}`}
                                            </div>
                                            <div className={styles.cardSub}>
                                                {method.Brand ? `${method.Brand} · ` : ""}
                                                fecha dia {method.ClosingDay} · vence dia{" "}
                                                {method.DueDay}
                                            </div>
                                        </div>
                                        <IconButton
                                            label="Editar cartão"
                                            onClick={() =>
                                                setCardDraft({
                                                    IdPaymentMethod: method.IdPaymentMethod,
                                                    IdAccount: detail.IdAccount,
                                                    Name: method.Name,
                                                    ClosingDay: method.ClosingDay ?? 1,
                                                    DueDay: method.DueDay ?? 1,
                                                    Brand: method.Brand ?? "",
                                                    LastDigits: method.LastDigits ?? "",
                                                    Color: method.Color,
                                                })
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
                                        : "Negativo é válido — é o cheque especial."
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

                        {accountDraft.IdAccount === null && (
                            <InfoNote>
                                A conta já nasce com uma forma <b>pix</b> e uma de <b>débito</b>.
                                Cartão de crédito você cadastra depois, abrindo a conta na lista.
                            </InfoNote>
                        )}
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

                        <FormGrid columns={2}>
                            <FormField label="Fecha no dia" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={cardDraft.ClosingDay}
                                        onChange={(event) =>
                                            setCardDraft((c) =>
                                                c
                                                    ? {
                                                          ...c,
                                                          ClosingDay: Number(event.target.value),
                                                      }
                                                    : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>
                            <FormField label="Vence no dia" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={cardDraft.DueDay}
                                        onChange={(event) =>
                                            setCardDraft((c) =>
                                                c
                                                    ? { ...c, DueDay: Number(event.target.value) }
                                                    : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>
                        </FormGrid>

                        <FormGrid columns={2}>
                            <FormField label="Bandeira">
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={100}
                                        placeholder="Mastercard"
                                        value={cardDraft.Brand}
                                        onChange={(event) =>
                                            setCardDraft((c) =>
                                                c ? { ...c, Brand: event.target.value } : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>
                            <FormField label="Últimos 4 dígitos">
                                {(field) => (
                                    <Input
                                        {...field}
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="1234"
                                        value={cardDraft.LastDigits}
                                        onChange={(event) =>
                                            setCardDraft((c) =>
                                                c
                                                    ? {
                                                          ...c,
                                                          LastDigits: event.target.value
                                                              .replace(/\D/g, "")
                                                              .slice(0, 4),
                                                      }
                                                    : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>
                        </FormGrid>

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

                        {cardDraft.IdPaymentMethod !== null && (
                            <InfoNote>
                                O cartão não muda de conta e não vira outro tipo: as duas trocas
                                reescreveriam o significado de todas as compras já lançadas nele.
                            </InfoNote>
                        )}
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
