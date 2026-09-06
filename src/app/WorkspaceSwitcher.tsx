import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./WorkspaceSwitcher.module.css";
import { useSession, useSwitchWorkspace } from "./session";
import {
    createWorkspace,
    type CreateWorkspaceContext,
} from "@/pages/Workspace/sections/createWorkspace";
import { IconChevronDown, IconEdit, IconPlus } from "@/ui/icons";
import { Button } from "@/ui/primitives";
import { FormError, FormField, Input } from "@/ui/form";
import { FooterSpacer, Modal } from "@/ui/overlay";
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
   - **Criar** chama `POST /Workspaces` e, logo depois, o `switch` — a
     rota não troca a sessão sozinha, pela mesma razão do `join`. O
     espaço nasce vazio e com você como dono.
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

    /* O nome do espaço novo. `null` é "o formulário não está aberto" —
       um campo de texto não cabe na largura da sidebar, então ele vira
       um modal por cima. */
    const [newName, setNewName] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

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

    const createContext = useMemo<CreateWorkspaceContext>(
        () => ({
            name: newName ?? "",
            beginSubmit() {
                setCreating(true);
                setCreateError(null);
            },
            failSubmit(message) {
                setCreating(false);
                setCreateError(message);
            },
            finishCreate() {
                setCreating(false);
                setNewName(null);
                /* O `switch` já aconteceu: a tela do espaço abre JÁ no
                   novo. Ela é o lugar certo para cair — acabou de ser
                   nomeado, está vazio, e o passo seguinte de quem cria um
                   espaço para dividir é convidar alguém. */
                navigate("/espaco");
            },
        }),
        [newName, navigate],
    );

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
                                <span className={styles.pickText}>
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

                    <button
                        type="button"
                        className={styles.new}
                        disabled={pending}
                        onClick={() => {
                            setOpen(false);
                            setCreateError(null);
                            setNewName("");
                        }}
                    >
                        <IconPlus />
                        Novo espaço
                    </button>
                </div>
            )}

            {/* Criar é um formulário de um campo só, e ele não cabe na
                largura da sidebar — por isso o modal. */}
            <Modal
                open={newName !== null}
                onClose={() => setNewName(null)}
                title="Novo espaço"
                subtitle="Um espaço separa as finanças: casa e empresa, pessoal e do casal. Ele nasce vazio e com você como dono."
                footer={
                    <>
                        <FooterSpacer />
                        <Button onClick={() => setNewName(null)} disabled={creating}>
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            form="new-workspace-form"
                            disabled={creating}
                        >
                            {creating ? "Criando…" : "Criar e entrar"}
                        </Button>
                    </>
                }
            >
                <form
                    id="new-workspace-form"
                    onSubmit={(event: FormEvent) => {
                        event.preventDefault();
                        void createWorkspace(createContext, switchWorkspace);
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                    <FormError>{createError}</FormError>

                    <FormField
                        label="Nome"
                        required
                        help="Você entra nele assim que for criado. Suas contas e lançamentos atuais continuam no espaço de onde você veio."
                    >
                        {(field) => (
                            <Input
                                {...field}
                                maxLength={255}
                                placeholder="Empresa, Viagem, Casa da praia…"
                                value={newName ?? ""}
                                onChange={(event) => setNewName(event.target.value)}
                            />
                        )}
                    </FormField>
                </form>
            </Modal>
        </div>
    );
}
