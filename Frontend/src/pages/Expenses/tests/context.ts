import { vi } from "vitest";
import type { ExpensesContext, SeriesDraft } from "../controller";

export const aSeriesDraft = (overrides: Partial<SeriesDraft> = {}): SeriesDraft => ({
    Description: "Aluguel",
    TotalValue: 2400,
    IdCategory: 2,
    Notes: "",
    persons: [],
    ...overrides,
});

/** Contexto de mentira para as sections da lista de gastos. */
export function fakeExpensesContext(overrides: Partial<ExpensesContext> = {}): ExpensesContext {
    return {
        seriesDraft: aSeriesDraft(),
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        closeDetail: vi.fn(),
        closeSeriesForm: vi.fn(),
        ...overrides,
    };
}
