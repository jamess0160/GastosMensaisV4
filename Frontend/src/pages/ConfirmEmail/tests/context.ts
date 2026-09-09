import { vi } from "vitest";
import type { ConfirmEmailContext } from "../controller";

/** Contexto de mentira para as sections da confirmação de e-mail. */
export function fakeConfirmEmailContext(
    overrides: Partial<ConfirmEmailContext> = {},
): ConfirmEmailContext {
    return {
        token: "jwt-do-link",
        email: "tiago@exemplo.com",
        beginConfirm: vi.fn(),
        finishConfirm: vi.fn(),
        failConfirm: vi.fn(),
        beginResend: vi.fn(),
        finishResend: vi.fn(),
        failResend: vi.fn(),
        ...overrides,
    };
}
