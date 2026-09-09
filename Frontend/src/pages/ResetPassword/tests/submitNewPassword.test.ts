import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { submitNewPassword } from "../sections/submitNewPassword";
import { fakeResetPasswordContext } from "./context";

const route = "*/api/Users/resetPassword";

describe("submitNewPassword", () => {
    it("manda o token e a senha no corpo, nunca na URL", async () => {
        let body: unknown;
        let url: URL | undefined;
        server.use(
            msw.post(route, async ({ request }) => {
                url = new URL(request.url);
                body = await request.json();
                return HttpResponse.json({ msg: "Senha alterada com sucesso" });
            }),
        );

        await submitNewPassword(fakeResetPasswordContext());

        expect(body).toEqual({ Token: "jwt-do-link", NewPassword: "senha-nova-1" });
        // Os dois são credencial: o path cai no log do proxy, no
        // histórico do navegador e no header Referer.
        expect(url?.search).toBe("");
    });

    it("mostra a msg do servidor quando o link não vale mais", async () => {
        server.use(
            msw.post(route, () =>
                HttpResponse.json(
                    { msg: "Link de recuperação inválido ou expirado!" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeResetPasswordContext();

        await submitNewPassword(context);

        /* Inválido, expirado e já usado são o MESMO 406, com a mesma
           `msg` — e a ação da tela é a mesma nos três: mostrar a
           mensagem e oferecer pedir outro link. */
        expect(context.failSubmit).toHaveBeenCalledWith(
            "Link de recuperação inválido ou expirado!",
        );
        expect(context.finishSubmit).not.toHaveBeenCalled();
    });

    it("não gasta requisição sem token no link", async () => {
        const context = fakeResetPasswordContext({ token: "" });

        await submitNewPassword(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Este link está incompleto. Peça outro link de recuperação.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("recusa senha curta antes de ir à rede", async () => {
        const context = fakeResetPasswordContext({ password: "curta", confirmation: "curta" });

        await submitNewPassword(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "A nova senha precisa de pelo menos 8 caracteres.",
        );
    });

    it("recusa quando as duas senhas não conferem", async () => {
        const context = fakeResetPasswordContext({ confirmation: "outra-senha-1" });

        await submitNewPassword(context);

        expect(context.failSubmit).toHaveBeenCalledWith("As senhas não conferem.");
    });
});
