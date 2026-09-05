import { vi } from "vitest";
import type { AccountDraft, AccountsContext, CardDraft } from "../controller";

export const anAccountDraft = (overrides: Partial<AccountDraft> = {}): AccountDraft => ({
    IdAccount: null,
    Name: "Nubank",
    Type: "checking",
    Color: null,
    InitialBalance: 1000,
    InitialBalanceDate: "2026-01-01",
    balanceFrozen: false,
    ...overrides,
});

export const aCardDraft = (overrides: Partial<CardDraft> = {}): CardDraft => ({
    IdPaymentMethod: null,
    IdAccount: 1,
    Name: "Cartão Roxo",
    // Fechou 29/08 e venceu 05/09: vencimento dia 5, folga de 7 dias.
    ClosingDate: "2026-08-29",
    DueDate: "2026-09-05",
    Color: null,
    ...overrides,
});

/** Contexto de mentira para as sections de contas. */
export function fakeAccountsContext(overrides: Partial<AccountsContext> = {}): AccountsContext {
    return {
        accountDraft: anAccountDraft(),
        cardDraft: aCardDraft(),
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishSubmit: vi.fn(),
        finishInvoice: vi.fn(),
        closeAccountForm: vi.fn(),
        closeCardForm: vi.fn(),
        ...overrides,
    };
}
