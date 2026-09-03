import {
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./select.module.css";
import { cx } from "./form";
import { IconChevronDown } from "./icons";

/* ════════════════════════════════════════════════════════════
   Seletor padrão do sistema.

   POR QUE NÃO É UM `<select>` NATIVO. O desenho de referência
   (Layout/prints/select.webp) mostra ícone colorido tanto no campo
   fechado quanto em CADA LINHA da lista aberta, e `<option>` não aceita
   marcação nenhuma dentro: o navegador desenha texto puro. Não há CSS
   que resolva isso — é limitação do controle, não de folha de estilo.
   Então a lista é montada à mão.

   O QUE ISSO CUSTA, e como está pago:

   - Acessibilidade. Segue o padrão combobox da APG: o gatilho é um
     `<button role="combobox">` e O FOCO NUNCA SAI DELE — quem diz ao
     leitor de tela qual linha está sob as setas é `aria-activedescendant`.
     Mover o foco para dentro da lista funcionaria igual no olho e pior no
     ouvido, além de brigar com a armadilha de foco do SlideOver.
   - Recorte. A lista é `position: fixed` num portal no `<body>`. Dentro
     de um SlideOver — que tem `overflow-y: auto` — uma lista posicionada
     no fluxo seria cortada na borda do painel.
   - Teclado. Setas, Home/End, Enter/Espaço, Escape e busca por digitação
     estão implementados; Tab fecha e deixa o foco seguir, que é o que o
     nativo faz.

   As opções vêm por PROP, não por filhos: com filhos, o ícone e a cor de
   cada linha teriam que viajar dentro de um `<option>` que não os
   desenha, e o componente não teria como saber o que mostrar fechado.
   ════════════════════════════════════════════════════════════ */

export interface SelectOption<T extends string | number> {
    value: T;
    label: string;
    /** O desenho à esquerda. Categoria manda `<CategoryIcon />`, forma de
     *  pagamento manda o ícone do `Kind`. Sem ícone a linha alinha pelo
     *  texto — não fica um buraco. */
    icon?: ReactNode;
    /** Cor do ícone (a da categoria, a da conta). Só pinta o ícone. */
    color?: string;
    disabled?: boolean;
}

export type SelectVariant = "field" | "compact" | "plain" | "filter";

interface SelectProps<T extends string | number> {
    value: T | null;
    onChange: (value: T | null) => void;
    options: readonly SelectOption<T>[];
    /** O rótulo do valor vazio, que É UMA OPÇÃO ESCOLHÍVEL: nos
     *  formulários é "Escolha…", e num filtro é "Todas as categorias" —
     *  onde vazio não é ausência de escolha, é a escolha "tudo". */
    placeholder?: string;
    variant?: SelectVariant;
    /** O que aparece quando não há nenhuma opção para escolher. */
    emptyLabel?: string;
    id?: string;
    disabled?: boolean;
    invalid?: boolean;
    className?: string;
    ariaLabel?: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
}

/** Uma linha da lista — a do vazio inclusive, que carrega `value: null`. */
interface Row<T> {
    value: T | null;
    label: string;
    icon?: ReactNode;
    color?: string;
    disabled?: boolean;
}

export function Select<T extends string | number>({
    value,
    onChange,
    options,
    placeholder = "Escolha…",
    variant = "field",
    emptyLabel = "Nada para escolher",
    id,
    disabled,
    invalid,
    className,
    ariaLabel,
    "aria-invalid": ariaInvalid,
    "aria-describedby": describedBy,
}: SelectProps<T>) {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const rows: Row<T>[] = useMemo(
        () => [{ value: null, label: placeholder }, ...options],
        [options, placeholder],
    );

    const selected = value === null ? null : (options.find((o) => o.value === value) ?? null);
    const selectedIndex = rows.findIndex((row) => row.value === value);

    const position = useAnchoredPosition(open, triggerRef);

    const openList = (startAt?: number) => {
        if (disabled) return;
        setActive(startAt ?? (selectedIndex >= 0 ? selectedIndex : 0));
        setOpen(true);
    };

    const commit = (index: number) => {
        const row = rows[index];
        if (!row || row.disabled) return;
        onChange(row.value);
        setOpen(false);
    };

    /* Anda pela lista pulando o que está desabilitado — parar em cima de
       uma linha que o Enter não aceita é um beco sem saída no teclado.
       Não achando nada dali para frente, fica onde estava: a seta não
       tem para onde ir, e mover para uma linha morta seria pior. */
    const step = (at: number, candidate: number, delta: number) => {
        for (let i = candidate; i >= 0 && i < rows.length; i += delta) {
            if (!rows[i].disabled) return i;
        }
        return at;
    };

    const typeahead = useTypeahead(rows, (index) => {
        setActive(index);
        if (!open) commit(index);
    });

    /* Fecha ao clicar fora. `mousedown` na fase de captura, e não
       `click`: o clique numa opção só chega depois, e com `click` o
       primeiro clique fora de um seletor aberto seria comido para
       fechá-lo em vez de acionar o botão que o recebeu. */
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
            setOpen(false);
        };

        document.addEventListener("mousedown", onPointerDown, true);
        document.addEventListener("touchstart", onPointerDown, true);
        return () => {
            document.removeEventListener("mousedown", onPointerDown, true);
            document.removeEventListener("touchstart", onPointerDown, true);
        };
    }, [open]);

    // Mantém a linha ativa à vista quando as setas passam da borda.
    useEffect(() => {
        if (!open) return;
        popupRef.current
            ?.querySelector(`[data-index="${active}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [open, active]);

    const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                if (!open) return openList();
                return setActive((at) => step(at, Math.min(at + 1, rows.length - 1), 1));
            case "ArrowUp":
                event.preventDefault();
                if (!open) return openList();
                return setActive((at) => step(at, Math.max(at - 1, 0), -1));
            case "Home":
                if (!open) return;
                event.preventDefault();
                return setActive((at) => step(at, 0, 1));
            case "End":
                if (!open) return;
                event.preventDefault();
                return setActive((at) => step(at, rows.length - 1, -1));
            case "Enter":
            case " ":
                event.preventDefault();
                if (!open) return openList();
                return commit(active);
            case "Escape":
                if (!open) return;
                /* O SlideOver escuta Escape no documento para se fechar.
                   Sem parar aqui, um Escape com a lista aberta fecharia o
                   painel inteiro e o formulário junto. */
                event.preventDefault();
                event.stopPropagation();
                return setOpen(false);
            case "Tab":
                setOpen(false);
                return;
            default:
                typeahead(event.key);
        }
    };

    const trigger = (
        <button
            ref={triggerRef}
            type="button"
            id={id}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open ? `${listId}-${active}` : undefined}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid ?? (invalid || undefined)}
            aria-describedby={describedBy}
            disabled={disabled}
            className={cx(
                styles.trigger,
                styles[variant],
                open && styles.open,
                invalid && styles.invalid,
                variant === "filter" && value !== null && styles.filterOn,
                className,
            )}
            onClick={() => (open ? setOpen(false) : openList())}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
        >
            {selected?.icon && (
                <span className={styles.icon} style={{ color: selected.color }}>
                    {selected.icon}
                </span>
            )}
            <span className={cx(styles.text, selected === null && styles.placeholder)}>
                {selected ? selected.label : placeholder}
            </span>
            <span className={styles.caret}>
                <IconChevronDown />
            </span>
        </button>
    );

    return (
        <span className={styles.wrap}>
            {trigger}
            {open &&
                createPortal(
                    <div
                        ref={popupRef}
                        id={listId}
                        role="listbox"
                        aria-label={ariaLabel}
                        className={styles.popup}
                        style={position}
                        /* Segurar o `mousedown` é o que mantém o foco no
                           gatilho durante o clique: sem isso o `onBlur`
                           fecharia a lista antes do clique virar escolha. */
                        onMouseDown={(event) => event.preventDefault()}
                    >
                        {options.length === 0 && <div className={styles.empty}>{emptyLabel}</div>}
                        {(options.length === 0 ? [] : rows).map((row, index) => (
                            <button
                                key={row.value === null ? "__none" : String(row.value)}
                                type="button"
                                role="option"
                                id={`${listId}-${index}`}
                                data-index={index}
                                aria-selected={row.value === value}
                                disabled={row.disabled}
                                className={cx(
                                    styles.option,
                                    index === active && styles.optionActive,
                                    row.value === value && styles.optionOn,
                                    row.value === null && styles.optionOff,
                                )}
                                onMouseMove={() => setActive(index)}
                                onClick={() => commit(index)}
                            >
                                {row.icon && (
                                    <span
                                        className={styles.optionIcon}
                                        style={{ color: row.color }}
                                    >
                                        {row.icon}
                                    </span>
                                )}
                                <span className={styles.optionText}>{row.label}</span>
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </span>
    );
}

/* ── Posição da lista ─────────────────────────────────────── */

/** Ancora a lista no gatilho, em coordenadas de viewport.
 *
 *  Ela abre para baixo, e só sobe quando embaixo não cabe e em cima cabe
 *  mais — um seletor no rodapé de um painel abriria para fora da tela. A
 *  altura máxima é o espaço disponível, para a lista nunca vazar. */
function useAnchoredPosition(
    open: boolean,
    triggerRef: React.RefObject<HTMLElement>,
): CSSProperties | undefined {
    const [style, setStyle] = useState<CSSProperties>();

    useLayoutEffect(() => {
        if (!open) return;

        const place = () => {
            const anchor = triggerRef.current?.getBoundingClientRect();
            if (!anchor) return;

            const gap = 6;
            const margin = 8;
            const below = window.innerHeight - anchor.bottom - gap - margin;
            const above = anchor.top - gap - margin;
            const up = below < 180 && above > below;

            /* A pílula de filtro é estreita ("Fixo"), e a lista dela traz
               nomes longos ("Todas as formas de pagamento") — daí o piso
               de largura, que não vale para o campo largo do formulário. */
            const width = Math.max(anchor.width, 220);

            setStyle({
                left: Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin)),
                width,
                maxHeight: Math.max(140, Math.min(300, up ? above : below)),
                ...(up
                    ? { bottom: window.innerHeight - anchor.top + gap }
                    : { top: anchor.bottom + gap }),
            });
        };

        place();
        // `true` para pegar a rolagem do painel também, que não borbulha.
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        return () => {
            window.removeEventListener("scroll", place, true);
            window.removeEventListener("resize", place);
        };
    }, [open, triggerRef]);

    return style;
}

/* ── Busca por digitação ──────────────────────────────────── */

/** Digitar "mer" salta para "Mercado", como no `<select>` nativo.
 *
 *  As teclas se acumulam por um segundo; passado esse tempo, a próxima
 *  começa uma busca nova. */
function useTypeahead<T>(rows: Row<T>[], onMatch: (index: number) => void) {
    const buffer = useRef({ text: "", at: 0 });

    return (key: string) => {
        // Só letra/dígito solto: Shift, F5, Control-C e afins passam.
        if (key.length !== 1) return;

        const now = Date.now();
        buffer.current = {
            text: (now - buffer.current.at > 1000 ? "" : buffer.current.text) + key.toLowerCase(),
            at: now,
        };

        const index = rows.findIndex(
            (row) => !row.disabled && row.label.toLowerCase().startsWith(buffer.current.text),
        );
        if (index >= 0) onMatch(index);
    };
}
