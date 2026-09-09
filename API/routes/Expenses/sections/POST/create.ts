import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { ResolveByName } from "root/routes/Tags/sections/POST/resolveByName"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { ExpenseAxes } from "../ExpenseAxes.section"
import { ExpenseCategory } from "../ExpenseCategory.section"
import { CreateOne } from "./createOne"
import { CreateSeries } from "./createSeries"
import { ExpensesNamespace } from "../types"

//  Cria o gasto nos três formatos:
//
//      'single'      -> um gasto, uma perna por forma de pagamento
//      'installment' -> um gasto, N pernas — 600 em 6x são 6 linhas de 100, cada uma com o seu
//                       vencimento. O TotalValue continua sendo o total da compra.
//      'fixed'       -> uma corrente de ocorrências reais (ver createSeries.ts)
//
//  Esta section é o orquestrador: confere tudo, abre a transaction e delega a escrita. As
//  conferências vêm todas **antes** da transaction, para o caminho de erro não segurar conexão.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: ExpensesNamespace.CreateExpensePayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        await ExpenseCategory.assertCategory(IdWorkspace, body.IdCategory)

        //  Os dois eixos, cada um fechando com o total por conta própria — 2 formas de
        //  pagamento e 2 pessoas dão 2 + 2 linhas, nunca 4.
        let methods = await ExpenseAxes.assertPayments(IdWorkspace, body.TotalValue, body.Payments)
        await ExpenseAxes.assertPersons(IdWorkspace, body.TotalValue, body.Persons)

        this.assertKindRules(body)

        //  O sinal e o formato: estorno é sempre avulso.
        ExpenseAxes.assertSignAllowedForKind(body.Kind, body.TotalValue)

        return await KnexTransaction(async (tx) => {
            //  As tags chegam como texto e viram linhas aqui dentro, uma vez só: a série
            //  inteira compartilha os mesmos ids, e uma tag criada não pode sobreviver a um
            //  gasto que falhou.
            let tags = await new ResolveByName(tx).run(IdWorkspace, IdUser, body.Tags)

            if (body.Kind === "fixed") {
                return await new CreateSeries(tx).run(IdWorkspace, IdUser, body, { methods, tags })
            }

            let IdExpense = await new CreateOne(tx).run(IdWorkspace, IdUser, body, { ExpenseDate: body.ExpenseDate, methods, tags })

            return { IdExpense, Occurrences: 1 }
        })
    }

    //  A regra que o Joi não alcança porque depende de mais de um campo ao mesmo tempo.
    //
    //  **Parcelar e repetir valem em qualquer forma de pagamento** — carnê, crediário e o racha
    //  com um amigo caem em pix ou débito, e continuam sendo parcela mensal. O que não muda é
    //  serem sobre **uma** forma de pagamento: com duas, não haveria como dizer qual parcela
    //  saiu de onde sem inventar um segundo eixo dentro do eixo financeiro.
    private assertKindRules(body: ExpensesNamespace.CreateExpensePayload) {

        if (body.Kind === "single" || body.Payments.length === 1) return

        throw new APIError({
            msg: body.Kind === "installment"
                ? "Compra parcelada usa uma forma de pagamento só."
                : "Gasto fixo usa uma forma de pagamento só.",
            status: 406,
            data: { Kind: body.Kind, Payments: body.Payments.length },
        })
    }
}
