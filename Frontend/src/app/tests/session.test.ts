import { describe, expect, it } from "vitest";
import { currentWorkspace } from "@/app/session";
import type { ApiTypes } from "@/types/api";

/** Uma linha de `GET /Workspaces/getSelf`. */
const workspace = (IdWorkspace: number, Name: string, Current: boolean): ApiTypes.Workspace => ({
    IdWorkspace,
    Name,
    IdOwnerUser: 1,
    Current,
    CreatedAt: "2026-09-01T00:00:00.000Z",
    UpdatedAt: "2026-09-01T00:00:00.000Z",
});

describe("currentWorkspace", () => {
    it("devolve o que a API marcou com Current", () => {
        const list = [workspace(1, "Casa", false), workspace(4, "Ruah", true)];

        expect(currentWorkspace(list)?.Name).toBe("Ruah");
    });

    /* O bug que a pendência 19 fechou: com dois espaços, recarregar a
       página mostrava o nome do primeiro enquanto o cookie continuava no
       segundo — a tela AFIRMANDO um espaço e o lançamento indo para outro. */
    it("não cai no primeiro da lista", () => {
        const list = [workspace(1, "Casa", false), workspace(4, "Ruah", false)];

        expect(currentWorkspace(list)).toBeNull();
    });

    it("sem espaço nenhum, é null", () => {
        expect(currentWorkspace([])).toBeNull();
    });
});
