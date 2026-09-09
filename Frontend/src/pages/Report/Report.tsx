import { useMemo, useState } from "react";
import styles from "./src/styles.module.css";
import { ReportController, type ReportContext } from "./controller";
import { useCategories, useCategoryIndex, usePaymentMethods, usePersons } from "@/data/catalogs";
import { useRangeLegs } from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { ClearFilters, FilterBar, FilterMultiSelect, SearchInput } from "@/ui/controls";
import { DateInput } from "@/ui/form";
import { EChart, token } from "@/ui/echart";
import { KpiCard } from "@/ui/budget";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconCard, IconRepeat, IconTag, METHOD_ICON } from "@/ui/icons";
import { IconExport } from "@/app/icons";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import {
    legCompetence,
    spentByCategory,
    spentByDay,
    spentByMonthCategory,
    totalSpent,
} from "@/lib/aggregate";
import { accentColor, categoryColor } from "@/lib/categoryColor";
import { useIsMobile } from "@/lib/useMediaQuery";
import { formatMoney } from "@/lib/money";
import {
    addMonths,
    currentMonth,
    daysBetween,
    formatDate,
    formatMonthLabel,
    formatShort,
    monthRange,
    parts,
    toReferenceMonth,
} from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O Relatório é a única tela que olha PERÍODO, e não mês.

   Por isso ele fica fora do mês compartilhado do chassi: aqui a
   pergunta é "quanto gastei no trimestre", e um seletor de mês não a
   responde. O período tem presets para o que se pergunta sempre, e
   `From`/`To` para o resto.

   Os três desenhos são o MESMO recorte visto de três jeitos — a linha
   mostra quando, as barras mostram como o mês se compõe, o donut mostra
   o peso de cada categoria. Um de cada vez, pelo `switcher`: empilhar
   os três obrigaria a rolar para comparar.
   ════════════════════════════════════════════════════════════ */

type Preset = "month" | "previous" | "quarter" | "year" | "custom";
type View = "line" | "bars" | "donut";

interface Range {
    From: ApiTypes.CalendarDate;
    To: ApiTypes.CalendarDate;
}

const PRESET_LABEL: Record<Preset, string> = {
    month: "Este mês",
    previous: "Mês passado",
    quarter: "Trimestre",
    year: "Ano",
    custom: "Custom",
};

/** O período de cada preset. O trimestre é ESTE mês e os dois
 *  anteriores — não o trimestre do calendário: em março, "trimestre"
 *  que devolvesse janeiro a março esconderia justamente o mês corrente
 *  quando ele mal começou. */
function rangeOf(preset: Preset, current = currentMonth()): Range {
    switch (preset) {
        case "previous":
            return monthRange(addMonths(current, -1));
        case "quarter":
            return {
                From: monthRange(addMonths(current, -2)).From,
                To: monthRange(current).To,
            };
        case "year": {
            const { year } = parts(monthRange(current).From);
            return { From: `${year}-01-01`, To: `${year}-12-31` };
        }
        default:
            return monthRange(current);
    }
}

const KIND_LABEL: Record<ApiTypes.ExpenseKind, string> = {
    single: "Avulso",
    installment: "Parcelado",
    fixed: "Fixo",
};

const KIND_ICON: Record<ApiTypes.ExpenseKind, React.ReactNode> = {
    single: <IconTag />,
    installment: <IconCard />,
    fixed: <IconRepeat />,
};

export function Report() {
    const isMobile = useIsMobile();

    const [preset, setPreset] = useState<Preset>("month");
    const [range, setRange] = useState<Range>(() => rangeOf("month"));
    const [view, setView] = useState<View>("line");

    const [search, setSearch] = useState("");
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [kinds, setKinds] = useState<ApiTypes.ExpenseKind[]>([]);
    const [idCategories, setIdCategories] = useState<number[]>([]);
    const [idPersons, setIdPersons] = useState<number[]>([]);
    const [idMethods, setIdMethods] = useState<number[]>([]);

    const pickPreset = (next: Preset) => {
        setPreset(next);
        if (next !== "custom") setRange(rangeOf(next));
    };

    const { legs, months, isPending, isError, error } = useRangeLegs(
        toReferenceMonth(range.From),
        toReferenceMonth(range.To),
    );

    const categories = useCategories();
    const categoryIndex = useCategoryIndex();
    const persons = usePersons();
    const methods = usePaymentMethods();

    /* ── O recorte ─────────────────────────────────────────────
       Um predicado só, sobre PERNAS — e todos os cinco filtros são
       respondidos pela própria perna, inclusive destino e forma de
       pagamento, que antes custavam um `get(id)` por gasto do período.
       O intervalo é aparado aqui, no dia: o cache trabalha em meses
       inteiros, e um período que começa no dia 10 não pode trazer os
       nove primeiros junto. */
    const shown = useMemo(() => {
        const term = search.trim().toLowerCase();

        return legs.filter((leg) => {
            const day = legCompetence(leg).slice(0, 10);
            if (day < range.From || day > range.To) return false;

            if (kinds.length > 0 && !kinds.includes(leg.expense.Kind)) return false;
            if (idCategories.length > 0 && !idCategories.includes(leg.expense.IdCategory)) {
                return false;
            }
            if (term && !leg.expense.Description.toLowerCase().includes(term)) return false;

            if (idMethods.length > 0 && !idMethods.includes(leg.payment.IdPaymentMethod)) {
                return false;
            }
            if (
                idPersons.length > 0 &&
                !leg.persons.some((person) => idPersons.includes(person.IdPerson))
            ) {
                return false;
            }

            return true;
        });
    }, [legs, range, kinds, idCategories, idPersons, idMethods, search]);

    /* O contexto do único evento da tela. O período é o mesmo que os
       gráficos estão mostrando — é dele que sai o recorte da planilha. */
    const context = useMemo<ReportContext>(
        () => ({
            range,
            beginExport() {
                setExporting(true);
                setExportError(null);
            },
            failExport(message) {
                setExporting(false);
                setExportError(message);
            },
            finishExport() {
                setExporting(false);
            },
        }),
        [range],
    );

    const days = useMemo(() => daysBetween(range.From, range.To), [range]);
    const byDay = useMemo(() => spentByDay(shown, days), [shown, days]);

    const slices = useMemo(
        () =>
            spentByCategory(shown).map((slice) => {
                const category = categoryIndex.get(slice.IdCategory);
                return {
                    id: slice.IdCategory,
                    label: category?.Description ?? "Sem categoria",
                    value: slice.value,
                    color: category ? categoryColor(category) : "#6e6a66",
                };
            }),
        [shown, categoryIndex],
    );

    const grouped = useMemo(() => spentByMonthCategory(shown, months), [shown, months]);

    /* ── Números do topo ─────────────────────────────────────── */
    const total = totalSpent(shown);
    const busiest = days.reduce(
        (best, date, index) => (byDay[index] > best.value ? { date, value: byDay[index] } : best),
        { date: days[0] ?? "", value: 0 },
    );
    const daysWithSpend = byDay.filter((value) => value > 0).length;
    const average = daysWithSpend > 0 ? total / daysWithSpend : 0;

    const hasFilters =
        kinds.length > 0 ||
        idCategories.length > 0 ||
        idPersons.length > 0 ||
        idMethods.length > 0 ||
        search.trim() !== "";

    const clearAll = () => {
        setKinds([]);
        setIdCategories([]);
        setIdPersons([]);
        setIdMethods([]);
        setSearch("");
    };

    const toggleCategory = (idCategory: number) =>
        setIdCategories((current) =>
            current.includes(idCategory)
                ? current.filter((id) => id !== idCategory)
                : [...current, idCategory],
        );

    /* ── As três opções do ECharts ─────────────────────────────
       Elas leem os tokens do sistema em vez de trazer paleta própria:
       o canvas não enxerga `var(--ink-2)`, mas duplicar hexadecimal
       criaria uma segunda paleta para envelhecer sozinha. */
    const axis = { ink: token("--ink-2"), faint: token("--ink-3"), line: token("--border") };

    const lineOption = useMemo(
        () => ({
            grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
            tooltip: {
                trigger: "axis",
                valueFormatter: (value: number) => formatMoney(value),
            },
            xAxis: {
                type: "category",
                data: days.map((day) => formatShort(day)),
                axisLine: { lineStyle: { color: axis.line } },
                axisTick: { show: false },
                axisLabel: { color: axis.faint, fontSize: 11 },
            },
            yAxis: {
                type: "value",
                splitLine: { lineStyle: { color: axis.line } },
                axisLabel: { color: axis.faint, fontSize: 11 },
            },
            series: [
                {
                    name: "Gasto no dia",
                    type: "line",
                    smooth: true,
                    showSymbol: days.length <= 62,
                    data: byDay,
                    itemStyle: { color: token("--brand") },
                    areaStyle: { color: token("--brand-tint"), opacity: 0.55 },
                },
            ],
        }),
        [days, byDay, axis.faint, axis.line],
    );

    const barsOption = useMemo(
        () => ({
            /* A grade abre espaço para a legenda: `containLabel` cuida
               do eixo, e do espaço da legenda quem cuida é este recuo.
               Sem ele, ela fica POR CIMA das barras mais altas.

               No desktop a legenda vai em cima (ler o nome antes do
               desenho é o que diz de que cor é o quê); no telefone vai
               embaixo, onde não disputa altura com o gráfico. */
            grid: {
                left: 8,
                right: 16,
                top: isMobile ? 12 : 44,
                bottom: isMobile ? 48 : 8,
                containLabel: true,
            },
            tooltip: { trigger: "axis", valueFormatter: (value: number) => formatMoney(value) },
            legend: {
                type: "scroll",
                left: "center",
                ...(isMobile ? { bottom: 0 } : { top: 0 }),
                textStyle: { color: axis.ink, fontSize: 11 },
            },
            xAxis: {
                type: "category",
                data: months.map((month) => formatMonthLabel(month)),
                axisLine: { lineStyle: { color: axis.line } },
                axisTick: { show: false },
                /* "Maio · 2026" não cabe de pé em 390px com doze meses
                   no eixo: inclinado e escondendo o que colide, o eixo
                   continua legível em vez de virar um borrão. */
                axisLabel: {
                    color: axis.faint,
                    fontSize: 11,
                    rotate: isMobile ? 40 : 0,
                    hideOverlap: true,
                },
            },
            yAxis: {
                type: "value",
                splitLine: { lineStyle: { color: axis.line } },
                axisLabel: { color: axis.faint, fontSize: 11 },
            },
            series: grouped.map((row) => {
                const category = categoryIndex.get(row.IdCategory);
                return {
                    name: category?.Description ?? "Sem categoria",
                    type: "bar",
                    data: row.values,
                    itemStyle: {
                        color: category ? categoryColor(category) : "#6e6a66",
                        borderRadius: [3, 3, 0, 0],
                    },
                };
            }),
        }),
        [grouped, months, categoryIndex, isMobile, axis.ink, axis.faint, axis.line],
    );

    const donutOption = useMemo(
        () => ({
            tooltip: { trigger: "item", valueFormatter: (value: number) => formatMoney(value) },
            /* Legenda em coluna à direita: nome de categoria é texto
               largo, e em linha ela quebrava em três fileiras embaixo do
               anel. No telefone não há lateral para ceder — ali ela
               volta para baixo, deitada. */
            legend: {
                type: "scroll",
                textStyle: { color: axis.ink, fontSize: 11 },
                ...(isMobile
                    ? { orient: "horizontal" as const, bottom: 0, left: "center" }
                    : { orient: "vertical" as const, right: 0, top: "middle", itemGap: 10 }),
            },
            series: [
                {
                    name: "Por categoria",
                    type: "pie",
                    radius: ["42%", "66%"],
                    /* No desktop o anel fica à esquerda do meio, abrindo
                       a faixa da legenda à direita e deixando espaço
                       para os rótulos com linha de chamada; no telefone
                       volta ao centro, com a legenda embaixo. */
                    center: isMobile ? ["50%", "40%"] : ["42%", "50%"],
                    /* Fatia de 0,7% não desaparece: ela continua grande o
                       bastante para ser clicada e rotulada. */
                    minAngle: 3,
                    /* Rótulo direto na fatia, e não só cor: dois dos oito
                       tons da paleta não chegam a 3:1 contra o branco —
                       ver `src/lib/categoryColor.ts`. Identidade nunca
                       fica só na cor. */
                    label: { formatter: "{b}\n{d}%", color: axis.ink, fontSize: 11 },
                    labelLine: { lineStyle: { color: axis.line } },
                    data: slices.map((slice) => ({
                        name: slice.label,
                        value: slice.value,
                        itemStyle: { color: slice.color },
                    })),
                },
            ],
        }),
        [slices, isMobile, axis.ink, axis.line],
    );

    const option = view === "line" ? lineOption : view === "bars" ? barsOption : donutOption;

    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    return (
        <Page>
            <PageHead
                title="Relatório"
                subtitle={`${formatDate(range.From)} a ${formatDate(range.To)} · soma de parcelas pela data em que cada uma pesa`}
                actions={
                    /* Este botão exporta O PERÍODO QUE ESTÁ NA TELA, e o
                       item da sidebar exporta o histórico inteiro. São
                       dois significados, e nenhum dos dois abre um
                       segundo seletor: aqui o seletor é a tela. */
                    <Button
                        onClick={() => void ReportController.exportSpreadsheet(context)}
                        disabled={exporting}
                    >
                        <IconExport />
                        {exporting ? "Exportando…" : "Exportar para Excel"}
                    </Button>
                }
            />

            {exportError && (
                <div className={styles.exportError} role="alert">
                    {exportError}
                </div>
            )}

            {/* ── Filtros do período ─────────────────────────── */}
            <div className={styles.filterbar}>
                <div className={styles.presets}>
                    {(Object.keys(PRESET_LABEL) as Preset[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            className={preset === key ? styles.presetOn : styles.preset}
                            aria-pressed={preset === key}
                            onClick={() => pickPreset(key)}
                        >
                            {PRESET_LABEL[key]}
                        </button>
                    ))}

                    {preset === "custom" && (
                        <span className={styles.customRange}>
                            <DateInput
                                value={range.From}
                                onValueChange={(From) =>
                                    From && setRange((current) => ({ ...current, From }))
                                }
                                aria-label="Início do período"
                            />
                            <span className={styles.customTo}>até</span>
                            <DateInput
                                value={range.To}
                                onValueChange={(To) =>
                                    To && setRange((current) => ({ ...current, To }))
                                }
                                aria-label="Fim do período"
                            />
                        </span>
                    )}
                </div>

                <div className={styles.filterRow}>
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar descrição…"
                    />

                    <FilterBar>
                        <FilterMultiSelect
                            values={kinds}
                            onChange={setKinds}
                            ariaLabel="Formato"
                            allLabel="Todos os formatos"
                            options={(["single", "installment", "fixed"] as const).map((kind) => ({
                                value: kind,
                                label: KIND_LABEL[kind],
                                icon: KIND_ICON[kind],
                            }))}
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
            </div>

            {isError ? (
                <ErrorState error={error} />
            ) : isPending ? (
                <Card padded={false}>
                    <LoadingRows rows={6} />
                </Card>
            ) : shown.length === 0 ? (
                <EmptyState
                    title={hasFilters ? "Nada com esses filtros" : "Nenhum gasto no período"}
                    description={
                        hasFilters
                            ? "Limpe os filtros para ver o período inteiro."
                            : "O relatório é feito dos lançamentos — sem eles não há o que desenhar."
                    }
                />
            ) : (
                <>
                    <div className={styles.kpis}>
                        <KpiCard
                            label="Gasto no período"
                            value={total}
                            caption={`${months.length} ${months.length === 1 ? "mês" : "meses"} · soma das parcelas que pesam neles`}
                        />
                        <KpiCard
                            label="Dia mais caro"
                            value={busiest.value}
                            caption={busiest.date ? formatDate(busiest.date) : "—"}
                        />
                        <KpiCard
                            label="Média por dia com gasto"
                            value={average}
                            caption={`${daysWithSpend} dia${daysWithSpend === 1 ? "" : "s"} com lançamento`}
                        />
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionHead}>
                            <div>
                                <div className={styles.sectionTitle}>
                                    {view === "line"
                                        ? "Dia a dia"
                                        : view === "bars"
                                          ? "Mês a mês, por categoria"
                                          : "Por categoria"}
                                </div>
                                <div className={styles.sectionSub}>
                                    {view === "line"
                                        ? "Cada parcela cai no dia em que ela vence, não no da compra."
                                        : view === "bars"
                                          ? "Uma barra por categoria dentro de cada mês do período."
                                          : "Clique numa fatia para filtrar o período por ela."}
                                </div>
                            </div>

                            <div className={styles.switcher} role="group" aria-label="Visualização">
                                {(
                                    [
                                        ["line", "Linha"],
                                        ["bars", "Barras"],
                                        ["donut", "Donut"],
                                    ] as [View, string][]
                                ).map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={view === key ? styles.switchOn : undefined}
                                        aria-pressed={view === key}
                                        onClick={() => setView(key)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* O donut é um desenho redondo: esticado num
                            painel de 1600px ele fica pequeno no meio e a
                            legenda vai parar na outra ponta da tela. A
                            caixa dele é estreita e centralizada; linha e
                            barras continuam ocupando a largura, porque
                            eixo de tempo se lê melhor esticado. */}
                        <Card className={view === "donut" ? styles.donutPanel : undefined}>
                            <EChart
                                option={option}
                                /* O telefone precisa da faixa de baixo
                                   para a legenda deitada; o desktop
                                   resolve na lateral. */
                                height={isMobile ? 340 : view === "donut" ? 380 : 300}
                                ariaLabel={`Gasto no período, ${
                                    view === "line"
                                        ? "por dia"
                                        : view === "bars"
                                          ? "por mês e categoria"
                                          : "por categoria"
                                }`}
                                onPick={
                                    view === "donut"
                                        ? ({ name }) => {
                                              const slice = slices.find(
                                                  (item) => item.label === name,
                                              );
                                              if (slice) toggleCategory(slice.id);
                                          }
                                        : undefined
                                }
                            />
                        </Card>
                    </div>
                </>
            )}
        </Page>
    );
}
