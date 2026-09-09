import type { ReactNode } from "react";
import styles from "./cardList.module.css";
import { cx } from "./form";

/* ════════════════════════════════════════════════════════════
   A lista de cards do mobile — `.items` / `.item` / `.ghdr` dos frames
   de Layout/Hi-fi Mobile.

   Gastos, Renda e Contas mostram a mesma coisa num telefone: um cartão
   por linha, com descrição e etiquetas em cima, chips embaixo, e o
   valor à direita. Escrever isso três vezes é como as três telas de
   movimento acabaram cada uma com um cabeçalho diferente na leva
   anterior — então mora aqui, uma vez.

   Quem escolhe entre esta lista e a `Table` é `useIsMobile()`, não o
   CSS: ver o comentário de `src/lib/useMediaQuery.ts`.
   ════════════════════════════════════════════════════════════ */

export function CardList({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cx(styles.items, className)}>{children}</div>;
}

/** O cabeçalho de grupo da lista — "Fixos do mês", "Parcelados em
 *  curso". É o irmão mobile do `TableGroup`, e por isso mora aqui. */
export function CardGroup({ title, meta }: { title: string; meta?: ReactNode }) {
    return (
        <div className={styles.group}>
            <span>{title}</span>
            {meta !== undefined && <span className={styles.groupMeta}>{meta}</span>}
        </div>
    );
}

/** Um cartão da lista.
 *
 *  A repartição segue o layout: `title` + `badges` na primeira linha,
 *  `meta` (os chips) na segunda, e à direita `amount` com o que vier em
 *  `trailing` — o botão de quitar, o kebab.
 *
 *  Clicável é um `<div>`, nunca um `<button>`, pela mesma razão do
 *  `TableRow`: o cartão contém botões, e `<button>` dentro de
 *  `<button>` é marcação inválida. Quem carrega foco e teclado é o
 *  botão invisível em volta do título, cujo clique BORBULHA até o
 *  `onClick` do cartão — e as ações à direita só precisam parar a
 *  propagação. */
export function ItemCard({
    title,
    badges,
    meta,
    amount,
    trailing,
    onClick,
    /** Cancelado, inativo: o cartão apaga, mas continua legível. */
    faded,
    /** O nome acessível do alvo de foco, quando o título não é texto. */
    label,
}: {
    title: ReactNode;
    badges?: ReactNode;
    meta?: ReactNode;
    amount?: ReactNode;
    trailing?: ReactNode;
    onClick?: () => void;
    faded?: boolean;
    label?: string;
}) {
    const head = (
        <div className={styles.title}>
            {title}
            {badges}
        </div>
    );

    return (
        <div
            className={cx(styles.item, onClick && styles.clickable, faded && styles.faded)}
            onClick={onClick}
        >
            <div className={styles.left}>
                {onClick ? (
                    <button type="button" className={styles.trigger} aria-label={label}>
                        {head}
                    </button>
                ) : (
                    head
                )}
                {meta && <div className={styles.meta}>{meta}</div>}
            </div>

            {(amount !== undefined || trailing !== undefined) && (
                <div className={styles.right}>
                    {amount !== undefined && <div className={styles.amount}>{amount}</div>}
                    {trailing}
                </div>
            )}
        </div>
    );
}
