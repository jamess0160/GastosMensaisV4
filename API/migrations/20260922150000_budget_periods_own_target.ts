import type { Knex } from "knex";


// O ORCAMENTO DEIXA DE SER UM TETO PERENE E VIRA UMA REPARTICAO DA RENDA DO MES.
//
// O desenho anterior era definicao + instancia: "Budgets" guardava "mercado: 800
// por mes, para sempre" e uma rotina do dia 1o congelava esse numero no mes novo,
// em "BudgetPeriods". Tres coisas quebravam nisso, e as tres sao do modelo, nao
// da implementacao:
//
//   - O MES SEGUINTE NAO EXISTIA. Um periodo so nascia pela rotina, entao navegar
//     para outubro em setembro devolvia lista vazia. E nao era bug: materializar
//     na leitura congelaria o teto de HOJE num mes futuro, que e exatamente o que
//     a tabela do mes existe para impedir. Sem a definicao perene nao ha o que
//     congelar - o mes e montado a mao, e qualquer mes pode ser montado.
//   - O ALVO ERA UM SO. O CHECK de "Budgets" impunha o xor (categoria OU pessoa),
//     e nao havia como dizer "250 para o Tiago EM ALIMENTACAO".
//   - NADA LIGAVA O ORCAMENTO A RENDA. Os tetos eram numeros soltos: dava para
//     orcar 4.000 com uma renda de 1.000 e nada avisava.
//
// Dai o CHECK INVERTIDO desta migration - "pelo menos um", no lugar de
// "exatamente um" -, e dai "Budgets" morrer: a definicao perene era o que amarrava
// o modelo ao "para sempre", e com o mes montado a mao ela nao tem mais o que
// guardar. O que ela carregava (o alvo, o teto vigente) passa a viver na linha do
// mes, que e a unica coisa que o usuario de fato escreve.
//
// TRES INDICES PARCIAIS E NAO UMA UNIQUE SOBRE AS QUATRO COLUNAS. NULL nao
// conflita com NULL num indice unico do Postgres, entao uma unique
// (IdWorkspace, ReferenceMonth, IdCategory, IdPerson) deixaria passar duas linhas
// "(sem pessoa, Mercado)" - as duas com IdPerson nulo, que o indice trata como
// valores distintos. Cada indice abaixo enxerga so as linhas do seu formato, e
// dentro delas nao ha NULL nenhum nas colunas que ele indexa. E o mesmo recurso
// que a migration 20260905110000 usou em "Budgets", pelo mesmo motivo.
//
// O QUE ESTA MIGRATION NAO FAZ: ela nao toca em gasto, perna nem rateio. O
// "Spent" continua sendo calculado a cada leitura a partir de ExpensePayments -
// nao ha coluna de gasto aqui, e nunca houve.
export async function up(knex: Knex): Promise<void> {

    // 1. AS COLUNAS DE ALVO, as duas anulaveis. CASCADE nas duas como era em
    //    "Budgets": arquivar alvo e Active=false, que preserva a linha do mes;
    //    delete de verdade leva o plano junto, como deve.
    await knex.schema.alterTable("BudgetPeriods", (table) => {
        table.integer("IdCategory").nullable()
        table.integer("IdPerson").nullable()

        table.foreign("IdCategory").references("IdCategory").inTable("Categories").onDelete("CASCADE")
        table.foreign("IdPerson").references("IdPerson").inTable("Persons").onDelete("CASCADE")
    })

    // 2. O BACKFILL: cada periodo recebe o alvo da definicao mae dele. E um UPDATE
    //    ... FROM e nao um laco em JS porque a relacao e 1:1 pelo IdBudget, que e
    //    NOT NULL com FK - nao existe periodo orfao para o laco tratar.
    await knex.raw(`
        UPDATE "BudgetPeriods"
        SET "IdCategory" = "Budgets"."IdCategory",
            "IdPerson"   = "Budgets"."IdPerson",
            "UpdatedAt"  = now()
        FROM "Budgets"
        WHERE "Budgets"."IdBudget" = "BudgetPeriods"."IdBudget"
    `)

    // 3. A COLISAO. Depois do backfill, duas linhas do mesmo mes podem cair no
    //    mesmo alvo - e entao os indices do passo 5 nao entram e a migration morre
    //    com um 23505 no meio do deploy.
    //
    //    Pelo esquema de hoje isso NAO deveria acontecer: "Budgets" tem indice
    //    parcial unico por (IdWorkspace, IdCategory) e por (IdWorkspace, IdPerson),
    //    e "BudgetPeriods" tem unique(IdBudget, ReferenceMonth) - duas definicoes
    //    do mesmo alvo no mesmo workspace nao existem, logo dois periodos do mesmo
    //    alvo no mesmo mes tambem nao. MAS o IdWorkspace do periodo e uma copia
    //    denormalizada do da definicao, e e por ele que os indices novos passam a
    //    contar: basta um periodo gravado com o workspace divergente - por uma
    //    escrita manual, por um restore parcial - para a colisao ser real. Uma
    //    migration que so funciona se o dado estiver perfeito nao tem conserto as
    //    3 da manha.
    //
    //    QUEM FICA E O MAIOR IdBudgetPeriod, ou seja, o escrito por ultimo. Nao o
    //    maior teto (premiar a generosidade e inventar numero que ninguem digitou)
    //    e nao a soma dos dois (idem): o periodo e PLANO, nao lancamento - nenhum
    //    dinheiro passou por ele, nada aponta para ele, e o delete dele ja e fisico
    //    no app pelo mesmo motivo. "O ultimo que o usuario disse sobre aquele alvo
    //    naquele mes" e o mesmo criterio que o resto do app usa para correcao.
    await knex.raw(`
        DELETE FROM "BudgetPeriods" AS older
        USING "BudgetPeriods" AS newer
        WHERE older."IdWorkspace" = newer."IdWorkspace"
          AND older."ReferenceMonth" = newer."ReferenceMonth"
          AND older."IdCategory" IS NOT DISTINCT FROM newer."IdCategory"
          AND older."IdPerson" IS NOT DISTINCT FROM newer."IdPerson"
          AND older."IdBudgetPeriod" < newer."IdBudgetPeriod"
    `)

    // 4. O CHECK INVERTIDO: pelo menos um alvo, possivelmente os dois. E o
    //    oposto do "Budgets_target_check", que era um xor - e e exatamente o que a
    //    linha "Tiago em Alimentacao" precisa. O que continua proibido e a linha
    //    sem alvo nenhum: um teto que nao diz do que e nao soma contra nada.
    await knex.raw(`
        ALTER TABLE "BudgetPeriods"
        ADD CONSTRAINT "BudgetPeriods_target_check"
        CHECK ("IdCategory" IS NOT NULL OR "IdPerson" IS NOT NULL)
    `)

    // 5. OS TRES INDICES, um por formato de alvo. Ver o cabecalho: sao tres porque
    //    NULL nao conflita com NULL. Cada um exige a ausencia do outro alvo no seu
    //    predicado, entao uma linha entra em exatamente um deles.
    await knex.raw(`
        CREATE UNIQUE INDEX "BudgetPeriods_month_category_unique"
        ON "BudgetPeriods" ("IdWorkspace", "ReferenceMonth", "IdCategory")
        WHERE "IdCategory" IS NOT NULL AND "IdPerson" IS NULL
    `)

    await knex.raw(`
        CREATE UNIQUE INDEX "BudgetPeriods_month_person_unique"
        ON "BudgetPeriods" ("IdWorkspace", "ReferenceMonth", "IdPerson")
        WHERE "IdPerson" IS NOT NULL AND "IdCategory" IS NULL
    `)

    await knex.raw(`
        CREATE UNIQUE INDEX "BudgetPeriods_month_person_category_unique"
        ON "BudgetPeriods" ("IdWorkspace", "ReferenceMonth", "IdPerson", "IdCategory")
        WHERE "IdPerson" IS NOT NULL AND "IdCategory" IS NOT NULL
    `)

    // 6. O IdBudget sai, e com ele a unique(IdBudget, ReferenceMonth) que os tres
    //    indices acima substituem.
    await knex.schema.alterTable("BudgetPeriods", (table) => {
        table.dropUnique(["IdBudget", "ReferenceMonth"])
        table.dropForeign(["IdBudget"])
        table.dropColumn("IdBudget")
    })

    // 7. E a tabela morre - DEPOIS do backfill, na mesma transaction que ele (o
    //    migrate do knex envolve cada migration numa). Na ordem inversa o alvo
    //    de cada periodo seria perdido sem conserto.
    await knex.schema.dropTable("Budgets")
}


// A VOLTA REFAZ "Budgets" A PARTIR DOS PERIODOS.
//
// A definicao vigente de um alvo vira o teto do MES MAIS RECENTE que ele tem -
// que e o que "vigente" queria dizer: o ultimo valor que o usuario escreveu para
// aquele alvo. Os meses anteriores ficam como estao, congelados, que e o
// comportamento que o esquema antigo prometia.
//
// AS LINHAS DE ALVO DUPLO (pessoa E categoria) SAO APAGADAS, e nao ha alternativa:
// o CHECK antigo e um xor, e essas linhas nao tem para onde ir. E a mesma perda
// que o down da 20260905110000 assume, pela mesma razao - e perda de PLANO, nao de
// lancamento: nenhum dinheiro passou por um periodo de orcamento.
export async function down(knex: Knex): Promise<void> {

    await knex("BudgetPeriods").whereNotNull("IdCategory").whereNotNull("IdPerson").delete()

    await knex.raw(`DROP INDEX "BudgetPeriods_month_person_category_unique"`)
    await knex.raw(`DROP INDEX "BudgetPeriods_month_person_unique"`)
    await knex.raw(`DROP INDEX "BudgetPeriods_month_category_unique"`)
    await knex.raw(`ALTER TABLE "BudgetPeriods" DROP CONSTRAINT "BudgetPeriods_target_check"`)

    // "Budgets" volta exatamente como estava depois da 20260905110000: o xor, os
    // dois indices parciais, o Active e o IdUser autor.
    await knex.schema.createTable("Budgets", (table) => {
        table.increments("IdBudget").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdUser").nullable()
        table.integer("IdCategory").nullable()
        table.integer("IdPerson").nullable()
        table.decimal("LimitValue", 15, 2).notNullable()
        table.smallint("AlertPercent").notNullable().defaultTo(80)
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("SET NULL")
        table.foreign("IdCategory").references("IdCategory").inTable("Categories").onDelete("CASCADE")
        table.foreign("IdPerson").references("IdPerson").inTable("Persons").onDelete("CASCADE")

        table.index(["IdWorkspace"])
    })

    await knex.raw(`
        ALTER TABLE "Budgets"
        ADD CONSTRAINT "Budgets_target_check"
        CHECK (("IdCategory" IS NOT NULL) <> ("IdPerson" IS NOT NULL))
    `)

    await knex.raw(`
        CREATE UNIQUE INDEX "Budgets_workspace_category_unique"
        ON "Budgets" ("IdWorkspace", "IdCategory") WHERE "IdCategory" IS NOT NULL
    `)

    await knex.raw(`
        CREATE UNIQUE INDEX "Budgets_workspace_person_unique"
        ON "Budgets" ("IdWorkspace", "IdPerson") WHERE "IdPerson" IS NOT NULL
    `)

    await knex.schema.alterTable("BudgetPeriods", (table) => {
        table.integer("IdBudget").nullable()
    })

    // Uma definicao por (workspace, alvo). A ordem por ReferenceMonth e o que faz
    // o ultimo mes ganhar: o Map sobrescreve, entao o que sobra no fim do laco e o
    // teto mais recente daquele alvo.
    let periods = await knex("BudgetPeriods")
        .select("IdWorkspace", "IdCategory", "IdPerson", "LimitValue", "AlertPercent")
        .orderBy("ReferenceMonth") as PeriodRow[]

    let definitions = new Map<string, PeriodRow>()

    for (let period of periods) {
        definitions.set(`${period.IdWorkspace}|${period.IdCategory ?? ""}|${period.IdPerson ?? ""}`, period)
    }

    for (let definition of definitions.values()) {
        let [budget] = await knex("Budgets")
            .insert({
                IdWorkspace: definition.IdWorkspace,
                IdCategory: definition.IdCategory,
                IdPerson: definition.IdPerson,
                LimitValue: definition.LimitValue,
                AlertPercent: definition.AlertPercent,
            })
            .returning("IdBudget") as InsertedId[]

        // whereNull e nao where(coluna, null): em SQL "= NULL" nunca casa, e o
        // alvo ausente e justamente o que distingue uma definicao da outra.
        let query = knex("BudgetPeriods").where("IdWorkspace", definition.IdWorkspace)

        if (definition.IdCategory === null) {
            query.whereNull("IdCategory")
        } else {
            query.where("IdCategory", definition.IdCategory)
        }

        if (definition.IdPerson === null) {
            query.whereNull("IdPerson")
        } else {
            query.where("IdPerson", definition.IdPerson)
        }

        await query.update({ IdBudget: budget.IdBudget })
    }

    await knex.schema.alterTable("BudgetPeriods", (table) => {
        table.integer("IdBudget").notNullable().alter()
    })

    await knex.schema.alterTable("BudgetPeriods", (table) => {
        table.foreign("IdBudget").references("IdBudget").inTable("Budgets").onDelete("CASCADE")
        table.unique(["IdBudget", "ReferenceMonth"])

        table.dropForeign(["IdCategory"])
        table.dropForeign(["IdPerson"])
        table.dropColumn("IdCategory")
        table.dropColumn("IdPerson")
    })
}


interface PeriodRow {
    IdWorkspace: number
    IdCategory: number | null
    IdPerson: number | null
    LimitValue: number
    AlertPercent: number
}

interface InsertedId {
    IdBudget: number
}
