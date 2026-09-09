import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { requestResetLink } from "../sections/requestResetLink";
import { fakeForgotPasswordContext } from "./context";

const route = "*/api/Users/forgotPassword";

/** A frase única da API: ela é a mesma para e-mail com conta e sem
 *  conta, e é isso que impede a rota de virar um verificador de quais
 *  endereços estão cadastrados. */
const SAME_MSG = "Se este e-mail tiver uma conta, enviamos o link de recuperação.";

describe("requestResetLink", () => {
    it("manda o e-mail no formato que a API espera", async () => {
        let body: unknown;
        server.use(
            msw.post(route, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: SAME_MSG });
            }),
        );

        await requestResetLink(fakeForgotPasswordContext({ email: "  Tiago@Exemplo.com  " }));

        // O espaço em volta sai aqui; o `lowercase` é do Joi da API, que
        // precisa reencontrar a conta gravada em minúsculas.
        expect(body).toEqual({ Email: "Tiago@Exemplo.com" });
    });

    /* O teste que trava a decisão: e-mail que existe e e-mail que não
       existe passam pelo MESMO caminho de tela. Nada aqui pode
       distinguir os dois — nem com uma mensagem diferente, nem com um
       estado diferente. */
    it("mostra a mesma mensagem para e-mail com conta e sem conta", async () => {
        server.use(msw.post(route, () => HttpResponse.json({ msg: SAME_MSG })));

        const existente = fakeForgotPasswordContext({ email: "tiago@exemplo.com" });
        const inexistente = fakeForgotPasswordContext({ email: "ninguem@exemplo.com" });

        await requestResetLink(existente);
        await requestResetLink(inexistente);

        expect(existente.finishSubmit).toHaveBeenCalledWith(SAME_MSG);
        expect(inexistente.finishSubmit).toHaveBeenCalledWith(SAME_MSG);
        expect(existente.failSubmit).not.toHaveBeenCalled();
        expect(inexistente.failSubmit).not.toHaveBeenCalled();
    });

    it("não gasta requisição com e-mail em branco", async () => {
        // Sem handler declarado: se sair uma requisição, o teste quebra.
        const context = fakeForgotPasswordContext({ email: "   " });

        await requestResetLink(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe o e-mail da sua conta.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("mostra a msg do servidor quando a forma do e-mail é recusada", async () => {
        server.use(
            msw.post(route, () =>
                HttpResponse.json({ msg: "Email deve ser um e-mail válido!" }, { status: 406 }),
            ),
        );
        const context = fakeForgotPasswordContext({ email: "nao-e-email" });

        await requestResetLink(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Email deve ser um e-mail válido!");
        expect(context.finishSubmit).not.toHaveBeenCalled();
    });

    it("não deixa a tela presa em 'enviando' quando o servidor cai", async () => {
        server.use(msw.post(route, () => new HttpResponse(null, { status: 500 })));
        const context = fakeForgotPasswordContext();

        await requestResetLink(context);

        expect(context.failSubmit).toHaveBeenCalledOnce();
    });
});
