import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { BudgetController, type BudgetContext, type BudgetLine } from "./controller";
import { previousMonth } from "./sections/cloneBudgetMonth";
import { useMonthScope } from "@/app/monthScope";
import { useCategories, usePersons } from "@/data/catalogs";
import {
    useBudgetPreview,
    useInvalidateMovement,
    useMonthBudgets,
    useMonthReport,
} from "@/data/month";
import { Button, Card, Workspace as Page } from "@/ui/primitives";
import { Topbar } from "@/ui/topbar";
import { SplitEditor, type SplitOption } from "@/ui/SplitEditor";
import { ProgressMeter } from "@/ui/budget";
import { FormError, FormNotice, cx } from "@/ui/form";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconAlert, IconChevronDown, IconPlus } from "@/ui/icons";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import {
    budgetChain,
    budgetPercent,
    budgetRemaining,
    budgetState,
    budgetTargetKey,
    budgetTargetName,
    sumMoney,
} from "@/lib/aggregate";
import { categoryColor, paletteColor } from "@/lib/categoryColor";
import { formatDate, formatMonthLabel, formatMonthShort } from "@/lib/date";
import { formatAmount, formatMoney, fromCents, toCents } from "@/lib/money";
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

   ── A tela abre pela CADEIA do que sobra, não pela renda ──

   Até a leva 10 ela abria pelos três números da renda — "entrou 3.200 ·
   a receber 1.800 · total 5.000" — e repartia aquele total. O número que
   abriu a leva 11 foi esse: 10.226 de renda, 5.254 **já com dono** (o
   aluguel de uma série `fixed` lançada meses atrás, a parcela 7/10 de
   uma compra de abril), e a tela anunciando 10.226 a distribuir. A sobra
   mentia por 5.254, e nada digitado aqui mudaria aqueles 5.254: eles já
   estavam no banco, com competência neste mês, antes de a tela abrir.

   **O orçamento passou a repartir o que SOBRA da renda**, e a cadeia é:

       Em conta no dia 1º            OpeningBalance
     + Renda do mês                  Inflows
     − Fixos do mês                  ExpensesFixed
     − Parcelas do mês               ExpensesInstallments
     ± Ajustes de virada             os quatro termos-ponte
     ──────────────────────────────────────────────────────
     = Livre para o mês                                      <- o total do rateio
     − Avulso já gasto               ExpensesSingle
     ──────────────────────────────────────────────────────
     = Ainda posso gastar            ** = Available **       <- o número do Início

   **Ela é uma DECOMPOSIÇÃO do `Available`, não uma fórmula nova.** Todos
   os termos vêm prontos de `GET /Reports/Month`, e o que acontece aqui é
   soma e subtração em centavos — `budgetChain`, em src/lib/aggregate.ts,
   com teste. A propriedade que a torna verificável é `Livre −
   ExpensesSingle = Available`: a última linha bate **ao centavo** com o
   "Restante" do Início, por identidade e não por coincidência. Se um dia
   não bater, é a cadeia que está errada.

   Os quatro termos-ponte ficam numa linha EXPANSÍVEL, e os dois motivos
   se puxam: aberta, a tela abre com sete linhas de contabilidade;
   escondida, a cadeia não fecha visivelmente — e uma cadeia que não
   fecha é pior do que nenhuma. O preço de juntá-los é de rótulo: numa
   tela de novembro, a fatura que vence semana que vem aparece sob um
   termo chamado "vencido". A nota de dentro diz isso.

   ── A perna comprometida saiu do CASAMENTO, não só do topo ──

   Se o fixo e a parcela fossem descontados aqui em cima e as fatias
   continuassem contando tudo, a perna do aluguel em "Moradia" seria
   subtraída DUAS vezes — e erraria na direção do pânico, mostrando
   estouro onde não há. Por isso o `getPortions` da API filtra
   `Kind = 'single'`: o `Spent` de cada fatia e o `Unbudgeted` do mês são
   de avulso, e só.

   O preço é de rótulo e fica NA TELA: "Mercado" aqui não bate mais com
   "Mercado" no Relatório, onde a soma é de tudo. São perguntas
   diferentes, e é por isso que a palavra **avulso** aparece escrita ao
   lado da régua — o mesmo preço que o `Unbudgeted` já paga desde a
   leva 9: a exclusão fica visível em vez de silenciosa.

   ── E nenhum número da rota é somado do zero aqui ──

   Os três da renda saem inteiros de `GET /Reports/Month`: somar as
   entradas do mês no cliente para conferir seria refazer o filtro de
   transferência e o de cancelada — as duas regras que, replicadas, fazem
   o mesmo dinheiro ser contado duas vezes. O que a tela soma é o que ela
   mesma escreveu: o total ALOCADO, que é a soma das linhas que o usuário
   está editando, e a sobra que sai dele.

   ── O rateio daqui NÃO precisa fechar ──

   É a diferença com os dois eixos do gasto, e ela está no
   `closure="loose"` do SplitEditor: lá a soma tem que bater com o total
   ou é 406; aqui sobrar é o normal — o que não foi alocado é,
   literalmente, o que ainda não foi orçado. O que a tela sinaliza é o
   ESTOURO, e mesmo ele não impede salvar: o que sobra da renda ainda
   pode crescer, e a API não lê total nenhum para responder.

   ── Mês fechado abre em LEITURA ──

   O `ClosedAt` que a rotina do dia 1º carimba é a trava que impede
   reescrever a história de agosto em novembro: a API responde 403 a
   qualquer escrita, e a tela não oferece um controle que sempre
   falharia — ela mostra a data do fechamento no lugar deles.
   ════════════════════════════════════════════════════════════ */

/** Uma linha da cadeia: o sinal, o que ela é, e o valor.
 *
 *  **O sinal não é decoração e por isso não é `aria-hidden`:** sem ele a
 *  linha "Fixos do mês R$ 3.454,00" não diz que o número está sendo
 *  subtraído, e é justamente a direção de cada termo que faz a cadeia
 *  fechar. "−" e "=" são lidos como tal.
 *
 *  O valor chega FORMATADO, e isso é de propósito: quem decide mostrar o
 *  traço enquanto a rota não respondeu é a tela, num lugar só (`money`). */
function ChainRow({
    sign,
    label,
    caption,
    value,
    tone,
}: {
    sign?: string;
    label: string;
    caption?: string;
    value: string;
    /** `total` é o "Livre para o mês" e `final` é o "Ainda posso gastar" —
     *  as duas linhas que a tela compõe, destacadas por isso. */
    tone?: "total" | "final";
}) {
    return (
        <div
            className={cx(
                styles.chainRow,
                tone === "total" && styles.chainRowTotal,
                tone === "final" && styles.chainRowFinal,
            )}
        >
            <span className={styles.chainSign}>{sign}</span>
            <span className={styles.chainLabel}>
                {label}
                {caption && <span className={styles.chainCaption}>{caption}</span>}
            </span>
            <span className={styles.chainValue}>{value}</span>
        </div>
    );
}

/** O comprometido ao lado de uma linha do rateio — e **só de avulso**,
 *  com a palavra escrita.
 *
 *  O rótulo é o preço de o fixo e a parcela saírem do casamento (ver o
 *  cabeçalho), e ele fica na tela porque sem ele o mesmo nome mostraria
 *  dois números em duas telas sem nada explicando a diferença. */
function RowSpent({ spent, children }: { spent: ApiTypes.Money; children: ReactNode }) {
    return (
        <span className={styles.rowSpent}>
            <span className={styles.rowSpentValue}>
                {formatMoney(spent)} <span className={styles.rowSpentTag}>avulso</span>
            </span>
            {children}
        </span>
    );
}

/** **O que sobrou (ou faltou) da MESMA fatia no mês anterior.**
 *
 *  O caso que a pediu: 300 para jogos, 150 gastos de propósito, para
 *  comprar um jogo de 450 no mês seguinte. Ao montar o mês seguinte nada
 *  na tela dizia que sobraram 150 — e esse é justamente o número que
 *  justifica digitar 450.
 *
 *  **É INFORMAÇÃO, e não alimenta a matemática.** Ela não entra na
 *  cadeia, não vira teto, não muda o `total` do editor nem a sobra do
 *  rateio. Quem acumula a sobra é o `OpeningBalance` dentro da cadeia, e
 *  globalmente — é isso que dissolve a limitação de olhar UM mês para
 *  trás: se a poupança para o jogo levou três meses, os três já estão
 *  dentro do "Livre para o mês". Esta linha explica **de onde o dinheiro
 *  veio**, não quanto existe.
 *
 *  **O mês vai escrito no rótulo** porque a linha fala de outro mês que
 *  não o da tela, e com o ano junto: em janeiro, "dez" sozinho seria
 *  dezembro de qual?
 *
 *  O sinal troca o rótulo e a cor — `budgetRemaining` é assinado, e
 *  negativo é estouro. Zero cai em "sobrou", e está certo: a fatia
 *  existiu e foi gasta inteira. O que NÃO pode aparecer como zero é a
 *  fatia que não existia, e quem garante isso é o chamador: sem fatia no
 *  mês anterior não há componente. "Sobrou 0" e "não havia fatia" são
 *  fatos diferentes. */
function RowCarry({
    month,
    period,
}: {
    month: ApiTypes.ReferenceMonth;
    period: ApiTypes.BudgetPeriod;
}) {
    const remaining = budgetRemaining(period);
    const missed = remaining < 0;

    return (
        <span className={cx(styles.rowCarry, missed && styles.rowCarryMissed)}>
            {formatMonthShort(month)}: {formatAmount(period.LimitValue)} orçado ·{" "}
            {missed ? "faltou" : "sobrou"} {formatAmount(Math.abs(remaining))}
        </span>
    );
}

/** A linha em branco do rateio. Os DOIS alvos nascem vazios: a fatia
 *  pode ser de pessoa, de categoria, ou das duas. */
const emptyBudgetLine = (): BudgetLine => ({ id: null, secondaryId: null, value: null });

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

    /* ── O mês ANTERIOR, lido SEMPRE ──────────────────────────
       Ele responde DUAS perguntas desta tela, e por isso deixou de ser
       uma leitura condicional:

       - quantas fatias o botão de clonar vai trazer — e um botão que não
         diz o tamanho do que faz é um botão que ninguém clica;
       - **quanto sobrou de cada fatia no mês passado**, que é o número
         que justifica o valor que a pessoa vai digitar aqui. 300 para
         jogos com 150 gastos de propósito é o que explica 450 agora, e
         enquanto esta leitura era gateada pelo mês vazio o número não
         existia em lugar nenhum do produto.

       Custa UMA requisição por visita, na mesma chave de cache que
       navegar até lá já usaria — a resposta é reaproveitada nos dois
       sentidos. */
    const previous = previousMonth(month);
    const previousBudgets = useMonthBudgets(previous);

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

    /* ── Os termos da cadeia, todos vindos da rota ────────────
       Ver o cabeçalho. `Inflows` é competência — pendente junto com
       recebida —, porque orçar só o que já caiu na conta seria orçar
       depois do mês ter acabado. */
    const received = report.data?.InflowsReceived ?? 0;
    const expected = report.data?.InflowsPending ?? 0;
    const income = report.data?.Inflows ?? 0;
    const opening = report.data?.OpeningBalance ?? 0;
    const fixed = report.data?.ExpensesFixed ?? 0;
    const installments = report.data?.ExpensesInstallments ?? 0;
    const single = report.data?.ExpensesSingle ?? 0;
    /* Os quatro termos-ponte, que existem porque a abertura é CAIXA e o
       fluxo é COMPETÊNCIA: a abertura de novembro lida em outubro não tem
       o salário que ainda não caiu nem a fatura que ainda não foi paga, e
       os quatro capturam exatamente esses — cada perna uma vez só. */
    const initialBalances = report.data?.InitialBalances ?? 0;
    const pastCommitments = report.data?.PastCommitments ?? 0;
    const overdueReceivable = report.data?.OverdueReceivable ?? 0;
    const overduePayable = report.data?.OverduePayable ?? 0;

    /* **O que sobra da renda, e o que ainda dá para gastar.** A conta
       inteira é uma decomposição do `Available` da rota, em centavos e com
       teste — ver `budgetChain`. `chain.available` é o `Available` de
       volta, ao centavo: é ele que faz a última linha desta tela pousar no
       mesmo número que o "Restante" do Início. */
    const chain = budgetChain(report.data);

    /** Enquanto a rota não respondeu, o traço — um zero aqui seria um
     *  número, e um número errado. */
    const money = (value: ApiTypes.Money): string => (report.isPending ? "—" : formatMoney(value));

    /* O que a tela SOMA é só o que ela mesma escreveu: as linhas do
       rascunho. Em centavos, porque somar trinta linhas em ponto
       flutuante erra o centavo do total.

       **E a sobra é medida contra o LIVRE, não contra a renda.** Era aqui
       que ela mentia: com o mês em branco a tela anunciava os 10.226
       inteiros a distribuir quando existiam 4.972. */
    const allocated = sumMoney(lines.map((line) => line.value ?? 0));
    const remainder = fromCents(toCents(chain.free) - toCents(allocated));

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

    /* ── O comprometido do alvo que está SENDO MONTADO ────────
       `GET /BudgetPeriods` devolve o `Spent` por `IdBudgetPeriod`, e uma
       fatia só tem id depois de gravada: enquanto a régua saía daí,
       nenhum alvo recém-escolhido mostrava gasto — e o par
       `(pessoa, categoria)`, que ninguém gravou ainda, nunca mostrava.
       Zero exatamente no momento em que o número decide o valor que a
       pessoa vai digitar.

       A prévia responde a mesma pergunta para um alvo que ainda não
       existe, e **com o mesmo código do servidor**: o casamento porção →
       fatia é a regra de dinheiro mais delicada do orçamento, e
       recalculá-la aqui seria a segunda cópia dela.

       A chave de cache leva o mês e os ALVOS, então ela é refeita quando
       um seletor muda e não quando um valor é digitado — é o que
       dispensa debounce. */
    const preview = useBudgetPreview(
        month,
        lines.map((line) => ({ IdCategory: line.secondaryId ?? null, IdPerson: line.id })),
    );

    /** As fatias GRAVADAS, indexadas pelo alvo — e elas continuam sendo
     *  lidas por duas coisas que a prévia não responde:
     *
     *  - o **`AlertPercent`** do medidor, que não está na resposta da
     *    prévia e não deve estar: ele é uma decisão guardada na fatia,
     *    não um cálculo do mês;
     *  - o **`Spent` enquanto a prévia não respondeu** — a resposta certa
     *    para o alvo que já existe, e a única que esta tela tinha antes.
     *    Sem isso, cada troca de seletor piscaria uma régua em zero. */
    const savedByTarget = useMemo(
        () =>
            new Map(
                periods.map((period) => [
                    budgetTargetKey(period.IdCategory, period.IdPerson),
                    period,
                ]),
            ),
        [periods],
    );

    /** **As fatias do mês ANTERIOR, indexadas pelo mesmo alvo** — é delas
     *  que sai a sobra de cada linha. O índice é o mesmo padrão do
     *  `savedByTarget` acima porque a pergunta é a mesma: a linha conhece
     *  o par `(categoria, pessoa)`, nunca o id da fatia — e o id de
     *  setembro não teria nada a ver com o de outubro de todo jeito.
     *
     *  **Enquanto a rota não respondeu o mapa está VAZIO, e nenhuma linha
     *  mostra nada.** É de propósito: um número que aparece e muda é pior
     *  que um número que aparece depois, e aqui não há sequer um valor
     *  provisório honesto a pôr no lugar — ver `RowCarry`. */
    const previousByTarget = useMemo(
        () =>
            new Map(
                (previousBudgets.data?.Periods ?? []).map((period) => [
                    budgetTargetKey(period.IdCategory, period.IdPerson),
                    period,
                ]),
            ),
        [previousBudgets.data],
    );

    /* O "fora do orçamento" também sai da prévia: é o que o faz se mover
       enquanto a pessoa monta o mês, em vez de só depois de salvar. O do
       mês gravado é o que fica no lugar até ela responder. */
    const unbudgeted = preview.data?.Unbudgeted ?? budgets.data?.Unbudgeted ?? 0;

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

                {/* ── A cadeia, que é por onde a tela abre ──────
                    Uma decomposição do `Available`: cada linha é um termo
                    que a rota já respondeu, e as duas linhas de total são
                    o que a tela compõe em centavos. Ver o cabeçalho. */}
                <Card className={styles.income}>
                    <div className={styles.chain}>
                        <ChainRow label="Em conta no dia 1º" value={money(opening)} />
                        <ChainRow
                            sign="+"
                            label="Renda do mês"
                            caption={`entrou ${money(received)} · a receber ${money(expected)}`}
                            value={money(income)}
                        />
                        <ChainRow sign="−" label="Fixos do mês" value={money(fixed)} />
                        <ChainRow sign="−" label="Parcelas do mês" value={money(installments)} />

                        {/* ── Os quatro termos-ponte ───────────────
                            Numa linha só, e expansível: aberta ela abre a
                            tela com sete linhas de contabilidade, e
                            escondida de vez a cadeia não fecharia
                            visivelmente — uma cadeia que não fecha é pior
                            do que nenhuma.

                            `<details>` nativo e não estado de React: o
                            navegador dá o teclado, o foco e o estado de
                            expandido de graça. */}
                        <details className={styles.bridge}>
                            <summary className={styles.bridgeSummary}>
                                <span className={styles.chainSign}>±</span>
                                <span className={styles.chainLabel}>
                                    Ajustes de virada
                                    <span className={styles.chainCaption}>
                                        o que a virada do mês deixa para trás
                                    </span>
                                </span>
                                <span className={styles.chainValue}>
                                    {money(chain.adjustments)}
                                </span>
                                <span className={styles.bridgeChevron} aria-hidden="true">
                                    <IconChevronDown />
                                </span>
                            </summary>

                            <div className={styles.bridgeInner}>
                                <ChainRow
                                    sign="+"
                                    label="Contas abertas dentro do mês"
                                    value={money(initialBalances)}
                                />
                                <ChainRow
                                    sign="−"
                                    label="Já pesou antes, e o dinheiro ainda está aqui"
                                    value={money(pastCommitments)}
                                />
                                <ChainRow
                                    sign="+"
                                    label="A receber vencido"
                                    value={money(overdueReceivable)}
                                />
                                <ChainRow
                                    sign="−"
                                    label="A pagar vencido"
                                    value={money(overduePayable)}
                                />
                                <p className={styles.bridgeNote}>
                                    O saldo do dia 1º é <b>caixa</b> e o resto da cadeia é{" "}
                                    <b>competência</b>: estes quatro costuram as duas bases, cada
                                    perna uma vez só. Num mês futuro, &quot;vencido&quot; quer dizer{" "}
                                    <b>de antes dele</b> — com a tela em novembro, a fatura que
                                    vence semana que vem aparece aqui.
                                </p>
                            </div>
                        </details>

                        <ChainRow
                            sign="="
                            label="Livre para o mês"
                            caption="é este o total que o rateio reparte"
                            value={money(chain.free)}
                            tone="total"
                        />
                        <ChainRow sign="−" label="Avulso já gasto" value={money(single)} />
                        <ChainRow
                            sign="="
                            label="Ainda posso gastar"
                            caption="o mesmo número do Início, ao centavo"
                            value={money(chain.available)}
                            tone="final"
                        />
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
                                    <b>{formatMoney(-remainder)}</b> acima do que sobra no mês
                                </>
                            )}
                        </span>
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
                                        ? `Fechado em ${formatDate(closedPeriod.ClosedAt)}.`
                                        : "Este mês já foi fechado."}{" "}
                                    O rateio dele não muda mais
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
                            hint="Cada linha é uma fatia do que sobra, e a régua dela mede o avulso. A pessoa, a categoria, ou as duas"
                            closure="loose"
                            options={personOptions}
                            optionLabel="Pessoa"
                            secondaryOptions={categoryOptions}
                            secondaryLabel="Categoria"
                            addLabel="Adicionar fatia"
                            lines={lines}
                            onChange={setLines}
                            /* **O total é o LIVRE, não a renda** — é a
                               troca de modelo da leva 11 chegando no
                               editor: o botão de distribuir o que sobra, a
                               sobra e o aviso de estouro passam todos a se
                               medir contra o que resta depois do fixo e da
                               parcela. */
                            total={chain.free}
                            disabled={pending}
                            rowExtra={(_, line) => {
                                const key = budgetTargetKey(line.secondaryId ?? null, line.id);
                                const period = savedByTarget.get(key);

                                /* A prévia primeiro; a fatia gravada
                                   enquanto ela não respondeu. O
                                   `AlertPercent` vem sempre da fatia — a
                                   prévia não o tem, e não deve ter. */
                                const spent =
                                    preview.data?.spentByTarget.get(key) ?? period?.Spent ?? 0;

                                /* A MESMA fatia no mês anterior, se ela
                                   existiu lá. `undefined` é o caso em que
                                   a linha não mostra sobra nenhuma — ver
                                   `RowCarry`. */
                                const last = previousByTarget.get(key);

                                return (
                                    <RowSpent spent={spent}>
                                        <ProgressMeter
                                            height={6}
                                            percent={budgetPercent({
                                                LimitValue: line.value ?? 0,
                                                Spent: spent,
                                                AlertPercent: period?.AlertPercent ?? 80,
                                            })}
                                            state={budgetState({
                                                LimitValue: line.value ?? 0,
                                                Spent: spent,
                                                AlertPercent: period?.AlertPercent ?? 80,
                                            })}
                                        />
                                        {last && <RowCarry month={previous} period={last} />}
                                    </RowSpent>
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

                            Vem da API como tudo o mais aqui, e desde a
                            leva 11 ele é **só de avulso** — o que o fez
                            voltar a significar algo afiado: avulso gasto
                            sem fatia que o cubra. Antes, quem não criava
                            fatias para cobrir os fixos (e por que
                            criaria, se o valor deles não é uma decisão?)
                            abria a tela com o aluguel inteiro em vermelho
                            aqui: o alerta mais forte da tela apontando
                            para o dinheiro mais previsível do mês.

                            A conta que fecha ganhou dois termos e segue
                            fechando: Σ `Spent` + `Unbudgeted` +
                            `ExpensesFixed` + `ExpensesInstallments` = o
                            gasto do mês. E ele vem da PRÉVIA, não do mês
                            gravado, que é o que o faz descer conforme os
                            alvos cobrem o gasto — antes de salvar. */}
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
                                    Avulso fora do orçamento
                                </span>
                                <span className={styles.unbudgetedValue}>
                                    {formatMoney(unbudgeted)}
                                </span>
                            </div>
                            <div className={styles.unbudgetedText}>
                                {unbudgeted > 0 ? (
                                    <>
                                        Este avulso do mês não casou com nenhuma fatia — o fixo e a
                                        parcela já saíram lá em cima, e não entram nesta conta. Um
                                        gasto atribuído a alguém nunca cai numa fatia só de
                                        categoria: para cobrir a pessoa por inteiro, dê a ela uma
                                        fatia <b>sem categoria</b>.
                                    </>
                                ) : (
                                    "Todo avulso do mês caiu em alguma fatia."
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
            <RowSpent spent={period.Spent}>
                <ProgressMeter
                    height={6}
                    percent={budgetPercent(period)}
                    state={budgetState(period)}
                    alertPercent={period.AlertPercent}
                />
            </RowSpent>
        </div>
    );
}
