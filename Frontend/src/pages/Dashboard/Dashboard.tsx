import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { useMonthScope } from "@/app/monthScope";
import { useOpenModal } from "@/app/modalRoute";
import { useSession } from "@/app/session";
import { useCategoryIndex, usePaymentMethodIndex, usePersonIndex } from "@/data/catalogs";
import { useMonthBudgets, useMonthLegs, useMonthReport } from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { HideOnMobile, Topbar } from "@/ui/topbar";
import { BreakdownRow, BudgetBar, DeltaPill, KpiCard, ProgressMeter } from "@/ui/budget";
import { IconAlert, IconArrowDown, IconArrowUp, IconPlus } from "@/ui/icons";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import {
    budgetState,
    budgetTargetName,
    legsOfKind,
    spentByCategory,
    spentByPaymentMethod,
    spentByPerson,
    sumMoney,
    totalSpent,
} from "@/lib/aggregate";
import { accentColor, categoryColor, paletteColor } from "@/lib/categoryColor";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { formatMonthLabel } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ⚠️ O INÍCIO NÃO ESCREVE ORÇAMENTO, e desde a leva 9 não tem mais como.
   O formulário de teto que morava aqui — com o seu modal, o seu seletor
   de alvo e o seu confirm de remoção — foi absorvido pela tela do
   Orçamento (`/orcamento`), porque o gesto que o produto pedia não é
   "cadastrar um teto por vez": é repartir a renda do mês num rateio, que
   é uma tela inteira. O que ficou aqui é a LEITURA, que é o que um
   painel de início faz — a mesma divisão que Contas tem com o Extrato.

   Com ela foram as três sections da página, e o Início voltou a ser uma
   tela sem evento de negócio nenhum: não há `controller.tsx`, porque não
   há o que ele declararia. */

/** Um dos três painéis de quebra do layout: título, total e as linhas
 *  em ordem decrescente. A porcentagem é sobre o TOTAL do painel, que é
 *  o que faz as três colunas serem lidas do mesmo jeito. */
function Breakdown({
    title,
    total,
    rows,
    empty,
}: {
    title: string;
    total: number;
    rows: { key: string; label: string; color: string; amount: number; iconKey?: string | null }[];
    empty: ReactNode;
}) {
    return (
        <Card className={styles.breakdownCard}>
            <div className={styles.breakdownHead}>
                <div>
                    <div className={styles.sectionTitle}>{title}</div>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className={styles.breakdownEmpty}>{empty}</div>
            ) : (
                <div className={styles.breakdown}>
                    {rows.map((row) => (
                        <BreakdownRow
                            key={row.key}
                            label={row.label}
                            iconKey={row.iconKey}
                            color={row.color}
                            amount={row.amount}
                            percent={total > 0 ? (row.amount / total) * 100 : 0}
                        />
                    ))}
                </div>
            )}
        </Card>
    );
}

export function Dashboard() {
    const { user } = useSession();
    const openModal = useOpenModal();
    const navigate = useNavigate();

    const [month, setMonth] = useMonthScope();

    const {
        legs,
        isPending: legsPending,
        isError: legsError,
        error: legsErrorValue,
    } = useMonthLegs(month);
    /* Os nove números do mês, somados no servidor. A tela deixou de
       pedir `useMonthInflows`: ela puxava o mês inteiro de entradas
       para somar dois números que agora vêm prontos. */
    const report = useMonthReport(month);
    const budgets = useMonthBudgets(month);
    /* A leitura do mês ANTERIOR saiu daqui junto com o botão de clonar:
       ela existia para dizer quantas fatias a cópia traria, e quem monta
       um mês agora está na tela do Orçamento. Uma requisição a menos em
       toda visita ao Início. */
    /* `useAccounts` continua sendo lido nesta tela — por dentro de
       `usePaymentMethodIndex`, que é quem dá nome à fatia "Por forma de
       pagamento". O que saiu foi a leitura DIRETA, que existia só para
       somar o `totalBalance`: esse número agora é o `CurrentBalance` da
       rota. Mesma chave de cache, nenhuma requisição a mais. */
    const categoryIndex = useCategoryIndex();
    const personIndex = usePersonIndex();
    const methodIndex = usePaymentMethodIndex();

    /* ── Os números do mês, e todos vêm da rota ──────────────
       Nenhum deles se soma aqui — nem para conferir. As quatro regras
       de agregação se contradizem de propósito, e era a réplica delas
       no cliente que fazia a mesma pergunta ter dois totais na mesma
       tela. Se um número daqui divergir do da tela dele, é bug da API.

       O "Restante" era `recebido − gasto`, e faltava nele o
       `OpeningBalance`: somar só as entradas do mês para dizer quanto
       ainda dá para gastar ignora o dinheiro que já estava na conta no
       dia 1º. Não era questão de escala — dava errado com dois
       lançamentos no banco. */
    const available = report.data?.Available ?? 0;
    const inflows = report.data?.Inflows ?? 0;
    const expenses = report.data?.Expenses ?? 0;
    const currentBalance = report.data?.CurrentBalance ?? 0;
    const openInvoices = report.data?.OpenInvoices ?? 0;
    const overdueReceivable = report.data?.OverdueReceivable ?? 0;
    const overduePayable = report.data?.OverduePayable ?? 0;

    /** Enquanto a rota não respondeu, o traço — um zero aqui seria um
     *  número, e um número errado. */
    const money = (value: ApiTypes.Money): string => (report.isPending ? "—" : formatMoney(value));

    /* O que FICA no cliente: os dois recortes por tipo de gasto e as
       três quebras de baixo. A rota não responde nenhum deles, e todos
       saem da lista de pernas que a tela já tem em cache. O que mudou é
       o DENOMINADOR — o total dos painéis passou a ser o `Expenses` da
       rota, e não o `totalSpent` das pernas: dois totais de gasto na
       mesma tela é exatamente o que ela veio evitar. */
    const fixed = totalSpent(legsOfKind(legs, "fixed"));
    const installments = totalSpent(legsOfKind(legs, "installment"));

    /* **A resposta é um ENVELOPE, e as duas metades entram na tela.**
       `Periods` são as fatias; `Unbudgeted` é o gasto do mês que não
       casou com nenhuma delas — e ele existe porque o casamento é
       estrito: cada porção de gasto consome uma fatia ou NENHUMA. Sem
       mostrá-lo, o gasto que não achou fatia simplesmente não apareceria
       em lugar nenhum, e a regra viraria um sumiço silencioso de
       dinheiro. Com ele fecha a conta que o usuário confere sozinho:
       soma dos `Spent` + `Unbudgeted` = o gasto do mês. */
    const periods = budgets.data?.Periods ?? [];
    const unbudgeted = budgets.data?.Unbudgeted ?? 0;
    const overBudget = periods.filter((period) => budgetState(period) === "over");
    const alerting = periods.filter((period) => budgetState(period) === "alert");

    /* A régua do cartão principal. Com teto cadastrado ela mede o
       consumo do teto; sem teto nenhum, mede o quanto do que entrou já
       foi gasto — o rótulo muda junto, porque as duas perguntas são
       diferentes e trocá-las caladas seria mentir no número. */
    const budgetLimit = sumMoney(periods.map((period) => period.LimitValue));
    const budgetSpent = sumMoney(periods.map((period) => period.Spent));
    const hasBudget = budgetLimit > 0;
    const usedPercent = hasBudget
        ? (budgetSpent / budgetLimit) * 100
        : inflows > 0
          ? (expenses / inflows) * 100
          : 0;

    /* ── As três quebras do layout ───────────────────────────
       As três saem da MESMA lista de pernas: categoria vem do gasto,
       forma de pagamento vem da própria perna e destino é o rateio do
       gasto rateado pela perna. Nenhuma delas espera por requisição
       nenhuma — era daqui que saíam os `get(id)` por linha. */
    const byCategory = useMemo(() => spentByCategory(legs).slice(0, 5), [legs]);
    const byMethod = useMemo(() => spentByPaymentMethod(legs).slice(0, 5), [legs]);
    const byPerson = useMemo(() => spentByPerson(legs).slice(0, 5), [legs]);

    const firstName = user.Name.split(/\s+/)[0];

    return (
        <>
            <Topbar
                greeting={`Olá, ${firstName}`}
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
                <PageHead title={`Início - ${formatMonthLabel(month)}`} />

                {/* ── Faixa principal ──────────────────────────── */}
                <div className={styles.hero}>
                    <Card className={styles.heroCard}>
                        <div className={styles.heroLabel}>Restante</div>
                        <div className={styles.heroValue}>
                            <span className={styles.heroCurrency}>R$</span>
                            <span
                                className={`${styles.heroBig} ${available < 0 ? styles.heroNegative : ""}`}
                            >
                                {report.isPending
                                    ? "—"
                                    : formatMoney(available).replace("R$", "").trim()}
                            </span>
                        </div>

                        <div className={styles.heroMeter}>
                            <ProgressMeter
                                percent={usedPercent}
                                state={
                                    usedPercent > 100 ? "over" : usedPercent >= 80 ? "alert" : "ok"
                                }
                                height={8}
                            />
                            <div className={styles.heroMeterCaption}>
                                <b>{Math.round(usedPercent)}%</b>{" "}
                                {hasBudget ? "do orçamento usado" : "do que entrou já foi gasto"}
                            </div>
                        </div>

                        <div className={styles.flows}>
                            <div className={styles.flow}>
                                <div className={styles.flowLabel}>
                                    <span className={`${styles.arrow} ${styles.arrowUp}`}>
                                        <IconArrowUp />
                                    </span>
                                    {/* O rótulo mudou junto com o número: a rota
                                        conta a entrada PENDENTE junto com a
                                        recebida — é competência, não caixa.
                                        Trocar o número por baixo de um rótulo
                                        que diz "Recebido" seria a mentira que
                                        esta rota veio consertar. */}
                                    <span className={styles.flowName}>Entradas do mês</span>
                                </div>
                                <span
                                    className={styles.flowValue}
                                    style={{ color: "var(--pos-ink)" }}
                                >
                                    {money(inflows)}
                                </span>
                            </div>
                            <div className={styles.flow}>
                                <div className={styles.flowLabel}>
                                    <span className={`${styles.arrow} ${styles.arrowDown}`}>
                                        <IconArrowDown />
                                    </span>
                                    <span className={styles.flowName}>Gasto</span>
                                </div>
                                <span className={styles.flowValue} style={{ color: "var(--neg)" }}>
                                    {money(expenses)}
                                </span>
                            </div>
                        </div>

                        {/* ── O atrasado, exposto ────────────────────
                            Os dois vencidos entram no "Restante" de propósito:
                            sem eles, a perna de julho que ninguém honrou some
                            do indicador — ela não está no saldo de julho (não
                            foi paga) nem na janela de agosto (a competência é
                            de julho). O custo está aceito de olhos abertos, e
                            é por isso que eles não ficam escondidos dentro do
                            total: uma previsão que nunca chega infla o número
                            PARA SEMPRE se ninguém a resolver. Daí cada linha
                            levar para onde se resolve. */}
                        {(overdueReceivable > 0 || overduePayable > 0) && (
                            <div className={styles.overdue}>
                                {overdueReceivable > 0 && (
                                    <button
                                        type="button"
                                        className={styles.overdueRow}
                                        onClick={() => navigate("/renda")}
                                    >
                                        <span className={styles.overdueName}>
                                            A receber vencido
                                        </span>
                                        <span className={styles.overdueValue}>
                                            {formatMoney(overdueReceivable)}
                                        </span>
                                    </button>
                                )}
                                {overduePayable > 0 && (
                                    <button
                                        type="button"
                                        className={styles.overdueRow}
                                        onClick={() => navigate("/gastos?status=pending")}
                                    >
                                        <span className={styles.overdueName}>A pagar vencido</span>
                                        <span
                                            className={`${styles.overdueValue} ${styles.overdueNeg}`}
                                        >
                                            {formatMoney(overduePayable)}
                                        </span>
                                    </button>
                                )}
                                <div className={styles.overdueNote}>
                                    Já contam no Restante, e continuam contando enquanto ninguém os
                                    receber ou cancelar.
                                </div>
                            </div>
                        )}
                    </Card>

                    <div className={styles.kpiGrid}>
                        <KpiCard
                            label="Saldo nas contas"
                            value={report.isPending ? "—" : currentBalance}
                        />
                        <KpiCard
                            label="Faturas em aberto"
                            value={report.isPending ? "—" : openInvoices}
                            tone={openInvoices > 0 ? "neg" : "neutral"}
                        />
                        <KpiCard
                            label="Fixos do mês"
                            value={fixed}
                            badge={
                                expenses > 0 ? (
                                    <DeltaPill tone="mute">
                                        {Math.round((fixed / expenses) * 100)}%
                                    </DeltaPill>
                                ) : undefined
                            }
                        />
                        <KpiCard label="Parcelas do mês" value={installments} />
                    </div>
                </div>

                {report.isError && (
                    <ErrorState error={report.error} onRetry={() => void report.refetch()} />
                )}

                {legsError && <ErrorState error={legsErrorValue} />}

                {/* ── Orçamentos: painel próprio, largura inteira ── */}
                <Card className={styles.panel}>
                    <div className={styles.sectionHead}>
                        <div>
                            <div className={styles.sectionTitle}>
                                Orçamentos · {formatMonthLabel(month)}
                            </div>
                            <div className={styles.sectionSub}>
                                {periods.length} orçamento{periods.length === 1 ? "" : "s"} ativo
                                {periods.length === 1 ? "" : "s"}
                                {overBudget.length > 0 && ` · ${overBudget.length} estourado`}
                                {hasBudget &&
                                    ` · ${formatMoney(
                                        fromCents(toCents(budgetLimit) - toCents(budgetSpent)),
                                    )} disponíveis no total`}
                            </div>
                        </div>
                        {/* O Início não escreve orçamento: quem reparte
                            a renda do mês é a tela do Orçamento, e o
                            botão leva para lá com o mesmo mês na mão —
                            o seletor do chassi é o mesmo nas duas. */}
                        <Button variant="primary" size="sm" onClick={() => navigate("/orcamento")}>
                            Abrir o orçamento
                        </Button>
                    </div>

                    {overBudget.length > 0 && (
                        <div className={`${styles.alert} ${styles.alertSolid}`}>
                            <span className={styles.alertIcon}>
                                <IconAlert />
                            </span>
                            <div>
                                <div className={styles.alertTitle}>
                                    {overBudget.length} orçamento
                                    {overBudget.length === 1 ? "" : "s"} estourou o teto
                                </div>
                                <div className={styles.alertText}>
                                    {overBudget.map(budgetTargetName).join(" · ")}
                                </div>
                            </div>
                        </div>
                    )}

                    {overBudget.length === 0 && alerting.length > 0 && (
                        <div className={styles.alert}>
                            <span className={styles.alertIcon}>
                                <IconAlert />
                            </span>
                            <div>
                                <div className={styles.alertTitle}>
                                    {alerting.length} orçamento{alerting.length === 1 ? "" : "s"}{" "}
                                    perto do teto
                                </div>
                                <div className={styles.alertText}>
                                    {alerting.map(budgetTargetName).join(" · ")}
                                </div>
                            </div>
                        </div>
                    )}

                    {budgets.isPending ? (
                        <LoadingRows rows={3} />
                    ) : budgets.isError ? (
                        <ErrorState
                            inline
                            error={budgets.error}
                            onRetry={() => void budgets.refetch()}
                        />
                    ) : periods.length === 0 ? (
                        /* ── O mês vazio, e a saída é UMA: a tela do
                              Orçamento.

                           Desde a leva 9 nada se materializa sozinho, e é
                           isso que faz outubro ser montável em setembro. O
                           preço é que o mês novo nasce vazio — e as duas
                           saídas que este espaço oferecia (clonar o mês
                           anterior, montar do zero) são as duas primeiras
                           coisas que a tela do Orçamento mostra. Duplicá-las
                           aqui seria manter dois lugares que escrevem o
                           mesmo mês, e eles divergiriam na primeira regra
                           nova. */
                        <EmptyState
                            inline
                            title="Este mês ainda não foi repartido"
                            description="Reparta o que entra no mês em fatias por categoria, por pessoa, ou pelas duas — e acompanhe aqui o que cada uma já consumiu."
                            action={
                                <Button variant="primary" onClick={() => navigate("/orcamento")}>
                                    <IconPlus />
                                    Repartir {formatMonthLabel(month)}
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <div className={styles.budgets}>
                                {/* Clicar numa fatia leva ao rateio, e não
                                    abre um formulário: mexer numa linha é
                                    mexer na repartição do mês, e é lá que
                                    ela se vê inteira. */}
                                {periods.map((period) => (
                                    <BudgetBar
                                        key={period.IdBudgetPeriod}
                                        period={period}
                                        onClick={() => navigate("/orcamento")}
                                    />
                                ))}
                            </div>

                            {/* ── O FORA DO ORÇAMENTO ────────────────
                                O `Unbudgeted` do mês, e ele só aparece
                                quando existe: é o gasto que não casou com
                                fatia nenhuma, e é o que impede a regra
                                estrita de casamento de ser silenciosa —
                                sem esta linha, um gasto que não achou
                                fatia não apareceria em lugar nenhum do
                                orçamento. O número é da API: soma dos
                                `Spent` + `Unbudgeted` = o gasto do mês. */}
                            {unbudgeted > 0 && (
                                <button
                                    type="button"
                                    className={styles.unbudgeted}
                                    onClick={() => navigate("/gastos")}
                                >
                                    <span className={styles.unbudgetedLabel}>
                                        <IconAlert />
                                        Foi encontrado {formatMoney(unbudgeted)} em gastos fora do orçamento
                                    </span>
                                </button>
                            )}
                        </>
                    )}
                </Card>

                {/* ── As três quebras do mês ─────────────────────
                    As LINHAS saem das pernas que a tela já tem em cache — a
                    rota não responde nenhuma delas. O TOTAL de cada painel é
                    o `Expenses` da rota: dois totais de gasto na mesma tela é
                    exatamente o que ela veio evitar, e se eles divergirem é
                    bug da API, não duas leituras legítimas. Nada é
                    arredondado para "fechar" a soma. */}
                {legsPending ? (
                    <Card padded={false}>
                        <LoadingRows rows={4} />
                    </Card>
                ) : (
                    <div className={styles.breakdowns}>
                        <Breakdown
                            title="Por categoria"
                            total={expenses}
                            empty="Nenhum gasto neste mês."
                            rows={byCategory.map((slice) => {
                                const category = categoryIndex.get(slice.IdCategory);
                                return {
                                    key: `c${slice.IdCategory}`,
                                    label: category?.Description ?? "Sem categoria",
                                    iconKey: category?.IconKey ?? null,
                                    color: category
                                        ? categoryColor(category)
                                        : paletteColor(slice.IdCategory),
                                    amount: slice.value,
                                };
                            })}
                        />

                        <Breakdown
                            title="Por forma de pagamento"
                            total={expenses}
                            empty="Nenhum gasto neste mês."
                            rows={byMethod.map((slice) => {
                                const option = methodIndex.get(slice.IdPaymentMethod);
                                return {
                                    key: `m${slice.IdPaymentMethod}`,
                                    label: option
                                        ? `${option.account.Name} · ${option.method.Name}`
                                        : "Forma arquivada",
                                    color: accentColor(
                                        option?.method.Color ?? option?.account.Color ?? null,
                                    ),
                                    amount: slice.value,
                                };
                            })}
                        />

                        <Breakdown
                            title="Por destino"
                            total={expenses}
                            empty="Nenhum gasto neste mês."
                            rows={byPerson.map((slice) => ({
                                key: `p${slice.IdPerson ?? "none"}`,
                                label:
                                    slice.IdPerson === null
                                        ? "Sem destino"
                                        : (personIndex.get(slice.IdPerson)?.Name ??
                                          "Pessoa arquivada"),
                                color:
                                    slice.IdPerson === null
                                        ? "var(--ink-3)"
                                        : paletteColor(slice.IdPerson),
                                amount: slice.value,
                            }))}
                        />
                    </div>
                )}
            </Page>
        </>
    );
}
