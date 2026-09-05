import { vi } from "vitest";
import type { SignUpContext } from "../controller";

/** Contexto de mentira para as sections do cadastro. */
export function fakeSignUpContext(overrides: Partial<SignUpContext> = {}): SignUpContext {
    return {
        name: "Tiago",
        email: "tiago@exemplo.com",
        password: "senha-forte-1",
        passwordConfirmation: "senha-forte-1",
        phone: "11999998888",
        acceptedTerms: true,
        inviteHash: null,
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSignUp: vi.fn(),
        ...overrides,
    };
}
