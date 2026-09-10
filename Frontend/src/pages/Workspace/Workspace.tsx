import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./src/styles.module.css";
import {
    WorkspaceController,
    type InviteDraft,
    type WorkspaceContext,
    type WorkspaceScope,
} from "./controller";
import { sessionKeys, useSession } from "@/app/session";
import { queryKeys } from "@/data/keys";
import { useWorkspaceMembers } from "@/data/members";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import { Badge, Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { FormError, FormField, FormNotice, Input, SegmentedControl } from "@/ui/form";
import { ConfirmDialog } from "@/ui/overlay";
import { IconCheck, IconCopy, IconPlus, IconUser } from "@/ui/icons";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import { formatDateTime } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   A tela do espaço.

   Ela é sempre a do espaço DA SESSÃO: nenhuma rota daqui recebe um
   `IdWorkspace` — todas agem no workspace do cookie, e o único id que
   viaja é o da linha em que se age (o convite, a matrícula). Quem chega
   aqui pelo lápis de outro espaço já foi trocado antes, no seletor da
   sidebar.

   E ela é quase toda a tela do DONO: renomear, convidar, listar convites
   e trocar o papel ou remover um membro respondem 403 para quem não é. Para os
   outros a tela mostra o espaço, diz de quem ele é e lista quem tem
   acesso — que é a única leitura de `assertMember` daqui —, sem oferecer
   um controle que sempre falharia.
   ════════════════════════════════════════════════════════════ */

const ROLE_LABEL: Record<ApiTypes.WorkspaceRole, string> = {
    editor: "Pode lançar e editar",
    viewer: "Só consulta",
};

/* Três papéis, e não os dois do convite: `owner` não se convida, mas é
   quem mais aparece na lista de membros. */
const MEMBER_ROLE_LABEL: Record<ApiTypes.WorkspaceMemberRole, string> = {
    owner: "Dono do espaço",
    ...ROLE_LABEL,
};

/* Os rótulos curtos do seletor de papel, num lugar só: é a MESMA
   escolha em dois momentos — no convite, antes de a pessoa entrar; na
   linha do membro, depois. Duas listas divergiriam na primeira vez que
   uma delas fosse reescrita. */
const ROLE_OPTIONS: readonly { value: ApiTypes.WorkspaceRole; label: string }[] = [
    { value: "editor", label: "Lançar" },
    { value: "viewer", label: "Só ver" },
];

const emptyInviteDraft = (): InviteDraft => ({ Email: "", Role: "editor" });

/** O link que o dono vai mandar.
 *
 *  A API não envia e-mail: ela devolve o hash, e a URL da tela de aceite
 *  é do cliente. Montá-la a partir do `origin` é o que faz o link certo
 *  em desenvolvimento e em produção sem uma variável para esquecer. */
const inviteLink = (hash: string): string =>
    `${window.location.origin}/convite/${encodeURIComponent(hash)}`;

export function Workspace() {
    const { workspace, isOwner, workspaces } = useSession();
    const queryClient = useQueryClient();

    const [name, setName] = useState(workspace?.Name ?? "");
    const [inviteDraft, setInviteDraft] = useState<InviteDraft>(emptyInviteDraft);
    const [pending, setPending] = useState<WorkspaceScope | null>(null);
    const [errors, setErrors] = useState<Partial<Record<WorkspaceScope, string | null>>>({});
    const [done, setDone] = useState<Partial<Record<WorkspaceScope, string | null>>>({});
    const [copied, setCopied] = useState<number | null>(null);
    const [revoking, setRevoking] = useState<ApiTypes.WorkspaceInvite | null>(null);
    /* A matrícula é apagada de verdade, e não arquivada: a confirmação
       existe porque não há desfazer. Guarda o membro inteiro, e não o
       id, porque a pergunta do diálogo é pelo NOME de quem sai. */
    const [removing, setRemoving] = useState<ApiTypes.WorkspaceMember | null>(null);

    /* O nome vem da sessão, e a sessão é relida depois de gravar. Sem
       isto, trocar de espaço com a tela aberta deixaria o campo com o
       nome do espaço anterior. */
    useEffect(() => setName(workspace?.Name ?? ""), [workspace?.IdWorkspace, workspace?.Name]);

    /* Só o dono: a rota responde 403 para os outros, e uma consulta que
       sempre falha vira um erro na tela sem nada que o usuário possa
       fazer a respeito. */
    const invites = useQuery({
        queryKey: queryKeys.invites,
        queryFn: () => WorkspacesConnection.invites(),
        enabled: isOwner,
    });

    /* Sem `enabled`, ao contrário dos convites: a rota abre com
       `assertMember`, então quem só lança também lê a lista. Esconder
       dele com quem divide o espaço deixaria o editor sem saber a quem
       pedir uma permissão. */
    const members = useWorkspaceMembers();

    const context = useMemo<WorkspaceContext>(
        () => ({
            name,
            inviteDraft,
            beginSubmit(scope) {
                setPending(scope);
                setErrors((current) => ({ ...current, [scope]: null }));
                setDone((current) => ({ ...current, [scope]: null }));
            },
            failSubmit(scope, message) {
                setPending(null);
                setErrors((current) => ({ ...current, [scope]: message }));
            },
            finishSubmit(scope, message) {
                setPending(null);
                setDone((current) => ({ ...current, [scope]: message }));
            },
            refreshInvites() {
                void queryClient.invalidateQueries({ queryKey: queryKeys.invites });
            },
            refreshMembers() {
                void queryClient.invalidateQueries({ queryKey: queryKeys.members });
            },
            refreshWorkspaces() {
                void queryClient.invalidateQueries({ queryKey: sessionKeys.workspaces });
            },
            clearInviteDraft: () => setInviteDraft(emptyInviteDraft()),
        }),
        [name, inviteDraft, queryClient],
    );

    const copy = async (invite: ApiTypes.WorkspaceInvite) => {
        try {
            await navigator.clipboard.writeText(inviteLink(invite.Hash));
            setCopied(invite.IdWorkspaceInvite);
            window.setTimeout(() => setCopied(null), 2000);
        } catch {
            /* Sem permissão de área de transferência (http, navegador
               antigo) o link continua visível na tela para seleção
               manual — que é por que ele é mostrado, e não só copiado. */
            setErrors((current) => ({
                ...current,
                invite: "Não consegui copiar. Selecione o link e copie à mão.",
            }));
        }
    };

    if (!workspace) {
        return (
            <Page>
                <PageHead title="Espaço" />
                <LoadingRows rows={3} />
            </Page>
        );
    }

    const rows = invites.data ?? [];

    return (
        <Page>
            {/* O selo do papel fica aqui, e não no card do nome: ele
                qualifica o ESPAÇO — "você é o dono deste espaço" —, e
                dentro daquele cabeçalho ele parecia qualificar o campo.
                Ao lado do título ele também cabe numa linha só a 390px,
                onde antes quebrava contra o subtítulo do bloco. */}
            <div className={styles.head}>
                <PageHead
                    title={workspace.Name}
                    subtitle={`Onde vivem suas contas, categorias e lançamentos · ${workspaces.length} espaço${workspaces.length === 1 ? "" : "s"} nesta conta`}
                />
                <Badge className={styles.headBadge}>
                    {isOwner ? "Você é o dono" : "Você é membro"}
                </Badge>
            </div>

            <div className={styles.grid}>
                {/* ── O nome ────────────────────────────────── */}
                <Card>
                    <div className={styles.section}>
                        <div className={styles.sectionHead}>
                            <div>
                                <div className={styles.sectionTitle}>Nome do espaço</div>
                                <div className={styles.sectionSub}>
                                    É o que aparece no seletor da barra lateral, em toda tela.
                                </div>
                            </div>
                        </div>

                        <FormError>{errors.name}</FormError>
                        <FormNotice>{done.name}</FormNotice>

                        {isOwner ? (
                            <form
                                className={styles.row}
                                onSubmit={(event: FormEvent) => {
                                    event.preventDefault();
                                    void WorkspaceController.saveWorkspace(context);
                                }}
                            >
                                <FormField label="Nome" required className={styles.rowGrow}>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            maxLength={255}
                                            placeholder="Casa, Escritório…"
                                            value={name}
                                            onChange={(event) => setName(event.target.value)}
                                        />
                                    )}
                                </FormField>
                                <Button
                                    variant="primary"
                                    type="submit"
                                    disabled={pending === "name"}
                                >
                                    {pending === "name" ? "Salvando…" : "Salvar nome"}
                                </Button>
                            </form>
                        ) : (
                            <div className={styles.note}>
                                Só o dono do espaço muda o nome e convida gente. Você lança e
                                consulta normalmente.
                            </div>
                        )}
                    </div>
                </Card>

                {/* ── Quem tem acesso ───────────────────────── */}
                <Card>
                    <div className={styles.section}>
                        <div className={styles.sectionHead}>
                            <div>
                                <div className={styles.sectionTitle}>Quem tem acesso</div>
                                <div className={styles.sectionSub}>
                                    Todos aqui veem as mesmas contas, os mesmos lançamentos e os
                                    mesmos saldos. O que muda entre os papéis é quem pode escrever.
                                </div>
                            </div>
                        </div>

                        {/* Escopo próprio: o aviso de que o papel mudou não
                            pode ser apagado por um convite criado depois,
                            nem apagar o dele. */}
                        <FormError>{errors.members}</FormError>
                        <FormNotice>{done.members}</FormNotice>

                        {members.isPending ? (
                            <LoadingRows rows={2} />
                        ) : members.isError ? (
                            <ErrorState
                                inline
                                error={members.error}
                                onRetry={() => void members.refetch()}
                            />
                        ) : (
                            <div className={styles.members}>
                                {(members.data ?? []).map((member) => (
                                    <div className={styles.member} key={member.IdWorkspaceMember}>
                                        <div className={styles.memberBody}>
                                            <div className={styles.memberName}>
                                                {member.Name}
                                                {/* Quem é "você" vem da API, em
                                                    `IsSelf`: comparar e-mail aqui
                                                    seria comparar a coisa errada. */}
                                                {member.IsSelf && (
                                                    <span className={styles.selfTag}>você</span>
                                                )}
                                            </div>
                                            <div className={styles.memberSub}>{member.Email}</div>
                                            <div className={styles.memberSub}>
                                                {MEMBER_ROLE_LABEL[member.Role]} · entrou em{" "}
                                                {formatDateTime(member.JoinedAt)}
                                            </div>
                                        </div>

                                        {/* As ações só para o dono, e nunca na
                                            própria linha: as duas rotas respondem
                                            403 para quem não é dono e 406 na
                                            própria matrícula — um controle que
                                            sempre falharia não é um controle.

                                            Não há terceiro caso a filtrar: o dono
                                            é um só, e é ele quem está olhando —
                                            então `IsSelf` já exclui a linha de
                                            papel `owner`. */}
                                        {isOwner && !member.IsSelf && (
                                            <span className={styles.memberActions}>
                                                {/* O teste do papel é o que diz ao
                                                    compilador que sobraram os dois
                                                    do seletor. Remover, ao
                                                    contrário, não depende do papel:
                                                    tira-se editor e viewer do mesmo
                                                    jeito. */}
                                                {member.Role !== "owner" && (
                                                    <SegmentedControl
                                                        value={member.Role}
                                                        ariaLabel={`O que ${member.Name} pode fazer`}
                                                        onChange={(Role) =>
                                                            void WorkspaceController.updateMemberRole(
                                                                context,
                                                                member,
                                                                Role,
                                                            )
                                                        }
                                                        options={ROLE_OPTIONS.map((option) => ({
                                                            ...option,
                                                            disabled: pending === "members",
                                                        }))}
                                                    />
                                                )}
                                                {/* Atrás de confirmação, no padrão
                                                    do arquivamento de Contas: a
                                                    matrícula é apagada de verdade e
                                                    não há desfazer. */}
                                                <Button
                                                    size="sm"
                                                    disabled={pending === "members"}
                                                    onClick={() => setRemoving(member)}
                                                >
                                                    Remover
                                                </Button>
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                {/* ── Convites ──────────────────────────────── */}
                {/* Depois dos membros, e não antes: o convite é o que
                    ainda NÃO virou acesso. */}
                {isOwner && (
                    <Card>
                        <div className={styles.section}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <div className={styles.sectionTitle}>Convidar alguém</div>
                                    <div className={styles.sectionSub}>
                                        O convite vale 7 dias, serve uma vez só e pode ser revogado
                                        a qualquer momento.
                                    </div>
                                </div>
                            </div>

                            <FormError>{errors.invite}</FormError>
                            <FormNotice>{done.invite}</FormNotice>

                            <form
                                className={styles.row}
                                onSubmit={(event: FormEvent) => {
                                    event.preventDefault();
                                    void WorkspaceController.createInvite(context);
                                }}
                            >
                                <FormField label="E-mail" required className={styles.rowGrow}>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            type="email"
                                            maxLength={255}
                                            placeholder="alguem@exemplo.com"
                                            value={inviteDraft.Email}
                                            onChange={(event) =>
                                                setInviteDraft((current) => ({
                                                    ...current,
                                                    Email: event.target.value,
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>

                                {/* Dois papéis, não três: `owner` responde
                                    406 — propriedade não se convida. */}
                                <FormField label="Pode">
                                    {() => (
                                        <SegmentedControl
                                            value={inviteDraft.Role}
                                            ariaLabel="O que a pessoa poderá fazer"
                                            onChange={(Role) =>
                                                setInviteDraft((current) => ({ ...current, Role }))
                                            }
                                            options={ROLE_OPTIONS}
                                        />
                                    )}
                                </FormField>

                                <Button
                                    variant="primary"
                                    type="submit"
                                    disabled={pending === "invite"}
                                >
                                    <IconPlus />
                                    {pending === "invite" ? "Criando…" : "Criar convite"}
                                </Button>
                            </form>

                            {/* O recado que muda o comportamento de quem
                                usa: a API não manda e-mail nenhum. Sem
                                copiar o link, o convite fica no banco e
                                não chega a ninguém. */}
                            <div className={styles.note}>
                                <b>Nós não enviamos o e-mail.</b> O convite vira um link, e quem
                                manda é você — WhatsApp, e-mail, o que preferir. E{" "}
                                <b>o e-mail precisa bater</b>: quem abrir o link só entra se a conta
                                dele for a do endereço convidado. É isso que faz o link poder ser
                                encaminhado sem virar porta de entrada.
                            </div>

                            <div className={styles.sectionTitle}>Convites pendentes</div>

                            {invites.isPending ? (
                                <LoadingRows rows={2} />
                            ) : invites.isError ? (
                                <ErrorState
                                    inline
                                    error={invites.error}
                                    onRetry={() => void invites.refetch()}
                                />
                            ) : rows.length === 0 ? (
                                <EmptyState
                                    inline
                                    icon={<IconUser />}
                                    title="Nenhum convite esperando"
                                    description="Quem já entrou não aparece aqui — esta lista é só de quem foi convidado e ainda não aceitou."
                                />
                            ) : (
                                <div className={styles.invites}>
                                    {rows.map((invite) => {
                                        const expired = new Date(invite.ExpiresAt) < new Date();

                                        return (
                                            <div
                                                className={styles.invite}
                                                key={invite.IdWorkspaceInvite}
                                            >
                                                <div className={styles.inviteBody}>
                                                    <div className={styles.inviteEmail}>
                                                        {invite.Email}
                                                    </div>
                                                    <div
                                                        className={`${styles.inviteSub} ${expired ? styles.expired : ""}`}
                                                    >
                                                        {ROLE_LABEL[invite.Role]} ·{" "}
                                                        {expired
                                                            ? `expirou em ${formatDateTime(invite.ExpiresAt)}`
                                                            : `vale até ${formatDateTime(invite.ExpiresAt)}`}
                                                    </div>
                                                </div>

                                                <span className={styles.inviteActions}>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => void copy(invite)}
                                                    >
                                                        {copied === invite.IdWorkspaceInvite ? (
                                                            <>
                                                                <IconCheck />
                                                                Copiado
                                                            </>
                                                        ) : (
                                                            <>
                                                                <IconCopy />
                                                                Copiar link
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        disabled={pending === "invite"}
                                                        onClick={() => setRevoking(invite)}
                                                    >
                                                        Revogar
                                                    </Button>
                                                </span>

                                                {/* O link fica à vista, e não só
                                                    atrás do botão: sem área de
                                                    transferência (http, navegador
                                                    antigo) ele ainda pode ser
                                                    selecionado à mão. */}
                                                <div className={styles.link}>
                                                    <span className={styles.linkText}>
                                                        {inviteLink(invite.Hash)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className={styles.note}>
                                Revogar um convite só impede quem <b>ainda não usou</b> o link. Quem
                                já entrou aparece em <b>Quem tem acesso</b>, acima, e é lá que se
                                remove.
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            <ConfirmDialog
                open={revoking !== null}
                onClose={() => setRevoking(null)}
                onConfirm={() => {
                    const target = revoking;
                    setRevoking(null);
                    if (target) {
                        void WorkspaceController.revokeInvite(context, target.IdWorkspaceInvite);
                    }
                }}
                title={`Revogar o convite de ${revoking?.Email ?? ""}?`}
                description="O link para de funcionar na hora. Se essa pessoa já tiver entrado, revogar não a tira do espaço — ela não apareceria nesta lista, e quem tira é o botão de remover em Quem tem acesso."
                confirmLabel="Revogar"
                danger
                pending={pending === "invite"}
            />

            {/* A confirmação de remover, no mesmo padrão do arquivamento
                de Contas — mas o texto diz o oposto: aqui a linha é
                apagada de verdade, e o que NÃO acontece é o que precisa
                estar escrito. Gasto, entrada e conta são do espaço, e
                quem gastou é a lista de pessoas, que não tem relação com
                quem tem login: nenhum saldo muda. */}
            <ConfirmDialog
                open={removing !== null}
                onClose={() => setRemoving(null)}
                onConfirm={() => {
                    const target = removing;
                    setRemoving(null);
                    if (target) {
                        void WorkspaceController.removeMember(context, target);
                    }
                }}
                title={`Remover ${removing?.Name ?? ""} do espaço?`}
                description="A pessoa perde o acesso na hora e não há como desfazer — readmitir é convidar de novo, e a data de entrada recomeça. Nada do que ela lançou é apagado: os gastos, as entradas e as contas são do espaço, o rateio das pessoas fica igual e nenhum saldo muda."
                confirmLabel="Remover"
                danger
                pending={pending === "members"}
            />
        </Page>
    );
}
