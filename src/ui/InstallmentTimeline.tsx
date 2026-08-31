import styles from "./split.module.css";
import { cx } from "./form";
import { formatMoney, splitEvenly } from "@/lib/money";
import { addMonths, toReferenceMonth } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* Régua de parcelas — o .ptl do layout.

   Mostra, antes de salvar, o que o parcelamento vai virar: quantas
   pernas, de quanto cada uma, e em que mês caem. É onde o usuário vê
   que `TotalValue` é o total da COMPRA e não o da parcela — o erro
   mais fácil de cometer neste formulário. */

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;

export function InstallmentTimeline({
    total,
    parts,
    startDate,
    /** Quantas já foram quitadas — só faz sentido depois de gravado. */
    paidCount = 0,
}: {
    total: ApiTypes.Money | null;
    parts: number;
    startDate: ApiTypes.CalendarDate | null;
    paidCount?: number;
}) {
    if (total === null || total <= 0 || parts < 2) return null;

    // O centavo que sobra vai na PRIMEIRA parcela, como a API faz.
    const values = splitEvenly(total, parts);
    const startMonth = startDate ? toReferenceMonth(startDate) : null;

    // Acima de dois anos a régua vira um borrão de traços de 1px: aí ela
    // resume em vez de desenhar cada perna.
    const drawn = Math.min(parts, 24);

    return (
        <div className={styles.timeline}>
            <div className={styles.timelineHead}>
                <span className={styles.timelineTitle}>Como fica o parcelamento</span>
                <span className={styles.timelineValue}>
                    {parts}× de <b>{formatMoney(values[1] ?? values[0])}</b>
                    {values[0] !== values[1] && parts > 1 && (
                        <>
                            {" "}
                            · 1ª de <b>{formatMoney(values[0])}</b>
                        </>
                    )}
                </span>
            </div>

            <div className={styles.segs}>
                {Array.from({ length: drawn }, (_, index) => (
                    <i key={index} className={cx(index < paidCount ? styles.paid : styles.on)} />
                ))}
            </div>

            {startMonth && (
                <div className={styles.months}>
                    {Array.from({ length: drawn }, (_, index) => {
                        const month = addMonths(startMonth, index);
                        const monthNumber = Number(month.slice(5, 7));
                        return (
                            <span key={index} className={cx(index === 0 && styles.on)}>
                                {MONTH_INITIALS[monthNumber - 1]}
                            </span>
                        );
                    })}
                </div>
            )}

            <div className={styles.timelineNote}>
                O total informado é o da <b>compra inteira</b> ({formatMoney(total)}), não o da
                parcela. O centavo que sobra da divisão vai na primeira.
                {parts > drawn && <> Só as {drawn} primeiras aparecem na régua.</>}
            </div>
        </div>
    );
}
