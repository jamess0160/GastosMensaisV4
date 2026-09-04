import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./table.module.css";
import { cx } from "./form";
import { IconCheck } from "./icons";

/* A tabela é uma grade CSS, não um <table>: no layout as colunas são
   proporcionais e precisam alinhar entre grupos separados por
   cabeçalho, e é a grade que faz isso sem medir célula. */

export function Table({
    columns,
    children,
    className,
}: {
    /** `grid-template-columns` — as mesmas proporções do layout. */
    columns: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx(styles.table, className)}>
            {/* Duas camadas de propósito: `.scroll` é quem rola, e
                `.track` é quem tem a largura mínima. Sem o segundo, num
                telefone o cabeçalho de grupo ficaria da largura da tela
                e as linhas, mais largas — desalinhados. */}
            <div className={styles.scroll}>
                <div className={styles.track} style={{ ["--cols" as string]: columns }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export function TableHead({ children }: { children: ReactNode }) {
    return (
        <div className={styles.head} style={{ gridTemplateColumns: "var(--cols)" }} role="row">
            {children}
        </div>
    );
}

/** Linha da tabela.
 *
 *  É sempre um `<div>`, nunca um `<button>`: uma linha clicável que
 *  fosse botão não poderia conter os botões de ação — `<button>` dentro
 *  de `<button>` é HTML inválido e o navegador desmonta a marcação.
 *
 *  O clique do mouse fica no `<div>` e quem carrega o foco e o teclado é
 *  o `RowTrigger` do nome. Como um `<button>` acionado pelo teclado
 *  dispara um clique que BORBULHA, o mesmo `onClick` atende os dois — e
 *  os botões de ação só precisam parar a propagação. */
export function TableRow({
    children,
    onClick,
    selected,
    faded,
    className,
}: {
    children: ReactNode;
    onClick?: () => void;
    selected?: boolean;
    faded?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cx(
                styles.row,
                onClick && styles.clickable,
                selected && styles.selected,
                faded && styles.faded,
                className,
            )}
            style={{ gridTemplateColumns: "var(--cols)" }}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

/** O alvo de foco de uma linha clicável: envolve o nome e não tem
 *  handler próprio — quem trata é o `onClick` da linha, para onde o
 *  clique do teclado borbulha. */
export function RowTrigger({ label, children }: { label: string; children: ReactNode }) {
    return (
        <button type="button" className={styles.trigger} aria-label={label}>
            {children}
        </button>
    );
}

/** Cabeçalho de grupo — "Fixos", "Parcelas", "Avulsos" da lista de
 *  gastos. `pending` é a bolinha vermelha de "ainda tem coisa em aberto
 *  aqui". */
export function TableGroup({
    title,
    count,
    pending,
    total,
    icon,
}: {
    title: string;
    count?: number;
    pending?: number;
    total?: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <div className={styles.group}>
            <div className={styles.groupLeft}>
                {icon && <span className={cx(styles.tile)}>{icon}</span>}
                <span className={styles.groupTitle}>{title}</span>
                {count !== undefined && <span className={styles.count}>{count}</span>}
                {pending !== undefined && pending > 0 && (
                    <span className={styles.pending}>
                        <i />
                        {pending} em aberto
                    </span>
                )}
            </div>
            {total !== undefined && <span className={styles.groupTotal}>{total}</span>}
        </div>
    );
}

export function TableFoot({ children }: { children: ReactNode }) {
    return <div className={styles.foot}>{children}</div>;
}

/* ── Células ──────────────────────────────────────────────── */

export function Cell({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cx(styles.cell, className)}>{children}</div>;
}

export function CellName({ children }: { children: ReactNode }) {
    return <div className={styles.name}>{children}</div>;
}

export function CellSub({ children }: { children: ReactNode }) {
    return <div className={styles.sub}>{children}</div>;
}

export function CellMute({ children }: { children: ReactNode }) {
    return <div className={styles.mute}>{children}</div>;
}

export function CellAmount({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cx(styles.amount, className)}>{children}</div>;
}

export function CellActions({ children }: { children: ReactNode }) {
    return <div className={styles.actions}>{children}</div>;
}

/** O ladrilho quadrado que marca o tipo da linha (pix, cartão, fixo…). */
export function TypeTile({
    children,
    large,
    color,
}: {
    children: ReactNode;
    large?: boolean;
    color?: string;
}) {
    return (
        <span
            className={cx(styles.tile, large && styles.tileLarge)}
            style={color ? { background: `${color}1a`, color } : undefined}
        >
            {children}
        </span>
    );
}

/* ── Botões de linha ──────────────────────────────────────── */

export function IconButton({
    label,
    children,
    className,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
    return (
        <button
            type="button"
            className={cx(styles.iconButton, className)}
            aria-label={label}
            title={label}
            {...rest}
        >
            {children}
        </button>
    );
}

/** Quitar / desquitar uma perna. Pago vira o tique verde, que continua
 *  clicável: `unpay` existe justamente porque um clique errado, sem ele,
 *  tiraria dinheiro da conta sem volta. */
export function PayButton({
    paid,
    onToggle,
    disabled,
    pending,
    /** Por que o botão está apagado. Desabilitar sem dizer o motivo é o
     *  que faz o usuário clicar três vezes e desistir. */
    reason,
}: {
    paid: boolean;
    onToggle: () => void;
    disabled?: boolean;
    pending?: boolean;
    reason?: string;
}) {
    if (paid) {
        return (
            <button
                type="button"
                className={styles.payDone}
                onClick={onToggle}
                disabled={disabled || pending}
                aria-label="Desfazer quitação"
                title={reason ?? "Desfazer quitação"}
            >
                <IconCheck />
            </button>
        );
    }

    return (
        <button
            type="button"
            className={styles.payButton}
            onClick={onToggle}
            disabled={disabled || pending}
            title={reason}
        >
            {pending ? "…" : "Quitar"}
        </button>
    );
}

/** Data de vencimento; `warn` a pinta de vermelho quando já venceu e
 *  ainda está em aberto. */
export function DueDate({ children, warn }: { children: ReactNode; warn?: boolean }) {
    return <span className={cx(styles.due, warn && styles.dueWarn)}>{children}</span>;
}
