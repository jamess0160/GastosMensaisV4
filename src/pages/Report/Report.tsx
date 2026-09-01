import { useMemo, useState } from "react";
import styles from "./src/styles.module.css";
import { useCategoryIndex } from "@/data/catalogs";
import { useMonthLegs } from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { MonthPicker } from "@/ui/controls";
import { ChartLegend, DonutChart, DonutWithLegend, LineChart } from "@/ui/charts";
import { KpiCard } from "@/ui/budget";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import { spentByCategory, spentByDay, sumMoney, totalSpent } from "@/lib/aggregate";
import { categoryColor } from "@/lib/categoryColor";
import { currentMonth, daysOfMonth, formatDate, formatMonthLabel } from "@/lib/date";

export function Report() {
    const [month, setMonth] = useState(currentMonth);
    const [selected, setSelected] = useState<number | null>(null);

    const { legs, isPending, isError, error } = useMonthLegs(month);
    const categoryIndex = useCategoryIndex();

    const days = useMemo(() => daysOfMonth(month), [month]);

    /* O drill: escolher uma categoria filtra AS PERNAS, e as duas
       visões se redesenham a partir do mesmo recorte. É por isso que a
       linha e o donut nunca discordam — elas leem a mesma lista. */
    const shown = useMemo(
        () =>
            selected === null ? legs : legs.filter((leg) => leg.expense.IdCategory === selected),
        [legs, selected],
    );

    const byDay = useMemo(() => spentByDay(shown, days), [shown, days]);
    const points = useMemo(
        () => days.map((date, index) => ({ date, value: byDay[index] })),
        [days, byDay],
    );

    /* O donut sempre mostra o mês inteiro: se ele se redesenhasse com o
       recorte, a fatia escolhida viraria 100% e o gráfico perderia a
       comparação que é a razão de ele existir. */
    const slices = useMemo(
        () =>
            spentByCategory(legs).map((slice) => {
                const category = categoryIndex.get(slice.IdCategory);
                return {
                    id: slice.IdCategory,
                    label: category?.Description ?? "Sem categoria",
                    value: slice.value,
                    color: category ? categoryColor(category) : "#6e6a66",
                };
            }),
        [legs, categoryIndex],
    );

    const total = totalSpent(legs);
    const shownTotal = totalSpent(shown);
    const busiest = points.reduce((best, point) => (point.value > best.value ? point : best), {
        date: days[0] ?? "",
        value: 0,
    });
    const daysWithSpend = points.filter((point) => point.value > 0).length;
    const average = daysWithSpend > 0 ? shownTotal / daysWithSpend : 0;

    const selectedName =
        selected !== null ? (categoryIndex.get(selected)?.Description ?? "categoria") : null;

    return (
        <Page>
            <div className={styles.topbar}>
                <PageHead
                    title="Relatório"
                    subtitle={`${formatMonthLabel(month)} · soma de parcelas pela data em que cada uma pesa`}
                />
                <MonthPicker month={month} onChange={setMonth} />
            </div>

            {isError ? (
                <ErrorState error={error} />
            ) : isPending ? (
                <Card padded={false}>
                    <LoadingRows rows={6} />
                </Card>
            ) : legs.length === 0 ? (
                <EmptyState
                    title="Nenhum gasto neste mês"
                    description="O relatório é feito dos lançamentos — sem eles não há o que desenhar."
                />
            ) : (
                <>
                    <div className={styles.kpis}>
                        <KpiCard
                            label={selectedName ? `Gasto em ${selectedName}` : "Gasto no mês"}
                            value={shownTotal}
                            caption={
                                selectedName
                                    ? `${total > 0 ? Math.round((shownTotal / total) * 100) : 0}% do mês`
                                    : "Soma das parcelas que pesam neste mês"
                            }
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
                                    Dia a dia
                                    {selectedName && ` · ${selectedName}`}
                                </div>
                                <div className={styles.sectionSub}>
                                    Cada parcela cai no dia em que ela vence, não no da compra.
                                </div>
                            </div>
                            {selected !== null && (
                                <Button size="sm" onClick={() => setSelected(null)}>
                                    Ver o mês inteiro
                                </Button>
                            )}
                        </div>

                        <Card>
                            <LineChart points={points} />
                        </Card>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionHead}>
                            <div>
                                <div className={styles.sectionTitle}>Por categoria</div>
                                <div className={styles.sectionSub}>
                                    Clique numa fatia para ver só ela no gráfico de cima.
                                </div>
                            </div>
                        </div>

                        <Card>
                            <DonutWithLegend>
                                <DonutChart
                                    slices={slices}
                                    selected={selected}
                                    onSelect={setSelected}
                                />
                                <ChartLegend
                                    slices={slices}
                                    total={sumMoney(slices.map((slice) => slice.value))}
                                    selected={selected}
                                    onSelect={setSelected}
                                />
                            </DonutWithLegend>
                        </Card>
                    </div>
                </>
            )}
        </Page>
    );
}
