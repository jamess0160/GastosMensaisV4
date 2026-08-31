import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useSession, useSignOut } from "./session";
import {
    IconAccounts,
    IconExpenses,
    IconExport,
    IconHome,
    IconIncome,
    IconReport,
    IconSettings,
    IconSignOut,
} from "./icons";

const primary = [
    { to: "/", label: "Início", Icon: IconHome, end: true },
    { to: "/gastos", label: "Gastos", Icon: IconExpenses },
    { to: "/renda", label: "Renda", Icon: IconIncome },
    { to: "/contas", label: "Contas", Icon: IconAccounts },
    { to: "/relatorio", label: "Relatório", Icon: IconReport },
] as const;

const settings = [{ to: "/personalizacao", label: "Personalização", Icon: IconSettings }] as const;

export function Sidebar() {
    const { user, workspaces } = useSession();
    const signOut = useSignOut();
    const workspaceName = workspaces[0]?.Name ?? "";

    return (
        <aside className={styles.sidebar}>
            <div className={styles.brandrow}>
                <img className={styles.mark} src="/logo.png" alt="" />
                <div>
                    <div className={styles.brandName}>Gastos mensais</div>
                    {workspaceName && <div className={styles.brandSub}>{workspaceName}</div>}
                </div>
            </div>

            <nav className={styles.nav}>
                <div className={styles.group}>
                    {primary.map(({ to, label, Icon, ...rest }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={"end" in rest ? rest.end : undefined}
                            className={({ isActive }) =>
                                isActive ? `${styles.item} ${styles.active}` : styles.item
                            }
                        >
                            <Icon />
                            {label}
                        </NavLink>
                    ))}
                </div>

                <div>
                    <div className={styles.sectionHeading}>Configuração</div>
                    <div className={styles.group}>
                        {settings.map(({ to, label, Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    isActive ? `${styles.item} ${styles.active}` : styles.item
                                }
                            >
                                <Icon />
                                {label}
                            </NavLink>
                        ))}
                        {/* Sem API: a exportação ainda não existe no contrato. */}
                        <button
                            type="button"
                            className={styles.item}
                            disabled
                            title="Ainda sem API"
                        >
                            <IconExport />
                            Exportar para Excel
                        </button>
                    </div>
                </div>
            </nav>

            <div className={styles.user}>
                {/* O bloco do usuário é o caminho para o perfil: é onde
                    se procura por "meus dados" sem pensar. */}
                <NavLink to="/perfil" className={styles.userLink}>
                    <span className={styles.avatar}>{user.Name.charAt(0).toUpperCase()}</span>
                    <div className={styles.userInfo}>
                        <div className={styles.userName}>{user.Name}</div>
                        <div className={styles.userEmail}>{user.Email}</div>
                    </div>
                </NavLink>
                <button type="button" className={styles.iconButton} onClick={signOut} title="Sair">
                    <IconSignOut />
                </button>
            </div>
        </aside>
    );
}
