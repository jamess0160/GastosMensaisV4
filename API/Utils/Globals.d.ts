declare namespace Express {
    interface Locals {
        IdUser: number
        IdWorkspace: number
        /**
         * A duracao escolhida no login, lida do token junto com os outros dois.
         *
         * Esta aqui por causa do POST /Workspaces/switch, o unico lugar que reemite a
         * credencial: sem ela, trocar de workspace rebaixaria uma sessao de 30 dias para 24h.
         */
        RememberDevice: boolean
    }
}