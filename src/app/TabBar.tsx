import { NavLink, useNavigate } from "react-router-dom";
import styles from "./TabBar.module.css";
import { IconAccounts, IconExpenses, IconHome, IconIncome, IconReport } from "./icons";
import { IconPlus } from "@/ui/icons";

/** A barra inferior do mobile.
 *
 *  Ela é irmã da sidebar, não uma versão reduzida dela: as cinco áreas
 *  são as mesmas, e o que muda é que "Adicionar gasto" — que no desktop
 *  é um botão dentro da tela — vira o botão central, porque é a ação
 *  que o app existe para receber.
 *
 *  Personalização e perfil ficam de fora: são visitas raras, e cabem
 *  dentro da tela de Início sem custar um sexto ícone numa barra de
 *  390px. */
const left = [
    { to: "/", label: "Início", Icon: IconHome, end: true },
    { to: "/gastos", label: "Gastos", Icon: IconExpenses },
] as const;

const right = [
    { to: "/renda", label: "Renda", Icon: IconIncome },
    { to: "/contas", label: "Contas", Icon: IconAccounts },
    { to: "/relatorio", label: "Relatório", Icon: IconReport },
] as const;

export function TabBar() {
    const navigate = useNavigate();

    const item = ({
        to,
        label,
        Icon,
        end,
    }: {
        to: string;
        label: string;
        Icon: typeof IconHome;
        end?: boolean;
    }) => (
        <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
            <Icon />
            <span className={styles.label}>{label}</span>
        </NavLink>
    );

    return (
        <nav className={styles.tabbar} aria-label="Navegação principal">
            {left.map((entry) => item(entry))}

            <span className={styles.fabSlot}>
                <button
                    type="button"
                    className={styles.fab}
                    onClick={() => navigate("/gastos/novo")}
                    aria-label="Adicionar gasto"
                >
                    <IconPlus />
                </button>
            </span>

            {right.map((entry) => item(entry))}
        </nav>
    );
}
