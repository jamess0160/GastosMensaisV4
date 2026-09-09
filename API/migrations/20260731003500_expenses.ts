import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    // Substitui baseexpenses + defaultexpenses + fixedexpenses + installmentexpenses do V3.
    //
    // Sem Active: o ciclo de vida e Status, e desativar um gasto e Status='canceled'.
    // Status e DERIVADO das pernas de ExpensePayments, nunca editado direto:
    // 'paid' so quando TODAS as pernas estao pagas, 'pending' ate la. Nao existe
    // estado parcial no gasto - as pernas e que sabem o que ja foi quitado.
    //
    // Gasto fixo e uma CORRENTE de ocorrencias, nao um molde + instancias: toda
    // linha aqui e um gasto real. A raiz da serie tem IdParentExpense nulo e
    // carrega RecurrenceDay/RecurrenceEndDate; as ocorrencias geradas apontam
    // para ela. Assim nenhum relatorio precisa filtrar linha-fantasma.
    await knex.schema.createTable("Expenses", (table) => {
        table.increments("IdExpense").primary()
        table.integer("IdWorkspace").notNullable()
        /** Quem registrou o lancamento no app. */
        table.integer("IdUser").nullable()
        table.string("Description", 255).notNullable()
        table.decimal("TotalValue", 15, 2).notNullable()
        table.enu("Status", ["pending", "paid", "canceled"]).notNullable().defaultTo("pending")
        table.integer("IdCategory").nullable()
        table.date("ExpenseDate").notNullable()
        table.enu("Kind", ["single", "installment", "fixed"]).notNullable().defaultTo("single")
        table.integer("IdParentExpense").nullable()
        /** Dia do mes da recorrencia. So na raiz de uma serie Kind='fixed'. */
        table.smallint("RecurrenceDay").nullable()
        /** Nulo = serie sem fim. So na raiz. */
        table.date("RecurrenceEndDate").nullable()
        table.text("Notes").nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("SET NULL")
        table.foreign("IdCategory").references("IdCategory").inTable("Categories").onDelete("SET NULL")
        table.foreign("IdParentExpense").references("IdExpense").inTable("Expenses").onDelete("SET NULL")

        table.index(["IdWorkspace"])
        table.index(["IdWorkspace", "ExpenseDate"])
        table.index(["IdWorkspace", "Status"])
        table.index(["IdWorkspace", "IdCategory"])
        table.index(["IdParentExpense"])
    })

    await knex.raw(`
        ALTER TABLE "Expenses"
        ADD CONSTRAINT "Expenses_total_positive_check"
        CHECK ("TotalValue" > 0)
    `)

    // EIXO FINANCEIRO: e o que move saldo. Uma linha por forma de pagamento, com
    // valor proprio - atende o rateio entre formas de pagamento. A soma das pernas
    // tem que fechar com Expenses.TotalValue (validado no model).
    //
    // Absorve o parcelamento: 600 em 6x sao 6 linhas de 100, cada uma com sua
    // ClosingDate/DueDate. Melhor que o CurrentInstallment/MaxInstallment numa
    // linha so do V3, porque deixa ver o comprometimento futuro mes a mes.
    //
    // ClosingDate/DueDate saem do DueDay/ClosingOffsetDays da PaymentMethods quando
    // Kind='credit_card'; em pix e debito ficam nulas.
    await knex.schema.createTable("ExpensePayments", (table) => {
        table.increments("IdExpensePayment").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdExpense").notNullable()
        table.integer("IdPaymentMethod").notNullable()
        table.decimal("Value", 15, 2).notNullable()
        table.integer("InstallmentNumber").nullable()
        table.integer("InstallmentTotal").nullable()
        /** Fechamento da fatura em que esta perna caiu. */
        table.date("ClosingDate").nullable()
        table.date("DueDate").nullable()
        table.boolean("Paid").notNullable().defaultTo(false)
        table.datetime("PaidAt").nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdExpense").references("IdExpense").inTable("Expenses").onDelete("CASCADE")
        table.foreign("IdPaymentMethod").references("IdPaymentMethod").inTable("PaymentMethods").onDelete("RESTRICT")

        table.index(["IdExpense"])
        table.index(["IdWorkspace", "IdPaymentMethod", "Paid"])
        table.index(["IdWorkspace", "DueDate"])
    })

    await knex.raw(`
        ALTER TABLE "ExpensePayments"
        ADD CONSTRAINT "ExpensePayments_value_positive_check"
        CHECK ("Value" > 0)
    `)

    // Parcela e tudo ou nada, e 3/6 existe mas 7/6 nao.
    await knex.raw(`
        ALTER TABLE "ExpensePayments"
        ADD CONSTRAINT "ExpensePayments_installment_check"
        CHECK (
            ("InstallmentNumber" IS NULL AND "InstallmentTotal" IS NULL)
         OR ("InstallmentNumber" IS NOT NULL AND "InstallmentTotal" IS NOT NULL
             AND "InstallmentNumber" >= 1 AND "InstallmentNumber" <= "InstallmentTotal")
        )
    `)

    // EIXO ANALITICO: quem gastou. Rateio entre Persons, por valor absoluto.
    // Nao move saldo. Espelha a InflowPersons. Independente do eixo financeiro:
    // 2 formas de pagamento e 2 pessoas geram 2 + 2 linhas, nunca 4.
    await knex.schema.createTable("ExpensePersons", (table) => {
        table.increments("IdExpensePerson").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdExpense").notNullable()
        table.integer("IdPerson").notNullable()
        table.decimal("Value", 15, 2).notNullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdExpense").references("IdExpense").inTable("Expenses").onDelete("CASCADE")
        table.foreign("IdPerson").references("IdPerson").inTable("Persons").onDelete("RESTRICT")

        table.unique(["IdExpense", "IdPerson"])
        table.index(["IdPerson"])
    })

    await knex.raw(`
        ALTER TABLE "ExpensePersons"
        ADD CONSTRAINT "ExpensePersons_value_positive_check"
        CHECK ("Value" > 0)
    `)
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("ExpensePersons")
    await knex.schema.dropTable("ExpensePayments")
    await knex.schema.dropTable("Expenses")
}
