import { vi } from "vitest";
import type { ProfileContext } from "../controller";
import type { ApiTypes } from "@/types/api";

const user: ApiTypes.User = {
    IdUser: 1,
    Name: "Tiago",
    Email: "tiago@exemplo.com",
    Phone: 11999998888,
    LastLogin: "2026-08-30T12:00:00.000Z",
    TrialStartAt: null,
    TrialEndAt: null,
    Active: true,
    CreatedAt: "2026-08-01T00:00:00.000Z",
    UpdatedAt: "2026-08-30T12:00:00.000Z",
};

/** Contexto de mentira para as sections do perfil. */
export function fakeProfileContext(overrides: Partial<ProfileContext> = {}): ProfileContext {
    return {
        user,
        form: { name: "Tiago", email: "tiago@exemplo.com", phone: "11999998888" },
        passwordForm: {
            oldPassword: "senha-antiga",
            newPassword: "senha-nova-1",
            confirmation: "senha-nova-1",
        },
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        refresh: vi.fn(),
        resetAllCaches: vi.fn(),
        clearPasswordForm: vi.fn(),
        ...overrides,
    };
}
