import { useId, useMemo, useState, type PointerEvent } from "react";
import styles from "./charts.module.css";
import { cx } from "./form";
import { formatMoney } from "@/lib/money";
import { formatDate, parts } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   SVG à mão, sem biblioteca de gráficos.

   O layout desenha os dois gráficos em SVG inline, e eles são uma
   linha e um anel — uma lib de gráficos traria layout engine,
   escalas, temas e animação para fazer isso, e o plano já avisa que o
   bundle (~106 kB gzip) costuma dobrar aí. O que se ganharia em
   configuração se perderia em controle da paleta, que aqui é
   exatamente o que precisa ficar preso ao sistema.

   Duas regras que valem para os dois desenhos:

   - identidade NUNCA é só cor. Toda fatia tem rótulo direto na
     legenda, com valor e porcentagem, e existe uma visão em tabela.
     Isso não é zelo: dois dos oito tons da paleta do layout têm
     contraste abaixo de 3:1 contra o branco (ver src/lib/categoryColor.ts).
   - grade e eixos são recessivos; quem aparece é o dado.
   ════════════════════════════════════════════════════════════ */

/* ── Gráfico de linha ─────────────────────────────────────── */

export interface LinePoint {
    date: ApiTypes.CalendarDate;
    value: ApiTypes.Money;
}

/** Gasto por dia do mês.
 *
 *  Uma série só: sem caixa de legenda, porque o título já a nomeia. O
 *  eixo Y começa em zero sempre — cortar a base de um gráfico de
 *  dinheiro exagera a variação e é a distorção mais fácil de cometer
 *  sem perceber. */
export function LineChart({
    points,
    height = 220,
    color = "var(--brand)",
}: {
    points: readonly LinePoint[];
    height?: number;
    color?: string;
}) {
    const gradientId = useId();
    const [hover, setHover] = useState<number | null>(null);

    const width = 720;
    const padding = { top: 16, right: 16, bottom: 26, left: 52 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const max = Math.max(...points.map((point) => point.value), 0);
    // Um teto redondo acima do maior valor: a linha nunca encosta no topo.
    const ceiling = max === 0 ? 100 : Math.ceil((max * 1.15) / 50) * 50;

    const x = (index: number) =>
        padding.left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotWidth);
    const y = (value: number) => padding.top + plotHeight - (value / ceiling) * plotHeight;

    const path = useMemo(
        () =>
            points
                .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(point.value)}`)
                .join(" "),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [points, ceiling, height],
    );

    const areaPath = useMemo(() => {
        if (points.length === 0) return "";
        return `${path} L${x(points.length - 1)} ${padding.top + plotHeight} L${x(0)} ${padding.top + plotHeight} Z`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path, points, height]);

    if (points.length === 0) {
        return <div className={styles.empty}>Sem gastos neste mês.</div>;
    }

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ceiling * fraction);

    /** O ponto mais próximo do cursor — não o que está exatamente sob
     *  ele. Num mês de 31 dias, cada dia tem 20px de largura e exigir
     *  precisão faria o tooltip piscar. */
    const onMove = (event: PointerEvent<SVGRectElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientX - box.left) / box.width;
        const index = Math.round(ratio * (points.length - 1));
        setHover(Math.min(points.length - 1, Math.max(0, index)));
    };

    const active = hover !== null ? points[hover] : null;

    return (
        <div className={styles.chart}>
            <svg
                className={styles.svg}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`Gasto por dia do mês. Maior dia: ${formatMoney(max)}.`}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            className={styles.grid}
                            x1={padding.left}
                            x2={width - padding.right}
                            y1={y(tick)}
                            y2={y(tick)}
                        />
                        <text
                            className={styles.axisText}
                            x={padding.left - 8}
                            y={y(tick) + 3.5}
                            textAnchor="end"
                        >
                            {tick >= 1000 ? `${Math.round(tick / 1000)}k` : Math.round(tick)}
                        </text>
                    </g>
                ))}

                <path className={styles.area} d={areaPath} fill={`url(#${gradientId})`} />
                <path className={styles.line} d={path} stroke={color} />

                {/* Rótulo do eixo X a cada cinco dias: um por dia
                    colidiria num mês de 31. */}
                {points.map((point, index) =>
                    index % 5 === 0 || index === points.length - 1 ? (
                        <text
                            key={point.date}
                            className={styles.axisText}
                            x={x(index)}
                            y={height - 8}
                            textAnchor="middle"
                        >
                            {parts(point.date).day}
                        </text>
                    ) : null,
                )}

                {active && hover !== null && (
                    <>
                        <line
                            className={styles.crosshair}
                            x1={x(hover)}
                            x2={x(hover)}
                            y1={padding.top}
                            y2={padding.top + plotHeight}
                        />
                        <circle
                            className={styles.marker}
                            cx={x(hover)}
                            cy={y(active.value)}
                            r={5}
                            fill={color}
                        />
                    </>
                )}

                <rect
                    className={styles.hit}
                    x={padding.left}
                    y={padding.top}
                    width={plotWidth}
                    height={plotHeight}
                    onPointerMove={onMove}
                    onPointerLeave={() => setHover(null)}
                />
            </svg>

            {active && hover !== null && (
                <div
                    className={styles.tooltip}
                    style={{
                        left: `${((x(hover) / width) * 100).toFixed(2)}%`,
                        top: `${((y(active.value) / height) * 100).toFixed(2)}%`,
                        marginTop: -10,
                    }}
                >
                    <div className={styles.tooltipLabel}>{formatDate(active.date)}</div>
                    <div className={styles.tooltipValue}>{formatMoney(active.value)}</div>
                </div>
            )}
        </div>
    );
}

/* ── Donut ────────────────────────────────────────────────── */

export interface DonutSlice {
    id: number;
    label: string;
    value: ApiTypes.Money;
    color: string;
}

/** Gasto por categoria.
 *
 *  As fatias são arcos de um `<circle>` com `stroke-dasharray`, e entre
 *  duas fatias fica um vão de 2px na cor da superfície — é a separação
 *  secundária que a paleta do layout exige para quem não distingue os
 *  tons vizinhos. */
export function DonutChart({
    slices,
    size = 190,
    onSelect,
    selected,
    centerLabel = "Total do mês",
}: {
    slices: readonly DonutSlice[];
    size?: number;
    onSelect?: (id: number | null) => void;
    selected?: number | null;
    centerLabel?: string;
}) {
    const thickness = 26;
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    const gap = 2;

    let offset = 0;

    return (
        <div className={styles.donut} style={{ width: size, height: size }}>
            <svg
                className={styles.svg}
                viewBox={`0 0 ${size} ${size}`}
                role="img"
                aria-label={`Gasto por categoria. Total ${formatMoney(total)}.`}
            >
                <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                    <circle
                        className={styles.donutTrack}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={thickness}
                    />
                    {total > 0 &&
                        slices.map((slice) => {
                            const length = (slice.value / total) * circumference;
                            // O vão sai do comprimento da fatia, não do
                            // vizinho: assim a soma continua sendo o
                            // círculo inteiro.
                            const drawn = Math.max(0, length - gap);
                            const element = (
                                <circle
                                    key={slice.id}
                                    className={cx(
                                        styles.segment,
                                        selected != null &&
                                            selected !== slice.id &&
                                            styles.segmentDim,
                                    )}
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    stroke={slice.color}
                                    strokeWidth={thickness}
                                    strokeDasharray={`${drawn} ${circumference - drawn}`}
                                    strokeDashoffset={-offset}
                                    onClick={() =>
                                        onSelect?.(selected === slice.id ? null : slice.id)
                                    }
                                />
                            );
                            offset += length;
                            return element;
                        })}
                </g>
            </svg>

            <div className={styles.donutCenter}>
                {selected != null ? (
                    (() => {
                        const slice = slices.find((item) => item.id === selected);
                        if (!slice) return null;
                        return (
                            <>
                                <div className={styles.donutLabel}>{slice.label}</div>
                                <div className={styles.donutValue}>{formatMoney(slice.value)}</div>
                                <div className={styles.donutCaption}>
                                    {total > 0
                                        ? `${Math.round((slice.value / total) * 100)}% do mês`
                                        : ""}
                                </div>
                            </>
                        );
                    })()
                ) : (
                    <>
                        <div className={styles.donutLabel}>{centerLabel}</div>
                        <div className={styles.donutValue}>{formatMoney(total)}</div>
                        <div className={styles.donutCaption}>
                            {slices.length} categoria{slices.length === 1 ? "" : "s"}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/** A legenda — e a visão em tabela.
 *
 *  Ela existe porque identidade não pode depender só da cor: cada
 *  entrada traz o nome, o valor e a fatia em porcentagem. O botão de
 *  tabela abre os mesmos números em `<table>`, que é o caminho para
 *  leitor de tela e para impressão em preto e branco. */
export function ChartLegend({
    slices,
    total,
    selected,
    onSelect,
}: {
    slices: readonly DonutSlice[];
    total: ApiTypes.Money;
    selected?: number | null;
    onSelect?: (id: number | null) => void;
}) {
    const [showTable, setShowTable] = useState(false);

    return (
        <div className={styles.legend}>
            {slices.map((slice) => (
                <button
                    key={slice.id}
                    type="button"
                    className={cx(styles.legendItem, selected === slice.id && styles.legendOn)}
                    aria-pressed={selected === slice.id}
                    onClick={() => onSelect?.(selected === slice.id ? null : slice.id)}
                >
                    <span className={styles.swatch} style={{ background: slice.color }} />
                    <span className={styles.legendName}>{slice.label}</span>
                    <span className={styles.legendValue}>{formatMoney(slice.value)}</span>
                    <span className={styles.legendPercent}>
                        {total > 0 ? `${Math.round((slice.value / total) * 100)}%` : "—"}
                    </span>
                </button>
            ))}

            <button
                type="button"
                className={styles.tableToggle}
                onClick={() => setShowTable((on) => !on)}
                aria-expanded={showTable}
            >
                {showTable ? "Esconder a tabela" : "Ver como tabela"}
            </button>

            {showTable && (
                <table className={styles.dataTable}>
                    <caption className="sr-only">Gasto por categoria no mês</caption>
                    <thead>
                        <tr>
                            <th scope="col">Categoria</th>
                            <th scope="col">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {slices.map((slice) => (
                            <tr key={slice.id}>
                                <th scope="row" style={{ fontWeight: 500 }}>
                                    {slice.label}
                                </th>
                                <td>{formatMoney(slice.value)}</td>
                            </tr>
                        ))}
                        <tr>
                            <th scope="row">Total</th>
                            <td>
                                <b>{formatMoney(total)}</b>
                            </td>
                        </tr>
                    </tbody>
                </table>
            )}
        </div>
    );
}

export function DonutWithLegend({ children }: { children: React.ReactNode }) {
    return <div className={styles.donutWrap}>{children}</div>;
}
