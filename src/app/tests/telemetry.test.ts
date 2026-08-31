import { HttpResponse, http as msw } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { reportError } from "@/app/telemetry";
import { ApiBusinessError, ApiUnauthorizedError } from "@/api/client";

const route = "*/api/Utils/Logs";

/** Coleta os corpos que chegaram em `POST /Utils/Logs`. */
function collect() {
    const bodies: Record<string, unknown>[] = [];
    server.use(
        msw.post(route, async ({ request }) => {
            bodies.push((await request.json()) as Record<string, unknown>);
            return HttpResponse.text("Sucesso");
        }),
    );
    return bodies;
}

/** O envio é disparado sem `await`. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("reportError", () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it("manda o erro como Type: error, com a msg preenchida", async () => {
        const bodies = collect();

        reportError(new Error("quebrou no render"), { rota: "/gastos" });
        await flush();

        expect(bodies).toHaveLength(1);
        expect(bodies[0].Type).toBe("error");
        const log = bodies[0].Log as Record<string, unknown>;
        // `Log.msg` é o único campo obrigatório do contrato.
        expect(log.msg).toBe("quebrou no render");
        expect(log.rota).toBe("/gastos");
    });

    it("IGNORA o 401 — sessão expirada é fluxo, não incidente", async () => {
        // Sem handler declarado: qualquer requisição aqui quebra o
        // teste, que é a garantia de que nada é enviado.
        reportError(new ApiUnauthorizedError());
        await flush();

        expect(true).toBe(true);
    });

    it("engole erros iguais em sequência", async () => {
        const bodies = collect();

        // Um laço de render quebrado dispara o mesmo erro dezenas de
        // vezes por segundo; sem a trava, a telemetria vira o incidente.
        reportError(new Error("mesmo erro repetido"));
        reportError(new Error("mesmo erro repetido"));
        reportError(new Error("mesmo erro repetido"));
        await flush();

        expect(bodies).toHaveLength(1);
    });

    it("manda erros diferentes em sequência", async () => {
        const bodies = collect();

        reportError(new Error("primeiro problema"));
        reportError(new Error("segundo problema"));
        await flush();

        expect(bodies).toHaveLength(2);
    });

    it("registra erro de negócio, que é bug de tela quando não tratado", async () => {
        const bodies = collect();

        reportError(new ApiBusinessError("A soma do rateio não bate!"));
        await flush();

        expect((bodies[0].Log as Record<string, unknown>).msg).toBe("A soma do rateio não bate!");
    });

    it("não deixa o log falhando derrubar a tela", async () => {
        server.use(msw.post(route, () => new HttpResponse(null, { status: 500 })));

        expect(() => reportError(new Error("erro com log quebrado"))).not.toThrow();
        await flush();
    });

    it("recorta a pilha", async () => {
        const bodies = collect();
        const error = new Error("pilha enorme");
        error.stack = Array.from({ length: 60 }, (_, index) => `linha ${index}`).join("\n");

        reportError(error);
        await flush();

        const log = bodies[0].Log as Record<string, unknown>;
        expect((log.stack as string[]).length).toBeLessThanOrEqual(12);
    });
});
