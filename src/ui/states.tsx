import type { ReactNode } from "react";
import styles from "./states.module.css";
import { cx } from "./form";
import { Button } from "./primitives";
import { IconAlert, IconLayers } from "./icons";
import { errorMessage } from "@/api/client";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Carregando, vazio e erro — os três estados que toda lista tem e
   que o layout não desenha, porque ele só mostra o caminho feliz.
   ════════════════════════════════════════════════════════════ */

export function EmptyState({
    title,
    description,
    action,
    icon,
    inline,
}: {
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    icon?: ReactNode;
    inline?: boolean;
}) {
    return (
        <div className={cx(styles.state, inline && styles.inline)}>
            <span className={styles.mark}>{icon ?? <IconLayers />}</span>
            <div className={styles.title}>{title}</div>
            {description && <div className={styles.text}>{description}</div>}
            {action && <div className={styles.action}>{action}</div>}
        </div>
    );
}

/** O erro de uma lista.
 *
 *  A `msg` do 406 já chega pronta para o usuário — mostrá-la é o
 *  contrário de engoli-la e escrever "algo deu errado". `onRetry` só
 *  aparece quando repetir faz sentido: um 406 é recusa de negócio e
 *  repetir a mesma requisição responderia igual. */
export function ErrorState({
    error,
    onRetry,
    inline,
}: {
    error: unknown;
    onRetry?: () => void;
    inline?: boolean;
}) {
    return (
        <div className={cx(styles.state, inline && styles.inline)}>
            <span className={cx(styles.mark, styles.markError)}>
                <IconAlert />
            </span>
            <div className={styles.title}>Não foi possível carregar</div>
            <div className={styles.text}>{errorMessage(error)}</div>
            {onRetry && (
                <div className={styles.action}>
                    <Button onClick={onRetry}>Tentar de novo</Button>
                </div>
            )}
        </div>
    );
}

export function Skeleton({
    width,
    height = 12,
    radius,
}: {
    width?: number | string;
    height?: number;
    radius?: number;
}) {
    return (
        <span
            className={styles.skeleton}
            style={{ width, height, borderRadius: radius, display: "block" }}
            aria-hidden
        />
    );
}

/** Esqueleto de lista. `aria-busy` no lugar de um "Carregando…" visível
 *  para que o leitor de tela saiba que a região está em trânsito sem
 *  ler linhas falsas. */
export function LoadingRows({ rows = 4 }: { rows?: number }) {
    return (
        <div className={styles.skeletonRows} aria-busy="true" aria-label="Carregando">
            {Array.from({ length: rows }, (_, index) => (
                <div className={styles.skeletonRow} key={index}>
                    <Skeleton width={22} height={22} radius={6} />
                    <span className={styles.grow}>
                        <Skeleton width={`${45 + ((index * 13) % 30)}%`} />
                    </span>
                    <Skeleton width={72} />
                </div>
            ))}
        </div>
    );
}

/* ── Status ───────────────────────────────────────────────── */

const EXPENSE_LABEL: Record<ApiTypes.ExpenseStatus, string> = {
    paid: "Pago",
    pending: "Em aberto",
    canceled: "Cancelado",
};

const INFLOW_LABEL: Record<ApiTypes.InflowStatus, string> = {
    received: "Recebido",
    pending: "A receber",
    canceled: "Cancelada",
};

/** O selo de status.
 *
 *  `overdue` não é status do contrato — é `pending` com a data já
 *  vencida, uma leitura do cliente. Por isso entra como sinalizador à
 *  parte, e não como um quarto valor de `Status`. */
export function StatusBadge({
    status,
    kind = "expense",
    overdue = false,
}: {
    status: ApiTypes.ExpenseStatus | ApiTypes.InflowStatus;
    kind?: "expense" | "inflow";
    overdue?: boolean;
}) {
    const label =
        kind === "inflow"
            ? INFLOW_LABEL[status as ApiTypes.InflowStatus]
            : EXPENSE_LABEL[status as ApiTypes.ExpenseStatus];

    const tone =
        status === "canceled"
            ? styles.canceled
            : status === "paid" || status === "received"
              ? styles.paid
              : overdue
                ? styles.overdue
                : styles.pending;

    return (
        <span className={cx(styles.status, tone)}>
            <i />
            {overdue && status === "pending" ? "Vencido" : label}
        </span>
    );
}
