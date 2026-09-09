import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { confirmEmail } from "../sections/confirmEmail";
import { resendConfirmation } from "../sections/resendConfirmation";
import { fakeConfirmEmailContext } from "./context";

const confirmRoute = "*/api/Users/confirmEmail";
const resendRoute = "*/api/Users/resendConfirmation";

const RESEND_MSG = "Se este e-mail tiver uma conta pendente de confirmação, enviamos o link.";

describe("confirmEmail", () => {
    it("manda o token no corpo, nunca na URL", async () => {
        let body: unknown;
        let url: URL | undefined;
        server.use(
            msw.post(confirmRoute, async ({ request }) => {
                url = new URL(request.url);
                body = await request.json();
                return HttpResponse.json({ msg: "E-mail confirmado com sucesso" });
            }),
        );

        await confirmEmail(fakeConfirmEmailContext());

        expect(body).toEqual({ Token: "jwt-do-link" });
        /* Um GET com o token na URL seria gasto pelo pré-carregador de
           link do cliente de e-mail, confirmando um endereço que
           ninguém abriu — e o path cairia no log do proxy. */
        expect(url?.search).toBe("");
    });

    /* A armadilha da etapa: a rota é IDEMPOTENTE. Abrir o link de novo
       responde 200 de novo, e o sucesso da tela não pode depender de ser
       a primeira vez — o pré-carregador de link é um "segundo clique"
       que ninguém deu. */
    it("trata a segunda abertura do link como sucesso, não como erro", async () => {
        server.use(
            msw.post(confirmRoute, () =>
                HttpResponse.json({ msg: "E-mail confirmado com sucesso" }),
            ),
        );

        const primeira = fakeConfirmEmailContext();
        const segunda = fakeConfirmEmailContext();

        await confirmEmail(primeira);
        await confirmEmail(segunda);

        expect(primeira.finishConfirm).toHaveBeenCalledWith("E-mail confirmado com sucesso");
        expect(segunda.finishConfirm).toHaveBeenCalledWith("E-mail confirmado com sucesso");
        expect(segunda.failConfirm).not.toHaveBeenCalled();
    });

    it("mostra a msg do servidor quando o link expirou", async () => {
        server.use(
            msw.post(confirmRoute, () =>
                HttpResponse.json(
                    { msg: "Link de confirmação inválido ou expirado!" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeConfirmEmailContext();

        await confirmEmail(context);

        expect(context.failConfirm).toHaveBeenCalledWith(
            "Link de confirmação inválido ou expirado!",
        );
    });

    it("não gasta requisição quando o link vem sem token", async () => {
        const context = fakeConfirmEmailContext({ token: "" });

        await confirmEmail(context);

        expect(context.failConfirm).toHaveBeenCalledWith(
            "Este link está incompleto. Peça outro e-mail de confirmação.",
        );
        expect(context.beginConfirm).not.toHaveBeenCalled();
    });
});

describe("resendConfirmation", () => {
    /* Mesma regra do forgotPassword: a resposta é a mesma para e-mail
       com conta, sem conta e já confirmado — senão a rota vira um
       verificador de quais endereços estão cadastrados. */
    it("mostra a mesma mensagem para qualquer e-mail", async () => {
        server.use(msw.post(resendRoute, () => HttpResponse.json({ msg: RESEND_MSG })));

        const comConta = fakeConfirmEmailContext({ email: "tiago@exemplo.com" });
        const semConta = fakeConfirmEmailContext({ email: "ninguem@exemplo.com" });

        await resendConfirmation(comConta);
        await resendConfirmation(semConta);

        expect(comConta.finishResend).toHaveBeenCalledWith(RESEND_MSG);
        expect(semConta.finishResend).toHaveBeenCalledWith(RESEND_MSG);
    });

    it("manda o e-mail sem o espaço em volta", async () => {
        let body: unknown;
        server.use(
            msw.post(resendRoute, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: RESEND_MSG });
            }),
        );

        await resendConfirmation(fakeConfirmEmailContext({ email: "  tiago@exemplo.com " }));

        expect(body).toEqual({ Email: "tiago@exemplo.com" });
    });

    it("não gasta requisição com e-mail em branco", async () => {
        const context = fakeConfirmEmailContext({ email: "  " });

        await resendConfirmation(context);

        expect(context.failResend).toHaveBeenCalledWith("Informe o e-mail da sua conta.");
        expect(context.beginResend).not.toHaveBeenCalled();
    });
});
