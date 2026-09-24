import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./src/styles.module.css";
import {
    WorkspaceController,
    type InviteDraft,
    type WorkspaceContext,
    type WorkspaceScope,
} from "./controller";
import { createWorkspace, type CreateWorkspaceContext } from "./sections/createWorkspace";
import { sessionKeys, useSession, useSwitchWorkspace } from "@/app/session";
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

   COM UMA EXCEÇÃO, e ela é o inverso de todas as outras: **sair do
   espaço** é a única ação daqui que o dono NÃO pode fazer. A rota exige
   não ser dono, então é o botão que aparece só para quem não é.

   E a tela tem um terceiro estado, além do dono e do membro: **espaço
   nenhum**. Quem sai do último cai nele — sessão válida, sem espaço a
   que voltar —, e aí a tela é só a criação de um.

   Uma ação daqui **muda o lado em que o próprio usuário está**, e é a
   única do app que faz isso: transferir a propriedade. Ela não tem
   guarda própria nem estado próprio — o dono a chama como chama remover
   —, e o que ela faz é virar o `isOwner` da sessão. Todas as guardas
   desta tela caem do outro lado sozinhas depois dela: quem transferiu
   perde o bloco de convites e ganha o botão de sair, e quem recebeu
   passa a ver os dois. O que a section tem de garantir é só que a lista
   de ESPAÇOS seja relida junto com a de membros — é o `IdOwnerUser` de
   lá que o `isOwner` lê.
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
    const { workspace, workspacesPending, isOwner } = useSession();
    const queryClient = useQueryClient();
    const switchWorkspace = useSwitchWorkspace();

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
    /* A ação mais destrutiva da tela, e a única que muda o que o PRÓPRIO
       usuário pode fazer: quem confirma sai do clique sem o bloco de
       convites e sem as ações de membro. Guarda o membro inteiro porque a
       pergunta do diálogo é pelo NOME de quem recebe — o aviso não pode
       ser genérico numa ação que só o outro lado pode desfazer. */
    const [transferring, setTransferring] = useState<ApiTypes.WorkspaceMember | null>(null);
    /* Sair também é irreversível, e pelo mesmo motivo: a matrícula é
       apagada de verdade, e voltar é ser convidado de novo. Booleano e
       não um membro, porque quem sai é sempre você. */
    const [leaving, setLeaving] = useState(false);
    /* O nome do espaço a criar, para quando não houver espaço NENHUM —
       o estado em que sair do último deixa a sessão. `null` é "o
       formulário não está na tela", como no seletor do chassi. */
    const [newName, setNewName] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

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

    /* A MESMA section do seletor do chassi, e é o ponto: criar espaço é
       um POST seguido de um `switch`, e duas implementações disso
       divergiriam na primeira vez que uma delas esquecesse a segunda
       chamada. O que muda aqui é só a caixa — um card no lugar de um
       modal, porque quem chega neste estado não tem tela por baixo. */
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
                /* Sem `navigate`: o `switch` já aconteceu dentro da
                   section, e o `reset` do cache traz a lista de espaços
                   com o novo marcado como atual. Esta mesma tela volta a
                   desenhar o espaço inteiro. */
            },
        }),
        [newName],
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

    /* Sem espaço nenhum, e a lista ainda vindo: é só o carregamento. */
    if (!workspace && workspacesPending) {
        return (
            <Page>
                <PageHead title="Espaço" />
                <LoadingRows rows={3} />
            </Page>
        );
    }

    /* Sem espaço nenhum, e a lista JÁ chegou vazia. Deixou de ser
       impossível quando sair do espaço passou a existir: quem sai do
       último cai exatamente aqui, com a sessão válida e sem espaço a que
       voltar. A API responde 406 em toda rota escopada, e o conserto que
       ela não pode fazer sozinha é este — criar um espaço, a única rota
       da feature que não confere matrícula, porque o workspace nasce
       nela.

       O seletor do chassi não serve aqui: ele desenha o espaço atual, e
       não há um. */
    if (!workspace) {
        return (
            <Page>
                <PageHead
                    title="Você não está em nenhum espaço"
                    subtitle="Um espaço é onde vivem suas contas, categorias e lançamentos — sem um, não há onde lançar nada."
                />
                <Card>
                    <div className={styles.section}>
                        <div className={styles.sectionHead}>
                            <div>
                                <div className={styles.sectionTitle}>Criar um espaço</div>
                                <div className={styles.sectionSub}>
                                    Ele nasce vazio e com você como dono. Você entra nele assim que
                                    for criado.
                                </div>
                            </div>
                        </div>

                        <FormError>{createError}</FormError>

                        <form
                            className={styles.row}
                            onSubmit={(event: FormEvent) => {
                                event.preventDefault();
                                void createWorkspace(createContext, switchWorkspace);
                            }}
                        >
                            <FormField label="Nome" required className={styles.rowGrow}>
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={255}
                                        placeholder="Casa, Escritório…"
                                        value={newName ?? ""}
                                        onChange={(event) => setNewName(event.target.value)}
                                    />
                                )}
                            </FormField>
                            <Button variant="primary" type="submit" disabled={creating}>
                                {creating ? "Criando…" : "Criar e entrar"}
                            </Button>
                        </form>

                        <div className={styles.note}>
                            Se você saiu de um espaço compartilhado,{" "}
                            <b>nada do que você lançou lá foi apagado</b> — gastos, entradas e
                            contas são do espaço, e continuam com quem ficou. Para voltar, peça um
                            convite novo ao dono.
                        </div>
                    </div>
                </Card>
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
                    subtitle="Onde vivem suas contas, categorias e lançamentos"
                />
                <Badge className={styles.headBadge}>
                    {isOwner ? "Você é o dono" : "Você é membro"}
                </Badge>
            </div>

            <div className={styles.grid}>
                {/* ── O nome ────────────────────────────────── */}
                <Card>
                    <div className={styles.section}>
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
                                Só o dono do espaço muda o nome e convida novas pessoas. Você pode
                                lançar e consulta normalmente.
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
                                                {/* Por último, e é de propósito: é a
                                                    ação mais forte da tela — a única
                                                    que muda o que o próprio usuário
                                                    pode fazer, e a única cujo desfazer
                                                    não está com ele. Fica onde o dedo
                                                    não passa antes de "Remover".

                                                    A condição é a mesma das outras
                                                    duas, sem nada a mais: `isOwner`
                                                    porque a rota é 403 para quem não
                                                    é, e `!IsSelf` porque a própria
                                                    matrícula é 406 — "você já é o
                                                    dono". Um viewer também pode
                                                    receber: não existe dono que só
                                                    consulta, e o papel vem junto com
                                                    o espaço. */}
                                                <Button
                                                    size="sm"
                                                    disabled={pending === "members"}
                                                    onClick={() => setTransferring(member)}
                                                >
                                                    Tornar dono
                                                </Button>
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Sair é a guarda OPOSTA de remover: aquela rota
                            é só do dono, esta é de todo mundo MENOS ele.
                            Enquanto ele for dono, sair deixaria o espaço
                            sem quem convida e sem quem remove — a chamada
                            direta responde 406 mandando transferir a
                            propriedade, e é por isso que o botão não
                            aparece aqui. Não é a mesma condição do bloco
                            de ações da linha: lá é `isOwner && !IsSelf`,
                            aqui é só `!isOwner`. */}
                        {!isOwner && (
                            <div className={styles.leave}>
                                <div className={styles.leaveText}>
                                    <div className={styles.sectionTitle}>Sair deste espaço</div>
                                    <div className={styles.sectionSub}>
                                        Você perde o acesso na hora. O que você lançou fica com quem
                                        ficou, e voltar exige um convite novo.
                                    </div>
                                </div>
                                <Button
                                    disabled={pending === "members"}
                                    onClick={() => setLeaving(true)}
                                >
                                    {pending === "members" ? "Saindo…" : "Sair do espaço"}
                                </Button>
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
                description="A pessoa perde o acesso na hora e não há como desfazer, precisa convidar novamente. Nada do que ela lançou é apagado: os gastos, as entradas e as contas são do espaço, o rateio das pessoas fica igual e nenhum saldo muda."
                confirmLabel="Remover"
                danger
                pending={pending === "members"}
            />

            {/* A confirmação mais forte da tela. O que ela tem de dizer é
                diferente das outras duas: aqui não se perde acesso a
                nada de imediato — quem transfere continua lançando e
                editando —, o que se perde é o comando do espaço, e o
                desfazer não está mais com quem clicou. Por isso o nome de
                quem recebe vem POR EXTENSO no título e no texto: numa
                ação que só o outro lado pode reverter, "esta pessoa" não
                é confirmação suficiente. */}
            <ConfirmDialog
                open={transferring !== null}
                onClose={() => setTransferring(null)}
                onConfirm={() => {
                    const target = transferring;
                    setTransferring(null);
                    if (target) {
                        void WorkspaceController.transferOwnership(context, target);
                    }
                }}
                title={`Passar a propriedade de ${workspace.Name} para ${transferring?.Name ?? ""}?`}
                description={
                    <>
                        <b>
                            {transferring?.Name ?? ""} passa a ser o dono e você passa a ser editor
                        </b>{" "}
                        - você continua lançando e editando, mas deixa de renomear o espaço, de
                        convidar, de remover pessoas e de mudar papéis. Nada do que existe no espaço
                        muda: contas, lançamentos e saldos ficam exatamente como estão.{" "}
                        <b>Só {transferring?.Name ?? "o novo dono"} pode devolver a propriedade</b>{" "}
                        - você não tem como desfazer isso sozinho.
                    </>
                }
                confirmLabel="Passar a propriedade"
                danger
                pending={pending === "members"}
            />

            {/* Sair é irreversível pelo mesmo motivo de remover — a
                matrícula é apagada de verdade —, mas o que o texto tem de
                dizer é outro: o que se perde é o ACESSO, e nada do que a
                pessoa lançou vai com ela. */}
            <ConfirmDialog
                open={leaving}
                onClose={() => setLeaving(false)}
                onConfirm={() => {
                    setLeaving(false);
                    void WorkspaceController.leaveWorkspace(context, switchWorkspace);
                }}
                title={`Sair de ${workspace.Name}?`}
                description="Você perde o acesso na hora, e voltar exige um convite novo do dono — a data de entrada recomeça. Nada do que você lançou é apagado: os gastos, as entradas e as contas são do espaço e continuam com quem ficou. Se você tiver outro espaço, entramos nele em seguida; se não, você poderá criar um."
                confirmLabel="Sair do espaço"
                danger
                pending={pending === "members"}
            />
        </Page>
    );
}
