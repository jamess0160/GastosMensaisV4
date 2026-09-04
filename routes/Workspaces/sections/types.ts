export namespace WorkspacesNamespace {
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
}
