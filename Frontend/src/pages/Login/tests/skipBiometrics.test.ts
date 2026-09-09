import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { skipBiometrics } from "../sections/skipBiometrics";
import { fakeLoginContext } from "./context";

const route = "*/api/UsersAuth/skipDevice";

describe("skipBiometrics", () => {
    it("registra a recusa e guarda o DeviceKey que a API devolveu", async () => {
        server.use(msw.post(route, () => HttpResponse.json({ DeviceKey: "novo-device" })));
        const context = fakeLoginContext();

        await skipBiometrics(context);

        // É o `skipDevice` que faz o `checkDevice` responder `false` — sem
        // guardar a chave, o convite voltaria a cada login.
        expect(context.rememberDeviceKey).toHaveBeenCalledWith("novo-device");
        expect(context.finishSignIn).toHaveBeenCalledOnce();
    });

    it("manda o DeviceKey que o aparelho já tinha", async () => {
        let body: unknown;
        server.use(
            msw.post(route, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ DeviceKey: "device-abc" });
            }),
        );

        await skipBiometrics(fakeLoginContext({ deviceKey: "device-abc" }));

        expect(body).toEqual({ DeviceKey: "device-abc" });
    });

    it("omite o DeviceKey quando o aparelho não tem um — a API gera", async () => {
        let body: unknown;
        server.use(
            msw.post(route, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ DeviceKey: "gerado" });
            }),
        );

        await skipBiometrics(fakeLoginContext({ deviceKey: null }));

        expect(body).toEqual({});
    });

    it("entra mesmo assim quando a recusa falha", async () => {
        // Travar a entrada por causa de um "não, obrigado" seria pior do
        // que o convite voltar na próxima vez.
        server.use(msw.post(route, () => new HttpResponse(null, { status: 500 })));
        const context = fakeLoginContext();

        await skipBiometrics(context);

        expect(context.finishSignIn).toHaveBeenCalledOnce();
        expect(context.failSubmit).not.toHaveBeenCalled();
    });
});
