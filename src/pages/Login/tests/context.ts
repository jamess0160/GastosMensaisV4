import { vi } from "vitest";
import type { LoginContext } from "../controller";

/** Contexto de mentira para as sections.
 *
 *  Como as sections não conhecem React, testá-las é só passar isto —
 *  não há componente para montar nem hook para simular. Os verbos são
 *  spies, então o teste verifica o que o evento pediu para a tela fazer. */
export function fakeLoginContext(overrides: Partial<LoginContext> = {}): LoginContext {
    return {
        deviceKey: "device-abc",
        email: "tiago@exemplo.com",
        password: "senha-certa",
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSignIn: vi.fn(),
        setOfferBiometrics: vi.fn(),
        setInviteBiometrics: vi.fn(),
        rememberDeviceKey: vi.fn(),
        ...overrides,
    };
}
