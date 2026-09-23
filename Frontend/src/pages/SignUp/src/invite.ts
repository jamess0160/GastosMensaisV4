import { ApiUnauthorizedError, errorMessage } from "@/api/client";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O convite visto pelo formulário de cadastro.

   A tela de aceite já diz, em negrito, de quem é o convite — e o
   cadastro para onde ela manda nascia com o campo de e-mail VAZIO e um
   texto pedindo "use o MESMO e-mail". Quem digitava outro endereço — o
   pessoal em vez do de trabalho, um typo — preenchia o formulário
   inteiro, aceitava os termos, enviava e levava 406 no fim, com o dado
   que evitaria isso a uma requisição de distância.

   Aqui mora a decisão — travar ou não travar, e com qual e-mail —, sem
   React, para ser lida e testada sem montar tela.

   A trava é `readOnly`, NUNCA `disabled`: campo desabilitado não é
   enviado no submit nativo, some da navegação por teclado e é ignorado
   por leitor de tela — três jeitos de o e-mail simplesmente não chegar
   ao servidor.

   E o inverso também é regra: convite que não serve DESTRAVA o campo.
   Travá-lo com um endereço que a API vai recusar é pior do que não
   travar — a tela deixaria de ser um cadastro e não viraria um aceite.
   ════════════════════════════════════════════════════════════ */

/** Os quatro estados em que o cadastro pode estar quanto ao convite. */
export type SignUpInvite =
    /** Cadastro comum: ninguém chegou por link. */
    | { kind: "none" }
    /** Veio com `?convite=`, e a resposta ainda não chegou. O campo já
     *  nasce travado aqui: quem digitasse agora veria o que escreveu ser
     *  trocado sozinho meio segundo depois. */
    | { kind: "loading" }
    | { kind: "valid"; email: string; workspaceName: string; inviterName: string }
    /** Inexistente, revogado, expirado ou já aceito. A `msg` é a do
     *  servidor porque cada um dos quatro manda o usuário para um lugar
     *  diferente. */
    | { kind: "invalid"; message: string };

/** O que a consulta do convite entrega — só o que a decisão usa, para
 *  que o teste não precise montar um `UseQueryResult` inteiro. */
export interface InviteQuery {
    hash: string | null;
    isError: boolean;
    error: unknown;
    /** Ausente enquanto a resposta não chega — é ela, e não um
     *  `isPending`, que diz se há convite lido: com `enabled: false` o
     *  React Query reporta `pending` para sempre. */
    data: ApiTypes.WorkspaceInvitePreview | undefined;
}

/** A leitura do convite, do jeito que o formulário precisa dela.
 *
 *  `reference` existe para o teste: a tela chama sem ela. */
export function readInvite(query: InviteQuery, reference: Date = new Date()): SignUpInvite {
    if (!query.hash) return { kind: "none" };

    if (query.isError) {
        /* O 401 é o único que não se mostra como veio: a rota é
           pública, então ele não é "sessão expirada" — é o interceptor
           falando de uma sessão que esta tela nem tem. */
        return {
            kind: "invalid",
            message:
                query.error instanceof ApiUnauthorizedError
                    ? "Não foi possível ler este convite."
                    : errorMessage(query.error),
        };
    }

    if (!query.data) return { kind: "loading" };

    /* A API já recusa o expirado com 406, então este ramo quase nunca
       roda — ele cobre o formulário que ficou aberto atravessando a
       validade, e é barato o bastante para não valer a aposta contrária:
       o campo travado com um e-mail que o servidor vai recusar é o
       estado que esta etapa existe para não ter. */
    if (new Date(query.data.ExpiresAt).getTime() <= reference.getTime()) {
        return { kind: "invalid", message: "Este convite expirou. Peça um novo a quem convidou." };
    }

    return {
        kind: "valid",
        email: query.data.Email,
        workspaceName: query.data.WorkspaceName,
        inviterName: query.data.InviterName,
    };
}

/** O campo de e-mail aceita digitação? */
export function isEmailLocked(invite: SignUpInvite): boolean {
    return invite.kind === "loading" || invite.kind === "valid";
}

/** O e-mail que o formulário mostra E envia.
 *
 *  É UM valor só de propósito. Guardar o do convite num estado à parte
 *  abriria a porta para a tela mostrar um e-mail e o `POST /Users`
 *  mandar outro — que é a falha que a trava existe para fechar. */
export function signUpEmail(invite: SignUpInvite, typed: string): string {
    return invite.kind === "valid" ? invite.email : typed;
}
