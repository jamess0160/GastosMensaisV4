import styles from "./tabs.module.css";
import { cx } from "./form";

/** As abas sublinhadas do layout.
 *
 *  São `role="tab"` de verdade, com as setas do teclado funcionando —
 *  uma aba que só responde ao clique é um botão disfarçado. */
export function Tabs<T extends string>({
    value,
    onChange,
    tabs,
    ariaLabel,
}: {
    value: T;
    onChange: (value: T) => void;
    tabs: readonly { value: T; label: string; count?: number }[];
    ariaLabel?: string;
}) {
    const move = (delta: number) => {
        const at = tabs.findIndex((tab) => tab.value === value);
        onChange(tabs[(at + delta + tabs.length) % tabs.length].value);
    };

    return (
        <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
            {tabs.map((tab) => (
                <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={tab.value === value}
                    tabIndex={tab.value === value ? 0 : -1}
                    className={cx(styles.tab, tab.value === value && styles.active)}
                    onClick={() => onChange(tab.value)}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowRight") move(1);
                        if (event.key === "ArrowLeft") move(-1);
                    }}
                >
                    {tab.label}
                    {tab.count !== undefined && <span className={styles.count}>{tab.count}</span>}
                </button>
            ))}
        </div>
    );
}
