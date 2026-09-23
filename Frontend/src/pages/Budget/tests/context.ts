import { vi } from "vitest";
import type { BudgetContext, BudgetLine } from "../controller";

/** Uma linha do rateio: a pessoa em `id`, a categoria em `secondaryId`.
 *
 *  O padrão é a fatia só de categoria, que é a forma mais comum — o
 *  rateio da renda distribui por categoria, e a fatia de pessoa é a
 *  mesada que entra à mão. */
export const aBudgetLine = (overrides: Partial<BudgetLine> = {}): BudgetLine => ({
    id: null,
    secondaryId: 1,
    value: 800,
    ...overrides,
});

/** Contexto de mentira para as sections do orçamento. */
export function fakeBudgetContext(overrides: Partial<BudgetContext> = {}): BudgetContext {
    return {
        month: "2026-10",
        lines: [aBudgetLine()],
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        ...overrides,
    };
}
