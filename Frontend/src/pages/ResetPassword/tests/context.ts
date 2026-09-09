import { vi } from "vitest";
import type { ResetPasswordContext } from "../controller";

/** Contexto de mentira para a section de "criar senha nova". */
export function fakeResetPasswordContext(
    overrides: Partial<ResetPasswordContext> = {},
): ResetPasswordContext {
    return {
        token: "jwt-do-link",
        password: "senha-nova-1",
        confirmation: "senha-nova-1",
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        ...overrides,
    };
}
