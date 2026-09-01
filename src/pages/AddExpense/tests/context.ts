import { vi } from "vitest";
import type { AddExpenseContext, ExpenseDraft } from "../controller";

export const aDraft = (overrides: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
    Description: "Mercado",
    TotalValue: 600,
    IdCategory: 1,
    ExpenseDate: "2026-08-10",
    Kind: "single",
    Notes: "",
    payments: [{ id: 3, value: 600, paid: false }],
    persons: [],
    tags: [],
    InstallmentTotal: 2,
    RecurrenceDay: null,
    RecurrenceEndDate: null,
    ...overrides,
});

/** Contexto de mentira para as sections do lançamento. */
export function fakeAddExpenseContext(
    overrides: Partial<AddExpenseContext> = {},
): AddExpenseContext {
    return {
        draft: aDraft(),
        idExpense: null,
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        finishLoad: vi.fn(),
        ...overrides,
    };
}
