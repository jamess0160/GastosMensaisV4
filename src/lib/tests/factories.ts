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

/** `CompetenceDate` segue o `DueDate` quando ele existe, que é o que a
 *  API congela no lançamento — informar as duas coisas separadas num
 *  teste seria poder escrever uma perna que não existe. */
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
        CompetenceDate: overrides.DueDate ?? "2026-08-10",
        // `null` é o padrão porque a maioria das pernas não é de cartão:
        // é a nulidade que diz que a linha não tem conferência de fatura.
        Charged: null,
        ChargedAt: null,
        Paid: false,
        PaidAt: null,
        CreatedAt: NOW,
        UpdatedAt: NOW,
        ...overrides,
    };
}

/** Uma perna como `GET /ExpensePayments` a devolve: com o gasto de
 *  origem e o rateio DELE. É a unidade de todo total de gasto. */
export function aLegRow(
    expense: ApiTypes.Expense = anExpense(),
    payment: Partial<ApiTypes.ExpensePayment> = {},
    persons: ApiTypes.ExpensePerson[] = [],
): ApiTypes.ExpensePaymentRow {
    return {
        ...aPayment({
            IdExpense: expense.IdExpense,
            Value: expense.TotalValue,
            CompetenceDate: expense.ExpenseDate,
            ...payment,
        }),
        Expense: expense,
        Persons: persons,
    };
}

/** O rateio de um gasto entre pessoas, do jeito que vem na perna. */
export function anExpensePerson(
    IdPerson: number,
    Value: ApiTypes.Money,
    IdExpense = 1,
): ApiTypes.ExpensePerson {
    return {
        IdExpensePerson: IdPerson,
        IdWorkspace: 1,
        IdExpense,
        IdPerson,
        Value,
        CreatedAt: NOW,
        UpdatedAt: NOW,
    };
}

/** Uma compra parcelada como a API a devolve em `GET /ExpensePayments`:
 *  N pernas, cada uma carregando a MESMA linha de gasto (com o total da
 *  compra) e o MESMO rateio — e cada uma com o `DueDate` da sua fatura.
 *
 *  É essa repetição que faz `spentByPerson` precisar ratear: somar o
 *  `Persons` perna a perna contaria a compra inteira seis vezes. */
export function installmentRows({
    IdExpense = 1,
    total = 600,
    parts = 6,
    firstDueMonth = 8,
    year = 2026,
    paidUntil = 0,
    IdPaymentMethod = 1,
    persons = [],
    ...rest
}: {
    IdExpense?: number;
    total?: number;
    parts?: number;
    firstDueMonth?: number;
    year?: number;
    paidUntil?: number;
    IdPaymentMethod?: number;
    persons?: ApiTypes.ExpensePerson[];
} & Partial<ApiTypes.Expense> = {}): ApiTypes.ExpensePaymentRow[] {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / parts);
    // O centavo que sobra vai na PRIMEIRA parcela, como a API faz.
    const remainder = cents - base * parts;

    const expense = anExpense({
        IdExpense,
        TotalValue: total,
        Kind: "installment",
        ExpenseDate: `${year}-${String(firstDueMonth).padStart(2, "0")}-10`,
        ...rest,
    });

    return Array.from({ length: parts }, (_, index) => {
        const due = new Date(year, firstDueMonth - 1 + index, 27);
        const DueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-27`;
        return aLegRow(
            expense,
            {
                IdExpensePayment: index + 1,
                IdPaymentMethod,
                Value: (index === 0 ? base + remainder : base) / 100,
                InstallmentNumber: index + 1,
                InstallmentTotal: parts,
                DueDate,
                CompetenceDate: DueDate,
                Paid: index < paidUntil,
            },
            persons,
        );
    });
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
        Scope: "category",
        IdCategory: 1,
        Category: aCategory(),
        IdPerson: null,
        Person: null,
        Spent: 0,
        ...overrides,
    };
}

/** Um teto de PESSOA: mesma tabela, mesma lista, `Scope` diferente — e
 *  os dois campos de categoria nulos. */
export function aPersonBudgetPeriod(
    overrides: Partial<ApiTypes.BudgetPeriod> = {},
): ApiTypes.BudgetPeriod {
    return aBudgetPeriod({
        Scope: "person",
        IdCategory: null,
        Category: null,
        IdPerson: 4,
        Person: {
            IdPerson: 4,
            IdWorkspace: 1,
            Name: "Maria",
            IdUser: null,
            Active: true,
            CreatedAt: NOW,
            UpdatedAt: NOW,
        },
        ...overrides,
    });
}
