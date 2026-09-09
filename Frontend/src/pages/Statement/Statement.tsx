import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { useMonthScope } from "@/app/monthScope";
import { useSession } from "@/app/session";
import { useMonthStatement } from "@/data/month";
import { Badge, Button, Card, Overline, PageHead, Workspace as Page } from "@/ui/primitives";
import { Topbar } from "@/ui/topbar";
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
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
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

export function Statement() {
    const navigate = useNavigate();
    const { user } = useSession();
    const [month, setMonth] = useMonthScope();

    const statement = useMonthStatement(month);

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

    /* ── A fatura, em DOIS blocos ────────────────────────────
       `Charged` quer dizer "está na fatura", e a perna de cartão já
       nasce assim: lançar num cartão É dizer que a compra vai para a
       fatura dele. O que sobra desmarcado é o caso raro — o emissor
       ainda não registrou —, e é ele que vira o segundo bloco.

       O TOTAL É O DO PRIMEIRO BLOCO. O previsto continua na tela, e
       não some: `payInvoice` quita o CICLO INTEIRO, então essa perna
       sai da conta junto. Uma linha invisível que mesmo assim tira
       dinheiro da conta é exatamente o que um extrato não pode ter. */
    const cardSection = (card: ApiTypes.StatementCard) => (
        <Card
            key={`${card.IdPaymentMethod}-${card.DueDate}`}
            padded={false}
            className={styles.section}
        >
            <div className={styles.sectionHead}>
                <div>
                    <div className={styles.sectionTitle}>
                        <IconCard />
                        {card.Name}
                    </div>
                    <div className={styles.sectionSub}>
                        Fatura com vencimento em {formatDate(card.DueDate)}
                    </div>
                    {/* O QUE ESTA FATURA COBRE, dito na tela.

                        O recorte é o vencimento — é o que uma fatura é —,
                        então a de setembro é feita de compras de agosto.
                        Sem esta linha não há como saber, olhando, se
                        aquelas compras pesam no mês selecionado ou no
                        anterior; e num cartão em `purchase` a resposta é
                        o anterior, que é a diferença que o modo produz e
                        a razão de o "Restante" do Início e o "Saldo nas
                        contas" discordarem. */}
                    <div className={styles.cycle}>
                        <span>{cycleLabel({ start: card.CycleStart, end: card.CycleEnd })}</span>
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
                {Accounts.map(accountSection)}

                {/* A fatura já entrou na conta como UMA linha, acima.
                    Aqui ela é aberta — e não é dupla contagem: é a mesma
                    perna vista dos dois lados. */}
                {Cards.length > 0 && (
                    <>
                        <div className={styles.divider}>
                            <span>Faturas do mês</span>
                        </div>
                        {Cards.map(cardSection)}
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

                {body()}
            </Page>
        </>
    );
}
