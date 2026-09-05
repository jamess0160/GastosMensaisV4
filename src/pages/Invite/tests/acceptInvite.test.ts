import { HttpResponse, http as msw } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { acceptInvite } from "../sections/acceptInvite";
import type { InviteContext } from "../controller";
import type { ApiTypes } from "@/types/api";

const workspace: ApiTypes.Workspace = {
    IdWorkspace: 7,
    Name: "Casa",
    IdOwnerUser: 2,
    CreatedAt: "2026-09-01T00:00:00.000Z",
    UpdatedAt: "2026-09-01T00:00:00.000Z",
};

function fakeInviteContext(overrides: Partial<InviteContext> = {}): InviteContext {
    return {
        hash: "Yk3s",
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishAccept: vi.fn(),
        ...overrides,
    };
}

describe("acceptInvite", () => {
    it("manda só o Hash — o papel vem da linha do convite", async () => {
        let body: unknown;
        server.use(
            msw.post("*/api/Workspaces/join", async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ IdWorkspace: 7 });
            }),
        );
        const switchWorkspace = vi.fn().mockResolvedValue(workspace);

        await acceptInvite(fakeInviteContext(), switchWorkspace);

        expect(body).toEqual({ Hash: "Yk3s" });
    });

    it("TROCA a sessão depois do join — é o que o join não faz", async () => {
        // Sem esta segunda chamada o usuário aceita o convite, entra no
        // app e continua vendo o espaço antigo. Não dá erro nenhum: só
        // confunde, e é o bug mais provável desta entrega.
        server.use(msw.post("*/api/Workspaces/join", () => HttpResponse.json({ IdWorkspace: 7 })));
        const switchWorkspace = vi.fn().mockResolvedValue(workspace);
        const context = fakeInviteContext();

        await acceptInvite(context, switchWorkspace);

        expect(switchWorkspace).toHaveBeenCalledWith(7);
        expect(context.finishAccept).toHaveBeenCalledWith(workspace);
    });

    it("não troca a sessão quando o join é recusado", async () => {
        server.use(
            msw.post("*/api/Workspaces/join", () =>
                HttpResponse.json({ msg: "Este convite é de outro e-mail!" }, { status: 406 }),
            ),
        );
        const switchWorkspace = vi.fn().mockResolvedValue(workspace);
        const context = fakeInviteContext();

        await acceptInvite(context, switchWorkspace);

        expect(switchWorkspace).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith("Este convite é de outro e-mail!");
    });

    it("mostra a msg do servidor quando o convite expirou", async () => {
        // Os cinco 406 — inexistente, revogado, expirado, já usado e
        // e-mail diferente — só se distinguem pela mensagem, e é ela que
        // manda o usuário para o lugar certo.
        server.use(
            msw.post("*/api/Workspaces/join", () =>
                HttpResponse.json({ msg: "Este convite expirou!" }, { status: 406 }),
            ),
        );
        const context = fakeInviteContext();

        await acceptInvite(context, vi.fn());

        expect(context.failSubmit).toHaveBeenCalledWith("Este convite expirou!");
    });
});
