import { Database } from "root/Utils/database"

export namespace WorkspacesNamespace {
    //  Só o nome: o dono é o usuário do token, e o id nasce na própria chamada.
    export interface CreateWorkspacePayload {
        Name: string
    }

    export interface UpdateWorkspacePayload {
        Name: string
    }

    export interface SwitchWorkspacePayload {
        IdWorkspace: number
    }

    //  Sem IdWorkspace: o workspace do convite é o da sessão de quem convida.
    //  Sem 'owner' no Role: transferir propriedade é operação própria, não convite.
    export interface CreateInvitePayload {
        Email: string
        Role: "editor" | "viewer"
    }

    //  Só o hash. O papel vem da linha do convite, nunca do cliente.
    export interface JoinWorkspacePayload {
        Hash: string
    }

    //  Só o papel: a matrícula alvo vem do caminho, e o workspace vem do token.
    //
    //  Sem 'owner', pelo mesmo motivo do convite: promover alguém a dono é TRANSFERIR a
    //  propriedade, que tem regra própria. Aqui só se anda entre editor e viewer.
    export interface UpdateMemberPayload {
        Role: "editor" | "viewer"
    }

    //  A linha crua do join de WorkspaceMembers com Users. Fica separada da linha que sai na
    //  resposta porque ela ainda carrega o IdUser: a section precisa dele para marcar qual
    //  linha é a do usuário da requisição, e é ela que o descarta em seguida.
    export interface WorkspaceMemberWithUser {
        IdWorkspaceMember: number
        IdUser: number
        Role: Database.WorkspaceMembers["Role"]
        CreatedAt: Database.WorkspaceMembers["CreatedAt"]
        Name: string
        Email: string
    }

    //  Uma linha de "quem tem acesso". SEM IdUser de propósito: as ações de membro endereçam a
    //  matrícula, que é do espaço, e não o usuário, que é global.
    //
    //  Role tem os TRÊS papéis, ao contrário do convite: 'owner' não se convida, mas ele é
    //  quem mais aparece nesta lista.
    export interface WorkspaceMemberRow {
        IdWorkspaceMember: number
        Name: string
        Email: string
        Role: Database.WorkspaceMembers["Role"]
        /** O CreatedAt da matrícula: quando a pessoa entrou no espaço. */
        JoinedAt: Database.WorkspaceMembers["CreatedAt"]
        /** Esta linha é a do usuário DESTA requisição? Não é coluna — descreve o token. */
        IsSelf: boolean
    }
}
