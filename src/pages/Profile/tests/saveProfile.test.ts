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

    it("recusa telefone sem DDD sem gastar requisição", async () => {
        const context = fakeProfileContext({
            form: { name: "Tiago", email: "tiago@exemplo.com", phone: "99998888" },
        });

        await saveProfile(context);

        expect(context.failSubmit).toHaveBeenCalledWith("profile", "Informe um telefone com DDD.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });
});
