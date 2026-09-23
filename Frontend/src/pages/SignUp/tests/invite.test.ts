import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { isEmailLocked, readInvite, signUpEmail, type InviteQuery } from "../src/invite";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";

/* O 406 que esta etapa existe para não acontecer: a pessoa clicava em
   "Criar conta e entrar" na tela de aceite, digitava o e-mail pessoal em
   vez do que recebeu o convite, preenchia o formulário inteiro, aceitava
   os termos — e só então descobria que a matrícula foi recusada. */

const preview = (
    overrides: Partial<ApiTypes.WorkspaceInvitePreview> = {},
): ApiTypes.WorkspaceInvitePreview => ({
    WorkspaceName: "Casa",
    InviterName: "Tiago",
    Email: "convidado@exemplo.com",
    Role: "editor",
    ExpiresAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
});

const query = (overrides: Partial<InviteQuery> = {}): InviteQuery => ({
    hash: "Yk3s",
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
});

/** O erro como a tela o recebe: pela rota de verdade, com o interceptor
 *  traduzindo o status. Fabricar um `ApiBusinessError` à mão testaria a
 *  fábrica, e não o caminho. */
async function inviteError(status: number, body: unknown): Promise<unknown> {
    server.use(
        msw.get("*/api/Workspaces/invite/Hash=expirado", () =>
            body === null
                ? new HttpResponse(null, { status })
                : HttpResponse.json(body, { status }),
        ),
    );

    return WorkspacesConnection.inviteByHash("expirado").catch((cause: unknown) => cause);
}

describe("readInvite", () => {
    it("sem ?convite= na URL, o cadastro é o comum — nada trava", () => {
        const invite = readInvite(query({ hash: null }));

        expect(invite).toEqual({ kind: "none" });
        expect(isEmailLocked(invite)).toBe(false);
        expect(signUpEmail(invite, "eu@exemplo.com")).toBe("eu@exemplo.com");
    });

    it("com convite válido, preenche o e-mail e TRAVA o campo", () => {
        const invite = readInvite(query({ data: preview() }), new Date("2026-09-22T10:00:00.000Z"));

        expect(invite).toEqual({
            kind: "valid",
            email: "convidado@exemplo.com",
            // O espaço e quem convidou vêm junto: sem eles o formulário
            // perde o contexto que a tela anterior tinha.
            workspaceName: "Casa",
            inviterName: "Tiago",
        });
        expect(isEmailLocked(invite)).toBe(true);
    });

    it("o e-mail ENVIADO é o do convite, e não o que estiver no estado", () => {
        /* O valor é um só: mostrar um endereço e mandar outro no
           `POST /Users` é exatamente a falha que a trava fecha. */
        const invite = readInvite(query({ data: preview() }), new Date("2026-09-22T10:00:00.000Z"));

        expect(signUpEmail(invite, "outro@exemplo.com")).toBe("convidado@exemplo.com");
    });

    it("trava desde antes da resposta chegar", () => {
        // Quem digitasse agora veria o que escreveu ser trocado sozinho
        // meio segundo depois.
        const invite = readInvite(query());

        expect(invite).toEqual({ kind: "loading" });
        expect(isEmailLocked(invite)).toBe(true);
    });

    it("DESTRAVA quando o hash expirou, com a msg do servidor", async () => {
        const error = await inviteError(406, {
            msg: "Este convite expirou. Peça um novo ao dono do workspace.",
        });

        const invite = readInvite(query({ isError: true, error }));

        expect(invite).toEqual({
            kind: "invalid",
            message: "Este convite expirou. Peça um novo ao dono do workspace.",
        });
        // Travar um campo com um valor que não serve para nada é pior do
        // que não travar: a tela vira um cadastro comum.
        expect(isEmailLocked(invite)).toBe(false);
        expect(signUpEmail(invite, "eu@exemplo.com")).toBe("eu@exemplo.com");
    });

    it("destrava também quando o hash não existe", async () => {
        const error = await inviteError(406, { msg: "Convite não encontrado." });

        expect(readInvite(query({ isError: true, error }))).toEqual({
            kind: "invalid",
            message: "Convite não encontrado.",
        });
    });

    it("destrava se a validade passou com o formulário aberto", () => {
        /* A API já recusa o expirado com 406, então este ramo cobre o
           formulário que ficou aberto atravessando a validade. */
        const invite = readInvite(
            query({ data: preview({ ExpiresAt: "2026-09-20T12:00:00.000Z" }) }),
            new Date("2026-09-22T10:00:00.000Z"),
        );

        expect(invite).toEqual({
            kind: "invalid",
            message: "Este convite expirou. Peça um novo a quem convidou.",
        });
        expect(isEmailLocked(invite)).toBe(false);
    });

    it("não diz 'sessão expirada' numa tela que não tem sessão", async () => {
        // A rota é pública: o 401 sem corpo é o interceptor falando de
        // uma sessão que nem o cadastro nem o aceite têm.
        const error = await inviteError(401, null);

        expect(readInvite(query({ isError: true, error }))).toEqual({
            kind: "invalid",
            message: "Não foi possível ler este convite.",
        });
    });
});
