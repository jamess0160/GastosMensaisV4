import { vi } from "vitest";
import type { IncomeContext, InflowDraft } from "../controller";

export const anInflowDraft = (overrides: Partial<InflowDraft> = {}): InflowDraft => ({
    IdInflow: null,
    Description: "Salário",
    TotalValue: 5000,
    Kind: "inflow",
    IdFromAccount: null,
    IdToAccount: 1,
    CompetenceDate: "2026-08-05",
    ExpectedDate: null,
    Notes: "",
    persons: [],
    received: false,
    ...overrides,
});

/** Contexto de mentira para as sections de renda. */
export function fakeIncomeContext(overrides: Partial<IncomeContext> = {}): IncomeContext {
    return {
        draft: anInflowDraft(),
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        closeForm: vi.fn(),
        closeDetail: vi.fn(),
        closeCloneMonth: vi.fn(),
        setDraft: vi.fn(),
        ...overrides,
    };
}
