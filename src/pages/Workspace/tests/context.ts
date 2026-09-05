import { vi } from "vitest";
import type { InviteDraft, WorkspaceContext } from "../controller";

export const anInviteDraft = (overrides: Partial<InviteDraft> = {}): InviteDraft => ({
    Email: "alguem@exemplo.com",
    Role: "editor",
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
        refreshWorkspaces: vi.fn(),
        clearInviteDraft: vi.fn(),
        ...overrides,
    };
}
