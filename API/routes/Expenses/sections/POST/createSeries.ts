import { Knex } from "knex"
import { Database } from "root/Utils/database"
import { Utils } from "root/Utils/Utils"
import { CreateOne } from "./createOne"
import { ExpensesNamespace } from "../types"

//  A série de um gasto fixo: a raiz e as ocorrências geradas.
//
//  **Corrente de ocorrências reais, não molde + instâncias.** A raiz é o gasto deste mês e
//  carrega `RecurrenceDay`/`RecurrenceEndDate`; as seguintes apontam para ela pelo
//  `IdParentExpense` e são gastos de verdade, com pernas, rateio e tags próprios. Nenhum
//  relatório precisa filtrar linha-fantasma, e o `IdParentExpense` é a única coisa que permite
//  achar a série inteira a partir de qualquer ocorrência aberta na tela.
//
//  A janela é finita de propósito: gerar N meses à frente entrega o mês seguinte já visível na
//  consulta sem depender de agendador, e estender a série é uma edição, não uma rotina.
export class CreateSeries {

    //  Quantas ocorrências nascem de uma vez, contando a raiz.
    //
    //  Constante do servidor, e não campo do corpo: é regra de domínio, não escolha de quem
    //  lança — quem cria um gasto fixo quer "todo mês", não "doze". E não vai para o `.env`
    //  pelo mesmo motivo: não é configuração de servidor, é regra, e regra mora ao lado do
    //  código que a aplica.
    //
    //  O que limita a série é ESTA janela **ou** o RecurrenceEndDate, o que vier primeiro.
    private static readonly OCCURRENCE_WINDOW = 12

    private readonly CreateOne: CreateOne

    constructor(tx: Knex.Transaction) {
        this.CreateOne = new CreateOne(tx)
    }

    public async run(IdWorkspace: number, IdUser: number, body: ExpensesNamespace.CreateExpensePayload, options: CreateSeriesOptions) {
        let dates = this.buildOccurrenceDates(body)

        //  A raiz é a primeira ocorrência, não um molde.
        let IdExpense = await this.CreateOne.run(IdWorkspace, IdUser, body, {
            ...options,
            ExpenseDate: dates[0],
            recurrence: {
                RecurrenceDay: body.RecurrenceDay ?? this.dayOf(body.ExpenseDate),
                RecurrenceEndDate: body.RecurrenceEndDate ?? null,
            },
        })

        for (let ExpenseDate of dates.slice(1)) {
            await this.CreateOne.run(IdWorkspace, IdUser, body, {
                ...options,
                ExpenseDate,
                IdParentExpense: IdExpense,
                forceUnpaid: true,
            })
        }

        return { IdExpense, Occurrences: dates.length }
    }

    //  As datas: a da raiz, como veio, e as seguintes no dia da recorrência de cada mês. O dia é
    //  grampeado no fim do mês (Utils.setDayOfMonth), senão a recorrência do dia 31 sumiria em
    //  fevereiro.
    private buildOccurrenceDates(body: ExpensesNamespace.CreateExpensePayload) {
        let RecurrenceDay = body.RecurrenceDay ?? this.dayOf(body.ExpenseDate)

        let dates = [body.ExpenseDate]

        for (let index = 1; index < CreateSeries.OCCURRENCE_WINDOW; index++) {
            let date = Utils.setDayOfMonth(Utils.addMonthsToDate(body.ExpenseDate, index), RecurrenceDay)

            //  A série pode acabar antes da janela pedida.
            if (body.RecurrenceEndDate && date > body.RecurrenceEndDate) break

            dates.push(date)
        }

        return dates
    }

    private dayOf(date: string) {
        return Number(date.split("-")[2])
    }
}

export interface CreateSeriesOptions {
    methods: Map<number, Database.PaymentMethods>
    tags: number[]
}
