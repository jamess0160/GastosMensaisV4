import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";

/* Quem tem acesso ao espaço da sessão.

   Arquivo próprio, e não dentro de `catalogs.ts`: um cadastro é do
   ESPAÇO — categorias, pessoas, contas —, e esta lista é do espaço
   COMPARTILHADO. Ela muda por outros motivos (alguém aceita um convite,
   um papel é trocado, alguém sai) e não é lida por tela nenhuma além da
   do espaço, então não faz sentido carregá-la junto do que todo
   formulário precisa. */

/** Nome, e-mail, papel e data de entrada de cada membro do espaço da
 *  sessão — com a linha do próprio usuário marcada em `IsSelf`.
 *
 *  Qualquer membro lê: a rota abre com `assertMember`, e não com
 *  `assertRole`. Por isso o hook não tem `enabled` — ao contrário da
 *  consulta de convites, que só o dono pode fazer.
 *
 *  Sem `staleTime`: a lista é a tela em que as ações de membro
 *  acontecem, e ver o papel antigo depois de trocá-lo é exatamente o que
 *  não pode acontecer aqui. */
export function useWorkspaceMembers(): UseQueryResult<ApiTypes.WorkspaceMember[]> {
    return useQuery({
        queryKey: queryKeys.members,
        queryFn: () => WorkspacesConnection.members(),
    });
}
