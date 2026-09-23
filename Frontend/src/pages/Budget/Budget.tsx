import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { BudgetController, type BudgetContext, type BudgetLine } from "./controller";
import { previousMonth } from "./sections/cloneBudgetMonth";
import { useMonthScope } from "@/app/monthScope";
import { useCategories, usePersons } from "@/data/catalogs";
import { useInvalidateMovement, useMonthBudgets, useMonthReport } from "@/data/month";
import { Button, Card, Workspace as Page } from "@/ui/primitives";
import { Topbar } from "@/ui/topbar";
import { SplitEditor, type SplitOption } from "@/ui/SplitEditor";
import { ProgressMeter } from "@/ui/budget";
import { FormError, FormNotice, cx } from "@/ui/form";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconAlert, IconPlus } from "@/ui/icons";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import { budgetPercent, budgetState, budgetTargetName, sumMoney } from "@/lib/aggregate";
import { categoryColor, paletteColor } from "@/lib/categoryColor";
import { formatDateTime, formatMonthLabel, formatMonthShort } from "@/lib/date";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O ORÇAMENTO — a tela do gesto que o produto não tinha.

   POR QUE ELA É UMA TELA, e não o painel do Início que existia até a
   etapa 11. O que o usuário pediu foi "quando eu recebo o dinheiro, eu
   defino para qual categoria ele vai, em um RATEIO, e isso ser o
   orçamento do mês" — e um rateio é uma tela inteira: ele abre pela
   renda, tem uma linha por fatia com dois seletores e um valor, tem o
   botão de distribuir o que sobra, e tem o "fora do orçamento" no fim.
   Dentro do Início isso empurraria para baixo os indicadores do mês e
   as três quebras, e ainda assim seria menor do que precisa ser.

   O Início continua com o BLOCO de orçamento, e a divisão entre os dois
   é a de sempre: lá se OLHA (as fatias com o consumo de cada uma, mais
   o que ficou fora), aqui se DECIDE. É a mesma relação que Contas tem
   com o Extrato.

   ── A tela abre pela RENDA, e nenhum número dela é somado aqui ──

   "Entrou 3.200 · a receber 1.800 · total 5.000" sai inteiro de
   `GET /Reports/Month`. Somar as entradas do mês no cliente para
   conferir seria refazer o filtro de transferência e o de cancelada —
   as duas regras que, replicadas, fazem o mesmo dinheiro ser contado
   duas vezes. O que a tela soma é o que ela mesma escreveu: o total
   ALOCADO, que é a soma das linhas que o usuário está editando, e a
   sobra que sai dele.

   ── O rateio daqui NÃO precisa fechar ──

   É a diferença com os dois eixos do gasto, e ela está no
   `closure="loose"` do SplitEditor: lá a soma tem que bater com o total
   ou é 406; aqui sobrar é o normal — o que não foi alocado é,
   literalmente, o que ainda não foi orçado. O que a tela sinaliza é o
   ESTOURO, e mesmo ele não impede salvar: a renda do mês ainda pode
   crescer, e a API não lê renda nenhuma para responder.

   ── Mês fechado abre em LEITURA ──

   O `ClosedAt` que a rotina do dia 1º carimba é a trava que impede
   reescrever a história de agosto em novembro: a API responde 403 a
   qualquer escrita, e a tela não oferece um controle que sempre
   falharia — ela mostra a data do fechamento no lugar deles.
   ════════════════════════════════════════════════════════════ */

/** A linha em branco do rateio. Os DOIS alvos nascem vazios: a fatia
 *  pode ser de pessoa, de categoria, ou das duas. */
const emptyBudgetLine = (): BudgetLine => ({ id: null, secondaryId: null, value: null });

/** O alvo como string, do jeito que a API o compara: `null` não casa
 *  com `null` em lugar nenhum, e é o alvo ausente que distingue
 *  "Mercado" de "Luana em Mercado". */
const targetKey = (IdCategory: number | null, IdPerson: number | null) =>
    `${IdCategory ?? ""}|${IdPerson ?? ""}`;

/** As fatias que o mês tem, viradas em linhas do editor.
 *
 *  A ordem é a que a API devolveu (por id), que é a ordem em que elas
 *  foram criadas — e é a mesma que o rateio devolve depois de salvar,
 *  porque a rota responde na ordem do corpo. */
const linesFromPeriods = (periods: readonly ApiTypes.BudgetPeriod[]): BudgetLine[] =>
    periods.map((period) => ({
        id: period.IdPerson,
        secondaryId: period.IdCategory,
        value: period.LimitValue,
    }));

export function Budget() {
    const [month, setMonth] = useMonthScope();
    const navigate = useNavigate();

    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const budgets = useMonthBudgets(month);
    const report = useMonthReport(month);
    const categories = useCategories();
    const persons = usePersons();
    const invalidateMovement = useInvalidateMovement();

    /* O mês ANTERIOR, lido só quando este está vazio: é ele que diz
       quantas fatias o botão de clonar vai trazer, e um botão que não
       diz o tamanho do que faz é um botão que ninguém clica. Mesma
       chave de cache de sempre — navegar até lá reaproveita a resposta. */
    const previous = previousMonth(month);
    const previousBudgets = useMonthBudgets(
        previous,
        !budgets.isPending && (budgets.data?.Periods.length ?? 0) === 0,
    );

    const periods = useMemo(() => budgets.data?.Periods ?? [], [budgets.data]);

    /* ── O rascunho, e por que ele não precisa de efeito ──────
       A chave carrega o mês e o instante da resposta: trocar de mês ou
       receber dados novos (depois de salvar, de clonar, ou de qualquer
       invalidação) troca a chave, e o rascunho volta a sair do servidor.
       Um `useEffect` sincronizando os dois teria uma janela em que a
       tela mostra o rascunho velho sobre os dados novos.

       O que ela custa: uma resposta nova chegando no meio da edição
       descarta o que estava sendo digitado. É aceitável porque não há de
       onde ela vir sozinha — o cliente desliga o `refetchOnWindowFocus`
       e a única invalidação é a da própria escrita desta tela. O
       contrário — o rascunho sobrevivendo a uma resposta nova — seria a
       tela gravando por cima de um mês que já mudou. */
    const draftKey = `${month}:${budgets.dataUpdatedAt}`;
    const [draft, setDraft] = useState<{ key: string; lines: BudgetLine[] } | null>(null);

    const lines = draft?.key === draftKey ? draft.lines : linesFromPeriods(periods);
    const setLines = (next: BudgetLine[]) => setDraft({ key: draftKey, lines: next });

    /* **Mês fechado é leitura.** Basta uma linha fechada: a rotina fecha
       o mês inteiro de uma vez, então "alguma" e "todas" são o mesmo
       fato — é a mesma leitura que a API faz para responder 403. */
    const closedPeriod = periods.find((period) => period.Status === "closed");
    const isClosed = closedPeriod !== undefined;

    const context = useMemo<BudgetContext>(
        () => ({
            month,
            lines,
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
                /* A invalidação é a mesma de toda escrita de movimento: o
                   rateio muda o `Spent` de cada fatia e o `Unbudgeted` do
                   mês, e a resposta nova é o que reconstrói o rascunho. */
                invalidateMovement();
            },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [month, lines, invalidateMovement],
    );

    /* ── A renda do mês: três números, nenhum somado aqui ─────
       Ver o cabeçalho. `Inflows` é competência — pendente junto com
       recebida —, e é ele o total contra o qual o rateio se mede: orçar
       só o que já caiu na conta seria orçar depois do mês ter acabado. */
    const received = report.data?.InflowsReceived ?? 0;
    const expected = report.data?.InflowsPending ?? 0;
    const income = report.data?.Inflows ?? 0;

    /** Enquanto a rota não respondeu, o traço — um zero aqui seria um
     *  número, e um número errado. */
    const money = (value: ApiTypes.Money): string => (report.isPending ? "—" : formatMoney(value));

    /* O que a tela SOMA é só o que ela mesma escreveu: as linhas do
       rascunho. Em centavos, porque somar trinta linhas em ponto
       flutuante erra o centavo do total. */
    const allocated = sumMoney(lines.map((line) => line.value ?? 0));
    const remainder = fromCents(toCents(income) - toCents(allocated));

    const personOptions = useMemo<SplitOption[]>(
        () =>
            (persons.data ?? [])
                .filter((person) => person.Active)
                .map((person) => ({
                    id: person.IdPerson,
                    label: person.Name,
                    color: paletteColor(person.IdPerson),
                })),
        [persons.data],
    );

    const categoryOptions = useMemo<SplitOption[]>(
        () =>
            (categories.data ?? [])
                .filter((category) => category.Active)
                .map((category) => ({
                    id: category.IdCategory,
                    label: category.Description,
                    icon: <CategoryIcon iconKey={category.IconKey} />,
                    color: categoryColor(category),
                })),
        [categories.data],
    );

    /** O comprometido de cada alvo, para a régua ao lado da linha.
     *
     *  `Spent` vem da API e **não se recalcula aqui** — a linha só o
     *  encontra pelo alvo. Uma linha de alvo novo não tem nenhum, e zero
     *  é a resposta certa: nada foi gasto contra uma fatia que ainda não
     *  existe no mês. */
    const spentByTarget = useMemo(
        () =>
            new Map(
                periods.map((period) => [targetKey(period.IdCategory, period.IdPerson), period]),
            ),
        [periods],
    );

    const unbudgeted = budgets.data?.Unbudgeted ?? 0;

    const loading = budgets.isPending || persons.isPending || categories.isPending;
    const previousCount = previousBudgets.data?.Periods.length ?? 0;

    return (
        <>
            <Topbar
                greeting={`Orçamento · ${formatMonthLabel(month)}`}
                month={month}
                onMonthChange={setMonth}
                actions={
                    !isClosed && (
                        <Button
                            variant="primary"
                            disabled={pending || loading}
                            onClick={() => void BudgetController.saveAllocation(context)}
                        >
                            {pending ? "Salvando…" : "Salvar rateio"}
                        </Button>
                    )
                }
            />

            <Page>
                <FormError>{error}</FormError>
                <FormNotice>{notice}</FormNotice>

                {/* ── A renda, que é por onde a tela abre ──────── */}
                <Card className={styles.income}>
                    <div className={styles.incomeRow}>
                        <div className={styles.incomeItem}>
                            <span className={styles.incomeLabel}>Entrou</span>
                            <span className={styles.incomeValue}>{money(received)}</span>
                        </div>
                        <div className={styles.incomeItem}>
                            <span className={styles.incomeLabel}>A receber</span>
                            <span className={styles.incomeValue}>{money(expected)}</span>
                        </div>
                        <div className={cx(styles.incomeItem, styles.incomeTotal)}>
                            <span className={styles.incomeLabel}>Total do mês</span>
                            <span className={styles.incomeValue}>{money(income)}</span>
                        </div>
                    </div>

                    {/* O que a tela soma sozinha: o alocado e a sobra. O
                        estouro é o único dos dois que vira alerta —
                        sobrar é o estado normal de quem ainda não
                        terminou de repartir. */}
                    <div className={cx(styles.allocation, remainder < 0 && styles.allocationOver)}>
                        <span>
                            alocado <b>{formatMoney(allocated)}</b>
                        </span>
                        <span>
                            {remainder >= 0 ? (
                                <>
                                    sobra <b>{formatMoney(remainder)}</b> a distribuir
                                </>
                            ) : (
                                <>
                                    <b>{formatMoney(-remainder)}</b> acima do que entra no mês
                                </>
                            )}
                        </span>
                    </div>

                    {/* A renda do mês é competência: a entrada prevista
                        conta no total contra o qual se reparte. Sem esta
                        linha o usuário procura de onde saiu um total
                        maior do que o extrato dele mostra. */}
                    <div className={styles.incomeNote}>
                        O total do mês conta o previsto junto com o recebido — é o que permite
                        repartir o mês antes de ele acabar. Transferência entre as suas contas não
                        entra: ela não é renda nova.
                    </div>
                </Card>

                {loading ? (
                    <Card padded={false}>
                        <LoadingRows rows={4} />
                    </Card>
                ) : budgets.isError ? (
                    <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} />
                ) : isClosed ? (
                    /* ── Mês fechado: leitura, e a data no lugar dos
                          controles. A API responde 403 a qualquer
                          escrita aqui, e oferecer os campos seria
                          oferecer um clique que sempre falha. */
                    <Card className={styles.panel}>
                        <div className={styles.closed}>
                            <span className={styles.closedIcon}>
                                <IconAlert />
                            </span>
                            <div>
                                <div className={styles.closedTitle}>Mês fechado</div>
                                <div className={styles.closedText}>
                                    {closedPeriod.ClosedAt
                                        ? `Fechado em ${formatDateTime(closedPeriod.ClosedAt)}.`
                                        : "Este mês já foi fechado."}{" "}
                                    O rateio dele não muda mais — é o que mantém a história de um
                                    mês encerrado de pé.
                                </div>
                            </div>
                        </div>

                        <div className={styles.readOnly}>
                            {periods.map((period) => (
                                <ReadOnlyRow key={period.IdBudgetPeriod} period={period} />
                            ))}
                        </div>
                    </Card>
                ) : periods.length === 0 && lines.length === 0 ? (
                    /* ── O mês vazio e as suas DUAS saídas ────────
                       Desde a leva 9 nada se materializa sozinho, e é
                       isso que faz outubro ser montável em setembro. O
                       preço é que o mês novo nasce vazio, e é aqui que
                       ele se paga: clonar o anterior, ou montar do zero.

                       O botão de clonar DIZ QUANTAS LINHAS VAI TRAZER —
                       "clonar setembro" sem número é um pulo no escuro.
                       O número é o do mês anterior inteiro; o que o
                       servidor descartar (alvo arquivado, alvo já
                       existente) sai na `msg` da resposta. */
                    <Card className={styles.panel}>
                        <EmptyState
                            inline
                            title="Este mês ainda não foi repartido"
                            description={
                                previousCount > 0
                                    ? `${formatMonthLabel(previous)} tem ${previousCount} fatia${
                                          previousCount === 1 ? "" : "s"
                                      } — traga-as para cá e ajuste o que mudou, ou comece do zero.`
                                    : "Reparta o que entra no mês em fatias por categoria, por pessoa, ou pelas duas."
                            }
                            action={
                                <div className={styles.emptyActions}>
                                    {previousCount > 0 && (
                                        <Button
                                            variant="primary"
                                            disabled={pending}
                                            onClick={() =>
                                                void BudgetController.cloneBudgetMonth(context)
                                            }
                                        >
                                            Clonar {formatMonthShort(previous)} ({previousCount}{" "}
                                            {previousCount === 1 ? "fatia" : "fatias"})
                                        </Button>
                                    )}
                                    <Button
                                        variant={previousCount > 0 ? "default" : "primary"}
                                        onClick={() => setLines([emptyBudgetLine()])}
                                    >
                                        <IconPlus />
                                        Montar do zero
                                    </Button>
                                </div>
                            }
                        />
                    </Card>
                ) : (
                    <>
                        {/* ── O RATEIO ─────────────────────────────
                            O mesmo editor dos dois eixos do gasto, com a
                            regra de fechamento invertida (`closure`): lá
                            não fechar é 406, aqui sobrar é o normal.

                            Os dois seletores são o alvo da fatia, e os
                            dois são opcionais — o que não pode é os dois
                            vazios. A linha só com pessoa é a MESADA, que
                            é a única fatia que o rateio por categoria não
                            monta sozinho: ela entra pelo botão de
                            adicionar, ao lado. */}
                        <SplitEditor
                            label={`Rateio de ${formatMonthLabel(month)}`}
                            hint="Cada linha é uma fatia da renda. A pessoa, a categoria, ou as duas — “Luana”, “Mercado”, ou “Luana em Mercado”."
                            closure="loose"
                            options={personOptions}
                            optionLabel="Pessoa"
                            secondaryOptions={categoryOptions}
                            secondaryLabel="Categoria"
                            addLabel="Adicionar fatia"
                            lines={lines}
                            onChange={setLines}
                            total={income}
                            disabled={pending}
                            rowExtra={(_, line) => {
                                const period = spentByTarget.get(
                                    targetKey(line.secondaryId ?? null, line.id),
                                );

                                return (
                                    <span className={styles.rowSpent}>
                                        <span className={styles.rowSpentValue}>
                                            {formatMoney(period?.Spent ?? 0)}
                                        </span>
                                        <ProgressMeter
                                            height={6}
                                            percent={budgetPercent({
                                                LimitValue: line.value ?? 0,
                                                Spent: period?.Spent ?? 0,
                                                AlertPercent: period?.AlertPercent ?? 80,
                                            })}
                                            state={budgetState({
                                                LimitValue: line.value ?? 0,
                                                Spent: period?.Spent ?? 0,
                                                AlertPercent: period?.AlertPercent ?? 80,
                                            })}
                                        />
                                    </span>
                                );
                            }}
                        />

                        {/* ── O FORA DO ORÇAMENTO ──────────────────
                            O `Unbudgeted` do mês: o gasto que não casou
                            com fatia nenhuma. Ele é o preço da regra
                            estrita de casamento ficando VISÍVEL — cada
                            porção de gasto consome uma fatia ou nenhuma,
                            e sem esta linha o que não achou fatia
                            simplesmente não apareceria em lugar nenhum
                            desta tela.

                            Vem da API como tudo o mais aqui: soma dos
                            `Spent` + `Unbudgeted` = o gasto do mês. */}
                        <Card
                            className={cx(
                                styles.unbudgeted,
                                unbudgeted > 0 && styles.unbudgetedAlert,
                            )}
                        >
                            <div className={styles.unbudgetedTop}>
                                <span className={styles.unbudgetedLabel}>
                                    {unbudgeted > 0 ? (
                                        <span className={styles.unbudgetedIcon}>
                                            <IconAlert />
                                        </span>
                                    ) : null}
                                    Fora do orçamento
                                </span>
                                <span className={styles.unbudgetedValue}>
                                    {formatMoney(unbudgeted)}
                                </span>
                            </div>
                            <div className={styles.unbudgetedText}>
                                {unbudgeted > 0 ? (
                                    <>
                                        Este gasto do mês não casou com nenhuma fatia. Um gasto
                                        atribuído a alguém nunca cai numa fatia só de categoria —
                                        para cobrir a pessoa por inteiro, dê a ela uma fatia{" "}
                                        <b>sem categoria</b>.
                                    </>
                                ) : (
                                    "Todo gasto do mês caiu em alguma fatia."
                                )}
                            </div>
                            <div className={styles.unbudgetedAction}>
                                <Button size="sm" onClick={() => navigate("/gastos")}>
                                    Ver os gastos do mês
                                </Button>
                            </div>
                        </Card>
                    </>
                )}
            </Page>
        </>
    );
}

/** Uma fatia do mês fechado: o mesmo conteúdo da linha do rateio, sem
 *  controle nenhum. */
function ReadOnlyRow({ period }: { period: ApiTypes.BudgetPeriod }) {
    return (
        <div className={styles.readOnlyRow}>
            <span className={styles.readOnlyName}>{budgetTargetName(period)}</span>
            <span className={styles.readOnlyValue}>{formatMoney(period.LimitValue)}</span>
            <span className={styles.rowSpent}>
                <span className={styles.rowSpentValue}>{formatMoney(period.Spent)}</span>
                <ProgressMeter
                    height={6}
                    percent={budgetPercent(period)}
                    state={budgetState(period)}
                    alertPercent={period.AlertPercent}
                />
            </span>
        </div>
    );
}
