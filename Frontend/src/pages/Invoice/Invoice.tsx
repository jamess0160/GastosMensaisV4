import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "./src/styles.module.css";
import { InvoiceController, type InvoiceContext } from "./controller";
import { INVOICE_ACTION_LABEL, UNPAY_CONFIRM } from "@/app/payInvoice";
import { useSession } from "@/app/session";
import { useAccounts } from "@/data/catalogs";
import { useInvalidateMovement, useInvoice } from "@/data/month";
import { Badge, Button, Card, Overline, PageHead, Workspace as Page } from "@/ui/primitives";
import { Topbar } from "@/ui/topbar";
import { FormError, FormNotice } from "@/ui/form";
import { ConfirmDialog } from "@/ui/overlay";
import { IconCard, IconChevronLeft, IconChevronRight } from "@/ui/icons";
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
import { formatDate, formatShort } from "@/lib/date";
import { COMPETENCE_LABEL, cycleLabel } from "@/lib/card";
import { formatMoney } from "@/lib/money";
import { sumMoney } from "@/lib/aggregate";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   A FATURA, com tela própria.

   Ela sempre existiu nos dados — todas as pernas de um ciclo
   compartilham o mesmo `DueDate` exato, e é essa tupla
   `(cartão, vencimento)` que o `payInvoice` quita —, mas só aparecia
   DENTRO do Extrato, recortada pelo mês selecionado no chassi. Três
   perguntas comuns não tinham onde ser feitas, e as três têm a mesma
   causa:

        **A FATURA NÃO É UM MÊS.**

   Ela vai de fechamento a fechamento e quase nunca coincide com o mês
   civil. Enquanto ela morava no seletor de mês global, "e a fatura
   passada?" custava trocar o mês da aplicação inteira — o Início, os
   Gastos e o Relatório iam junto, três telas que a pergunta não tinha
   por que mexer. Por isso esta tela **não tem seletor de mês**: ela
   navega por CICLO (‹ anterior · a aberta · próxima ›), e o mês do
   chassi fica exatamente onde estava.

   NENHUMA TABELA NOVA. A fatura continua sendo a consulta que sempre
   foi; o que faltava era a rota que a devolve inteira, com o ciclo, o
   estado derivado e os vizinhos.

   E É AQUI QUE SE QUITA. O `payInvoice` existe desde a leva 6, mas só
   tinha botão no card do cartão em Contas, recortado pelo mês do
   chassi — enquanto a tela de Gastos recusa quitar perna de cartão
   (406, "perna de cartão de crédito é quitada com a fatura"). A única
   operação que faz o saldo do cartão descer não tinha botão na tela em
   que a fatura aparece inteira; agora tem, ao lado do total que ela vai
   tirar da conta.
   ════════════════════════════════════════════════════════════ */

/** O estado da fatura, em uma palavra e com a cor certa.
 *
 *  Ele é DERIVADO pela API e não se recalcula aqui: comparar "hoje" com
 *  o fechamento no cliente seria a segunda implementação da mesma
 *  pergunta — e a que usa o relógio do navegador, que o usuário mexe. */
const STATUS: Record<ApiTypes.InvoiceStatus, { label: string; tone: "pos" | "brand" | "neutral" }> =
    {
        open: { label: "Aberta", tone: "brand" },
        closed: { label: "Fechada", tone: "neutral" },
        paid: { label: "Quitada", tone: "pos" },
    };

/** As colunas da tabela: compra, descrição, situação e valor — as
 *  mesmas medidas do Extrato, porque é a mesma linha. */
const COLUMNS = "104px minmax(220px, 1fr) 140px 150px";

export function Invoice() {
    const navigate = useNavigate();
    const { user } = useSession();
    const isMobile = useIsMobile();

    const params = useParams();
    const idPaymentMethod = Number(params.idPaymentMethod) || null;

    /* O `?DueDate=` do link. É por ele que o bloco do cartão no Extrato
       manda para O CICLO QUE ELE ESTAVA MOSTRANDO — sem isso o link
       cairia sempre na fatura aberta, e quem clicou numa fatura de
       agosto teria que voltar até ela pelas setas.

       Ele decide só a PRIMEIRA: depois, quem manda é o estado da tela. */
    const [urlQuery] = useSearchParams();
    const asked = urlQuery.get("DueDate");

    const [due, setDue] = useState<ApiTypes.CalendarDate | null>(asked);

    const invoice = useInvoice(idPaymentMethod, due);

    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    /* A confirmação de "Desfazer quitação" — e só ela confirma. Quitar
       registra um pagamento que a pessoa acabou de fazer e se desfaz com
       um clique; desfazer devolve dezenas de lançamentos ao saldo de um
       mês que pode já estar fechado. */
    const [confirmingUndo, setConfirmingUndo] = useState(false);

    const invalidateMovement = useInvalidateMovement();

    const context = useMemo<InvoiceContext>(
        () => ({
            due,
            showCycle: setDue,
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
                /* INVALIDAR, não recalcular. Uma fatura quitada mexe no
                   saldo da conta, nos indicadores do Início, no extrato e
                   no `Status` de dezenas de gastos ao mesmo tempo — e o
                   saldo é somado pela API a cada leitura. Ajustar
                   qualquer um desses números aqui seria a segunda conta,
                   a que fica plausível e errada. */
                invalidateMovement();
            },
        }),
        [due, invalidateMovement],
    );

    /* De que CONTA é o cartão. A fatura já traz o `IdAccount`, e o nome
       sai do cadastro que as telas de saldo já leram — mesma entrada de
       cache, sem requisição a mais. SEM filtrar `Active`: o cartão
       arquivado continua tendo tido faturas, e a conta dele também. */
    const accounts = useAccounts();
    const accountName = useMemo(
        () =>
            (accounts.data ?? []).find((account) => account.IdAccount === invoice.data?.IdAccount)
                ?.Name,
        [accounts.data, invoice.data],
    );

    const entryTable = (entries: ApiTypes.StatementCardEntry[]) => (
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
                        {/* A data da COMPRA, não a do vencimento: é por
                            ela que se reconhece a linha ao conferir com
                            o app do cartão. */}
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
                        {/* Pago E pendente juntos: a fatura é o que foi
                            COMPRADO no ciclo, não o que já saiu da
                            conta. */}
                        <Badge tone={entry.Paid ? "pos" : "neutral"}>
                            {entry.Paid ? "Paga" : "Em aberto"}
                        </Badge>
                    </Cell>
                    <CellAmount>{formatMoney(entry.Value)}</CellAmount>
                </TableRow>
            ))}
        </Table>
    );

    /** A mesma lista no telefone: mesmo conteúdo, mesma ordem, sem
     *  rolagem de lado. */
    const entryCards = (entries: ApiTypes.StatementCardEntry[]) => (
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

    /* ── A navegação por ciclo ───────────────────────────────
       O que substitui o seletor de mês nesta tela, e o motivo de ela
       existir. As pontas vêm da API: `PreviousDueDate`/`NextDueDate`
       nulos desabilitam a seta em vez de deixá-la levar a lugar
       nenhum. */
    const cycleNav = (data: ApiTypes.Invoice) => (
        <div className={styles.nav}>
            <Button
                size="sm"
                disabled={data.PreviousDueDate === null}
                title={
                    data.PreviousDueDate === null
                        ? "Não há fatura anterior neste cartão"
                        : `Fatura de ${formatShort(data.PreviousDueDate)}`
                }
                onClick={() => InvoiceController.goToCycle(context, data, -1)}
            >
                <IconChevronLeft />
                Anterior
            </Button>

            <Button
                size="sm"
                variant={due === null ? "primary" : "default"}
                disabled={due === null}
                title="A fatura que está aberta hoje"
                onClick={() => InvoiceController.goToOpenCycle(context)}
            >
                A aberta
            </Button>

            <Button
                size="sm"
                disabled={data.NextDueDate === null}
                title={
                    data.NextDueDate === null
                        ? "Não há fatura seguinte neste cartão"
                        : `Fatura de ${formatShort(data.NextDueDate)}`
                }
                onClick={() => InvoiceController.goToCycle(context, data, 1)}
            >
                Próxima
                <IconChevronRight />
            </Button>
        </div>
    );

    /* ── Quitar ──────────────────────────────────────────────
       **É este botão que faz o saldo do cartão descer.** No crédito,
       marcar uma compra como paga não tira dinheiro de conta nenhuma —
       a tela de Gastos recusa quitar perna de cartão de propósito, com
       406 —, e quem tira é o pagamento da fatura inteira, que quita o
       ciclo de uma vez: um cartão concentrador tem 40 compras, e
       ninguém marca 40.

       O RÓTULO DIZ O QUE A FATURA É (ver `INVOICE_ACTION_LABEL`): numa
       fatura ainda aberta ele vem com a ressalva em vez de sumir, porque
       pagar adiantado — ou registrar hoje o pagamento já feito no app do
       banco — é legítimo e acontece.

       Desabilitado só quando não há ciclo nenhum: fatura sem perna não é
       fatura paga, é fatura que não existe, e a API responde 406. O
       PREVISTO conta para habilitar — ele fica fora do total, mas sai da
       conta junto quando a fatura é quitada. */
    const payButton = (data: ApiTypes.Invoice) => {
        if (data.Status === "paid") {
            return (
                <Button size="sm" disabled={pending} onClick={() => setConfirmingUndo(true)}>
                    {INVOICE_ACTION_LABEL.paid}
                </Button>
            );
        }

        const empty = data.Entries.length === 0 && data.Expected.length === 0;

        return (
            <Button
                size="sm"
                variant="primary"
                disabled={pending || empty}
                title={empty ? "Fatura sem lançamento nenhum não é fatura" : undefined}
                onClick={() => void InvoiceController.payInvoice(context, data)}
            >
                {pending ? "Quitando…" : INVOICE_ACTION_LABEL[data.Status]}
            </Button>
        );
    };

    /* ── O rodapé: as próximas faturas ───────────────────────
       Os vencimentos depois deste que JÁ TÊM parcela marcada, com o
       total de cada um. É o que responde "quanto do meu mês que vem já
       está comprometido" — e sai de graça, porque as pernas futuras de
       um parcelamento estão gravadas desde o lançamento dele.

       Zero não vira bloco: "nenhuma parcela lançada para a frente" é o
       caso comum de quem não parcela, e uma seção vazia só ocuparia a
       tela. */
    const upcoming = (data: ApiTypes.Invoice) =>
        data.Upcoming.length > 0 && (
            <Card padded={false} className={styles.section}>
                <div className={styles.sectionHead}>
                    <div>
                        <div className={styles.sectionTitle}>Próximas faturas</div>
                        <div className={styles.sectionSub}>
                            O que já está vendido em parcela nos ciclos seguintes
                        </div>
                    </div>
                    <div className={styles.end}>
                        <Overline>Total comprometido</Overline>
                        <div className={styles.endValue}>
                            {formatMoney(sumMoney(data.Upcoming.map((item) => item.Total)))}
                        </div>
                    </div>
                </div>

                <div className={styles.upcoming}>
                    {data.Upcoming.map((item) => (
                        <button
                            key={item.DueDate}
                            type="button"
                            className={styles.upcomingRow}
                            onClick={() =>
                                InvoiceController.goToDue(context, item.DueDate, data.OpenDueDate)
                            }
                        >
                            <span className={styles.upcomingDate}>
                                Vence em {formatDate(item.DueDate)}
                            </span>
                            <span className={styles.upcomingValue}>{formatMoney(item.Total)}</span>
                        </button>
                    ))}
                </div>
            </Card>
        );

    const body = () => {
        if (idPaymentMethod === null) {
            return (
                <EmptyState
                    title="Cartão não informado"
                    description="A fatura é de um cartão: abra-a pelo botão de Gastos ou pelo card do cartão em Contas."
                    action={<Button onClick={() => navigate("/contas")}>Ir para Contas</Button>}
                />
            );
        }

        if (invoice.isError) return <ErrorState error={invoice.error} />;

        if (invoice.isPending) {
            return (
                <Card padded={false}>
                    <LoadingRows rows={8} />
                </Card>
            );
        }

        const data = invoice.data;
        const status = STATUS[data.Status];

        return (
            <>
                {cycleNav(data)}

                {/* O resultado da quitação, onde o botão está. A frase
                    carrega o NÚMERO DE PERNAS que mudaram de estado —
                    "12 lançamentos saíram do saldo" é o que o usuário
                    confere contra o extrato do banco. */}
                <FormError>{error}</FormError>
                <FormNotice>{notice}</FormNotice>

                <Card padded={false} className={styles.section}>
                    <div className={styles.sectionHead}>
                        <div>
                            <div className={styles.sectionTitle}>
                                {/* O BANCO ANTES DO CARTÃO, como qualquer
                                    extrato identifica uma fatura: dois
                                    cartões de nome parecido em bancos
                                    diferentes só se distinguem por aqui. */}
                                {accountName !== undefined && (
                                    <span className={styles.titleAccount}>{accountName}</span>
                                )}
                                {data.Name}
                                <Badge tone={status.tone}>{status.label}</Badge>
                            </div>

                            {/* As DUAS datas da fatura, que é o que a
                                pessoa lê no cadastro do cartão: até
                                quando dá para comprar nesta, e quando
                                ela é cobrada. */}
                            <div className={styles.sectionSub}>
                                {data.Status === "open" ? "Fecha" : "Fechou"} em{" "}
                                {formatDate(data.ClosingDate)} · vence em {formatDate(data.DueDate)}
                            </div>

                            {/* De quais compras ela é feita — a mesma
                                linha do Extrato e do card do cartão, e
                                pelo mesmo motivo: o ciclo não é o mês. */}
                            <div className={styles.cycle}>
                                <span>
                                    {cycleLabel({ start: data.CycleStart, end: data.CycleEnd })}
                                </span>
                                <Badge tone="neutral">
                                    {COMPETENCE_LABEL[data.CompetenceMode]}
                                </Badge>
                            </div>
                        </div>

                        <div className={styles.end}>
                            <Overline>Total da fatura</Overline>
                            {/* O número que a API AFIRMOU. Somar as
                                linhas aqui para conferir seria a segunda
                                implementação da mesma pergunta. */}
                            <div className={`${styles.endValue} ${styles.endStrong}`}>
                                {formatMoney(data.Total)}
                            </div>

                            {/* O botão fica COLADO NO TOTAL, e não na
                                Topbar: é esse número que ele tira da
                                conta. */}
                            <div className={styles.pay}>{payButton(data)}</div>
                        </div>
                    </div>

                    {data.Entries.length === 0 ? (
                        <EmptyState
                            inline
                            icon={<IconCard />}
                            title="Nada nesta fatura"
                            description={
                                data.Expected.length > 0
                                    ? "Todo o ciclo está marcado como previsto — nenhuma compra foi dada como lançada na fatura."
                                    : "Nenhuma compra caiu neste ciclo."
                            }
                        />
                    ) : isMobile ? (
                        entryCards(data.Entries)
                    ) : (
                        entryTable(data.Entries)
                    )}

                    {/* ── O previsto ─────────────────────────────
                        `Charged` quer dizer "está na fatura", e a perna
                        de cartão já nasce assim. O que sobra desmarcado
                        é o caso raro — o emissor ainda não registrou —,
                        e ele fica FORA do total e DENTRO da tela: a
                        quitação leva o ciclo inteiro, e uma linha
                        invisível que mesmo assim tira dinheiro da conta
                        é o que esta separação existe para não criar. */}
                    {data.Expected.length > 0 &&
                        (isMobile ? (
                            <>
                                <CardGroup
                                    title="Previsto · ainda não apareceu na fatura"
                                    meta={formatMoney(
                                        sumMoney(data.Expected.map((entry) => entry.Value)),
                                    )}
                                />
                                {entryCards(data.Expected)}
                            </>
                        ) : (
                            <>
                                <div className={styles.group}>
                                    <span>Previsto · ainda não apareceu na fatura</span>
                                    <span className={styles.groupValue}>
                                        {formatMoney(
                                            sumMoney(data.Expected.map((entry) => entry.Value)),
                                        )}
                                    </span>
                                </div>
                                {entryTable(data.Expected)}
                            </>
                        ))}
                </Card>

                {upcoming(data)}
            </>
        );
    };

    return (
        <>
            {/* SEM seletor de mês, e essa ausência é a tela inteira: a
                fatura vai de fechamento a fechamento, e forçá-la no mês
                do chassi trocaria junto o Início, os Gastos e o
                Relatório. Quem anda de ciclo aqui é a barra de
                navegação. */}
            <Topbar
                greeting={`Olá, ${user.Name.split(/\s+/)[0]}`}
                actions={
                    <>
                        <Button onClick={() => navigate("/contas/extrato")}>Extrato</Button>
                        <Button onClick={() => navigate("/contas")}>Voltar para Contas</Button>
                    </>
                }
            />

            <Page>
                <PageHead
                    title="Fatura"
                    subtitle={
                        invoice.data
                            ? `${invoice.data.Name} · ciclo que vence em ${formatDate(invoice.data.DueDate)}`
                            : "O ciclo do cartão, de fechamento a fechamento"
                    }
                />

                {body()}

                {/* Só o DESFAZER confirma, e a assimetria é de
                    propósito: quitar registra um pagamento que acabou de
                    acontecer e se desfaz com um clique; desfazer devolve
                    dezenas de lançamentos ao saldo de um mês que pode já
                    estar fechado. */}
                <ConfirmDialog
                    open={confirmingUndo && invoice.data !== undefined}
                    onClose={() => setConfirmingUndo(false)}
                    onConfirm={() => {
                        const data = invoice.data;
                        setConfirmingUndo(false);
                        if (!data) return;
                        void InvoiceController.payInvoice(context, data, true);
                    }}
                    title={UNPAY_CONFIRM.title(invoice.data?.Name ?? "")}
                    description={UNPAY_CONFIRM.description}
                    confirmLabel={UNPAY_CONFIRM.confirmLabel}
                    danger
                    pending={pending}
                />
            </Page>
        </>
    );
}
