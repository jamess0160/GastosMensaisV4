import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Workspaces` — três formas de um usuário ser membro de um: o
 *  primeiro nasce no cadastro, um novo se cria aqui, e num que já existe
 *  só se entra por CONVITE.
 *
 *  **Nenhuma rota de gestão recebe `IdWorkspace`**: todas agem no
 *  workspace DA SESSÃO, e quem escolhe em qual espaço se está é o
 *  `switch`, que reemite o cookie. Gerenciar um espaço que não é o atual
 *  exige trocar antes. O único id que algumas delas recebem é o da linha
 *  em que agem — o convite, ou a matrícula do membro. */
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

    /** Troca o papel de quem JÁ é membro. **Só `owner`** — quem não é
     *  leva 403.
     *
     *  Endereça a MATRÍCULA, não o usuário: `IdWorkspaceMember` é do
     *  espaço e já nasce escopado, enquanto o `IdUser` é global — e é por
     *  isso que a lista de membros não traz um.
     *
     *  Só se anda entre `editor` e `viewer`: `Role: "owner"` é 406, como
     *  no convite, porque promover a dono é transferir a propriedade. E
     *  **ninguém troca o próprio papel** — a própria matrícula responde
     *  406: um espaço sem dono não é estado do qual se volta.
     *
     *  A data de entrada sobrevive à troca, e é o que esta rota existe
     *  para não perder: rebaixar e repromover por remover-e-reconvidar
     *  apagava a matrícula, e com ela o `JoinedAt`. */
    async updateMember(
        idWorkspaceMember: number,
        body: ApiTypes.WorkspaceMemberUpdateBody,
    ): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(
            `${this.route}/members/IdWorkspaceMember=${idWorkspaceMember}`,
            body,
        );
        return data;
    }

    /** Tira alguém do espaço. **Só `owner`** — quem não é leva 403.
     *
     *  Endereça a MATRÍCULA, como o `updateMember`, e não recebe corpo:
     *  remover não tem opção.
     *
     *  ⚠️ **A matrícula é apagada de verdade** — não é arquivamento. Não
     *  há como desfazer: readmitir a pessoa é convidá-la de novo, e a
     *  data de entrada dela recomeça. Confirme antes de chamar.
     *
     *  **Nada do que a pessoa lançou é tocado.** Gasto, entrada e conta
     *  são do ESPAÇO, não da matrícula; e quem responde "quem gastou" é
     *  `ExpensePersons`, que aponta para `Persons` — outra tabela, sem
     *  relação com quem tem login. Nenhum saldo muda, nenhum rateio
     *  muda, e o mês continua fechando igual. A tela não pode sugerir o
     *  contrário.
     *
     *  **Ninguém se remove por aqui**: a própria matrícula responde 406,
     *  mandando transferir a propriedade. 406 também numa matrícula que
     *  não é deste espaço, com "Membro não encontrado". */
    async removeMember(idWorkspaceMember: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/members/IdWorkspaceMember=${idWorkspaceMember}`,
        );
        return data;
    }

    /** Passa a propriedade do espaço a outro membro. **Só `owner`** —
     *  quem não é leva 403.
     *
     *  É a rota que as recusas dos outros três apontam: `updateMember`
     *  não aceita `Role: "owner"` nem a própria matrícula,
     *  `removeMember` não deixa o dono se remover e `leave` não deixa o
     *  dono sair. Sem esta chamada o dono é o único membro sem saída do
     *  próprio espaço.
     *
     *  Recebe a matrícula de QUEM RECEBE, e não recebe corpo: o papel do
     *  alvo passa a `owner` e o de quem chamou passa a `editor` — as
     *  duas coisas são a operação, não parâmetros dela.
     *
     *  ⚠️ **Ela muda o que o PRÓPRIO usuário pode fazer**, e é a única
     *  rota do app que faz isso. Depois dela, com o mesmo cookie: as
     *  rotas de dono respondem 403 para quem chamou (`invites`,
     *  `invite`, `update`, as ações de membro) e o `leave`, que
     *  respondia 406, passa a funcionar. Releia a lista de espaços
     *  (`getSelf`) além da de membros — é o `IdOwnerUser` de lá que diz
     *  à tela quem é o dono, e ele mudou.
     *
     *  Não reemite o cookie: o espaço da sessão é o MESMO antes e
     *  depois, e o papel nunca esteve dentro do token — quem responde
     *  por ele é o servidor, a cada requisição.
     *
     *  **Desfazer depende do novo dono**: só ele pode devolver. 406 na
     *  própria matrícula ("você já é o dono") e numa que não é deste
     *  espaço ("Membro não encontrado"). */
    async transferOwnership(idWorkspaceMember: number): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(
            `${this.route}/members/IdWorkspaceMember=${idWorkspaceMember}/transferOwnership`,
        );
        return data;
    }

    /** Sair do espaço da sessão — a SUA matrícula.
     *
     *  Sem id no caminho, ao contrário do `removeMember`: um
     *  `IdWorkspaceMember` aqui viria do cliente e a rota teria que
     *  conferir que é o do próprio usuário, quando a sessão já sabe
     *  disso.
     *
     *  **O dono não sai**: 406, com a `msg` mandando transferir a
     *  propriedade. É a guarda OPOSTA do `removeMember`, que só o dono
     *  pode chamar — e por isso o botão da tela é o inverso do de
     *  remover.
     *
     *  ⚠️ **NÃO reemite o cookie**, como o `join` e o `create`: o
     *  `switch` continua sendo a única rota que recebe um
     *  `IdWorkspace`. Depois desta chamada o token ainda aponta para o
     *  espaço de onde você saiu, e toda rota escopada responde 406 de
     *  lá. Quem escolhe onde continuar é o cliente: chame `getSelf` e
     *  dê `switch` no primeiro espaço que sobrou.
     *
     *  Se não sobrar nenhum — `getSelf` vazio —, a sessão continua
     *  válida e sem espaço a que voltar. Ninguém é deslogado; o caminho
     *  é criar um espaço, que é a rota que não confere matrícula
     *  nenhuma.
     *
     *  **Nada do que você lançou vai com você.** Gasto, entrada e conta
     *  são do ESPAÇO, e o rateio aponta para `Persons` — nenhum saldo
     *  muda para quem fica. Voltar é ser convidado de novo, e a data de
     *  entrada recomeça. */
    async leave(): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(`${this.route}/members/self`);
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
     *  Revogar NÃO desfaz matrícula já criada: quem já aceitou nem
     *  aparece nesta lista, e tirá-lo do espaço é o `removeMember`. */
    async revokeInvite(idWorkspaceInvite: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/invite/IdWorkspaceInvite=${idWorkspaceInvite}`,
        );
        return data;
    }
}

export const WorkspacesConnection = new Connection();
