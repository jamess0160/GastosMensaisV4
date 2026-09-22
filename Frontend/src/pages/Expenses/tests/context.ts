import { vi } from "vitest";
import type { ExpensesContext, SeriesDraft } from "../controller";
import type { ApiTypes } from "@/types/api";

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
        openInvoiceFor: vi.fn(),
        openCardChoice: vi.fn(),
        ...overrides,
    };
}

/** Um cartão de crédito de mentira, com os dois dias do mês que o
 *  descrevem desde a leva 9. */
export const aCard = (overrides: Partial<ApiTypes.PaymentMethod> = {}): ApiTypes.PaymentMethod => ({
    IdPaymentMethod: 7,
    IdWorkspace: 1,
    IdAccount: 1,
    Name: "Cartão Roxo",
    Kind: "credit_card",
    DueDay: 4,
    ClosingDay: 27,
    CompetenceMode: "purchase",
    IconPath: null,
    Color: null,
    Position: null,
    Active: true,
    CreatedAt: "2026-01-01T00:00:00.000Z",
    UpdatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
});
