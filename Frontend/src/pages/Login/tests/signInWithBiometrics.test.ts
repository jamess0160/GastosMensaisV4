import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { fakeLoginContext } from "./context";

// O autenticador do sistema operacional não existe no jsdom: o que se
// testa aqui é a costura dos dois passos, não a assinatura em si.
const { startAuthentication } = vi.hoisted(() => ({ startAuthentication: vi.fn() }));
vi.mock("@simplewebauthn/browser", () => ({ startAuthentication }));

const { signInWithBiometrics } = await import("../sections/signInWithBiometrics");

const optionsRoute = "*/api/UsersAuth/options/login/DeviceKey=:deviceKey";
const authRoute = "*/api/UsersAuth/authenticate";

beforeEach(() => {
    startAuthentication.mockReset();
});

describe("signInWithBiometrics", () => {
    it("entra devolvendo no passo 2 o ChallengeToken do passo 1", async () => {
        server.use(
            msw.get(optionsRoute, () =>
                HttpResponse.json({ options: { challenge: "abc" }, ChallengeToken: "jwt-123" }),
            ),
        );
        let body: { ChallengeToken?: string } = {};
        server.use(
            msw.post(authRoute, async ({ request }) => {
                body = (await request.json()) as { ChallengeToken?: string };
                return HttpResponse.json({ msg: "Login realizado com sucesso" });
            }),
        );
        startAuthentication.mockResolvedValue({ id: "credential-1" });
        const context = fakeLoginContext();

        await signInWithBiometrics(context);

        // É o token do passo 1 que costura os dois: a API não guarda estado.
        expect(body.ChallengeToken).toBe("jwt-123");
        expect(context.finishSignIn).toHaveBeenCalledOnce();
    });

    /* Uma caixa para os DOIS caminhos: a biometria manda o mesmo
       `RememberDevice` do login por senha. Uma sessão de 24h para quem
       marcou 30 dias seria a promessa quebrada justamente por quem entra
       mais rápido. */
    it("manda o RememberDevice da tela, como o login por senha", async () => {
        server.use(
            msw.get(optionsRoute, () =>
                HttpResponse.json({ options: { challenge: "abc" }, ChallengeToken: "jwt-123" }),
            ),
        );
        let body: { RememberDevice?: boolean } = {};
        server.use(
            msw.post(authRoute, async ({ request }) => {
                body = (await request.json()) as { RememberDevice?: boolean };
                return HttpResponse.json({ msg: "ok" });
            }),
        );
        startAuthentication.mockResolvedValue({ id: "credential-1" });

        await signInWithBiometrics(fakeLoginContext({ rememberDevice: true }));

        expect(body.RememberDevice).toBe(true);
    });

    it("passa as options da API direto para a lib, sem reformatar", async () => {
        const options = { challenge: "abc", rpId: "exemplo.com", timeout: 60000 };
        server.use(
            msw.get(optionsRoute, () => HttpResponse.json({ options, ChallengeToken: "jwt-123" })),
        );
        server.use(msw.post(authRoute, () => HttpResponse.json({ msg: "ok" })));
        startAuthentication.mockResolvedValue({ id: "credential-1" });

        await signInWithBiometrics(fakeLoginContext());

        expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: options });
    });

    it("mostra a mensagem quando não há credencial neste aparelho", async () => {
        server.use(
            msw.get(optionsRoute, () =>
                HttpResponse.json(
                    { msg: "Nenhuma credencial biométrica registrada neste dispositivo." },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeLoginContext();

        await signInWithBiometrics(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Nenhuma credencial biométrica registrada neste dispositivo.",
        );
        expect(startAuthentication).not.toHaveBeenCalled();
    });

    it("libera a tela quando o usuário cancela a biometria", async () => {
        server.use(
            msw.get(optionsRoute, () =>
                HttpResponse.json({ options: {}, ChallengeToken: "jwt-123" }),
            ),
        );
        startAuthentication.mockRejectedValue(new Error("cancelado pelo usuário"));
        const context = fakeLoginContext();

        await signInWithBiometrics(context);

        // Sem isso o botão fica preso em "entrando" para sempre.
        expect(context.failSubmit).toHaveBeenCalledOnce();
        expect(context.finishSignIn).not.toHaveBeenCalled();
    });

    it("não faz nada sem DeviceKey", async () => {
        const context = fakeLoginContext({ deviceKey: null });

        await signInWithBiometrics(context);

        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(startAuthentication).not.toHaveBeenCalled();
    });
});
