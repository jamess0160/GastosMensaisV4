import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { ReportsNamespace } from "./types"

//  **As linhas que a planilha imprime.** Duas consultas, uma por aba, e nenhuma regra nova:
//  são as mesmas listagens que `GET /Inflows` e `GET /ExpensePayments` já devolvem, com os
//  nomes resolvidos por junção — a planilha é lida por gente, e um `IdCategory` numa célula não
//  diz nada a ninguém.
//
//  **A aba de gastos lista PERNAS, não gastos**, pelo mesmo motivo de todo o resto do projeto:
//  600 em 6x são seis linhas de 100, cada uma no mês em que pesa. Uma planilha por compra
//  jogaria 600 no mês da compra e não bateria com nenhum número da tela.
//
//  **O período recorta pela competência** (`CompetenceDate` nos dois lados), que é a data das
//  listagens de movimento — e é `From`/`To`, não `ReferenceMonth`: exportar é recortar, e um
//  recorte de exportação não precisa ser um mês civil.
//
//  Cancelado fica de fora, como nas listagens sem filtro de status: ele é lixo, não histórico.
class Controller {

    public getInflows(IdWorkspace: number, From?: string, To?: string) {
        let query = KnexConnection
            .select(
                "Inflows.IdInflow",
                "Inflows.Description",
                "Inflows.Kind",
                "Inflows.TotalValue",
                "Inflows.Status",
                "Inflows.CompetenceDate",
                "Inflows.ExpectedDate",
                { FromAccountName: "FromAccount.Name" },
                { ToAccountName: "ToAccount.Name" },
            )
            .from("Inflows")
            //  left join nos dois lados: a entrada de fora não tem conta de origem
            .leftJoin("Accounts as FromAccount", "FromAccount.IdAccount", "Inflows.IdFromAccount")
            .leftJoin("Accounts as ToAccount", "ToAccount.IdAccount", "Inflows.IdToAccount")
            .where("Inflows.IdWorkspace", IdWorkspace)
            .whereNot("Inflows.Status", "canceled")
            .orderBy("Inflows.CompetenceDate")
            .orderBy("Inflows.IdInflow")

        if (From) query = query.where("Inflows.CompetenceDate", ">=", From)
        if (To) query = query.where("Inflows.CompetenceDate", "<=", To)

        return query as unknown as Promise<ReportsNamespace.ExportInflowRow[]>
    }

    public getPayments(IdWorkspace: number, From?: string, To?: string) {
        let query = KnexConnection
            .select(
                "ExpensePayments.IdExpensePayment",
                "ExpensePayments.IdExpense",
                "ExpensePayments.Value",
                "ExpensePayments.CompetenceDate",
                "ExpensePayments.CashDate",
                "ExpensePayments.DueDate",
                "ExpensePayments.InstallmentNumber",
                "ExpensePayments.InstallmentTotal",
                "ExpensePayments.Paid",
                "Expenses.Description",
                "Expenses.ExpenseDate",
                { ExpenseStatus: "Expenses.Status" },
                { CategoryName: "Categories.Description" },
                { PaymentMethodName: "PaymentMethods.Name" },
                { AccountName: "Accounts.Name" },
            )
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            //  left join: a categoria é obrigatória hoje, mas a coluna é anulável e uma
            //  planilha não é lugar de descobrir isso com uma linha faltando
            .leftJoin("Categories", "Categories.IdCategory", "Expenses.IdCategory")
            .innerJoin("PaymentMethods", "PaymentMethods.IdPaymentMethod", "ExpensePayments.IdPaymentMethod")
            .innerJoin("Accounts", "Accounts.IdAccount", "PaymentMethods.IdAccount")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .whereNot("Expenses.Status", "canceled")
            .orderBy("ExpensePayments.CompetenceDate")
            .orderBy("ExpensePayments.IdExpensePayment")

        if (From) query = query.where("ExpensePayments.CompetenceDate", ">=", From)
        if (To) query = query.where("ExpensePayments.CompetenceDate", "<=", To)

        return query as unknown as Promise<ReportsNamespace.ExportPaymentRow[]>
    }
}

export const ExportRows = new Controller()
