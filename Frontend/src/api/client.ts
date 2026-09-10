import axios, { AxiosError, type AxiosInstance } from "axios";
import type { ApiTypes } from "@/types/api";

/** Mesma origem em produção; em dev o Vite faz proxy de /api.
 *  O cookie `token` é HttpOnly + SameSite=Strict — o JS não o lê e não
 *  existe header Authorization. Requisição de mesma origem já leva o
 *  cookie sozinha, então não há `withCredentials` a configurar. */
export const http: AxiosInstance = axios.create({
    baseURL: "/api",
    headers: { "Content-Type": "application/json" },
});

/** 406 — erro de negócio ou validação. `msg` é texto pronto para o usuário. */
export class ApiBusinessError extends Error {
    readonly status = 406;

    constructor(message: string) {
        super(message);
        this.name = "ApiBusinessError";
    }
}

/** 401 — e ele vem em dois sabores que o corpo separa.
 *
 *  **Sem corpo** é o middleware de sessão da API (`res.status(401).send()`):
 *  não veio cookie, ou o token não vale mais. É o 401 que derruba a
 *  sessão, e a frase é a padrão.
 *
 *  **Com `msg`** são as rotas públicas de entrar — `POST /Users/login` e
 *  `POST /UsersAuth/authenticate` —, que respondem 401 para credencial
 *  recusada. Aí não há sessão a expirar: quem errou a senha nunca teve
 *  uma. A frase é a que a API escreveu ("Login inválido"), a mesma para
 *  e-mail inexistente e senha errada de propósito. */
export class ApiUnauthorizedError extends Error {
    readonly status = 401;

    constructor(message = "Sessão expirada.") {
        super(message);
        this.name = "ApiUnauthorizedError";
    }
}

/** 403 — a rota existe, a sessão é válida, e mesmo assim não é sua.
 *
 *  Só as rotas de gestão do workspace respondem assim, e sempre pela
 *  mesma razão: quem chamou não é `owner`. Ele NÃO é um 406 disfarçado —
 *  não há dado a corrigir, e repetir a chamada nunca vai passar —, nem
 *  um 500, cuja mensagem ("tente de novo em instantes") convida a um
 *  retry que não leva a lugar nenhum. */
export class ApiForbiddenError extends Error {
    readonly status = 403;

    constructor(message?: string) {
        super(message ?? "Esta ação é só do dono do espaço.");
        this.name = "ApiForbiddenError";
    }
}

/** 500 e qualquer resposta não prevista. Corpo vazio. */
export class ApiServerError extends Error {
    constructor(readonly status: number) {
        super("Não foi possível concluir. Tente de novo em instantes.");
        this.name = "ApiServerError";
    }
}

/** Falha de rede — a requisição nem chegou a receber resposta. */
export class ApiNetworkError extends Error {
    constructor(cause?: unknown) {
        super("Sem conexão com o servidor.");
        this.name = "ApiNetworkError";
        this.cause = cause;
    }
}

/** Emitido em todo 401, para o app derrubar a sessão e ir ao login sem
 *  que cada tela precise tratar isso. Ouça em um lugar só. */
export const UNAUTHORIZED_EVENT = "api:unauthorized";

/** O corpo do erro, já legível.
 *
 *  **`GET /Reports/Export` obriga a isto.** Ela é a primeira rota que não
 *  responde JSON, e a connection dela pede `responseType: "blob"` — o
 *  que vale para a resposta de sucesso E para a de erro: um `406` chega
 *  aqui com o corpo empacotado num `Blob`, e ler `data.msg` dele devolve
 *  `undefined` sem estourar nada. O usuário veria "Dados de entrada
 *  inválidos." no lugar da frase pronta que o servidor escreveu.
 *
 *  O conserto mora aqui, e não na connection, porque este é o único
 *  lugar que traduz status em erro tipado: qualquer rota binária futura
 *  herda o comportamento sem fazer nada. */
export async function readErrorBody(data: unknown): Promise<ApiTypes.ApiError | undefined> {
    if (data instanceof Blob) {
        try {
            return JSON.parse(await data.text()) as ApiTypes.ApiError;
        } catch {
            /* Um binário que não é JSON não tem `msg` a extrair — cai no
               texto padrão de cada status, como qualquer corpo vazio. */
            return undefined;
        }
    }
    return data as ApiTypes.ApiError | undefined;
}

/** O interceptor é o único lugar que traduz status em erro tipado: as
 *  connections abaixo só falam de rotas e corpos. */
http.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
        if (!(error instanceof AxiosError)) {
            return Promise.reject(error);
        }

        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }

        if (!error.response) {
            return Promise.reject(new ApiNetworkError(error));
        }

        const { status, data } = error.response;

        if (status === 401) {
            /* O corpo decide, e a diferença aparece inteira na tela de
               login: dizer "Sessão expirada." a quem acabou de errar a
               senha manda a pessoa procurar uma sessão que ela nunca
               teve, escondendo o que estava errado de verdade.

               E só o 401 de sessão dispara o evento. O de credencial não
               tem sessão a derrubar — o `queryClient.clear()` e o
               `navigate("/login")` que o evento provoca não teriam o que
               fazer partindo da própria tela de login. */
            const body = await readErrorBody(data);

            if (body?.msg) {
                return Promise.reject(new ApiUnauthorizedError(body.msg));
            }

            window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
            return Promise.reject(new ApiUnauthorizedError());
        }

        if (status === 403) {
            /* A seção 1.3 do contrato não lista o 403 — ele aparece só na
               4.1, nas rotas de convite. Lemos a `msg` quando ela vier, e
               temos uma frase própria quando não vier: ver a pendência 21. */
            const body = await readErrorBody(data);
            return Promise.reject(new ApiForbiddenError(body?.msg));
        }

        if (status === 406) {
            const body = await readErrorBody(data);
            return Promise.reject(new ApiBusinessError(body?.msg ?? "Dados de entrada inválidos."));
        }

        return Promise.reject(new ApiServerError(status));
    },
);

/** Extrai a mensagem que se mostra ao usuário de qualquer erro do client. */
export function errorMessage(error: unknown): string {
    if (
        error instanceof ApiBusinessError ||
        error instanceof ApiForbiddenError ||
        error instanceof ApiServerError ||
        error instanceof ApiNetworkError ||
        error instanceof ApiUnauthorizedError
    ) {
        return error.message;
    }
    return "Não foi possível concluir. Tente de novo em instantes.";
}
