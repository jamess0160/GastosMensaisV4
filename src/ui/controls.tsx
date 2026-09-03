import { useRef, type ReactNode } from "react";
import styles from "./controls.module.css";
import { cx } from "./form";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClose, IconSearch } from "./icons";
import { CategoryIcon, ICON_CATALOG } from "./iconCatalog";
import { Select, type SelectOption } from "./select";
import { addMonths, currentMonth, formatMonthLabel } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ── Seletor de mês ───────────────────────────────────────── */

/** O mês é a unidade de navegação de quase toda tela do sistema.
 *
 *  O rótulo abre um `<input type="month">` nativo, que já fala
 *  "YYYY-MM" — o mesmo formato do `ReferenceMonth` do contrato, sem
 *  conversão no meio. As setas andam de mês em mês por `addMonths`, que
 *  é aritmética de calendário e não soma de milissegundos. */
export function MonthPicker({
    month,
    onChange,
}: {
    month: ApiTypes.ReferenceMonth;
    onChange: (month: ApiTypes.ReferenceMonth) => void;
}) {
    const native = useRef<HTMLInputElement>(null);
    const isCurrent = month === currentMonth();

    return (
        <div className={styles.month}>
            <button
                type="button"
                className={styles.monthStep}
                onClick={() => onChange(addMonths(month, -1))}
                aria-label="Mês anterior"
            >
                <IconChevronLeft />
            </button>

            <button
                type="button"
                className={styles.monthLabel}
                onClick={() => native.current?.showPicker?.()}
            >
                <IconCalendar />
                {formatMonthLabel(month)}
            </button>
            <input
                ref={native}
                type="month"
                className={styles.monthNative}
                value={month}
                tabIndex={-1}
                aria-hidden
                onChange={(event) => event.target.value && onChange(event.target.value)}
            />

            <button
                type="button"
                className={styles.monthStep}
                onClick={() => onChange(addMonths(month, 1))}
                aria-label="Próximo mês"
            >
                <IconChevronRight />
            </button>

            <button
                type="button"
                className={styles.monthToday}
                onClick={() => onChange(currentMonth())}
                disabled={isCurrent}
            >
                Hoje
            </button>
        </div>
    );
}

/* ── Barra de filtros ─────────────────────────────────────── */

export function FilterBar({ children }: { children: ReactNode }) {
    return <div className={styles.filters}>{children}</div>;
}

export function FilterGroup({ label, children }: { label?: string; children: ReactNode }) {
    return (
        <div className={styles.filterGroup}>
            {label && <span className={styles.filterLabel}>{label}</span>}
            {children}
        </div>
    );
}

/** Chip de filtro. `undefined` é "todos" — e ele é um valor de verdade,
 *  não a ausência de um: na lista de gastos, não mandar `Status` deixa
 *  os cancelados de fora, então "todos" e "sem filtro" são coisas
 *  diferentes e quem decide é a tela. */
export function FilterChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className={cx(styles.chip, active && styles.chipOn)}
            aria-pressed={active}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

/** O filtro é o seletor padrão na variante pílula.
 *
 *  `allLabel` ocupa o lugar do "Escolha…": aqui o vazio não é falta de
 *  resposta, é a resposta "todas" — e por isso ele aparece na lista como
 *  uma opção como as outras, para dar para voltar atrás. */
export function FilterSelect<T extends string | number>({
    value,
    onChange,
    options,
    allLabel = "Todas",
    ariaLabel,
}: {
    value: T | null;
    onChange: (value: T | null) => void;
    options: readonly SelectOption<T>[];
    allLabel?: string;
    ariaLabel?: string;
}) {
    return (
        <Select
            variant="filter"
            value={value}
            onChange={onChange}
            options={options}
            placeholder={allLabel}
            ariaLabel={ariaLabel}
        />
    );
}

export function SearchInput({
    value,
    onChange,
    placeholder = "Buscar…",
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <span className={styles.search}>
            <span className={styles.searchIcon}>
                <IconSearch />
            </span>
            <input
                className={styles.searchInput}
                type="search"
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
            />
        </span>
    );
}

export function ClearFilters({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" className={styles.clear} onClick={onClick}>
            Limpar filtros
        </button>
    );
}

/* ── Seletor de cor ───────────────────────────────────────── */

/** A paleta de categorias do layout. Sair dela é possível pelo seletor
 *  do sistema, mas o padrão é ficar dentro do sistema de cores — é o
 *  que mantém o relatório coerente. */
const PALETTE = [
    "#0084ff",
    "#7238d7",
    "#f40092",
    "#00b4d8",
    "#36da0d",
    "#f4d800",
    "#ff5247",
    "#6e6a66",
    "#ff6a00",
    "#00dc8c",
] as const;

export function ColorPicker({
    value,
    onChange,
}: {
    value: ApiTypes.Color | null;
    onChange: (color: ApiTypes.Color | null) => void;
}) {
    const custom = value !== null && !PALETTE.includes(value.toLowerCase() as never);

    return (
        <div className={styles.swatches}>
            <button
                type="button"
                className={cx(styles.swatch, styles.swatchNone, value === null && styles.swatchOn)}
                onClick={() => onChange(null)}
                aria-label="Sem cor própria"
                title="Sem cor própria — usa a paleta do sistema"
                aria-pressed={value === null}
            >
                <IconClose />
            </button>

            {PALETTE.map((color) => (
                <button
                    key={color}
                    type="button"
                    className={cx(styles.swatch, value?.toLowerCase() === color && styles.swatchOn)}
                    style={{ background: color }}
                    onClick={() => onChange(color)}
                    aria-label={`Cor ${color}`}
                    aria-pressed={value?.toLowerCase() === color}
                />
            ))}

            {/* O contrato pede "#RRGGBB" com 7 caracteres, que é
                exatamente o que o input de cor do navegador devolve. */}
            <input
                type="color"
                className={cx(styles.swatchCustom, custom && styles.swatchOn)}
                value={value ?? "#ff6a00"}
                onChange={(event) => onChange(event.target.value)}
                aria-label="Outra cor"
                title="Outra cor"
            />
        </div>
    );
}

/* ── Seletor de ícone ─────────────────────────────────────── */

export function IconPicker({
    value,
    onChange,
}: {
    value: string | null;
    onChange: (iconKey: string | null) => void;
}) {
    return (
        <div className={styles.icons} role="radiogroup" aria-label="Ícone da categoria">
            {ICON_CATALOG.map(({ key, label, Icon }) => (
                <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={value === key}
                    aria-label={label}
                    title={label}
                    className={cx(styles.iconCell, value === key && styles.iconCellOn)}
                    onClick={() => onChange(key)}
                >
                    <Icon />
                </button>
            ))}
        </div>
    );
}

/** O que a categoria vai virar na lista — ícone e cor juntos, como
 *  aparecem depois. Vale mais que os dois seletores separados. */
export function CategoryPreview({
    description,
    iconKey,
    color,
}: {
    description: string;
    iconKey: string | null;
    color: string;
}) {
    return (
        <div className={styles.preview}>
            <span className={styles.previewTile} style={{ background: `${color}1f`, color }}>
                <CategoryIcon iconKey={iconKey} />
            </span>
            <div>
                <div className={styles.previewName}>{description || "Nova categoria"}</div>
                <div className={styles.previewSub}>É assim que ela aparece nas listas</div>
            </div>
        </div>
    );
}
