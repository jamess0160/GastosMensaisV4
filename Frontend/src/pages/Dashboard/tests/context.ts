import { vi } from "vitest";
import type { BudgetDraft, DashboardContext } from "../controller";

export const aBudgetDraft = (overrides: Partial<BudgetDraft> = {}): BudgetDraft => ({
    IdBudgetPeriod: null,
    Scope: "category",
    IdCategory: 1,
    IdPerson: null,
    ReferenceMonth: "2026-08",
    LimitValue: 800,
    AlertPercent: 80,
    ...overrides,
});

/** Contexto de mentira para as sections de orçamento. */
export function fakeDashboardContext(overrides: Partial<DashboardContext> = {}): DashboardContext {
    return {
        budgetDraft: aBudgetDraft(),
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        closeBudgetForm: vi.fn(),
        ...overrides,
    };
}
