import type { ComponentType } from "react";

/* ════════════════════════════════════════════════════════════
   Catálogo de ícones do cliente, indexado por `IconKey`.

   `IconKey` é CHAVE, não caminho de arquivo — é por isso que a API
   chama de `IconKey` em Categories e de `IconPath` em Accounts. O
   desenho mora aqui: a API guarda só a chave, e trocar o traço de um
   ícone não exige migração nenhuma no banco.

   Chave desconhecida (vinda de outro cliente, ou de um catálogo mais
   novo) cai no genérico em vez de sumir da tela.
   ════════════════════════════════════════════════════════════ */

type IconProps = { className?: string };
type IconComponent = ComponentType<IconProps>;

const base = { viewBox: "0 0 20 20", fill: "none", "aria-hidden": true } as const;
const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

const draw =
    (path: string): IconComponent =>
    ({ className }: IconProps) => (
        <svg {...base} className={className}>
            <path d={path} {...stroke} />
        </svg>
    );

/** A ordem aqui é a ordem do seletor na tela. */
export const ICON_CATALOG: { key: string; label: string; Icon: IconComponent }[] = [
    {
        key: "food",
        label: "Alimentação",
        Icon: draw("M6 3v6a2 2 0 004 0V3M8 9v8M14 3c-1.2 1-1.8 2.4-1.8 4.2 0 1.4.6 2.3 1.8 2.6V17"),
    },
    {
        key: "market",
        label: "Mercado",
        Icon: draw("M3 4h2l1.8 8.2h8.4L17 6.6H6.2M8 16.2v.1M14 16.2v.1"),
    },
    {
        key: "restaurant",
        label: "Restaurante",
        Icon: draw(
            "M4.5 3.5v13M3 3.5v4a1.5 1.5 0 003 0v-4M15.5 3.5c-1.6 1-2.4 2.6-2.4 4.6 0 1.5.8 2.4 2.4 2.7v5.7",
        ),
    },
    {
        key: "transport",
        label: "Transporte",
        Icon: draw(
            "M4 12.5V7l1.6-3h8.8L16 7v5.5M4 12.5h12M4 12.5v2.2M16 12.5v2.2M6.4 9.8v.1M13.6 9.8v.1M4 7.6h12",
        ),
    },
    {
        key: "car",
        label: "Carro",
        Icon: draw(
            "M3.4 12.4V8.6l1.8-3.2h9.6l1.8 3.2v3.8M3.4 12.4h13.2M3.4 12.4v2.2M16.6 12.4v2.2M6 9.6v.1M14 9.6v.1",
        ),
    },
    {
        key: "fuel",
        label: "Combustível",
        Icon: draw(
            "M4 16.5V4.6a1 1 0 011-1h5a1 1 0 011 1v11.9M4 16.5h7M4 9.4h7M13 6.5l2 2v6a1.2 1.2 0 01-2.4 0V11h-1.6",
        ),
    },
    {
        key: "home",
        label: "Moradia",
        Icon: draw("M3.4 9.4L10 3.8l6.6 5.6v6.8H3.4V9.4zM8 16.2v-4.4h4v4.4"),
    },
    {
        key: "bills",
        label: "Contas de casa",
        Icon: draw("M5 3.2h10v13.6l-2.5-1.6-2.5 1.6-2.5-1.6L5 16.8V3.2zM7.8 7h4.4M7.8 10.4h4.4"),
    },
    {
        key: "phone",
        label: "Telefone e internet",
        Icon: draw(
            "M7 2.6h6a1.4 1.4 0 011.4 1.4v12a1.4 1.4 0 01-1.4 1.4H7A1.4 1.4 0 015.6 16V4A1.4 1.4 0 017 2.6zM9 14.6h2",
        ),
    },
    {
        key: "health",
        label: "Saúde",
        Icon: draw(
            "M10 4.4C8.4 2.3 4.2 3 4.2 7c0 3.2 4.4 6.2 5.8 7.6 1.4-1.4 5.8-4.4 5.8-7.6 0-4-4.2-4.7-5.8-2.6z",
        ),
    },
    {
        key: "gym",
        label: "Academia",
        Icon: draw("M3 8v4M5.4 6.4v7.2M14.6 6.4v7.2M17 8v4M5.4 10h9.2"),
    },
    {
        key: "education",
        label: "Educação",
        Icon: draw(
            "M10 4L2.8 7.4 10 10.8l7.2-3.4L10 4zM5.6 9v4.2c0 1 2 1.9 4.4 1.9s4.4-.9 4.4-1.9V9",
        ),
    },
    {
        key: "leisure",
        label: "Lazer",
        Icon: draw(
            "M3.4 6.4h13.2v8.2H3.4V6.4zM7.4 3.4l2.6 3M12.6 3.4L10 6.4M8.6 9.4l3 1.6-3 1.6V9.4z",
        ),
    },
    {
        key: "travel",
        label: "Viagem",
        Icon: draw("M2.6 10.4l14.8-4.6-2 3.4-4.2 1.4-2.6 4.2-1.4-.4.8-3.2-3.4 1-1.4-1.4-.6-.4z"),
    },
    {
        key: "shopping",
        label: "Compras",
        Icon: draw("M4.4 6.6h11.2l-1 9.4H5.4l-1-9.4zM7.2 6.6V5.2a2.8 2.8 0 015.6 0v1.4"),
    },
    {
        key: "clothes",
        label: "Vestuário",
        Icon: draw(
            "M7.2 3.4L4 5.6l1.4 2.8 1.4-.8v6.8h6.4V7.6l1.4.8L16 5.6l-3.2-2.2a2.8 2.8 0 01-5.6 0z",
        ),
    },
    {
        key: "pets",
        label: "Pets",
        Icon: draw(
            "M6.2 6.6v.1M9.4 5.2v.1M13 6.6v.1M15.4 9.6v.1M10 9.6c-2.2 0-4 2-4 3.8 0 1.4 1 2 2.2 2 .8 0 1.2-.4 1.8-.4s1 .4 1.8.4c1.2 0 2.2-.6 2.2-2 0-1.8-1.8-3.8-4-3.8z",
        ),
    },
    {
        key: "kids",
        label: "Filhos",
        Icon: draw("M10 3.6a3 3 0 100 6 3 3 0 000-6zM5 16.4a5 5 0 0110 0M7.4 6.4v.1M12.6 6.4v.1"),
    },
    {
        key: "gift",
        label: "Presentes",
        Icon: draw(
            "M3.6 8.4h12.8v8H3.6v-8zM10 8.4v8M3 6.2h14v2.2H3V6.2zM10 6.2C8.6 4 5.4 4 5.4 6.2M10 6.2c1.4-2.2 4.6-2.2 4.6 0",
        ),
    },
    {
        key: "subscription",
        label: "Assinaturas",
        Icon: draw("M4 5.4h12v9.2H4V5.4zM4 8.4h12M8.4 11.4l3 1.2-3 1.2v-2.4z"),
    },
    {
        key: "work",
        label: "Trabalho",
        Icon: draw(
            "M3.4 6.6h13.2v8.8H3.4V6.6zM7.4 6.6V5.2a1.4 1.4 0 011.4-1.4h2.4a1.4 1.4 0 011.4 1.4v1.4M3.4 10.2h13.2",
        ),
    },
    {
        key: "taxes",
        label: "Impostos",
        Icon: draw("M4.6 3.4h10.8v13.2H4.6V3.4zM7.4 7h5.2M7.4 10.2h5.2M7.4 13.4h3"),
    },
    {
        key: "savings",
        label: "Investimentos",
        Icon: draw("M4 14.6V9.4M8 14.6V5.8M12 14.6v-6M16 14.6V4M3 16.4h14"),
    },
    { key: "other", label: "Outros", Icon: draw("M5.6 10v.1M10 10v.1M14.4 10v.1") },
];

const BY_KEY = new Map(ICON_CATALOG.map((entry) => [entry.key, entry]));

/** Genérico para chave que este catálogo não conhece: a categoria
 *  continua na tela, com um desenho neutro, em vez de virar um buraco. */
const Fallback = ICON_CATALOG[ICON_CATALOG.length - 1].Icon;

export const iconFor = (iconKey: string | null | undefined): IconComponent =>
    (iconKey ? BY_KEY.get(iconKey)?.Icon : undefined) ?? Fallback;

export const iconLabel = (iconKey: string | null | undefined): string =>
    (iconKey ? BY_KEY.get(iconKey)?.label : undefined) ?? "Outros";

/** Desenha o ícone de uma categoria pela chave — o consumo mais comum,
 *  que evita `const Icon = iconFor(...)` espalhado pelas telas. */
export function CategoryIcon({
    iconKey,
    className,
}: {
    iconKey: string | null | undefined;
    className?: string;
}) {
    const Icon = iconFor(iconKey);
    return <Icon className={className} />;
}
