import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import styles from "./primitives.module.css";
import { formatMoney } from "@/lib/money";
import type { ApiTypes } from "@/types/api";

const cx = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join(" ");

/* ── Botão ────────────────────────────────────────────────── */

type ButtonVariant = "default" | "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: "md" | "sm";
}

export function Button({
    variant = "default",
    size = "md",
    className,
    type = "button",
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            className={cx(
                styles.btn,
                variant === "primary" && styles.primary,
                variant === "ghost" && styles.ghost,
                size === "sm" && styles.sm,
                className,
            )}
            {...rest}
        />
    );
}

/* ── Card ─────────────────────────────────────────────────── */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    padded?: boolean;
}

export function Card({ padded = true, className, ...rest }: CardProps) {
    return <div className={cx(styles.card, padded && styles.pad, className)} {...rest} />;
}

export function Overline({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cx(styles.overline, className)} {...rest} />;
}

/* ── Dinheiro ─────────────────────────────────────────────── */

/** `tone` explícito: o layout usa vermelho para saída e verde para
 *  entrada, e isso não se deduz do sinal do número. */
export function MoneyText({
    value,
    tone = "neutral",
    className,
}: {
    value: ApiTypes.Money;
    tone?: "neutral" | "pos" | "neg";
    className?: string;
}) {
    return (
        <span
            className={cx(
                styles.money,
                tone === "pos" && styles.moneyPos,
                tone === "neg" && styles.moneyNeg,
                className,
            )}
        >
            {formatMoney(value)}
        </span>
    );
}

/* ── Badge ────────────────────────────────────────────────── */

type BadgeTone = "pos" | "neg" | "brand" | "neutral";

export function Badge({
    tone = "neutral",
    pill = false,
    children,
    className,
}: {
    tone?: BadgeTone;
    pill?: boolean;
    children: ReactNode;
    className?: string;
}) {
    const toneClass = {
        pos: styles.badgePos,
        neg: styles.badgeNeg,
        brand: styles.badgeBrand,
        neutral: styles.badgeNeutral,
    }[tone];

    return (
        <span className={cx(styles.badge, toneClass, pill && styles.badgePill, className)}>
            {children}
        </span>
    );
}

/* ── Chip ─────────────────────────────────────────────────── */

export function Chip({
    active = false,
    children,
    className,
}: {
    active?: boolean;
    children: ReactNode;
    className?: string;
}) {
    return <span className={cx(styles.chip, active && styles.chipOn, className)}>{children}</span>;
}

/* ── Barra ────────────────────────────────────────────────── */

/** `over` marca o estouro em vermelho — a régua do orçamento. */
export function Bar({
    percent,
    over = false,
    height = 6,
}: {
    percent: number;
    over?: boolean;
    height?: number;
}) {
    return (
        <div className={styles.bar} style={{ height }}>
            <i
                className={cx(styles.barFill, over && styles.barOver)}
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
        </div>
    );
}

/* ── Avatar ───────────────────────────────────────────────── */

export function Avatar({
    name,
    size = 28,
    variant = "solid",
}: {
    name: string;
    size?: number;
    variant?: "solid" | "outline" | "rounded";
}) {
    return (
        <span
            className={cx(
                styles.avatar,
                variant === "outline" && styles.avatarOutline,
                variant === "rounded" && styles.avatarRounded,
            )}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
        >
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

/* ── Ponto de categoria ───────────────────────────────────── */

export function CategoryDot({ color }: { color: string }) {
    return <span className={styles.dot} style={{ background: color }} />;
}

/* ── Cabeçalho e corpo de tela ────────────────────────────── */

export function PageHead({
    title,
    subtitle,
    actions,
}: {
    title: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header className={styles.pageHead}>
            <div>
                <h1 className={styles.pageTitle}>{title}</h1>
                {subtitle && <div className={styles.pageSub}>{subtitle}</div>}
            </div>
            {actions && <div className={styles.headActions}>{actions}</div>}
        </header>
    );
}

export function Workspace({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cx(styles.workspace, className)} {...rest} />;
}
