import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveProfile } from "../sections/saveProfile";
import { fakeProfileContext } from "./context";

describe("saveProfile", () => {
    const route = "*/api/Users/IdUser=1";

    it("manda os três campos sempre, mesmo os que não mudaram", async () => {
        let body: unknown;
        server.use(
            msw.put(route, async ({ request }) => {
                body = await request.json();
                return new HttpResponse(null, { status: 200 });
            }),
        );

        await saveProfile(fakeProfileContext());

        // O PUT é substituição, não merge parcial: omitir um obrigatório
        // responde 406.
        expect(body).toEqual({
            Name: "Tiago",
            Email: "tiago@exemplo.com",
            Phone: 11999998888,
        });
    });

    /* Trocar o e-mail DERRUBA a confirmação: a API zera o
       `EmailConfirmedAt` e manda um link para o endereço novo. Sem o
       recado, o usuário lê "Dados atualizados", a faixa do chassi
       reaparece do nada e ele não liga uma coisa à outra. */
    it("avisa que o novo e-mail precisa ser confirmado", async () => {
        server.use(msw.put(route, () => new HttpResponse(null, { status: 200 })));
        const context = fakeProfileContext({
            form: { name: "Tiago", email: "outro@exemplo.com", phone: "11999998888" },
        });

        await saveProfile(context);

        expect(context.finishSubmit).toHaveBeenCalledWith(
            "profile",
            "Dados atualizados. Confirme o novo e-mail: mandamos um link para ele.",
        );
    });

    // Quem só mudou o nome não perde a confirmação — e o mesmo endereço
    // em outra caixa alta continua sendo o mesmo endereço.
    it("não avisa de confirmação quando o e-mail não mudou", async () => {
        server.use(msw.put(route, () => new HttpResponse(null, { status: 200 })));
        const context = fakeProfileContext({
            form: { name: "Tiago Ribeiro", email: "Tiago@Exemplo.com", phone: "11999998888" },
        });

        await saveProfile(context);

        expect(context.finishSubmit).toHaveBeenCalledWith("profile", "Dados atualizados.");
    });

    it("recusa telefone sem DDD sem gastar requisição", async () => {
        const context = fakeProfileContext({
            form: { name: "Tiago", email: "tiago@exemplo.com", phone: "99998888" },
        });

        await saveProfile(context);

        expect(context.failSubmit).toHaveBeenCalledWith("profile", "Informe um telefone com DDD.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });
});
