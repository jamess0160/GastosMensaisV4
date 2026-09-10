import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./overlay.module.css";
import { cx } from "./form";
import { Button } from "./primitives";
import { IconAlert, IconChevronRight, IconClose } from "./icons";

/* ════════════════════════════════════════════════════════════
   Slide-over e modal. Os dois têm o mesmo comportamento de camada —
   fecham no Escape e no clique fora, prendem o foco enquanto estão
   abertos e devolvem o foco a quem os abriu — então isso mora num
   hook só, e cada um só difere na moldura.
   ════════════════════════════════════════════════════════════ */

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Para onde vai o foco quando o painel abre.
 *
 *  NÃO é simplesmente o primeiro elemento focável: no DOM o `<header>`
 *  vem antes do corpo, e o primeiro focável do painel inteiro é o botão
 *  de fechar. Quem abre um formulário quer digitar, não fechar — então a
 *  busca começa pelo corpo, marcado com `data-dialog-body`.
 *
 *  Painel sem corpo focável (uma confirmação, que só tem os botões do
 *  rodapé) cai no primeiro focável do painel, e aí o botão certo é mesmo
 *  o de cancelar: numa ação destrutiva, o foco inicial não deve estar
 *  sobre o botão que confirma. */
export function firstFocusTarget(panel: HTMLElement): HTMLElement | null {
    const body = panel.querySelector<HTMLElement>("[data-dialog-body]");
    return (
        body?.querySelector<HTMLElement>(FOCUSABLE) ??
        panel.querySelector<HTMLElement>(FOCUSABLE) ??
        null
    );
}

function useDialogBehavior(open: boolean, onClose: () => void) {
    const ref = useRef<HTMLDivElement>(null);
    const restoreTo = useRef<HTMLElement | null>(null);

    /* O `onClose` de quem chama é quase sempre uma arrow inline, e por
       isso muda de identidade a cada render. Guardá-lo num ref é o que
       permite o efeito abaixo depender só de `open`: com `onClose` na
       lista de dependências, o efeito rodava a CADA TECLA digitada
       dentro do painel — e cada execução roubava o foco de volta para o
       começo. */
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return;

        restoreTo.current = document.activeElement as HTMLElement | null;

        const panel = ref.current;
        const target = panel ? firstFocusTarget(panel) : null;
        (target ?? panel)?.focus();

        // A página atrás não deve rolar junto com o painel.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                onCloseRef.current();
                return;
            }

            if (event.key !== "Tab" || !ref.current) return;

            // Prende o Tab dentro do painel: sem isso o foco escapa para
            // a tela de trás, que está inerte, e o teclado trava.
            const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
            if (items.length === 0) return;

            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown, true);
        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            document.body.style.overflow = previousOverflow;
            restoreTo.current?.focus?.();
        };
        // `open` e só: ver o comentário do `onCloseRef` acima.
    }, [open]);

    return ref;
}

interface PanelProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
}

/* ── Slide-over ───────────────────────────────────────────── */

export function SlideOver({ open, onClose, title, subtitle, children, footer, wide }: PanelProps) {
    const ref = useDialogBehavior(open, onClose);
    const titleId = useId();

    if (!open) return null;

    return createPortal(
        <>
            <div className={styles.scrim} onClick={onClose} />
            <div
                ref={ref}
                className={cx(styles.slideover, wide && styles.wide)}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <header className={styles.head}>
                    <div>
                        <div className={styles.title} id={titleId}>
                            {title}
                        </div>
                        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                    </div>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Fechar"
                    >
                        <IconClose />
                    </button>
                </header>
                <div className={styles.body} data-dialog-body>
                    {children}
                </div>
                {footer && <footer className={styles.foot}>{footer}</footer>}
            </div>
        </>,
        document.body,
    );
}

/* ── Modal ────────────────────────────────────────────────── */

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: PanelProps) {
    const ref = useDialogBehavior(open, onClose);
    const titleId = useId();

    if (!open) return null;

    return createPortal(
        <>
            <div className={styles.scrim} onClick={onClose} />
            <div
                ref={ref}
                className={cx(styles.modal, wide && styles.modalLarge)}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <header className={styles.head}>
                    <div>
                        <div className={styles.title} id={titleId}>
                            {title}
                        </div>
                        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                    </div>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Fechar"
                    >
                        <IconClose />
                    </button>
                </header>
                <div className={styles.body} data-dialog-body>
                    {children}
                </div>
                {footer && <footer className={styles.foot}>{footer}</footer>}
            </div>
        </>,
        document.body,
    );
}

/* ── Bottom sheet ─────────────────────────────────────────── */

export interface SheetMenuItem {
    label: string;
    /** A linha de baixo, quando o rótulo sozinho não diz o bastante. */
    description?: string;
    icon?: ReactNode;
    onSelect: () => void;
    disabled?: boolean;
    /** Vira o `title` do botão — é onde se diz por que está desligado. */
    reason?: string;
    danger?: boolean;
}

/** O menu que sobe de baixo, transcrito de `.sheet` / `.srow` do
 *  `Layout/Hi-fi Mobile/04` (frame B).
 *
 *  No mobile o padrão do layout é este, e não o popover ancorado do
 *  desktop: com o dedo, uma lista colada na base da tela é o que se
 *  alcança sem trocar a mão de posição. Ele herda o comportamento de
 *  camada dos outros painéis daqui — Escape, clique fora, foco preso e
 *  devolvido a quem abriu.
 *
 *  Escolher uma linha FECHA o sheet antes de agir: quase toda ação leva
 *  para outra tela, e o painel não pode ficar por cima dela. */
export function SheetMenu({
    open,
    onClose,
    title,
    items,
}: {
    open: boolean;
    onClose: () => void;
    /** Não aparece na tela: é o nome acessível do diálogo. */
    title: string;
    items: SheetMenuItem[];
}) {
    const ref = useDialogBehavior(open, onClose);

    if (!open) return null;

    return createPortal(
        <>
            <div className={styles.scrim} onClick={onClose} />
            <div
                ref={ref}
                className={styles.sheet}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
            >
                {/* A alça é desenho: quem fecha é o Escape, o scrim e o
                    botão de baixo. */}
                <div className={styles.grab} aria-hidden>
                    <i />
                </div>

                <div className={styles.sheetRows} data-dialog-body>
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            className={cx(styles.sheetRow, item.danger && styles.sheetRowDanger)}
                            disabled={item.disabled}
                            title={item.reason}
                            onClick={() => {
                                onClose();
                                item.onSelect();
                            }}
                        >
                            {item.icon && <span className={styles.sheetIcon}>{item.icon}</span>}
                            <span className={styles.sheetText}>
                                <span className={styles.sheetLabel}>{item.label}</span>
                                {item.description && (
                                    <span className={styles.sheetDescription}>
                                        {item.description}
                                    </span>
                                )}
                            </span>
                            <span className={styles.sheetChevron} aria-hidden>
                                <IconChevronRight />
                            </span>
                        </button>
                    ))}
                </div>

                <button type="button" className={styles.sheetCancel} onClick={onClose}>
                    Cancelar
                </button>
            </div>
        </>,
        document.body,
    );
}

/* ── Confirmação ──────────────────────────────────────────── */

/** Para o que não se desfaz com um clique: arquivar, cancelar um gasto
 *  pago (que é o estorno — o dinheiro volta ao saldo), encerrar série.
 *
 *  `danger` pinta o botão de vermelho; `description` é onde se diz o que
 *  vai acontecer com o dinheiro, não só "tem certeza?". */
export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = false,
    pending = false,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    pending?: boolean;
}) {
    const ref = useDialogBehavior(open, onClose);
    const titleId = useId();

    if (!open) return null;

    return createPortal(
        <>
            <div className={styles.scrim} onClick={onClose} />
            <div
                ref={ref}
                className={styles.modal}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className={styles.confirmBody}>
                    <span className={cx(styles.confirmMark, danger && styles.dangerMark)}>
                        <IconAlert />
                    </span>
                    <div>
                        <div className={styles.confirmTitle} id={titleId}>
                            {title}
                        </div>
                        <div className={styles.confirmText}>{description}</div>
                    </div>
                </div>
                <footer className={styles.foot}>
                    <span className={styles.footSpacer} />
                    <Button onClick={onClose} disabled={pending}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant="primary"
                        className={cx(danger && styles.danger)}
                        onClick={onConfirm}
                        disabled={pending}
                    >
                        {pending ? "Aguarde…" : confirmLabel}
                    </Button>
                </footer>
            </div>
        </>,
        document.body,
    );
}

/** O separador entre os grupos de botões do rodapé. Ele não empurra
 *  nada: o `.foot` centraliza os botões, e um espaçador que crescesse no
 *  meio da faixa desfaria a centralização — ver o comentário de
 *  `.footSpacer` em `overlay.module.css`. */
export function FooterSpacer() {
    return <span className={styles.footSpacer} />;
}
