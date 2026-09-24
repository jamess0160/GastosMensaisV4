import { vi } from "vitest";
import type {
    AccountStepDraft,
    CardStepDraft,
    InflowStepDraft,
    PersonsStepDraft,
    WelcomeContext,
} from "../controller";

export const anAccountDraft = (overrides: Partial<AccountStepDraft> = {}): AccountStepDraft => ({
    Name: "Nubank",
    Color: "#7238d7",
    InitialBalance: 1200.5,
    InitialBalanceDate: "2026-09-24",
    ...overrides,
});

export const aCardDraft = (overrides: Partial<CardStepDraft> = {}): CardStepDraft => ({
    Name: "Cartão Roxo",
    ClosingDay: 27,
    DueDay: 4,
    ...overrides,
});

export const aPersonsDraft = (overrides: Partial<PersonsStepDraft> = {}): PersonsStepDraft => ({
    names: ["Luana"],
    ...overrides,
});

export const anInflowDraft = (overrides: Partial<InflowStepDraft> = {}): InflowStepDraft => ({
    Description: "Salário",
    TotalValue: 5000,
    IdToAccount: 7,
    ...overrides,
});

/** Contexto de mentira para as sections do assistente.
 *
 *  `idAccount` já vem preenchido porque o passo 1 é obrigatório: quando
 *  os passos 2 e 4 rodam, a conta existe. O caso do `null` é testado
 *  passando-o explicitamente. */
export function fakeWelcomeContext(overrides: Partial<WelcomeContext> = {}): WelcomeContext {
    return {
        accountDraft: anAccountDraft(),
        cardDraft: aCardDraft(),
        personsDraft: aPersonsDraft(),
        inflowDraft: anInflowDraft(),
        idAccount: 7,
        beginSubmit: vi.fn(),
        failSubmit: vi.fn(),
        finishStep: vi.fn(),
        setIdAccount: vi.fn(),
        setPersonNames: vi.fn(),
        ...overrides,
    };
}
