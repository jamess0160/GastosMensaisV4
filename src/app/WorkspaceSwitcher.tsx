import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./WorkspaceSwitcher.module.css";
import { useSession, useSwitchWorkspace } from "./session";
import { IconChevronDown, IconEdit, IconPlus } from "@/ui/icons";
import { errorMessage } from "@/api/client";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O seletor de espaço.

   O espaço é a raiz de tudo que a tela mostra, e trocá-lo troca o
   sistema inteiro por baixo — por isso ele mora no chassi, com um
   gesto só, e não repetido dentro das telas.

   TRÊS COISAS SE FAZEM AQUI, e cada uma tem um limite do contrato:

   - **Trocar** chama `POST /Workspaces/switch`, que reemite o cookie e
     invalida todo o cache. É a única rota que recebe `IdWorkspace`.
   - **Editar** só aparece em quem é `owner` (`IdOwnerUser`), porque as
     rotas de gestão respondem 403 aos outros. E, como elas agem no
     espaço DA SESSÃO e não recebem id, editar um espaço que não é o
     atual TROCA a sessão antes — não há outro jeito de o formulário
     gravar no lugar certo.
   - **Criar** não existe: não há `POST /Workspaces` (pendência 18). O
     botão fica desabilitado e rotulado, como os outros do sistema que
     esperam rota.
   ════════════════════════════════════════════════════════════ */

const initials = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase();

export function WorkspaceSwitcher() {
    const navigate = useNavigate();
    const { workspaces, workspace, user } = useSession();
    const switchWorkspace = useSwitchWorkspace();

    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    /* Clique fora e Esc fecham. O painel cobre a navegação e o bloco do
       usuário: deixá-lo aberto por engano esconde meia sidebar. */
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    if (!workspace) return null;

    const isOwnerOf = (candidate: ApiTypes.Workspace) => candidate.IdOwnerUser === user.IdUser;
    const isCurrent = (candidate: ApiTypes.Workspace) =>
        candidate.IdWorkspace === workspace.IdWorkspace;

    const run = async (idWorkspace: number, then?: () => void) => {
        setPending(true);
        setError(null);
        try {
            await switchWorkspace(idWorkspace);
            setOpen(false);
            then?.();
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setPending(false);
        }
    };

    /** O lápis. Gerenciar é sempre o espaço DA SESSÃO — as rotas não
     *  recebem id —, então um espaço que não é o atual é trocado antes.
     *  Uma chamada a mais e o cache inteiro descartado; a alternativa
     *  seria um formulário que grava no espaço errado. */
    const manage = (candidate: ApiTypes.Workspace) => {
        if (isCurrent(candidate)) {
            setOpen(false);
            navigate("/espaco");
            return;
        }
        void run(candidate.IdWorkspace, () => navigate("/espaco"));
    };

    return (
        <div className={styles.wrap} ref={wrapRef}>
            <button
                type="button"
                className={styles.trigger}
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-haspopup="menu"
            >
                <span className={styles.mark}>{initials(workspace.Name)}</span>
                <span className={styles.body}>
                    <span className={styles.label}>Espaço</span>
                    <span className={styles.name}>{workspace.Name}</span>
                </span>
                <span className={styles.chevron}>
                    <IconChevronDown />
                </span>
            </button>

            {open && (
                <div className={styles.panel} role="menu">
                    {workspaces.map((candidate) => (
                        <div
                            className={`${styles.row} ${isCurrent(candidate) ? styles.on : ""}`}
                            key={candidate.IdWorkspace}
                        >
                            <button
                                type="button"
                                className={styles.pick}
                                disabled={pending || isCurrent(candidate)}
                                onClick={() => void run(candidate.IdWorkspace)}
                            >
                                <span className={styles.dot} />
                                <span style={{ minWidth: 0 }}>
                                    <span className={styles.pickName}>{candidate.Name}</span>
                                    <span className={styles.pickSub}>
                                        {isCurrent(candidate)
                                            ? "Espaço atual"
                                            : pending
                                              ? "Trocando…"
                                              : "Entrar neste espaço"}
                                    </span>
                                </span>
                            </button>

                            {/* Só o dono: as rotas de gestão respondem 403
                                para quem não é, e oferecer o caminho seria
                                oferecer uma tela que sempre falha. */}
                            {isOwnerOf(candidate) && (
                                <button
                                    type="button"
                                    className={styles.edit}
                                    disabled={pending}
                                    title={
                                        isCurrent(candidate)
                                            ? "Gerenciar este espaço"
                                            : "Entrar neste espaço e gerenciá-lo"
                                    }
                                    aria-label={`Gerenciar ${candidate.Name}`}
                                    onClick={() => manage(candidate)}
                                >
                                    <IconEdit />
                                </button>
                            )}
                        </div>
                    ))}

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.sep} />

                    {/* Sem rota: não existe `POST /Workspaces`, e um
                        workspace só nasce no cadastro. Pendência 18. */}
                    <button type="button" className={styles.new} disabled title="Ainda sem API">
                        <IconPlus />
                        Novo espaço
                    </button>
                    <div className={styles.note}>
                        Criar um espaço novo ainda não tem rota na API. Para entrar num espaço de
                        outra pessoa, peça um convite ao dono dele.
                    </div>
                </div>
            )}
        </div>
    );
}
