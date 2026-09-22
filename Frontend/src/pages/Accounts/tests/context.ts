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
    // O cartão que motivou a leva 9: fecha 27 e vence 04, ou seja,
    // `ClosingDay > DueDay` e a fatura é cobrada no mês seguinte ao que
    // ela fechou. É o par que o modelo da folga não descrevia em todos
    // os meses.
    ClosingDay: 27,
    DueDay: 4,
    // O default do servidor — um cartão criado sem tocar no seletor tem
    // que sair igual a um criado sem o campo no corpo.
    CompetenceMode: "purchase",
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
