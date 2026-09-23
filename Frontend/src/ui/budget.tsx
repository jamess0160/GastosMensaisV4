import type { ReactNode } from "react";
import styles from "./budget.module.css";
import { cx } from "./form";
import { CategoryIcon } from "./iconCatalog";
import { IconArrowDown, IconArrowUp } from "./icons";
import {
    budgetPercent,
    budgetRemaining,
    budgetState,
    budgetTargetName,
    type BudgetState,
} from "@/lib/aggregate";
import { categoryColor, paletteColor } from "@/lib/categoryColor";
import { formatMoney } from "@/lib/money";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Régua e cartão de orçamento.

   O ALERTA É DO CLIENTE: a API devolve `LimitValue`, `Spent` e
   `AlertPercent`, e comparar os três é trabalho da tela. Quem faz a
   comparação é `budgetState` em src/lib/aggregate.ts, com teste — aqui
   só se desenha o resultado.
   ════════════════════════════════════════════════════════════ */

/** Régua de consumo. Passa de 100% sem quebrar: o estouro é
 *  informação, e quem apara na largura é o `Math.min`. */
export function ProgressMeter({
    percent,
    state = "ok",
    height = 8,
    alertPercent,
}: {
    percent: number;
    state?: BudgetState;
    height?: number;
    /** Desenha a marca do alerta na régua. */
    alertPercent?: number;
}) {
    return (
        <div
            className={styles.meter}
            style={{ height }}
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <i
                className={cx(styles.fill, state === "alert" && styles.fillAlert)}
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
            {alertPercent !== undefined && alertPercent < 100 && (
                <span className={styles.alertMark} style={{ left: `${alertPercent}%` }} />
            )}
        </div>
    );
}

const STATE_LABEL: Record<BudgetState, string> = {
    ok: "No teto",
    alert: "Atenção",
    over: "Estourou",
};

/** O cartão de uma fatia do mês — de pessoa, de categoria, ou das duas.
 *
 *  Os três formatos convivem na mesma lista, e o que a tela lê é o par
 *  que veio preenchido: não há mais um `Scope`, porque com três formatos
 *  um discriminador de dois valores mentiria. */
export function BudgetBar({
    period,
    onClick,
}: {
    period: ApiTypes.BudgetPeriod;
    onClick?: () => void;
}) {
    const state = budgetState(period);
    const percent = budgetPercent(period);
    const remaining = budgetRemaining(period);
    const name = budgetTargetName(period);
    /* Pessoa não tem cor cadastrada; a paleta dá uma estável pelo id, a
       mesma que a quebra "Por destino" do Início usa. Com pessoa no alvo
       é ela que manda, inclusive na fatia de pessoa + categoria: a cor
       serve para achar a fatia na lista, e o que distingue "Luana em
       mercado" de "mercado" é a Luana. */
    const color =
        period.IdPerson !== null
            ? paletteColor(period.IdPerson)
            : period.Category
              ? categoryColor(period.Category)
              : "var(--ink-3)";

    const content = (
        <>
            <div className={styles.head}>
                <span className={styles.name}>
                    <span
                        className={styles.dot}
                        style={{ background: state === "over" ? "#fff" : color }}
                    />
                    <span className={styles.nameText}>{name}</span>
                </span>
                <span
                    className={cx(
                        styles.chip,
                        state === "over"
                            ? styles.chipOver
                            : state === "alert"
                              ? styles.chipAlert
                              : styles.chipOk,
                    )}
                >
                    {STATE_LABEL[state]}
                </span>
            </div>

            <div className={styles.value}>
                <span className={styles.big}>{formatMoney(period.Spent)}</span>
                <span className={styles.of}>de {formatMoney(period.LimitValue)}</span>
            </div>

            <ProgressMeter
                percent={percent}
                state={state}
                alertPercent={state === "over" ? undefined : period.AlertPercent}
            />

            <div className={styles.status}>
                <span>{Math.round(percent)}% do teto</span>
                <span>
                    {remaining >= 0
                        ? `${formatMoney(remaining)} disponíveis`
                        : `${formatMoney(-remaining)} acima`}
                </span>
            </div>
        </>
    );

    if (!onClick) {
        return <div className={cx(styles.budget, state === "over" && styles.over)}>{content}</div>;
    }

    return (
        <button
            type="button"
            className={cx(styles.budget, state === "over" && styles.over)}
            onClick={onClick}
            aria-label={`Editar o teto de ${name}`}
        >
            {content}
        </button>
    );
}

/** A versão de uma linha — a quebra de gasto por categoria. */
export function BreakdownRow({
    label,
    iconKey,
    color,
    amount,
    percent,
}: {
    label: string;
    iconKey?: string | null;
    color: string;
    amount: ApiTypes.Money;
    percent: number;
}) {
    return (
        <div className={styles.row}>
            <div className={styles.rowTop}>
                {iconKey !== undefined ? (
                    <span style={{ color, display: "inline-flex", width: 16, height: 16 }}>
                        <CategoryIcon iconKey={iconKey} />
                    </span>
                ) : (
                    <span className={styles.dot} style={{ background: color }} />
                )}
                <span className={styles.rowName}>{label}</span>
                <span className={styles.rowAmount}>{formatMoney(amount)}</span>
            </div>
            <div className={styles.rowBar}>
                <ProgressMeter percent={percent} height={6} />
                <span className={styles.rowPercent}>{Math.round(percent)}%</span>
            </div>
        </div>
    );
}

/* ── KPI ──────────────────────────────────────────────────── */

export function KpiCard({
    label,
    value,
    caption,
    tone = "neutral",
    badge,
}: {
    label: string;
    value: ApiTypes.Money | string;
    caption?: ReactNode;
    tone?: "neutral" | "pos" | "neg";
    badge?: ReactNode;
}) {
    const money = typeof value === "number";

    return (
        <div
            className={cx(
                styles.kpi,
                tone === "neg" && styles.kpiNeg,
                tone === "pos" && styles.kpiPos,
            )}
        >
            <div className={styles.kpiTop}>
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.7px",
                        textTransform: "uppercase",
                        color: "var(--ink-2)",
                    }}
                >
                    {label}
                </span>
                {badge}
            </div>
            <div className={styles.kpiValue}>
                {money && <span className={styles.kpiCurrency}>R$</span>}
                <span className={styles.kpiBig}>
                    {money ? formatMoney(value).replace("R$", "").trim() : value}
                </span>
            </div>
            {caption && <div className={styles.kpiCaption}>{caption}</div>}
        </div>
    );
}

/** Pílula de variação. `direction` é explícito porque "subiu" é bom na
 *  renda e ruim no gasto — o sinal do número não diz qual dos dois. */
export function DeltaPill({
    children,
    tone = "neutral",
    direction,
}: {
    children: ReactNode;
    tone?: "neutral" | "pos" | "neg" | "mute";
    direction?: "up" | "down";
}) {
    return (
        <span
            className={cx(
                styles.delta,
                tone === "pos" && styles.deltaUp,
                tone === "neg" && styles.deltaDown,
                tone === "mute" && styles.deltaMute,
            )}
        >
            {direction === "up" && <IconArrowUp />}
            {direction === "down" && <IconArrowDown />}
            {children}
        </span>
    );
}
