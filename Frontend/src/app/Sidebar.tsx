import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useExportSpreadsheet } from "./exportSpreadsheet";
import { useSession, useSignOut } from "./session";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import {
    IconAccounts,
    IconBudget,
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
    /* O Orçamento vem DEPOIS da Renda porque é dela que ele parte: a
       tela abre pelo que entrou no mês e reparte esse número. */
    { to: "/orcamento", label: "Orçamento", Icon: IconBudget },
    { to: "/contas", label: "Contas", Icon: IconAccounts },
    { to: "/relatorio", label: "Relatório", Icon: IconReport },
] as const;

const settings = [{ to: "/personalizacao", label: "Personalização", Icon: IconSettings }] as const;

export function Sidebar() {
    const { user } = useSession();
    const signOut = useSignOut();
    const exportSpreadsheet = useExportSpreadsheet();

    return (
        <aside className={styles.sidebar}>
            <div className={styles.brandrow}>
                <img className={styles.mark} src="/logo.png" alt="" />
                <div>
                    <div className={styles.brandName}>Gastos mensais</div>
                    <div className={styles.brandSub}>Controle da casa</div>
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
                        {/* O item do menu exporta o HISTÓRICO INTEIRO —
                            é o que a rota faz sem `From`/`To`. Quem quer
                            recortar vai ao Relatório, onde recortar é a
                            tela: um menu global não tem período, e um
                            modal só para perguntá-lo duplicaria o
                            seletor que já existe lá. */}
                        <button
                            type="button"
                            className={styles.item}
                            onClick={() => exportSpreadsheet.run()}
                            disabled={exportSpreadsheet.exporting}
                            title="Baixa o histórico inteiro em .xlsx"
                        >
                            <IconExport />
                            {exportSpreadsheet.exporting ? "Exportando…" : "Exportar para Excel"}
                        </button>
                        {/* O erro aparece onde o botão está: a `msg` do
                            servidor já vem pronta para a tela. */}
                        {exportSpreadsheet.error && (
                            <div className={styles.itemError} role="alert">
                                {exportSpreadsheet.error}
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* O espaço vem antes do usuário porque é o de cima na
                hierarquia: o usuário está DENTRO de um espaço, e tudo que
                as telas mostram vive lá. */}
            <WorkspaceSwitcher />

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
