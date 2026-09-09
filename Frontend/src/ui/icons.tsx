import type { ReactNode } from "react";
import {
    Archive,
    ArrowDown,
    ArrowLeftRight,
    ArrowUp,
    Banknote,
    Calendar,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    CreditCard,
    Eye,
    EyeOff,
    Fingerprint,
    Landmark,
    Layers,
    Pencil,
    Plus,
    Repeat2,
    Search,
    Tag,
    TriangleAlert,
    User,
    X,
    type LucideIcon,
} from "lucide-react";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Ícones do sistema — lucide-react.

   O mesmo traço do catálogo de categorias (`src/ui/iconCatalog.tsx`).
   Antes eram SVGs desenhados à mão a partir do layout, e conviver com
   duas famílias de desenho na mesma tela é o tipo de inconsistência que
   ninguém sabe apontar mas todo mundo enxerga.

   Os NOMES daqui não mudaram: o que cada tela pede é a função, não o
   ícone do lucide. Trocar `IconPix` de desenho é uma linha neste
   arquivo, e nenhuma tela fica sabendo.
   ════════════════════════════════════════════════════════════ */

type IconProps = { className?: string };

/** Adapta um ícone do lucide ao contrato desta pasta.
 *
 *  O lucide escreve `width="24" height="24"` nos atributos do `<svg>`, e
 *  as telas daqui dimensionam pelo CONTÊINER — `.btn svg { width: 16px }`
 *  e companhia. Passar `undefined` APAGA os dois atributos (o React
 *  omite prop indefinida), deixando o `<svg>` só com o `viewBox`: é
 *  exatamente o que os desenhos à mão que este arquivo substituiu
 *  faziam.
 *
 *  Não é a mesma coisa que `width="100%"`: onde a folha dá só a largura,
 *  sem atributo a altura sai da proporção do desenho; com 100% ela sairia
 *  da altura do contêiner, e o ícone entortaria em toda caixa que não
 *  fosse quadrada. */
const adapt = (Icon: LucideIcon, displayName: string) => {
    const Adapted = ({ className }: IconProps) => (
        <Icon className={className} width={undefined} height={undefined} aria-hidden />
    );
    Adapted.displayName = displayName;
    return Adapted;
};

/* ── Ações ────────────────────────────────────────────────── */
export const IconPlus = adapt(Plus, "IconPlus");
export const IconClose = adapt(X, "IconClose");
export const IconCheck = adapt(Check, "IconCheck");
export const IconEdit = adapt(Pencil, "IconEdit");
export const IconArchive = adapt(Archive, "IconArchive");
export const IconCopy = adapt(Copy, "IconCopy");

/* ── Navegação e seleção ──────────────────────────────────── */
export const IconChevronDown = adapt(ChevronDown, "IconChevronDown");
export const IconChevronLeft = adapt(ChevronLeft, "IconChevronLeft");
export const IconChevronRight = adapt(ChevronRight, "IconChevronRight");
export const IconCalendar = adapt(Calendar, "IconCalendar");
export const IconSearch = adapt(Search, "IconSearch");

/* ── Dinheiro ─────────────────────────────────────────────── */
export const IconArrowUp = adapt(ArrowUp, "IconArrowUp");
export const IconArrowDown = adapt(ArrowDown, "IconArrowDown");
/** Transferência: as duas pontas do saldo se movendo ao mesmo tempo. */
export const IconTransfer = adapt(ArrowLeftRight, "IconTransfer");
export const IconCard = adapt(CreditCard, "IconCard");
export const IconBank = adapt(Landmark, "IconBank");
export const IconCash = adapt(Banknote, "IconCash");
/** Pix é MARCA, não ícone de traço: o lucide não tem, e redesenhar o
 *  logotipo de terceiro à mão seria pior do que usá-lo. O arquivo mora em
 *  `public/pix.webp`, como o `logo.png`.
 *
 *  Vai DENTRO de um `<svg>` com `viewBox`, e não como `<img>` solto, por
 *  um motivo prático: todo o CSS deste projeto dimensiona ícone por
 *  `svg { width: … }` — `.tile svg`, `.method svg`, `.cardMark svg`. Um
 *  `<img>` não seria alcançado por regra nenhuma dessas e apareceria no
 *  tamanho natural, 512px. Embrulhado assim, ele se comporta como
 *  qualquer outro ícone daqui, e nenhuma folha precisou mudar.
 *
 *  Não herda `currentColor` — e é o certo: é a marca, com as cores dela. */
export function IconPix({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
            <image href="/pix.webp" width="24" height="24" />
        </svg>
    );
}

/* ── Lançamento ───────────────────────────────────────────── */
export const IconTag = adapt(Tag, "IconTag");
/** Gasto fixo — o mesmo desenho que o catálogo usa em "Recorrentes". */
export const IconRepeat = adapt(Repeat2, "IconRepeat");
export const IconLayers = adapt(Layers, "IconLayers");
export const IconAlert = adapt(TriangleAlert, "IconAlert");

/* ── Conta e sessão ───────────────────────────────────────── */
export const IconEye = adapt(Eye, "IconEye");
export const IconEyeOff = adapt(EyeOff, "IconEyeOff");
export const IconFingerprint = adapt(Fingerprint, "IconFingerprint");
export const IconUser = adapt(User, "IconUser");

/** O ícone de uma forma de pagamento sai do `Kind` — mesmo desenho na
 *  lista de gastos e nos seletores, para o Pix da lista e o Pix do
 *  seletor serem visivelmente a mesma coisa. */
export const METHOD_ICON: Record<ApiTypes.PaymentMethodKind, ReactNode> = {
    credit_card: <IconCard />,
    pix: <IconPix />,
    debit: <IconBank />,
};
