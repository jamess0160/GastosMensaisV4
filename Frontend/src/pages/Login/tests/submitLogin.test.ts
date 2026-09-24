import { HttpResponse, http as msw } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restoreNavigator, stubMobileNavigator } from "@/test/navigator";
import { server } from "@/test/server";
import { submitLogin } from "../sections/submitLogin";
import { fakeLoginContext } from "./context";

const route = "*/api/Users/login";
const checkDevice = "*/api/UsersAuth/checkDevice/:deviceKey";

/** O login por senha sempre consulta o aparelho depois do 200, para
 *  decidir se convida a cadastrar biometria. Nos testes que não são
 *  sobre o convite, o aparelho responde "já recusou" — que é o caminho
 *  em que a tela segue direto. */
const deviceAlreadyAnswered = () =>
    server.use(msw.get(checkDevice, () => HttpResponse.json({ UseAuth: false })));

describe("submitLogin", () => {
    /* O convite é só de aparelho móvel, e o jsdom anuncia um desktop:
       sem forjar o aparelho, a consulta do `checkDevice` nem sairia e
       estes testes descreveriam o gate, não o login. */
    beforeEach(stubMobileNavigator);
    afterEach(restoreNavigator);

    beforeEach(deviceAlreadyAnswered);

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
        expect(body).toEqual({
            login: "luana@exemplo.com",
            password: "1234",
            RememberDevice: false,
        });
    });

    /* O "manter conectado": 30 dias em vez das 24h. O default é do
       SERVIDOR (`false`), e a caixa da tela nasce desmarcada por causa
       dele — o cliente não escolhe um default diferente do da API. */
    it("manda o RememberDevice da caixa marcada", async () => {
        let body: unknown;
        server.use(
            msw.post(route, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await submitLogin(fakeLoginContext({ rememberDevice: true }));

        expect((body as { RememberDevice: boolean }).RememberDevice).toBe(true);
    });

    //  401, e NÃO 406: a API responde "Login inválido" com o status de
    //  credencial recusada. O mock errado aqui era o que escondia o bug —
    //  a tela mostrava "Sessão expirada." para quem só tinha errado a senha.
    it("mostra a mensagem da API quando a credencial está errada", async () => {
        server.use(
            msw.post(route, () => HttpResponse.json({ msg: "Login inválido" }, { status: 401 })),
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

describe("submitLogin · convite de biometria", () => {
    const loginOk = () => server.use(msw.post(route, () => HttpResponse.json({ msg: "ok" })));

    beforeEach(stubMobileNavigator);
    afterEach(restoreNavigator);

    it("convida quando o aparelho nunca foi perguntado", async () => {
        loginOk();
        server.use(msw.get(checkDevice, () => HttpResponse.json({ UseAuth: null })));
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(context.setInviteBiometrics).toHaveBeenCalledWith(true);
        // A tela não sai daqui: registrar passkey é rota autenticada, e a
        // sessão acabou de nascer nesta tela.
        expect(context.finishSignIn).not.toHaveBeenCalled();
    });

    it("não convida quando o usuário já recusou neste aparelho", async () => {
        loginOk();
        server.use(msw.get(checkDevice, () => HttpResponse.json({ UseAuth: false })));
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(context.setInviteBiometrics).not.toHaveBeenCalled();
        expect(context.finishSignIn).toHaveBeenCalledOnce();
    });

    it("não convida quando o aparelho já tem passkey", async () => {
        loginOk();
        server.use(msw.get(checkDevice, () => HttpResponse.json({ UseAuth: true })));
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(context.setInviteBiometrics).not.toHaveBeenCalled();
        expect(context.finishSignIn).toHaveBeenCalledOnce();
    });

    it("convida sem consultar quando o aparelho não tem DeviceKey", async () => {
        // Sem DeviceKey não há o que consultar: o aparelho é novo por
        // definição. Um handler de checkDevice aqui quebraria o teste,
        // que é exatamente a garantia que se quer.
        loginOk();
        const context = fakeLoginContext({ deviceKey: null });

        await submitLogin(context);

        expect(context.setInviteBiometrics).toHaveBeenCalledWith(true);
    });

    it("segue em frente quando a consulta do aparelho falha", async () => {
        // Não dá para segurar quem acabou de entrar por causa de uma
        // consulta acessória: na dúvida, não convida.
        loginOk();
        server.use(msw.get(checkDevice, () => new HttpResponse(null, { status: 500 })));
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(context.finishSignIn).toHaveBeenCalledOnce();
        expect(context.setInviteBiometrics).not.toHaveBeenCalled();
    });
});

/* Sem `stubMobileNavigator` nenhum: o aparelho do jsdom é o desktop. */
describe("submitLogin · no desktop", () => {
    it("entra sem consultar o aparelho e sem convidar", async () => {
        /* O `checkDevice` responderia "nunca perguntei", que é o único
           caminho que convida — e mesmo assim ele não é chamado. O
           handler espiona em vez de faltar porque a consulta tem o erro
           engolido: sem handler, ela sairia, falharia e o teste
           continuaria verde sem o gate. */
        const asked = vi.fn();
        server.use(msw.post(route, () => HttpResponse.json({ msg: "ok" })));
        server.use(
            msw.get(checkDevice, () => {
                asked();
                return HttpResponse.json({ UseAuth: null });
            }),
        );
        const context = fakeLoginContext();

        await submitLogin(context);

        expect(asked).not.toHaveBeenCalled();
        expect(context.setInviteBiometrics).not.toHaveBeenCalled();
        expect(context.finishSignIn).toHaveBeenCalledOnce();
    });
});
