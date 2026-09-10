import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Workspaces` — três formas de um usuário ser membro de um: o
 *  primeiro nasce no cadastro, um novo se cria aqui, e num que já existe
 *  só se entra por CONVITE.
 *
 *  As três rotas de gestão — `update`, `invites` e `invite` — agem no
 *  workspace DA SESSÃO e não recebem id: quem escolhe em qual espaço se
 *  está é o `switch`, que reemite o cookie. Gerenciar um espaço que não
 *  é o atual exige trocar antes. */
class Connection {
    private readonly route = "/Workspaces";

    /** Os workspaces em que o usuário é membro, com o da SESSÃO marcado
     *  em `Current` — exatamente um item vem `true`.
     *
     *  É daqui que sai a resposta para "em qual espaço eu estou", e não
     *  de memória do cliente: a seleção vive dentro do token e o cookie é
     *  `HttpOnly`. O `Current` acompanha o token, então ele muda sozinho
     *  quando o `switch` reemite o cookie. */
    async getSelf(): Promise<ApiTypes.Workspace[]> {
        const { data } = await http.get<ApiTypes.Workspace[]>(`${this.route}/getSelf`);
        return data;
    }

    /** Cria um espaço novo, com o usuário da sessão como dono. É a tela
     *  de "separar as finanças" — casa e empresa, pessoal e do casal —
     *  para quem já tem conta.
     *
     *  O espaço nasce VAZIO: sem contas, sem categorias próprias e sem
     *  lançamentos, só com a matrícula `owner` e com a Person do usuário
     *  criada dentro dele, para ele já poder entrar num rateio. As
     *  categorias globais aparecem nele como em qualquer outro.
     *
     *  ⚠️ CRIAR NÃO TROCA A SESSÃO, exatamente como o `join`: o cookie
     *  continua apontando para o workspace em que se estava. Para operar
     *  no novo, chame `switch` com o `IdWorkspace` que voltou. */
    async create(body: ApiTypes.WorkspaceCreateBody): Promise<{ IdWorkspace: number }> {
        const { data } = await http.post<{ IdWorkspace: number }>(this.route, body);
        return data;
    }

    /** A única rota que recebe IdWorkspace do cliente: confere a matrícula
     *  e REEMITE o cookie, porque o workspace vive dentro do token. */
    async switch(idWorkspace: number): Promise<ApiTypes.Workspace> {
        const { data } = await http.post<ApiTypes.Workspace>(`${this.route}/switch`, {
            IdWorkspace: idWorkspace,
        });
        return data;
    }

    /** Edita o workspace selecionado na sessão — sem id no caminho. */
    async update(name: string): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(this.route, { Name: name });
        return data;
    }

    /* ── Membros ──────────────────────────────────────────── */

    /** Quem tem acesso ao espaço da SESSÃO — nome, e-mail, papel e
     *  quando entrou.
     *
     *  **Não é rota de dono.** Ao contrário de `invites`, ela abre com
     *  `assertMember`: qualquer membro lê, porque quem divide o espaço
     *  tem direito de saber com quem divide. Quem não é membro leva 406
     *  "Workspace não encontrado" — a rota não confirma que o espaço
     *  existe.
     *
     *  A lista NÃO traz `IdUser`, e as ações de membro endereçam o
     *  `IdWorkspaceMember`: a matrícula é do espaço, o usuário é global.
     *  Uma das linhas vem com `IsSelf: true` — é a sua. */
    async members(): Promise<ApiTypes.WorkspaceMember[]> {
        const { data } = await http.get<ApiTypes.WorkspaceMember[]>(`${this.route}/members`);
        return data;
    }

    /* ── Convites ─────────────────────────────────────────── */

    /** Cria o convite do workspace da sessão. **Só `owner`** — quem não
     *  é leva 403.
     *
     *  A API NÃO MANDA E-MAIL: ela devolve o `Hash`, e quem entrega o
     *  link é o usuário. Monte a URL da tela de aceite com ele.
     *
     *  Convidar quem já é membro é 406. Convidar o MESMO e-mail de novo
     *  RENOVA o convite pendente — hash e validade novos, o hash anterior
     *  para de funcionar. Não nascem dois links. */
    async invite(
        body: ApiTypes.WorkspaceInviteCreateBody,
    ): Promise<ApiTypes.WorkspaceInviteCreated> {
        const { data } = await http.post<ApiTypes.WorkspaceInviteCreated>(
            `${this.route}/invite`,
            body,
        );
        return data;
    }

    /** Os convites PENDENTES do workspace da sessão — "quem eu convidei e
     *  ainda não entrou". Aceitos e revogados não aparecem. Só `owner`. */
    async invites(): Promise<ApiTypes.WorkspaceInvite[]> {
        const { data } = await http.get<ApiTypes.WorkspaceInvite[]>(`${this.route}/invites`);
        return data;
    }

    /** **Pública** — é a tela de aceite, e quem recebeu o link pode não
     *  ter conta ainda.
     *
     *  Inexistente, revogado, expirado ou já aceito: 406, e a `msg` diz
     *  qual dos quatro. Mostre a `msg`: "expirou, peça outro" e "não
     *  encontrado" mandam o usuário para lugares diferentes. */
    async inviteByHash(hash: string): Promise<ApiTypes.WorkspaceInvitePreview> {
        const { data } = await http.get<ApiTypes.WorkspaceInvitePreview>(
            `${this.route}/invite/Hash=${encodeURIComponent(hash)}`,
        );
        return data;
    }

    /** O aceite de quem JÁ TEM conta. O papel vem da linha do convite,
     *  nunca do cliente — por isso o corpo é só o hash.
     *
     *  ⚠️ NÃO TROCA A SESSÃO, de propósito: aceitar não pode trocar o
     *  workspace debaixo da tela que o usuário estava usando. Para operar
     *  no espaço novo, chame `switch` com o `IdWorkspace` que voltou —
     *  esquecer isso é o bug mais provável desta entrega.
     *
     *  406 quando o e-mail da sessão não é o do convite, ou quando ele
     *  não existe, foi revogado, expirou ou já foi usado. */
    async join(hash: string): Promise<{ IdWorkspace: number }> {
        const { data } = await http.post<{ IdWorkspace: number }>(`${this.route}/join`, {
            Hash: hash,
        });
        return data;
    }

    /** Revoga: o link para de funcionar NA HORA. Só `owner`.
     *
     *  Revogar NÃO desfaz matrícula já criada — remover membro é outra
     *  coisa, e ainda não existe (pendência 20). */
    async revokeInvite(idWorkspaceInvite: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/invite/IdWorkspaceInvite=${idWorkspaceInvite}`,
        );
        return data;
    }
}

export const WorkspacesConnection = new Connection();
