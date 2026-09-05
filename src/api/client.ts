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

/** 401 — sem cookie, inválido ou expirado. Corpo vazio. */
export class ApiUnauthorizedError extends Error {
    readonly status = 401;

    constructor() {
        super("Sessão expirada.");
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

/** O interceptor é o único lugar que traduz status em erro tipado: as
 *  connections abaixo só falam de rotas e corpos. */
http.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
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
            window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
            return Promise.reject(new ApiUnauthorizedError());
        }

        if (status === 403) {
            /* A seção 1.3 do contrato não lista o 403 — ele aparece só na
               4.1, nas rotas de convite. Lemos a `msg` quando ela vier, e
               temos uma frase própria quando não vier: ver a pendência 21. */
            const msg = (data as ApiTypes.ApiError | undefined)?.msg;
            return Promise.reject(new ApiForbiddenError(msg));
        }

        if (status === 406) {
            const msg = (data as ApiTypes.ApiError | undefined)?.msg;
            return Promise.reject(new ApiBusinessError(msg ?? "Dados de entrada inválidos."));
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
