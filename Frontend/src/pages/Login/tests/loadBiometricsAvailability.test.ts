import { HttpResponse, http as msw } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restoreNavigator, stubMobileNavigator } from "@/test/navigator";
import { server } from "@/test/server";
import { loadBiometricsAvailability } from "../sections/loadBiometricsAvailability";
import { fakeLoginContext } from "./context";

const route = "*/api/UsersAuth/checkDevice/DeviceKey=:deviceKey";

describe("loadBiometricsAvailability", () => {
    /* A oferta de biometria é só de aparelho móvel, e o jsdom anuncia um
       desktop: sem forjar o aparelho, todo teste daqui descreveria o gate
       do desktop em vez do tri-estado do `checkDevice`. */
    beforeEach(stubMobileNavigator);
    afterEach(restoreNavigator);

    // O checkDevice é tri-estado, e os três casos levam a telas diferentes.
    it("oferece biometria quando há passkey neste aparelho", async () => {
        server.use(msw.get(route, () => HttpResponse.json({ UseAuth: true })));
        const context = fakeLoginContext();

        await loadBiometricsAvailability(context);

        expect(context.setOfferBiometrics).toHaveBeenCalledWith(true);
    });

    it("não oferece quando o usuário já recusou neste aparelho", async () => {
        server.use(msw.get(route, () => HttpResponse.json({ UseAuth: false })));
        const context = fakeLoginContext();

        await loadBiometricsAvailability(context);

        expect(context.setOfferBiometrics).toHaveBeenCalledWith(false);
    });

    it("não oferece quando nunca foi perguntado", async () => {
        server.use(msw.get(route, () => HttpResponse.json({ UseAuth: null })));
        const context = fakeLoginContext();

        await loadBiometricsAvailability(context);

        expect(context.setOfferBiometrics).toHaveBeenCalledWith(false);
    });

    it("não chama a API quando o aparelho ainda não tem DeviceKey", async () => {
        // Sem handler declarado: se a section chamar a API, o setup quebra
        // o teste com "unhandled request".
        const context = fakeLoginContext({ deviceKey: null });

        await loadBiometricsAvailability(context);

        expect(context.setOfferBiometrics).not.toHaveBeenCalled();
    });

    // Falhar aqui não pode impedir alguém de entrar com a senha.
    it("cai para o login por senha quando a checagem falha", async () => {
        server.use(msw.get(route, () => new HttpResponse(null, { status: 500 })));
        const context = fakeLoginContext();

        await expect(loadBiometricsAvailability(context)).resolves.toBeUndefined();

        expect(context.setOfferBiometrics).toHaveBeenCalledWith(false);
    });
});

/* Sem `stubMobileNavigator` nenhum: o aparelho do jsdom é o desktop, que
   é exatamente o caso desta suíte. */
describe("loadBiometricsAvailability · no desktop", () => {
    it("não consulta o aparelho nem oferece biometria", async () => {
        /* O handler existe e ESPIONA: o aparelho tem DeviceKey e a
           resposta seria a que mais oferece biometria. O que se afirma é
           que a requisição não sai — e ela é espionada em vez de omitida
           porque a section engole o erro da consulta, então um handler
           ausente passaria despercebido por ela. */
        const asked = vi.fn();
        server.use(
            msw.get(route, () => {
                asked();
                return HttpResponse.json({ UseAuth: true });
            }),
        );
        const context = fakeLoginContext();

        await loadBiometricsAvailability(context);

        expect(asked).not.toHaveBeenCalled();
        expect(context.setOfferBiometrics).not.toHaveBeenCalled();
    });
});
