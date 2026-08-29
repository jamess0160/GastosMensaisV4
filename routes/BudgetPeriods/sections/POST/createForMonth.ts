import { Knex } from "knex"
import { APIError } from "root/Utils/Logs"
import { class_BudgetPeriods_model } from "../../BudgetPeriods.model"

//  O mês congelado de um orçamento.
//
//  Recebe a transaction, como o CreateDefaults das formas de pagamento: quem chama é o cadastro
//  do orçamento, e uma definição sem o mês dela seria um teto que não aparece em tela nenhuma.
//
//  **É esta escrita que a rotina mensal vai passar a fazer sozinha** (etapa 8b): hoje ela roda
//  com o mês que o usuário informou; amanhã, com o mês corrente, a partir de `Budgets`.
export class CreateForMonth {

    private readonly BudgetPeriods_model: class_BudgetPeriods_model

    constructor(tx: Knex.Transaction) {
        this.BudgetPeriods_model = new class_BudgetPeriods_model(tx)
    }

    public async run(IdWorkspace: number, IdBudget: number, ReferenceMonth: string, LimitValue: number, AlertPercent: number) {
        //  unique(IdBudget, ReferenceMonth) já barraria, mas com 500. E a resposta importa: o
        //  conserto é editar o mês que já existe, não cadastrar de novo.
        let existing = await this.BudgetPeriods_model.getByBudgetAndMonth(IdBudget, ReferenceMonth)

        if (existing) {
            throw new APIError({
                msg: "Esta categoria já tem orçamento neste mês.",
                status: 406,
                data: { IdBudgetPeriod: existing.IdBudgetPeriod, ReferenceMonth },
            })
        }

        //  Status nasce 'open' e nada o fecha ainda: fechar o mês é trabalho da rotina, que
        //  ainda não existe. Sem rota que aceite 'closed', o valor não tem como divergir.
        return await this.BudgetPeriods_model.create({
            IdWorkspace,
            IdBudget,
            ReferenceMonth,
            LimitValue,
            AlertPercent,
        }).returnId("IdBudgetPeriod")
    }
}
