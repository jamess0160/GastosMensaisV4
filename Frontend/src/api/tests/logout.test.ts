import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { UsersConnection } from "@/api/Users.connection";

/* O logout é a rota que fecha a pendência 1: o cookie `token` é
   `HttpOnly` e o JavaScript nunca conseguiu apagá-lo, então até ela
   existir "sair" só fazia o cliente FINGIR que tinha saído, com a sessão
   viva no servidor por 24h. */

describe("UsersConnection.logout", () => {
    it("chama POST /Users/logout sem corpo", async () => {
        let body: string | null = null;
        server.use(
            msw.post("*/api/Users/logout", async ({ request }) => {
                body = await request.text();
                return HttpResponse.json({ msg: "Sessão encerrada com sucesso" });
            }),
        );

        const response = await UsersConnection.logout();

        expect(body).toBe("");
        expect(response.msg).toBe("Sessão encerrada com sucesso");
    });

    it("responde 200 sem sessão — é o que impede o botão Sair de travar", async () => {
        // A rota é pública DE PROPÓSITO: um logout que respondesse 401
        // travaria justamente no caso em que o usuário mais quer sair.
        server.use(
            msw.post("*/api/Users/logout", () =>
                HttpResponse.json({ msg: "Sessão encerrada com sucesso" }),
            ),
        );

        await expect(UsersConnection.logout()).resolves.toEqual({
            msg: "Sessão encerrada com sucesso",
        });
    });
});
