import { HttpResponse, http as msw } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { createWorkspace, type CreateWorkspaceContext } from "../sections/createWorkspace";
import type { ApiTypes } from "@/types/api";

const workspace: ApiTypes.Workspace = {
    IdWorkspace: 2,
    Name: "Empresa",
    IdOwnerUser: 1,
    Current: true,
    CreatedAt: "2026-09-06T00:00:00.000Z",
    UpdatedAt: "2026-09-06T00:00:00.000Z",
};

function fakeContext(overrides: Partial<CreateWorkspaceContext> = {}): CreateWorkspaceContext {
    return {
        name: "Empresa",
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishCreate: vi.fn(),
        ...overrides,
    };
}

describe("createWorkspace", () => {
    it("manda só o Name — a propriedade vem do token", async () => {
        let body: unknown;
        server.use(
            msw.post("*/api/Workspaces", async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ IdWorkspace: 2 });
            }),
        );

        await createWorkspace(fakeContext(), vi.fn().mockResolvedValue(workspace));

        // Não há campo por onde apontar o dono para outra pessoa, e o
        // `IdWorkspace` nasce na própria rota.
        expect(body).toEqual({ Name: "Empresa" });
    });

    it("TROCA a sessão depois de criar — criar não troca sozinho", async () => {
        // Mesma armadilha do `join`: sem o `switch`, o usuário cria o
        // espaço e continua vendo o antigo, sem erro nenhum na tela.
        server.use(msw.post("*/api/Workspaces", () => HttpResponse.json({ IdWorkspace: 2 })));
        const switchWorkspace = vi.fn().mockResolvedValue(workspace);
        const context = fakeContext();

        await createWorkspace(context, switchWorkspace);

        expect(switchWorkspace).toHaveBeenCalledWith(2);
        expect(context.finishCreate).toHaveBeenCalledWith(workspace);
    });

    it("apara o nome antes de mandar", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Workspaces", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdWorkspace: 2 });
            }),
        );

        await createWorkspace(
            fakeContext({ name: "  Casa da praia  " }),
            vi.fn().mockResolvedValue(workspace),
        );

        expect(body?.Name).toBe("Casa da praia");
    });

    it("recusa nome vazio sem gastar requisição", async () => {
        const context = fakeContext({ name: "   " });

        await createWorkspace(context, vi.fn());

        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith("Informe o nome do espaço.");
    });

    it("não troca a sessão quando a criação falha", async () => {
        server.use(
            msw.post("*/api/Workspaces", () =>
                HttpResponse.json({ msg: "Dados de entrada inválidos." }, { status: 406 }),
            ),
        );
        const switchWorkspace = vi.fn();
        const context = fakeContext();

        await createWorkspace(context, switchWorkspace);

        expect(switchWorkspace).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith("Dados de entrada inválidos.");
    });
});
