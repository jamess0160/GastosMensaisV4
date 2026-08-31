import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { switchWorkspace } from "../sections/switchWorkspace";
import { saveProfile } from "../sections/saveProfile";
import { fakeProfileContext } from "./context";

const route = "*/api/Workspaces/switch";

const workspace = {
    IdWorkspace: 2,
    Name: "Casa da praia",
    IdOwnerUser: 1,
    CreatedAt: "2026-08-01T00:00:00.000Z",
    UpdatedAt: "2026-08-01T00:00:00.000Z",
};

describe("switchWorkspace", () => {
    it("limpa TODO o cache depois de trocar", async () => {
        server.use(msw.post(route, () => HttpResponse.json(workspace)));
        const context = fakeProfileContext();

        await switchWorkspace(context, 2);

        // O switch reemite o cookie e o workspace vive dentro do token:
        // contas, categorias e gastos em cache passam a ser de outro
        // espaço. Não há invalidação seletiva que salve aqui.
        expect(context.resetAllCaches).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "workspace",
            "Agora você está em Casa da praia.",
        );
    });

    it("é a única rota que manda IdWorkspace do cliente", async () => {
        let body: unknown;
        server.use(
            msw.post(route, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json(workspace);
            }),
        );

        await switchWorkspace(fakeProfileContext(), 2);

        expect(body).toEqual({ IdWorkspace: 2 });
    });

    it("não mexe no cache quando a troca falha", async () => {
        server.use(
            msw.post(route, () =>
                HttpResponse.json({ msg: "Você não é membro deste workspace!" }, { status: 406 }),
            ),
        );
        const context = fakeProfileContext();

        await switchWorkspace(context, 99);

        expect(context.resetAllCaches).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith(
            "workspace",
            "Você não é membro deste workspace!",
        );
    });
});

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
