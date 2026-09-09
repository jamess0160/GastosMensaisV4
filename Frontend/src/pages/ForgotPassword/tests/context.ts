import { vi } from "vitest";
import type { ForgotPasswordContext } from "../controller";

/** Contexto de mentira para a section de "esqueci minha senha". */
export function fakeForgotPasswordContext(
    overrides: Partial<ForgotPasswordContext> = {},
): ForgotPasswordContext {
    return {
        email: "tiago@exemplo.com",
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        ...overrides,
    };
}
