import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Workspaces` — não há POST: um workspace nasce no cadastro, e a
 *  única forma de entrar num que já existe é o CONVITE (pendência 18
 *  pede a criação avulsa).
 *
 *  As três rotas de gestão — `update`, `invites` e `invite` — agem no
 *  workspace DA SESSÃO e não recebem id: quem escolhe em qual espaço se
 *  está é o `switch`, que reemite o cookie. Gerenciar um espaço que não
 *  é o atual exige trocar antes. */
class Connection {
    private readonly route = "/Workspaces";

    /** Os workspaces em que o usuário é membro.
     *
     *  ⚠️ A resposta NÃO marca qual é o da sessão — o `IdWorkspace` vive
     *  dentro do token, e o cookie é `HttpOnly`. Ver a pendência 19. */
    async getSelf(): Promise<ApiTypes.Workspace[]> {
        const { data } = await http.get<ApiTypes.Workspace[]>(`${this.route}/getSelf`);
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
