import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";

/* O convite lido pelo HASH — a única consulta do app que roda SEM
   sessão, e a única lida por DUAS telas.

   Ela mora aqui, e não dentro da tela de aceite, porque o cadastro lê o
   MESMO hash pela MESMA rota: é dele que sai o e-mail com que o
   formulário nasce preenchido e travado. Duas consultas com duas chaves
   fariam a segunda tela pedir de novo o que a primeira acabou de
   receber — e divergiriam no dia em que uma delas ganhasse um `retry`
   ou um `staleTime`. */

/** Nome do espaço, quem convidou, o e-mail convidado, o papel e a
 *  validade. Nenhum id: a rota não devolve, de propósito — ela não pode
 *  virar sonda para descobrir workspace contando.
 *
 *  `null` ou string vazia desliga a consulta: é o cadastro comum, que
 *  chega sem `?convite=`.
 *
 *  Sem `retry`: os quatro recusados — inexistente, revogado, expirado e
 *  já aceito — vêm como 406 com a `msg` pronta, e repetir a chamada não
 *  muda a resposta. */
export function useInvitePreview(
    hash: string | null,
): UseQueryResult<ApiTypes.WorkspaceInvitePreview> {
    return useQuery({
        queryKey: queryKeys.invitePreview(hash ?? ""),
        queryFn: () => WorkspacesConnection.inviteByHash(hash ?? ""),
        enabled: Boolean(hash),
        retry: false,
    });
}
