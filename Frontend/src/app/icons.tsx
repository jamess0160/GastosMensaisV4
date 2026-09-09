import {
    ChartColumn,
    Ellipsis,
    House,
    LogOut,
    ReceiptText,
    Settings,
    TrendingUp,
    User,
    Users,
    Wallet,
    FileSpreadsheet,
    type LucideIcon,
} from "lucide-react";

/** Ícones da navegação — lucide-react, o mesmo traço do resto do
 *  sistema (`src/ui/icons.tsx` e `src/ui/iconCatalog.tsx`).
 *
 *  Os atributos `width`/`height` do lucide são apagados pelo mesmo motivo
 *  de lá: quem dá o tamanho é o CSS da navegação, e o `24` do atributo
 *  não pode vazar para os lugares em que a folha não define medida. */

type IconProps = { className?: string };

const adapt = (Icon: LucideIcon, displayName: string) => {
    const Adapted = ({ className }: IconProps) => (
        <Icon className={className} width={undefined} height={undefined} aria-hidden />
    );
    Adapted.displayName = displayName;
    return Adapted;
};

export const IconHome = adapt(House, "IconHome");
export const IconExpenses = adapt(ReceiptText, "IconExpenses");
export const IconIncome = adapt(TrendingUp, "IconIncome");
export const IconAccounts = adapt(Wallet, "IconAccounts");
export const IconReport = adapt(ChartColumn, "IconReport");
export const IconSettings = adapt(Settings, "IconSettings");
export const IconExport = adapt(FileSpreadsheet, "IconExport");
export const IconSignOut = adapt(LogOut, "IconSignOut");
export const IconProfile = adapt(User, "IconProfile");
export const IconUsers = adapt(Users, "IconUsers");

/** "Mais" — os três pontos que o layout desenha na quinta fatia da
 *  barra inferior (`Layout/Hi-fi Mobile/04`). */
export const IconMore = adapt(Ellipsis, "IconMore");
