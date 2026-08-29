import { Persons_model } from "root/routes/Persons/Persons.model"
import { APIError } from "root/Utils/Logs"
import { Utils } from "root/Utils/Utils"
import { InflowsNamespace } from "./types"

//  O rateio da entrada: quem recebeu, em valor absoluto.
//
//  Três regras, e **nenhuma das três é garantida pelo banco**:
//
//  1. só existe em Kind='inflow' — ratear entre contas próprias uma transferência não diz nada;
//  2. as pessoas são deste workspace (o IdPerson chega do cliente e é sequencial);
//  3. a soma fecha exatamente com o TotalValue.
//
//  A terceira é a que silencia: um rateio que soma menos que o total não quebra nada na hora,
//  só faz todo relatório por pessoa mostrar menos dinheiro do que entrou de verdade.
class Controller {

    public async assertSplit(IdWorkspace: number, Kind: "inflow" | "transfer", TotalValue: number, split: InflowsNamespace.SplitPayload[]) {

        if (!split.length) return

        if (Kind === "transfer") {
            throw new APIError({
                msg: "Transferência entre contas próprias não tem rateio: o dinheiro não mudou de dono.",
                status: 406,
                data: { Kind },
            })
        }

        //  unique(IdInflow, IdPerson) no banco: a mesma pessoa duas vezes estouraria 23505 como
        //  500, e o cliente que quer dar dois valores à mesma pessoa quer somá-los numa linha.
        let ids = split.map((item) => item.IdPerson)

        if (new Set(ids).size !== ids.length) {
            throw new APIError({
                msg: "A mesma pessoa aparece duas vezes no rateio.",
                status: 406,
                data: { ids },
            })
        }

        await this.assertPersons(IdWorkspace, ids)

        //  Em centavos: 0.1 + 0.2 em ponto flutuante não dá 0.3, e este `===` é o invariante
        //  do modelo inteiro.
        let total = Utils.toCents(TotalValue)
        let sum = split.reduce((acc, item) => acc + Utils.toCents(item.Value), 0)

        if (sum !== total) {
            throw new APIError({
                msg: "A soma do rateio precisa fechar exatamente com o valor da entrada.",
                status: 406,
                data: { TotalValue, SplitTotal: sum / 100 },
            })
        }
    }

    private async assertPersons(IdWorkspace: number, ids: number[]) {
        let persons = await Persons_model.getByWorkspace(IdWorkspace).whereIn("IdPerson", ids)

        if (persons.length === ids.length) return

        let found = new Set(persons.map((person) => person.IdPerson))

        throw new APIError({
            //  Arquivada cai aqui junto com a de outro tenant e a inexistente: as três dão a
            //  mesma resposta, senão a mensagem contaria quais ids existem nos vizinhos.
            msg: "Pessoa do rateio não encontrada!",
            status: 406,
            data: { IdWorkspace, missing: ids.filter((id) => !found.has(id)) },
        })
    }
}

export const InflowSplit = new Controller()
