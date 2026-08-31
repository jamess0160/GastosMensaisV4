import { vi } from "vitest";
import type { CategoryDraft, PersonDraft, SettingsContext } from "../controller";

export const aCategoryDraft = (overrides: Partial<CategoryDraft> = {}): CategoryDraft => ({
    IdCategory: null,
    Description: "Mercado",
    IconKey: "market",
    Color: "#0084ff",
    ...overrides,
});

export const aPersonDraft = (overrides: Partial<PersonDraft> = {}): PersonDraft => ({
    IdPerson: null,
    Name: "Luana",
    ...overrides,
});

/** Contexto de mentira para as sections da personalização. */
export function fakeSettingsContext(overrides: Partial<SettingsContext> = {}): SettingsContext {
    return {
        categoryDraft: aCategoryDraft(),
        personDraft: aPersonDraft(),
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        resetCategoryDraft: vi.fn(),
        resetPersonDraft: vi.fn(),
        ...overrides,
    };
}
