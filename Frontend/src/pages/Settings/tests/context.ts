import { vi } from "vitest";
import type { CategoryDraft, PersonDraft, SettingsContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Uma categoria como a API a devolve. `Position` acompanha a ordem da
 *  lista, que é o que `moveCategory` troca. */
export const aCategory = (
    IdCategory: number,
    Description: string,
    overrides: Partial<ApiTypes.Category> = {},
): ApiTypes.Category => ({
    IdCategory,
    IdWorkspace: 1,
    Description,
    IconKey: null,
    Color: null,
    Position: IdCategory,
    Active: true,
    CreatedAt: "2026-01-01T00:00:00.000Z",
    UpdatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
});

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
        activeCategories: [],
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        resetCategoryDraft: vi.fn(),
        resetPersonDraft: vi.fn(),
        ...overrides,
    };
}
