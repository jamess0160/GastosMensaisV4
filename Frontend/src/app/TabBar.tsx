import { useCallback, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./TabBar.module.css";
import {
    IconAccounts,
    IconExpenses,
    IconExport,
    IconHome,
    IconIncome,
    IconMore,
    IconProfile,
    IconUsers,
    IconReport,
    IconSettings,
    IconSignOut,
} from "./icons";
import { useExportSpreadsheet } from "./exportSpreadsheet";
import { useSession, useSignOut } from "./session";
import { useOpenModal } from "./modalRoute";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SheetMenu, type SheetMenuItem } from "@/ui/overlay";
import { IconLayers, IconPlus } from "@/ui/icons";

/** A barra inferior do mobile.
 *
 *  Ela é irmã da sidebar, não uma versão reduzida dela: o que muda é que
 *  "Adicionar gasto" — que no desktop é um botão dentro da tela — vira o
 *  botão central, porque é a ação que o app existe para receber.
 *
 *  São CINCO fatias, não seis: numa barra de 390px, seis `flex: 1` com
 *  rótulo dão ~65px cada e os textos se atropelam. O layout
 *  (`Layout/Hi-fi Mobile/04`) desenha quatro links, o FAB no meio — numa
 *  fatia igual às outras, sem rótulo — e o quinto ícone é "Mais". Contas
 *  e Relatório passam para esse menu: são as duas áreas de visita menos
 *  frequente das cinco. */
const left = [
    { to: "/", label: "Início", Icon: IconHome, end: true },
    { to: "/gastos", label: "Gastos", Icon: IconExpenses },
] as const;

const right = [{ to: "/renda", label: "Renda", Icon: IconIncome }] as const;

/** As rotas que vivem dentro do menu. Estar numa delas acende "Outros" —
 *  sem isso, quem abriu Contas fica sem nenhuma fatia marcada e perde a
 *  referência de onde está. */
const inMenu = ["/contas", "/relatorio", "/personalizacao", "/perfil"];

export function TabBar() {
    const navigate = useNavigate();
    const location = useLocation();
    const signOut = useSignOut();
    const { workspace } = useSession();
    const openModal = useOpenModal();
    const exportSpreadsheet = useExportSpreadsheet();
    const [menuOpen, setMenuOpen] = useState(false);

    /* O seletor de espaço não cabe como sexta fatia da barra, então ele
       é aberto por uma linha do menu — e por isso o estado dele mora
       aqui, e não dentro do componente. `useCallback` porque ele é
       dependência do efeito de Escape lá dentro. */
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const closeSwitcher = useCallback(() => setSwitcherOpen(false), []);

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

    const menuActive = inMenu.some((path) => location.pathname.startsWith(path));

    const menu: SheetMenuItem[] = [
        {
            label: "Contas",
            description: "Contas, cartões e conciliação",
            icon: <IconAccounts />,
            onSelect: () => navigate("/contas"),
        },
        {
            label: "Relatório",
            description: "Gastos por período, categoria e pessoa",
            icon: <IconReport />,
            onSelect: () => navigate("/relatorio"),
        },
        {
            label: "Personalização",
            description: "Categorias, pessoas e formas de pagamento",
            icon: <IconSettings />,
            onSelect: () => navigate("/personalizacao"),
        },
        {
            /* TROCAR e CRIAR são do seletor, não da página: são as duas
               coisas que sumiam no telefone junto com a sidebar. O nome
               do atual vai aqui porque saber onde se está é a metade da
               informação. */
            label: "Trocar de espaço",
            description: workspace
                ? `Você está em ${workspace.Name}`
                : "Escolher ou criar um espaço",
            icon: <IconLayers />,
            onSelect: () => setSwitcherOpen(true),
        },
        {
            /* E a página é o que a página faz — nem trocar, nem criar. */
            label: "Espaço",
            description: "Nome do espaço e convites",
            icon: <IconUsers />,
            onSelect: () => navigate("/espaco"),
        },
        {
            label: "Perfil",
            description: "Seus dados e acesso",
            icon: <IconProfile />,
            onSelect: () => navigate("/perfil"),
        },
        {
            /* O histórico INTEIRO, como na sidebar: sem `From`/`To`.
               Quem quer recortar vai ao Relatório. */
            label: exportSpreadsheet.exporting ? "Exportando…" : "Exportar para Excel",
            description: "Todas as movimentações do mês em .xlsx",
            icon: <IconExport />,
            onSelect: () => exportSpreadsheet.run(),
            disabled: exportSpreadsheet.exporting,
        },
        {
            label: "Sair",
            icon: <IconSignOut />,
            onSelect: signOut,
            danger: true,
        },
    ];

    return (
        <>
            {/* Escolher no sheet FECHA o sheet, então o estado da
                exportação não pode morar lá dentro: ele vive acima da
                barra, que é o que continua na tela depois. */}
            {(exportSpreadsheet.exporting || exportSpreadsheet.error) && (
                <div
                    className={exportSpreadsheet.error ? styles.noteError : styles.note}
                    role="status"
                >
                    {exportSpreadsheet.error ?? "Montando sua planilha…"}
                </div>
            )}

            <nav className={styles.tabbar} aria-label="Navegação principal">
                {left.map((entry) => item(entry))}

                {/* A fatia do meio é uma `.tab` como as outras, só que
                    sem rótulo: é isso que mantém as cinco do mesmo
                    tamanho. */}
                <span className={styles.tab}>
                    <button
                        type="button"
                        className={styles.fab}
                        /* O FAB abre o painel por cima da tela em que
                           se está, como o botão do cabeçalho. */
                        onClick={() => openModal("/gastos/novo")}
                        aria-label="Adicionar gasto"
                    >
                        <IconPlus />
                    </button>
                </span>

                {right.map((entry) => item(entry))}

                <button
                    type="button"
                    className={menuActive ? `${styles.tab} ${styles.active}` : styles.tab}
                    onClick={() => setMenuOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={menuOpen}
                >
                    <IconMore />
                    <span className={styles.label}>Outros</span>
                </button>
            </nav>

            <SheetMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                title="Mais opções"
                items={menu}
            />

            {/* O MESMO seletor da sidebar, num segundo ponto de montagem
                — não uma versão de mobile dele. Escolher no menu FECHA o
                menu antes de agir, então os dois painéis nunca ficam um
                por cima do outro. */}
            <WorkspaceSwitcher variant="sheet" open={switcherOpen} onClose={closeSwitcher} />
        </>
    );
}
