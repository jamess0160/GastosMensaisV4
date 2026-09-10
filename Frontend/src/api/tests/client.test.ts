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
    readErrorBody,
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

    // O 401 das rotas de entrar. `POST /Users/login` e `POST
    // /UsersAuth/authenticate` recusam credencial com 401 + `msg`, e a
    // frase pronta da API é a única que descreve o que aconteceu:
    // "Sessão expirada." mandaria quem errou a senha procurar uma sessão
    // que nunca existiu.
    it("mostra a msg do 401 quando ela vem — credencial recusada não é sessão expirada", async () => {
        server.use(
            msw.post("*/api/Users/login", () =>
                HttpResponse.json({ msg: "Login inválido" }, { status: 401 }),
            ),
        );

        await expect(http.post("/Users/login", {})).rejects.toMatchObject({
            name: "ApiUnauthorizedError",
            status: 401,
            message: "Login inválido",
        });
    });

    // E ele NÃO derruba a sessão: não há sessão nenhuma a derrubar, e o
    // evento levaria a tela de login a limpar o cache e navegar para ela
    // mesma.
    it("não avisa o app quando o 401 é de credencial", async () => {
        server.use(
            msw.post("*/api/Users/login", () =>
                HttpResponse.json({ msg: "Login inválido" }, { status: 401 }),
            ),
        );
        const listener = vi.fn();
        window.addEventListener(UNAUTHORIZED_EVENT, listener);

        await expect(http.post("/Users/login", {})).rejects.toThrow("Login inválido");

        expect(listener).not.toHaveBeenCalled();
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

    it("transforma 403 na mensagem do servidor — não é 500 nem 406", async () => {
        // Só as rotas de gestão do workspace respondem assim, e sempre
        // pela mesma razão: quem chamou não é o dono. Cair na mensagem do
        // 500 ("tente de novo em instantes") convidaria a um retry que
        // nunca vai passar.
        server.use(
            msw.get("*/api/Workspaces/invites", () =>
                HttpResponse.json({ msg: "Apenas o dono pode convidar!" }, { status: 403 }),
            ),
        );

        await expect(http.get("/Workspaces/invites")).rejects.toMatchObject({
            name: "ApiForbiddenError",
            status: 403,
            message: "Apenas o dono pode convidar!",
        });
    });

    it("tem uma frase própria quando o 403 vier sem msg", async () => {
        // A seção 1.3 do contrato não lista o 403 e não diz se ele traz
        // corpo — ver a pendência 21.
        server.use(
            msw.get("*/api/Workspaces/invites", () => new HttpResponse(null, { status: 403 })),
        );

        await expect(http.get("/Workspaces/invites")).rejects.toMatchObject({
            message: "Esta ação é só do dono do espaço.",
        });
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

/* ════════════════════════════════════════════════════════════
   O erro que vem como BLOB.

   `GET /Reports/Export` é a primeira rota do projeto que não responde
   JSON, e o `responseType: "blob"` da connection vale também para a
   resposta de ERRO: sem desempacotar o corpo, `data.msg` sai
   `undefined` sem estourar nada, e o usuário vê o texto genérico no
   lugar da frase que o servidor escreveu.

   Este é o único caminho do interceptor testado FORA da rede: o
   interceptor de XHR do MSW não entrega `responseType: "blob"` dentro
   do jsdom, e a regra que interessa — desempacotar antes de ler a
   `msg` — é a função abaixo, não o transporte.
   ════════════════════════════════════════════════════════════ */

describe("readErrorBody", () => {
    it("desempacota a msg de um corpo que chegou como Blob", async () => {
        const blob = new Blob([JSON.stringify({ msg: "Período inválido!" })], {
            type: "application/json",
        });

        await expect(readErrorBody(blob)).resolves.toEqual({ msg: "Período inválido!" });
    });

    // Um .xlsx de verdade não é JSON: aí não há `msg` a extrair, e cada
    // status cai no seu texto padrão — o mesmo caminho do corpo vazio.
    it("devolve undefined quando o binário não é JSON", async () => {
        const blob = new Blob(["PK"], { type: "application/octet-stream" });

        await expect(readErrorBody(blob)).resolves.toBeUndefined();
    });

    it("deixa passar o corpo JSON de sempre", async () => {
        await expect(readErrorBody({ msg: "Conta não encontrada!" })).resolves.toEqual({
            msg: "Conta não encontrada!",
        });
    });
});
