import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { submitLogin } from "../sections/submitLogin";
import { fakeLoginContext } from "./context";

const route = "*/api/Users/login";

describe("submitLogin", () => {
    it("entra quando a credencial está certa", async () => {
        server.use(
            msw.post(route, () => HttpResponse.json({ msg: "Login realizado com sucesso" })),
        );
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(context.beginSubmit).toHaveBeenCalledOnce();
        expect(context.finishSignIn).toHaveBeenCalledOnce();
        expect(context.failSubmit).not.toHaveBeenCalled();
    });

    it("manda e-mail e senha no formato que a API espera", async () => {
        let body: unknown;
        server.use(
            msw.post(route, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await submitLogin(fakeLoginContext({ email: "luana@exemplo.com", password: "1234" }));

        // A API chama de `login` e `password`, minúsculos — não de Email/Senha.
        expect(body).toEqual({ login: "luana@exemplo.com", password: "1234" });
    });

    it("mostra a mensagem da API quando a credencial está errada", async () => {
        server.use(
            msw.post(route, () => HttpResponse.json({ msg: "Login inválido" }, { status: 406 })),
        );
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Login inválido");
        expect(context.finishSignIn).not.toHaveBeenCalled();
    });

    it("não deixa a tela presa em 'entrando' quando o servidor cai", async () => {
        server.use(msw.post(route, () => new HttpResponse(null, { status: 500 })));
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Não foi possível concluir. Tente de novo em instantes.",
        );
    });

    it("avisa quando não há conexão", async () => {
        server.use(msw.post(route, () => HttpResponse.error()));
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Sem conexão com o servidor.");
    });
});
