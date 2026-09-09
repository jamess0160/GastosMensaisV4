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
        // A forma 3 do `aDraft` é cartão: é ela que os testes de estorno
        // usam, e a de sinal proibido troca por outra.
        creditCardMethods: new Set([3]),
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        finishLoad: vi.fn(),
        ...overrides,
    };
}
