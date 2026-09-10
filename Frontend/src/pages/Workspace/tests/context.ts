import { vi } from "vitest";
import type { InviteDraft, WorkspaceContext } from "../controller";
import type { ApiTypes } from "@/types/api";

export const anInviteDraft = (overrides: Partial<InviteDraft> = {}): InviteDraft => ({
    Email: "alguem@exemplo.com",
    Role: "editor",
    ...overrides,
});

/** Uma linha de "quem tem acesso". Sem `IdUser` — a lista não traz um, e
 *  o que endereça o membro é o `IdWorkspaceMember`. */
export const aMember = (
    overrides: Partial<ApiTypes.WorkspaceMember> = {},
): ApiTypes.WorkspaceMember => ({
    IdWorkspaceMember: 7,
    Name: "Ana",
    Email: "ana@exemplo.com",
    Role: "viewer",
    JoinedAt: "2026-09-01T12:00:00.000Z",
    IsSelf: false,
    ...overrides,
});

/** Contexto de mentira para as sections do espaço. */
export function fakeWorkspaceContext(overrides: Partial<WorkspaceContext> = {}): WorkspaceContext {
    return {
        name: "Casa",
        inviteDraft: anInviteDraft(),
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        refreshInvites: vi.fn(),
        refreshMembers: vi.fn(),
        refreshWorkspaces: vi.fn(),
        clearInviteDraft: vi.fn(),
        ...overrides,
    };
}
