import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { loadBiometricsAvailability } from "../sections/loadBiometricsAvailability";
import { fakeLoginContext } from "./context";

const route = "*/api/UsersAuth/checkDevice/DeviceKey=:deviceKey";

describe("loadBiometricsAvailability", () => {
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
