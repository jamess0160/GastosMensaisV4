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
import { IconCheck, IconChevronDown } from "./icons";
import { useIsMobile } from "@/lib/useMediaQuery";

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

   DUAS PELES, UM MOTOR. `Select` escolhe uma; `MultiSelect` marca
   várias e é só para filtro. As duas montam o mesmo `Combobox` daqui —
   o que muda é o que uma linha faz ao ser escolhida e se a lista fecha
   depois. Foi assim para que as quatro coisas caras acima (APG, portal,
   teclado, foco) existissem uma vez só.

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

/* ── Motor comum ──────────────────────────────────────────── */

interface ComboboxProps<T extends string | number> {
    rows: Row<T>[];
    /** Sem opção nenhuma a lista mostra só o `emptyLabel`. */
    hasOptions: boolean;
    isSelected: (row: Row<T>) => boolean;
    /** Linha em que a lista abre — a escolhida, quando há uma. */
    startAt: number;
    onPick: (row: Row<T>) => void;
    /** Uma escolha só fecha a lista; multi-seleção não. */
    closeOnPick: boolean;
    /** Caixinha em cada linha e `aria-multiselectable` na lista. */
    multiple?: boolean;
    /** No mobile a lista sobe do rodapé em vez de ancorar no gatilho. */
    sheetOnMobile?: boolean;
    /** O miolo do gatilho — ícone e texto. A seta é daqui. */
    label: ReactNode;
    /** Pinta a pílula de filtro de "ligado". */
    on?: boolean;
    emptyLabel: string;
    variant: SelectVariant;
    id?: string;
    disabled?: boolean;
    invalid?: boolean;
    className?: string;
    ariaLabel?: string;
    ariaInvalid?: true;
    describedBy?: string;
}

/** O combobox de verdade: gatilho, portal, teclado e foco.
 *
 *  `Select` e `MultiSelect` são as duas peles dele. O que muda entre
 *  elas é o que uma escolha faz (trocar ou alternar), se a lista fecha
 *  depois, e a caixinha na linha — todo o resto, principalmente as
 *  quatro coisas caras (APG, portal, teclado, foco), é o mesmo código. */
function Combobox<T extends string | number>({
    rows,
    hasOptions,
    isSelected,
    startAt,
    onPick,
    closeOnPick,
    multiple,
    sheetOnMobile,
    label,
    on,
    emptyLabel,
    variant,
    id,
    disabled,
    invalid,
    className,
    ariaLabel,
    ariaInvalid,
    describedBy,
}: ComboboxProps<T>) {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const isMobile = useIsMobile();
    const asSheet = Boolean(sheetOnMobile) && isMobile;

    const position = useAnchoredPosition(open && !asSheet, triggerRef, popupRef);

    const openList = (startFrom?: number) => {
        if (disabled) return;
        setActive(startFrom ?? (startAt >= 0 ? startAt : 0));
        setOpen(true);
    };

    const commit = (index: number) => {
        const row = rows[index];
        if (!row || row.disabled) return;
        onPick(row);
        if (closeOnPick) setOpen(false);
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
        /* Com a lista fechada, digitar escolhe direto — como no `<select>`
           nativo. Só que numa multi-seleção "escolher" é ALTERNAR, e
           alternar às cegas o que não se está vendo tiraria uma marca sem
           aviso: ali a tecla só move a linha ativa. */
        if (!open && closeOnPick) commit(index);
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

    const list = (
        <div
            ref={popupRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-multiselectable={multiple || undefined}
            className={cx(styles.popup, asSheet && styles.sheet)}
            style={asSheet ? undefined : position}
            /* Segurar o `mousedown` é o que mantém o foco no gatilho
               durante o clique: sem isso o `onBlur` fecharia a lista
               antes do clique virar escolha. */
            onMouseDown={(event) => event.preventDefault()}
        >
            {!hasOptions && <div className={styles.empty}>{emptyLabel}</div>}
            {(hasOptions ? rows : []).map((row, index) => (
                <button
                    key={row.value === null ? "__none" : String(row.value)}
                    type="button"
                    role="option"
                    id={`${listId}-${index}`}
                    data-index={index}
                    aria-selected={isSelected(row)}
                    disabled={row.disabled}
                    className={cx(
                        styles.option,
                        index === active && styles.optionActive,
                        isSelected(row) && styles.optionOn,
                        row.value === null && styles.optionOff,
                    )}
                    onMouseMove={() => setActive(index)}
                    onClick={() => commit(index)}
                >
                    {multiple && (
                        <span
                            className={cx(styles.check, isSelected(row) && styles.checkOn)}
                            aria-hidden
                        >
                            {isSelected(row) && <IconCheck />}
                        </span>
                    )}
                    {row.icon && (
                        <span className={styles.optionIcon} style={{ color: row.color }}>
                            {row.icon}
                        </span>
                    )}
                    <span className={styles.optionText}>{row.label}</span>
                </button>
            ))}
        </div>
    );

    return (
        <span className={styles.wrap}>
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
                    variant === "filter" && on && styles.filterOn,
                    className,
                )}
                onClick={() => (open ? setOpen(false) : openList())}
                onKeyDown={onKeyDown}
                onBlur={() => setOpen(false)}
            >
                {label}
                <span className={styles.caret}>
                    <IconChevronDown />
                </span>
            </button>

            {open &&
                createPortal(
                    asSheet ? (
                        <>
                            {/* O véu escurece a tela atrás; quem fecha no
                                toque fora continua sendo o `mousedown` de
                                captura lá em cima. */}
                            <div className={styles.sheetScrim} />
                            {list}
                        </>
                    ) : (
                        list
                    ),
                    document.body,
                )}
        </span>
    );
}

/* ── Escolha única ────────────────────────────────────────── */

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
    const rows: Row<T>[] = useMemo(
        () => [{ value: null, label: placeholder }, ...options],
        [options, placeholder],
    );

    const selected = value === null ? null : (options.find((o) => o.value === value) ?? null);

    return (
        <Combobox
            rows={rows}
            hasOptions={options.length > 0}
            isSelected={(row) => row.value === value}
            startAt={rows.findIndex((row) => row.value === value)}
            onPick={(row) => onChange(row.value)}
            closeOnPick
            label={
                <>
                    {selected?.icon && (
                        <span className={styles.icon} style={{ color: selected.color }}>
                            {selected.icon}
                        </span>
                    )}
                    <span className={cx(styles.text, selected === null && styles.placeholder)}>
                        {selected ? selected.label : placeholder}
                    </span>
                </>
            }
            on={value !== null}
            emptyLabel={emptyLabel}
            variant={variant}
            id={id}
            disabled={disabled}
            invalid={invalid}
            className={className}
            ariaLabel={ariaLabel}
            ariaInvalid={ariaInvalid}
            describedBy={describedBy}
        />
    );
}

/* ── Multi-seleção ────────────────────────────────────────── */

/** O irmão do `Select` para filtro: várias marcas ao mesmo tempo.
 *
 *  Só existe para FILTRO. Formulário continua com o `Select` de uma
 *  escolha — a categoria de um gasto é uma, e virar multi-seleção só
 *  para reaproveitar componente convidaria a mandar dois valores onde o
 *  contrato aceita um.
 *
 *  Três diferenças, e todas vêm do que multi-seleção é:
 *  - a lista NÃO fecha ao marcar, porque quase nunca se marca uma coisa
 *    só e reabrir a cada marca é um clique a mais por escolha;
 *  - o gatilho conta o que está marcado — "2 · Tiago, Luana", como o
 *    `.filt` do Relatório desenha;
 *  - nada marcado é "todas", e não "nenhuma": no filtro, o vazio é a
 *    escolha de não recortar. A primeira linha volta para esse estado. */
export function MultiSelect<T extends string | number>({
    values,
    onChange,
    options,
    placeholder = "Todas",
    variant = "filter",
    emptyLabel = "Nada para escolher",
    id,
    disabled,
    className,
    ariaLabel,
}: {
    values: readonly T[];
    onChange: (values: T[]) => void;
    options: readonly SelectOption<T>[];
    /** O rótulo do "nada marcado" — "Todas as pessoas". */
    placeholder?: string;
    variant?: SelectVariant;
    emptyLabel?: string;
    id?: string;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}) {
    const rows: Row<T>[] = useMemo(
        () => [{ value: null, label: placeholder }, ...options],
        [options, placeholder],
    );

    /* O resumo segue a ordem das OPÇÕES, não a de clique: assim o mesmo
       conjunto de marcas escreve sempre o mesmo texto. */
    const chosen = options.filter((option) => values.includes(option.value));
    const summary =
        chosen.length === 0
            ? placeholder
            : `${chosen.length} · ${chosen.map((option) => option.label).join(", ")}`;

    const toggle = (value: T) =>
        onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

    return (
        <Combobox
            rows={rows}
            hasOptions={options.length > 0}
            isSelected={(row) =>
                row.value === null ? values.length === 0 : values.includes(row.value)
            }
            startAt={rows.findIndex((row) => row.value !== null && values.includes(row.value))}
            onPick={(row) => (row.value === null ? onChange([]) : toggle(row.value))}
            closeOnPick={false}
            multiple
            sheetOnMobile
            label={<span className={styles.text}>{summary}</span>}
            on={values.length > 0}
            emptyLabel={emptyLabel}
            variant={variant}
            id={id}
            disabled={disabled}
            className={className}
            ariaLabel={ariaLabel}
        />
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
    popupRef: React.RefObject<HTMLElement>,
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

            /* A LISTA SE MEDE PELO TEXTO, não pelo gatilho.
        
               A pílula de filtro é estreita ("Fixo"), e a lista dela traz
               nomes que não cabem ali — "Nubank Tiago · Crédito #1". Com
               largura fixa no gatilho, todo nome longo virava reticência
               e o filtro ficava impossível de usar.

               Por isso não há `width` nenhum aqui: `position: fixed` sem
               largura encolhe até o conteúdo, e o que a gente manda são
               só os LIMITES — um piso, para a lista não ficar mais
               estreita que o gatilho, e um teto, para ela não passar da
               janela. */
            const minWidth = Math.max(anchor.width, 220);
            const maxWidth = window.innerWidth - 2 * margin;

            /* A largura já renderizada é o que decide se a lista cabe a
               partir da esquerda do gatilho. Na primeira passada o painel
               já está no DOM (o efeito é de layout, roda depois da
               montagem e antes da pintura), então a medida é real. */
            const measured = Math.min(
                Math.max(popupRef.current?.offsetWidth ?? 0, minWidth),
                maxWidth,
            );

            setStyle({
                left: Math.max(
                    margin,
                    Math.min(anchor.left, window.innerWidth - measured - margin),
                ),
                minWidth,
                maxWidth,
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
    }, [open, triggerRef, popupRef]);

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
