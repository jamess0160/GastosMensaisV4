/** Ícones de ação da interface, no mesmo traço dos da navegação
 *  (`src/app/icons.tsx`): viewBox 18×18, `currentColor`, 1.5 de traço.
 *  Quem os dimensiona é o CSS de quem os usa. */

type IconProps = { className?: string };

const base = {
    viewBox: "0 0 18 18",
    fill: "none",
    "aria-hidden": true,
} as const;

const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

export function IconPlus({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M9 4v10M4 9h10" {...stroke} />
        </svg>
    );
}

export function IconClose({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M5 5l8 8M13 5l-8 8" {...stroke} />
        </svg>
    );
}

export function IconCheck({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M4 9.5l3.2 3.2L14 6" {...stroke} />
        </svg>
    );
}

export function IconEdit({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M12.2 3.6l2.2 2.2-7.5 7.5-2.9.7.7-2.9 7.5-7.5z" {...stroke} />
        </svg>
    );
}

export function IconArchive({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M3 5.5h12v2.5H3z" {...stroke} />
            <path d="M4.2 8v6.5h9.6V8M7.3 10.8h3.4" {...stroke} />
        </svg>
    );
}

export function IconChevronDown({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M5 7.2l4 4 4-4" {...stroke} />
        </svg>
    );
}

export function IconChevronLeft({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M11 4l-4.5 5 4.5 5" {...stroke} />
        </svg>
    );
}

export function IconChevronRight({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M7 4l4.5 5-4.5 5" {...stroke} />
        </svg>
    );
}

export function IconCalendar({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <rect x="3" y="4.5" width="12" height="10" rx="2" {...stroke} />
            <path d="M3 7.6h12M6.4 3v2.6M11.6 3v2.6" {...stroke} />
        </svg>
    );
}

export function IconSearch({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <circle cx="8.2" cy="8.2" r="4.2" {...stroke} />
            <path d="M11.4 11.4L14.5 14.5" {...stroke} />
        </svg>
    );
}

export function IconFilter({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M3.5 5h11l-4.3 5v4l-2.4 1.2V10L3.5 5z" {...stroke} />
        </svg>
    );
}

export function IconArrowUp({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M9 14V4M4.8 8.2L9 4l4.2 4.2" {...stroke} />
        </svg>
    );
}

export function IconArrowDown({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M9 4v10M4.8 9.8L9 14l4.2-4.2" {...stroke} />
        </svg>
    );
}

/** Transferência: as duas pontas, porque ela move os dois lados. */
export function IconTransfer({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M4 6.5h10L11.5 4M14 11.5H4l2.5 2.5" {...stroke} />
        </svg>
    );
}

export function IconCard({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <rect x="2.5" y="4.5" width="13" height="9" rx="2" {...stroke} />
            <path d="M2.5 7.8h13M5 11.2h2.6" {...stroke} />
        </svg>
    );
}

export function IconBank({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M9 3.2L15 6.4H3L9 3.2z" {...stroke} />
            <path d="M5 7.6v5M9 7.6v5M13 7.6v5M3.2 14.4h11.6" {...stroke} />
        </svg>
    );
}

export function IconCash({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <rect x="2.5" y="5" width="13" height="8" rx="1.6" {...stroke} />
            <circle cx="9" cy="9" r="1.9" {...stroke} />
        </svg>
    );
}

export function IconPix({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M9 2.8l6.2 6.2L9 15.2 2.8 9 9 2.8z" {...stroke} />
        </svg>
    );
}

export function IconTag({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M3.5 3.5h5.2l5.8 5.8-5.2 5.2-5.8-5.8V3.5z" {...stroke} />
            <circle cx="6.4" cy="6.4" r="1" {...stroke} />
        </svg>
    );
}

export function IconRepeat({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M4 8a5 5 0 018.6-3.4M14 10a5 5 0 01-8.6 3.4" {...stroke} />
            <path d="M12.2 2.6v2.4h-2.4M5.8 15.4V13h2.4" {...stroke} />
        </svg>
    );
}

export function IconLayers({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M9 3l6 3-6 3-6-3 6-3z" {...stroke} />
            <path d="M3 9.6l6 3 6-3M3 12.6l6 3 6-3" {...stroke} />
        </svg>
    );
}

export function IconAlert({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <circle cx="9" cy="9" r="6.2" {...stroke} />
            <path d="M9 5.8v3.6M9 12.1v.1" {...stroke} />
        </svg>
    );
}

export function IconInfo({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <circle cx="9" cy="9" r="6.2" {...stroke} />
            <path d="M9 8.4v3.8M9 5.9v.1" {...stroke} />
        </svg>
    );
}

export function IconEye({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path
                d="M1.8 9S4.6 4.6 9 4.6 16.2 9 16.2 9 13.4 13.4 9 13.4 1.8 9 1.8 9z"
                {...stroke}
            />
            <circle cx="9" cy="9" r="1.9" {...stroke} />
        </svg>
    );
}

export function IconEyeOff({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path
                d="M6.6 5.2A7.7 7.7 0 019 4.6c4.4 0 7.2 4.4 7.2 4.4a13 13 0 01-2.4 2.9"
                {...stroke}
            />
            <path d="M4.4 6.3A13 13 0 001.8 9S4.6 13.4 9 13.4c1 0 1.9-.2 2.7-.6" {...stroke} />
            <path d="M3 3l12 12" {...stroke} />
        </svg>
    );
}

export function IconFingerprint({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <path d="M9 8.2v2.4a4 4 0 001 2.7" {...stroke} />
            <path d="M6.4 6.8a3.4 3.4 0 015.2 2.9v1.5" {...stroke} />
            <path d="M4.2 8.6A5.3 5.3 0 019 3.9a5.3 5.3 0 014.8 3" {...stroke} />
            <path d="M6.6 13.9a6 6 0 01-1.3-2.6" {...stroke} />
        </svg>
    );
}

export function IconUser({ className }: IconProps) {
    return (
        <svg {...base} className={className}>
            <circle cx="9" cy="6.6" r="2.6" {...stroke} />
            <path d="M3.8 14.6a5.2 5.2 0 0110.4 0" {...stroke} />
        </svg>
    );
}
