/** Ícones da navegação, copiados literalmente dos SVG inline do layout
 *  (Layout/Hi-fi Desktop/*.html). Todos herdam a cor via `currentColor`
 *  e são dimensionados pelo CSS de quem os usa. */

type IconProps = { className?: string };

const base = {
    viewBox: "0 0 18 18",
    fill: "none",
    "aria-hidden": true,
} as const;

export function IconHome({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path
                d="M3 9l6-5 6 5v6H3z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path d="M7 15v-4h4v4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}

export function IconExpenses({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path
                d="M5 5h10M5 9h10M5 13h7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconIncome({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path
                d="M9 3v10M5 9l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconAccounts({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <rect
                x="2.5"
                y="4"
                width="13"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path d="M2.5 7h13" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12.5" cy="10.5" r="1" fill="currentColor" />
        </svg>
    );
}

export function IconReport({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path
                d="M3 14V8M8 14V4M13 14v-7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconSettings({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M9 1v2M9 15v2M1 9h2M15 9h2M3 3l1.5 1.5M13.5 13.5L15 15M3 15l1.5-1.5M13.5 4.5L15 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconExport({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path
                d="M9 3v9M5 8l4 4 4-4M3 15h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconSignOut({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path
                d="M7 3H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 6l3 3-3 3M14 9H7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
