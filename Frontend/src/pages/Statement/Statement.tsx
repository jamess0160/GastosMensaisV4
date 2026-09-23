import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { StatementController, type StatementContext } from "./controller";
import { useMonthScope } from "@/app/monthScope";
import { INVOICE_ACTION_LABEL, UNPAY_CONFIRM } from "@/app/payInvoice";
import { useSession } from "@/app/session";
import { useAccounts } from "@/data/catalogs";
import { useInvalidateMovement, useInvoice, useMonthStatement } from "@/data/month";
import { Badge, Button, Card, Overline, PageHead, Workspace as Page } from "@/ui/primitives";
import { Topbar } from "@/ui/topbar";
import { FormError, FormNotice } from "@/ui/form";
import { ConfirmDialog } from "@/ui/overlay";
import { IconArrowDown, IconArrowUp, IconCard, IconTransfer } from "@/ui/icons";
import {
    Cell,
    CellAmount,
    CellMute,
    CellName,
    CellSub,
    RowTrigger,
    Table,
    TableHead,
    TableRow,
} from "@/ui/table";
import { CardGroup, CardList, ItemCard } from "@/ui/cardList";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import { useIsMobile } from "@/lib/useMediaQuery";
import { formatDate, formatMonthLabel } from "@/lib/date";
import { COMPETENCE_LABEL, cycleLabel } from "@/lib/card";
import { formatMoney } from "@/lib/money";
import { sumMoney } from "@/lib/aggregate";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O extrato — a DECOMPOSIÇÃO do saldo que Contas mostra somado.

   Ele NÃO é a conciliação do frame B do layout: não importa arquivo do
   banco, não casa lançamento com lançamento e não tem estado
   "conciliado". Por isso o botão da Topbar de Contas trocou de nome
   junto — "Conciliar extrato" virou "Extrato".

   A tela inteira mora em cima de DUAS assimetrias, e uma tela que as
   ignore fica errada sem ficar quebrada:

                | Conta                   | Cartão
   -------------|-------------------------|------------------------------
    O que é     | o dinheiro que PASSOU   | a FATURA — o que foi comprado
    Estado      | só liquidado            | pago E pendente
    Corte       | CashDate / competência  | o DueDate do ciclo
    Data        | a do lançamento         | a da COMPRA

   E sobre o fechamento: `OpeningBalance` + a soma da coluna =
   `ClosingBalance`, ao centavo. A tela EXIBE o `ClosingBalance` que a
   API afirmou e NUNCA o recalcula somando as linhas — se a soma não
   fechar, é bug da API, e é lá que se conserta.
   ════════════════════════════════════════════════════════════ */

const KIND_LABEL: Record<ApiTypes.StatementEntryKind, string> = {
    opening: "Saldo inicial",
    inflow: "Entrada",
    transfer: "Transferência",
    expense: "Gasto",
    invoice: "Fatura",
};

/** As colunas das duas tabelas, na mesma medida: data, o que foi,
 *  origem/situação e valor. */
const COLUMNS = "104px minmax(220px, 1fr) 140px 150px";

/** O valor com o sinal na frente.
 *
 *  `Value` já vem ASSINADO da API, e é isso que faz conferir o extrato
 *  ser somar a lista. Duas colunas de débito e crédito virariam uma
 *  subtração que alguém escreve ao contrário uma hora — então há uma
 *  coluna só, e o "+" explícito é o que impede a entrada de ser lida
 *  como saída num relance. */
function signed(value: ApiTypes.Money): string {
    return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

const toneOf = (value: ApiTypes.Money) => (value > 0 ? styles.pos : value < 0 ? styles.neg : "");

/** **Quitar a fatura deste bloco** — o gesto que faz o saldo do cartão
 *  descer, na tela em que a fatura aparece.
 *
 *  Componente próprio por causa do `useInvoice`: cada bloco tem o seu, e
 *  um hook dentro de um `map` não é hook.
 *
 *  E por que uma leitura A MAIS, se o bloco já tem as linhas? Porque o
 *  que decide o ROTULO do botão é o `Status`, e ele é derivado pela API
 *  — `open` enquanto o ciclo ainda recebe compras, `closed` depois do
 *  fechamento, `paid` acima dos dois. `GET /Reports/Statement` não o
 *  traz, e derivá-lo aqui seria comparar "hoje" com o fechamento usando
 *  o relógio do navegador, que o usuário mexe. A requisição cai na mesma
 *  entrada de cache da tela da Fatura (`["invoice", cartão,
 *  vencimento]`), então abrir uma depois da outra não pede duas vezes.
 *
 *  Enquanto a resposta não chega, botão nenhum: um "Quitar fatura" que
 *  ainda não sabe se a fatura já está quitada é um convite a pagar duas
 *  vezes. */
function InvoiceAction({
    card,
    pending,
    onPay,
    onUndo,
}: {
    card: ApiTypes.StatementCard;
    pending: boolean;
    onPay: () => void;
    onUndo: () => void;
}) {
    const invoice = useInvoice(card.IdPaymentMethod, card.DueDate);
    const status = invoice.data?.Status;

    if (status === undefined) return null;

    if (status === "paid") {
        return (
            <Button size="sm" disabled={pending} onClick={onUndo}>
                {INVOICE_ACTION_LABEL.paid}
            </Button>
        );
    }

    return (
        <Button size="sm" variant="primary" disabled={pending} onClick={onPay}>
            {pending ? "Quitando…" : INVOICE_ACTION_LABEL[status]}
        </Button>
    );
}

export function Statement() {
    const navigate = useNavigate();
    const { user } = useSession();
    const [month, setMonth] = useMonthScope();
    const isMobile = useIsMobile();

    const statement = useMonthStatement(month);

    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    /* A confirmação de "Desfazer quitação", e só ela confirma: quitar
       registra um pagamento que acabou de acontecer, desfazer devolve
       dezenas de lançamentos ao saldo de um mês que pode já estar
       fechado. */
    const [undoing, setUndoing] = useState<ApiTypes.StatementCard | null>(null);

    const invalidateMovement = useInvalidateMovement();

    const context = useMemo<StatementContext>(
        () => ({
            beginPay() {
                setPending(true);
                setError(null);
                setNotice(null);
            },
            failPay(message) {
                setPending(false);
                setError(message);
            },
            finishPay(message) {
                setPending(false);
                setNotice(message);
                /* INVALIDAR, não recalcular. A fatura quitada muda o
                   `ClosingBalance` deste mesmo extrato, o saldo de
                   Contas e os indicadores de Gastos ao mesmo tempo — e
                   todos eles são somados pela API a cada leitura. */
                invalidateMovement();
            },
        }),
        [invalidateMovement],
    );

    /* De que CONTA é cada cartão.

       A fatura vem do extrato sabendo só o `IdPaymentMethod`, e o nome do
       cartão sozinho não distingue dois "Cartão" de bancos diferentes. A
       ligação já está no cadastro que a tela de Contas leu no mesmo mês
       — `GET /Accounts` traz as formas de pagamento dentro da conta —,
       então isto é a mesma entrada de cache, sem requisição a mais.

       SEM filtrar `Active`, dos dois lados: o extrato lista a fatura do
       cartão arquivado, e a conta arquivada com movimento no mês também
       aparece. Filtrar aqui deixaria justamente essas faturas sem nome
       de banco. */
    const accounts = useAccounts();
    const accountOfCard = useMemo(() => {
        const index = new Map<number, string>();
        for (const account of accounts.data ?? [])
            for (const method of account.PaymentMethods)
                index.set(method.IdPaymentMethod, account.Name);
        return index;
    }, [accounts.data]);

    /* O caminho de volta ao lançamento. QUAIS ids vêm depende do `Kind`,
       e a linha `opening` não tem nenhum — ela não é lançamento, é a
       posição de onde o mês partiu.

       A linha `invoice` é o caso que precisa ser dito: ela não tem um
       lançamento único atrás dela, porque é a soma de um ciclo inteiro.
       O clique dela leva ao CARTÃO, não a um gasto — e o rótulo da
       linha diz isso antes de alguém clicar. */
    const openEntry = (entry: ApiTypes.StatementEntry) => {
        if (entry.IdInflow !== undefined) {
            navigate(`/renda?IdInflow=${entry.IdInflow}`);
            return;
        }
        if (entry.IdExpense !== undefined) {
            navigate(`/gastos?IdExpense=${entry.IdExpense}`);
            return;
        }
        if (entry.IdPaymentMethod !== undefined) {
            navigate(`/contas?IdPaymentMethod=${entry.IdPaymentMethod}`);
        }
    };

    const entryLabel = (entry: ApiTypes.StatementEntry): string | null => {
        if (entry.IdInflow !== undefined) return `Ver a entrada ${entry.Description}`;
        if (entry.IdExpense !== undefined) return `Ver o gasto ${entry.Description}`;
        if (entry.IdPaymentMethod !== undefined) return "Ver o cartão desta fatura";
        return null;
    };

    const kindIcon = (entry: ApiTypes.StatementEntry) => {
        if (entry.Kind === "transfer") return <IconTransfer />;
        if (entry.Kind === "invoice") return <IconCard />;
        return entry.Value >= 0 ? <IconArrowUp /> : <IconArrowDown />;
    };

    const accountSection = (account: ApiTypes.StatementAccount) => (
        <Card key={account.IdAccount} padded={false} className={styles.section}>
            <div className={styles.sectionHead}>
                <div>
                    <div className={styles.sectionTitle}>
                        {account.Name}
                        {/* Arquivada com movimento no mês APARECE, com
                            rótulo: `Active: false` quer dizer "não use
                            mais", não "não existiu". */}
                        {!account.Active && <Badge tone="neutral">Arquivada</Badge>}
                    </div>
                    <div className={styles.sectionSub}>
                        {account.Entries.length === 1
                            ? "1 lançamento liquidado"
                            : `${account.Entries.length} lançamentos liquidados`}
                    </div>
                </div>

                <div className={styles.ends}>
                    <div className={styles.end}>
                        <Overline>Abertura</Overline>
                        <div className={styles.endValue}>{formatMoney(account.OpeningBalance)}</div>
                    </div>
                    <span className={styles.endArrow} aria-hidden="true">
                        →
                    </span>
                    <div className={styles.end}>
                        <Overline>Fechamento</Overline>
                        {/* O número que a API AFIRMOU — o mesmo `Balance`
                            que a tela de Contas mostra para o mês. Não é
                            a soma da coluna feita aqui. */}
                        <div className={`${styles.endValue} ${styles.endStrong}`}>
                            {formatMoney(account.ClosingBalance)}
                        </div>
                    </div>
                </div>
            </div>

            {account.Entries.length === 0 ? (
                <EmptyState
                    inline
                    title="Nenhum movimento neste mês"
                    description={`Nada entrou nem saiu desta conta em ${formatMonthLabel(month)}.`}
                />
            ) : (
                <Table columns={COLUMNS}>
                    <TableHead>
                        <Cell>Data</Cell>
                        <Cell>Lançamento</Cell>
                        <Cell>Origem</Cell>
                        <CellAmount>Valor</CellAmount>
                    </TableHead>

                    {account.Entries.map((entry, index) => {
                        const label = entryLabel(entry);

                        return (
                            <TableRow
                                key={`${account.IdAccount}-${index}`}
                                onClick={label ? () => openEntry(entry) : undefined}
                            >
                                <Cell>
                                    <CellMute>{formatDate(entry.Date)}</CellMute>
                                </Cell>
                                <Cell>
                                    {label ? (
                                        <RowTrigger label={label}>
                                            <CellName>{entry.Description}</CellName>
                                        </RowTrigger>
                                    ) : (
                                        <CellName>{entry.Description}</CellName>
                                    )}
                                </Cell>
                                <Cell>
                                    <span className={styles.kind}>
                                        {kindIcon(entry)}
                                        {KIND_LABEL[entry.Kind]}
                                    </span>
                                </Cell>
                                <CellAmount>
                                    <span className={toneOf(entry.Value)}>
                                        {signed(entry.Value)}
                                    </span>
                                </CellAmount>
                            </TableRow>
                        );
                    })}
                </Table>
            )}
        </Card>
    );

    /* ── A mesma conta, no telefone ──────────────────────────
       A tabela rolava de lado (o `min-width: 640px` de
       `table.module.css`), que é justamente o que Gastos, Renda e
       Contas deixaram de fazer. Aqui ela vira a MESMA lista de cards
       daquelas três — nenhum desenho novo.

       A moldura do card da seção sai junto: os cards das linhas já são
       as caixas, e uma borda em volta delas seria borda dentro de
       borda.

       O que NÃO muda é a ordem, porque é ela que o extrato promete:
       abertura em cima, as linhas no meio e o FECHAMENTO como último
       elemento da conta. Um extrato se confere de cima para baixo, e o
       fechamento no cabeçalho — como no desktop, onde ele cabe ao lado
       da abertura — tiraria o número de onde a soma termina. */
    const accountCards = (account: ApiTypes.StatementAccount) => (
        <div key={account.IdAccount} className={styles.mobileSection}>
            <div className={styles.mobileHead}>
                <div className={styles.sectionTitle}>
                    {account.Name}
                    {!account.Active && <Badge tone="neutral">Arquivada</Badge>}
                </div>
                <div className={styles.sectionSub}>
                    {account.Entries.length === 1
                        ? "1 lançamento liquidado"
                        : `${account.Entries.length} lançamentos liquidados`}
                </div>
                <div className={styles.mobileEnd}>
                    <Overline>Abertura</Overline>
                    <span className={styles.mobileEndValue}>
                        {formatMoney(account.OpeningBalance)}
                    </span>
                </div>
            </div>

            {account.Entries.length === 0 ? (
                <EmptyState
                    title="Nenhum movimento neste mês"
                    description={`Nada entrou nem saiu desta conta em ${formatMonthLabel(month)}.`}
                />
            ) : (
                <CardList>
                    {account.Entries.map((entry, index) => {
                        const label = entryLabel(entry);

                        return (
                            <ItemCard
                                key={`${account.IdAccount}-${index}`}
                                onClick={label ? () => openEntry(entry) : undefined}
                                label={label ?? undefined}
                                title={entry.Description}
                                meta={
                                    <>
                                        <span className={styles.kind}>
                                            {kindIcon(entry)}
                                            {KIND_LABEL[entry.Kind]}
                                        </span>
                                        <span className={styles.meta}>
                                            {formatDate(entry.Date)}
                                        </span>
                                    </>
                                }
                                amount={
                                    <span className={toneOf(entry.Value)}>
                                        {signed(entry.Value)}
                                    </span>
                                }
                            />
                        );
                    })}
                </CardList>
            )}

            {/* O `ClosingBalance` que a API AFIRMOU, e não a soma dos
                cards feita aqui — a mesma regra da tabela. */}
            <div className={styles.mobileFoot}>
                <Overline>Fechamento</Overline>
                <b>{formatMoney(account.ClosingBalance)}</b>
            </div>
        </div>
    );

    /* A tabela de um dos dois grupos da fatura. As colunas são as mesmas
       nos dois: o que muda entre eles é se a linha entra no total. */
    const cardTable = (entries: ApiTypes.StatementCardEntry[]) => (
        <Table columns={COLUMNS}>
            <TableHead>
                <Cell>Compra</Cell>
                <Cell>Descrição</Cell>
                <Cell>Situação</Cell>
                <CellAmount>Valor</CellAmount>
            </TableHead>

            {entries.map((entry) => (
                <TableRow
                    key={entry.IdExpensePayment}
                    onClick={() => navigate(`/gastos?IdExpense=${entry.IdExpense}`)}
                >
                    <Cell>
                        {/* A data da COMPRA, não a do vencimento: é
                            por ela que se reconhece o lançamento. */}
                        <CellMute>{formatDate(entry.Date)}</CellMute>
                    </Cell>
                    <Cell>
                        <RowTrigger label={`Ver o gasto ${entry.Description}`}>
                            <CellName>{entry.Description}</CellName>
                        </RowTrigger>
                        {entry.InstallmentNumber !== null && entry.InstallmentTotal !== null && (
                            <CellSub>
                                Parcela {entry.InstallmentNumber} de {entry.InstallmentTotal}
                            </CellSub>
                        )}
                    </Cell>
                    <Cell>
                        {/* A fatura mostra pago E pendente — é o que
                            foi COMPRADO no ciclo, não o que já saiu
                            da conta. */}
                        <Badge tone={entry.Paid ? "pos" : "neutral"}>
                            {entry.Paid ? "Paga" : "Em aberto"}
                        </Badge>
                    </Cell>
                    <CellAmount>{formatMoney(entry.Value)}</CellAmount>
                </TableRow>
            ))}
        </Table>
    );

    /* Um dos dois grupos da fatura no telefone. O par de `cardTable`:
       mesmo conteúdo, mesma ordem, sem rolagem de lado. */
    const cardCards = (entries: ApiTypes.StatementCardEntry[]) => (
        <CardList>
            {entries.map((entry) => (
                <ItemCard
                    key={entry.IdExpensePayment}
                    onClick={() => navigate(`/gastos?IdExpense=${entry.IdExpense}`)}
                    label={`Ver o gasto ${entry.Description}`}
                    title={entry.Description}
                    badges={
                        <Badge tone={entry.Paid ? "pos" : "neutral"}>
                            {entry.Paid ? "Paga" : "Em aberto"}
                        </Badge>
                    }
                    meta={
                        <span className={styles.meta}>
                            {/* A data da COMPRA, não a do vencimento. */}
                            {formatDate(entry.Date)}
                            {entry.InstallmentNumber !== null &&
                                entry.InstallmentTotal !== null &&
                                ` · parcela ${entry.InstallmentNumber} de ${entry.InstallmentTotal}`}
                        </span>
                    }
                    amount={formatMoney(entry.Value)}
                />
            ))}
        </CardList>
    );

    /* ── A fatura, em DOIS blocos ────────────────────────────
       `Charged` quer dizer "está na fatura", e a perna de cartão já
       nasce assim: lançar num cartão É dizer que a compra vai para a
       fatura dele. O que sobra desmarcado é o caso raro — o emissor
       ainda não registrou —, e é ele que vira o segundo bloco.

       O TOTAL É O DO PRIMEIRO BLOCO. O previsto continua na tela, e
       não some: `payInvoice` quita o CICLO INTEIRO, então essa perna
       sai da conta junto. Uma linha invisível que mesmo assim tira
       dinheiro da conta é exatamente o que um extrato não pode ter. */
    const cardSection = (card: ApiTypes.StatementCard) => {
        const accountName = accountOfCard.get(card.IdPaymentMethod);

        return (
            <Card
                key={`${card.IdPaymentMethod}-${card.DueDate}`}
                padded={false}
                className={styles.section}
            >
                <div className={styles.sectionHead}>
                    <div>
                        {/* O BANCO ANTES DO CARTÃO, como qualquer extrato
                            identifica uma fatura. Dois cartões de nome
                            parecido em bancos diferentes só se distinguem
                            por aqui — e o ícone grande que estava neste
                            lugar ocupava o espaço sem dizer nada: TODA
                            seção desta metade da tela é de um cartão. */}
                        <div className={styles.sectionTitle}>
                            {accountName !== undefined && (
                                <span className={styles.titleAccount}>{accountName}</span>
                            )}
                            {card.Name}
                        </div>
                        <div className={styles.sectionSub}>
                            Fatura com vencimento em {formatDate(card.DueDate)}
                        </div>
                        {/* O QUE ESTA FATURA COBRE, dito na tela.

                            O recorte é o vencimento — é o que uma fatura
                            é —, então a de setembro é feita de compras de
                            agosto. Sem esta linha não há como saber,
                            olhando, se aquelas compras pesam no mês
                            selecionado ou no anterior; e num cartão em
                            `purchase` a resposta é o anterior, que é a
                            diferença que o modo produz e a razão de o
                            "Restante" do Início e o "Saldo nas contas"
                            discordarem. */}
                        <div className={styles.cycle}>
                            <span>
                                {cycleLabel({ start: card.CycleStart, end: card.CycleEnd })}
                            </span>
                            <Badge tone="neutral">{COMPETENCE_LABEL[card.CompetenceMode]}</Badge>
                        </div>
                    </div>

                    <div className={styles.ends}>
                        <div className={styles.end}>
                            <Overline>Total da fatura</Overline>
                            <div className={`${styles.endValue} ${styles.endStrong}`}>
                                {formatMoney(card.Total)}
                            </div>
                        </div>
                        {/* O caminho para a tela da fatura, e ele leva ao
                            CICLO QUE ESTE BLOCO ESTÁ MOSTRANDO — daí o
                            `DueDate` no link. Sem ele o clique cairia na
                            fatura aberta, e quem estava olhando agosto
                            teria que voltar até lá pelas setas. */}
                        <Button
                            size="sm"
                            onClick={() =>
                                navigate(
                                    `/contas/fatura/${card.IdPaymentMethod}?DueDate=${card.DueDate}`,
                                )
                            }
                        >
                            Abrir fatura
                        </Button>
                        {/* E o botão que faz o saldo DESCER, ao lado do
                            total que ele tira da conta. No crédito,
                            marcar uma compra como paga não move dinheiro
                            nenhum — a tela de Gastos recusa quitar perna
                            de cartão com 406 —, e é a fatura inteira que
                            se quita de uma vez. */}
                        <InvoiceAction
                            card={card}
                            pending={pending}
                            onPay={() => void StatementController.payInvoice(context, card)}
                            onUndo={() => setUndoing(card)}
                        />
                    </div>
                </div>

                {card.Entries.length === 0 ? (
                    <EmptyState
                        inline
                        title="Nada nesta fatura ainda"
                        description="Todo o ciclo está marcado como previsto — nenhuma compra foi dada como lançada na fatura."
                    />
                ) : (
                    cardTable(card.Entries)
                )}

                {card.Expected.length > 0 && (
                    <>
                        <div className={styles.group}>
                            <span>Previsto · ainda não apareceu na fatura</span>
                            <span className={styles.groupValue}>
                                {formatMoney(sumMoney(card.Expected.map((entry) => entry.Value)))}
                            </span>
                        </div>
                        {cardTable(card.Expected)}
                    </>
                )}
            </Card>
        );
    };

    /* A mesma fatura, no telefone.
       O total continua NO CABEÇALHO, e não no rodapé como o fechamento
       da conta: ele é o total do PRIMEIRO bloco, e um número depois do
       "Previsto" seria lido como a soma dos dois. */
    const cardMobileSection = (card: ApiTypes.StatementCard) => {
        const accountName = accountOfCard.get(card.IdPaymentMethod);

        return (
            <div key={`${card.IdPaymentMethod}-${card.DueDate}`} className={styles.mobileSection}>
                <div className={styles.mobileHead}>
                    <div className={styles.sectionTitle}>
                        {accountName !== undefined && (
                            <span className={styles.titleAccount}>{accountName}</span>
                        )}
                        {card.Name}
                    </div>
                    <div className={styles.sectionSub}>
                        Fatura com vencimento em {formatDate(card.DueDate)}
                    </div>
                    <div className={styles.cycle}>
                        <span>{cycleLabel({ start: card.CycleStart, end: card.CycleEnd })}</span>
                        <Badge tone="neutral">{COMPETENCE_LABEL[card.CompetenceMode]}</Badge>
                    </div>
                    <div className={styles.mobileEnd}>
                        <Overline>Total da fatura</Overline>
                        <span className={styles.mobileEndValue}>{formatMoney(card.Total)}</span>
                    </div>
                    <div className={styles.cycle}>
                        <Button
                            size="sm"
                            onClick={() =>
                                navigate(
                                    `/contas/fatura/${card.IdPaymentMethod}?DueDate=${card.DueDate}`,
                                )
                            }
                        >
                            Abrir fatura
                        </Button>
                        <InvoiceAction
                            card={card}
                            pending={pending}
                            onPay={() => void StatementController.payInvoice(context, card)}
                            onUndo={() => setUndoing(card)}
                        />
                    </div>
                </div>

                {card.Entries.length === 0 ? (
                    <EmptyState
                        title="Nada nesta fatura ainda"
                        description="Todo o ciclo está marcado como previsto — nenhuma compra foi dada como lançada na fatura."
                    />
                ) : (
                    cardCards(card.Entries)
                )}

                {card.Expected.length > 0 && (
                    <>
                        <CardGroup
                            title="Previsto · ainda não apareceu na fatura"
                            meta={formatMoney(sumMoney(card.Expected.map((entry) => entry.Value)))}
                        />
                        {cardCards(card.Expected)}
                    </>
                )}
            </div>
        );
    };

    const body = () => {
        if (statement.isError) return <ErrorState error={statement.error} />;

        if (statement.isPending) {
            return (
                <Card padded={false}>
                    <LoadingRows rows={8} />
                </Card>
            );
        }

        const { Accounts, Cards } = statement.data;

        if (Accounts.length === 0 && Cards.length === 0) {
            return (
                <EmptyState
                    title="Nada a extratar neste mês"
                    description={`Nenhuma conta teve movimento em ${formatMonthLabel(month)}.`}
                    action={<Button onClick={() => navigate("/contas")}>Ir para Contas</Button>}
                />
            );
        }

        return (
            <>
                {/* Quem escolhe entre a tabela e os cards é
                    `useIsMobile()`, não o CSS — o mesmo critério das
                    outras telas de lista. */}
                {Accounts.map((account) =>
                    isMobile ? accountCards(account) : accountSection(account),
                )}

                {/* A fatura já entrou na conta como UMA linha, acima.
                    Aqui ela é aberta — e não é dupla contagem: é a mesma
                    perna vista dos dois lados. */}
                {Cards.length > 0 && (
                    <>
                        <div className={styles.divider}>
                            <span>Faturas do mês</span>
                        </div>
                        {Cards.map((card) =>
                            isMobile ? cardMobileSection(card) : cardSection(card),
                        )}
                    </>
                )}
            </>
        );
    };

    return (
        <>
            <Topbar
                greeting={`Olá, ${user.Name.split(/\s+/)[0]}`}
                month={month}
                onMonthChange={setMonth}
                actions={<Button onClick={() => navigate("/contas")}>Voltar para Contas</Button>}
            />

            <Page>
                <PageHead
                    title="Extrato"
                    subtitle={`${formatMonthLabel(month)} · a abertura, o que passou e o fechamento de cada conta`}
                />

                {/* O que o extrato NÃO mostra, dito na tela.
                    Quem abre no dia 20 não vê a conta de luz lançada para
                    o dia 25 — e descobrir isso sozinho é o que vira
                    chamado. O custo está aceito; escondê-lo, não. */}
                <div className={styles.notice}>
                    Extrato é o que <b>já aconteceu</b>: a conta mostra só o que foi liquidado, e a
                    fatura mostra o que foi comprado no ciclo. Para o que ainda vai vencer, a tela é{" "}
                    <button
                        type="button"
                        className={styles.noticeLink}
                        onClick={() => navigate("/gastos?status=pending")}
                    >
                        Gastos
                    </button>
                </div>

                {/* O resultado da quitação, com o NÚMERO DE PERNAS que
                    mudaram de estado — é ele que se confere contra o
                    extrato do banco. */}
                <FormError>{error}</FormError>
                <FormNotice>{notice}</FormNotice>

                {body()}

                <ConfirmDialog
                    open={undoing !== null}
                    onClose={() => setUndoing(null)}
                    onConfirm={() => {
                        const target = undoing;
                        setUndoing(null);
                        if (!target) return;
                        void StatementController.payInvoice(context, target, true);
                    }}
                    title={UNPAY_CONFIRM.title(undoing?.Name ?? "")}
                    description={UNPAY_CONFIRM.description}
                    confirmLabel={UNPAY_CONFIRM.confirmLabel}
                    danger
                    pending={pending}
                />
            </Page>
        </>
    );
}
