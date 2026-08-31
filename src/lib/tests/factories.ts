import type { ApiTypes } from "@/types/api";

/* Fábricas dos objetos do contrato para os testes de agregação.
   Só os campos que a conta lê importam; o resto é preenchido com o que
   a API devolveria, para que o objeto continue sendo do tipo certo. */

const NOW = "2026-08-01T00:00:00.000Z";

export function anExpense(overrides: Partial<ApiTypes.Expense> = {}): ApiTypes.Expense {
    return {
        IdExpense: 1,
        IdWorkspace: 1,
        IdUser: 1,
        Description: "Mercado",
        TotalValue: 100,
        Status: "pending",
        IdCategory: 1,
        ExpenseDate: "2026-08-10",
        Kind: "single",
        IdParentExpense: null,
        RecurrenceDay: null,
        RecurrenceEndDate: null,
        Notes: null,
        CreatedAt: NOW,
        UpdatedAt: NOW,
        ...overrides,
    };
}

export function aPayment(
    overrides: Partial<ApiTypes.ExpensePayment> = {},
): ApiTypes.ExpensePayment {
    return {
        IdExpensePayment: 1,
        IdWorkspace: 1,
        IdExpense: 1,
        IdPaymentMethod: 1,
        Value: 100,
        InstallmentNumber: null,
        InstallmentTotal: null,
        ClosingDate: null,
        DueDate: null,
        Paid: false,
        PaidAt: null,
        CreatedAt: NOW,
        UpdatedAt: NOW,
        ...overrides,
    };
}

export function anExpenseDetail(
    overrides: Partial<ApiTypes.ExpenseDetail> = {},
): ApiTypes.ExpenseDetail {
    return {
        ...anExpense(),
        Payments: [aPayment()],
        Persons: [],
        Tags: [],
        ...overrides,
    };
}

/** Uma compra parcelada como a API a monta: uma linha de gasto com o
 *  total da compra e N pernas, cada uma com o `DueDate` da sua fatura. */
export function anInstallment({
    IdExpense = 1,
    total = 600,
    parts = 6,
    firstDueMonth = 8,
    year = 2026,
    paidUntil = 0,
    ...rest
}: {
    IdExpense?: number;
    total?: number;
    parts?: number;
    firstDueMonth?: number;
    year?: number;
    paidUntil?: number;
} & Partial<ApiTypes.Expense> = {}): ApiTypes.ExpenseDetail {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / parts);
    // O centavo que sobra vai na PRIMEIRA parcela, como a API faz.
    const remainder = cents - base * parts;

    return {
        ...anExpense({
            IdExpense,
            TotalValue: total,
            Kind: "installment",
            ExpenseDate: `${year}-${String(firstDueMonth).padStart(2, "0")}-10`,
            ...rest,
        }),
        Payments: Array.from({ length: parts }, (_, index) => {
            const due = new Date(year, firstDueMonth - 1 + index, 27);
            return aPayment({
                IdExpensePayment: index + 1,
                IdExpense,
                Value: (index === 0 ? base + remainder : base) / 100,
                InstallmentNumber: index + 1,
                InstallmentTotal: parts,
                DueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-27`,
                Paid: index < paidUntil,
            });
        }),
        Persons: [],
        Tags: [],
    };
}

export function anInflow(overrides: Partial<ApiTypes.Inflow> = {}): ApiTypes.Inflow {
    return {
        IdInflow: 1,
        IdWorkspace: 1,
        IdUser: 1,
        Description: "Salário",
        TotalValue: 5000,
        Status: "received",
        Kind: "inflow",
        IdFromAccount: null,
        IdToAccount: 1,
        CompetenceDate: "2026-08-05",
        ExpectedDate: "2026-08-05",
        ReceivedAt: NOW,
        Notes: null,
        CreatedAt: NOW,
        UpdatedAt: NOW,
        ...overrides,
    };
}

export function anAccount(overrides: Partial<ApiTypes.Account> = {}): ApiTypes.Account {
    return {
        IdAccount: 1,
        IdWorkspace: 1,
        IdUser: 1,
        Name: "Nubank",
        Type: "checking",
        IconPath: null,
        Color: null,
        InitialBalance: 0,
        InitialBalanceDate: null,
        Balance: 1000,
        Position: 1,
        Active: true,
        CreatedAt: NOW,
        UpdatedAt: NOW,
        PaymentMethods: [],
        ...overrides,
    };
}

export function aCategory(overrides: Partial<ApiTypes.Category> = {}): ApiTypes.Category {
    return {
        IdCategory: 1,
        IdWorkspace: 1,
        Description: "Alimentação",
        IconKey: "food",
        Color: null,
        Position: 1,
        Active: true,
        CreatedAt: NOW,
        UpdatedAt: NOW,
        ...overrides,
    };
}

export function aBudgetPeriod(
    overrides: Partial<ApiTypes.BudgetPeriod> = {},
): ApiTypes.BudgetPeriod {
    return {
        IdBudgetPeriod: 1,
        IdWorkspace: 1,
        IdBudget: 1,
        ReferenceMonth: "2026-08-01",
        LimitValue: 800,
        AlertPercent: 80,
        Status: "open",
        ClosedAt: null,
        CreatedAt: NOW,
        UpdatedAt: NOW,
        IdCategory: 1,
        Category: aCategory(),
        Spent: 0,
        ...overrides,
    };
}
