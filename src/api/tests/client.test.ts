import { HttpResponse, http as msw } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import {
    ApiBusinessError,
    ApiNetworkError,
    ApiServerError,
    ApiUnauthorizedError,
    UNAUTHORIZED_EVENT,
    errorMessage,
    http,
} from "../client";

const route = "*/api/Accounts";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("interceptor de resposta", () => {
    it("devolve o corpo quando dá certo", async () => {
        server.use(msw.get(route, () => HttpResponse.json([{ IdAccount: 1 }])));

        const { data } = await http.get("/Accounts");

        expect(data).toEqual([{ IdAccount: 1 }]);
    });

    it("transforma 406 na mensagem que a API mandou", async () => {
        server.use(
            msw.get(route, () =>
                HttpResponse.json({ msg: "Conta não encontrada!" }, { status: 406 }),
            ),
        );

        await expect(http.get("/Accounts")).rejects.toThrow(ApiBusinessError);
        await expect(http.get("/Accounts")).rejects.toThrow("Conta não encontrada!");
    });

    it("usa uma mensagem padrão se o 406 vier sem msg", async () => {
        server.use(msw.get(route, () => HttpResponse.json({}, { status: 406 })));

        await expect(http.get("/Accounts")).rejects.toThrow("Dados de entrada inválidos.");
    });

    it("transforma 401 em ApiUnauthorizedError", async () => {
        server.use(msw.get(route, () => new HttpResponse(null, { status: 401 })));

        await expect(http.get("/Accounts")).rejects.toThrow(ApiUnauthorizedError);
    });

    // É este evento que derruba a sessão em um lugar só, em vez de cada
    // tela ter que tratar 401 por conta própria.
    it("avisa o app no 401, para ele mandar ao login", async () => {
        server.use(msw.get(route, () => new HttpResponse(null, { status: 401 })));
        const listener = vi.fn();
        window.addEventListener(UNAUTHORIZED_EVENT, listener);

        await expect(http.get("/Accounts")).rejects.toThrow(ApiUnauthorizedError);

        expect(listener).toHaveBeenCalledOnce();
        window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    });

    it("não avisa o app quando o erro é de negócio", async () => {
        server.use(msw.get(route, () => HttpResponse.json({ msg: "Erro" }, { status: 406 })));
        const listener = vi.fn();
        window.addEventListener(UNAUTHORIZED_EVENT, listener);

        await expect(http.get("/Accounts")).rejects.toThrow(ApiBusinessError);

        expect(listener).not.toHaveBeenCalled();
        window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    });

    it("transforma 500 em erro genérico, sem vazar detalhe do servidor", async () => {
        server.use(msw.get(route, () => new HttpResponse(null, { status: 500 })));

        await expect(http.get("/Accounts")).rejects.toThrow(ApiServerError);
        await expect(http.get("/Accounts")).rejects.toThrow(
            "Não foi possível concluir. Tente de novo em instantes.",
        );
    });

    it("transforma falha de rede em ApiNetworkError", async () => {
        server.use(msw.get(route, () => HttpResponse.error()));

        await expect(http.get("/Accounts")).rejects.toThrow(ApiNetworkError);
    });
});

describe("errorMessage", () => {
    it("passa adiante a mensagem dos erros conhecidos", () => {
        expect(errorMessage(new ApiBusinessError("Login inválido"))).toBe("Login inválido");
        expect(errorMessage(new ApiUnauthorizedError())).toBe("Sessão expirada.");
    });

    it("cai na mensagem genérica para qualquer outra coisa", () => {
        expect(errorMessage(new Error("stack interno"))).toBe(
            "Não foi possível concluir. Tente de novo em instantes.",
        );
        expect(errorMessage("string solta")).toBe(
            "Não foi possível concluir. Tente de novo em instantes.",
        );
    });
});
