import { Knex } from "knex"
import { APIError } from "root/Utils/Logs"
import { class_Tags_model } from "../../Tags.model"

//  Transforma o **texto** que o usuário digitou nos ids das tags, criando o que ainda não
//  existe. É a única porta de entrada de uma tag nova no sistema.
//
//  Por que por texto e não por id: a tag não tem cadastro próprio. Quem lança o gasto digita
//  "Viagem Chile" no input, escolhe uma sugestão ou não, e a tag passa a existir junto com o
//  gasto. Exigir um POST antes obrigaria o front a cadastrar para depois usar — dois passos
//  para uma etiqueta.
//
//  Recebe a transaction, como o CreateDefaults das formas de pagamento: se o gasto falhar
//  depois daqui, as tags criadas não podem sobrar.
export class ResolveByName {

    private readonly Tags_model: class_Tags_model

    constructor(tx: Knex.Transaction) {
        this.Tags_model = new class_Tags_model(tx)
    }

    public async run(IdWorkspace: number, IdUser: number, names: string[]) {
        if (!names.length) return []

        let unique = this.dedupe(names)

        //  Enxerga a arquivada de propósito: o índice unique(IdWorkspace, Name) não conhece o
        //  Active, então inserir "Viagem" de novo estouraria 23505 como 500.
        let existing = await this.Tags_model.getByNamesIncludingInactive(IdWorkspace, unique)

        let byName = new Map(existing.map((tag) => [tag.Name.toLowerCase(), tag]))

        //  Marcar de novo com o nome de uma tag arquivada a traz de volta. É o que faz sentido
        //  para quem digitou: ele não está criando outra coisa, está usando a mesma etiqueta —
        //  e é também o único caminho de volta, já que não existe rota de restaurar.
        let archived = existing.filter((tag) => !tag.Active).map((tag) => tag.IdTag)

        if (archived.length) await this.Tags_model.restore(archived)

        let missing = unique.filter((name) => !byName.has(name.toLowerCase()))

        if (missing.length) {
            //  IdUser é a autoria: quem usou a tag primeiro. O dono do dado é o workspace.
            await this.Tags_model.create(missing.map((Name) => ({ Name, IdWorkspace, IdUser })))

            //  Relê em vez de usar `returning`: o returnId do projeto só vale para inserção de
            //  uma linha, e o `returning` cru é do Postgres — esta consulta a mais mantém o
            //  model agnóstico ao DB_CLIENT, como o resto.
            for (let tag of await this.Tags_model.getByNamesIncludingInactive(IdWorkspace, missing)) {
                byName.set(tag.Name.toLowerCase(), tag)
            }
        }

        return unique.map((name) => byName.get(name.toLowerCase())!.IdTag)
    }

    //  "Viagem" e "viagem" no mesmo gasto são a mesma etiqueta digitada duas vezes, não duas
    //  tags — e o unique(IdExpense, IdTag) do vínculo estouraria se as duas virassem o mesmo id.
    private dedupe(names: string[]) {
        let seen = new Map<string, string>()

        for (let name of names) {
            let trimmed = name.trim()

            if (!trimmed) {
                throw new APIError({
                    msg: "Tag sem nome.",
                    status: 406,
                    data: { names },
                })
            }

            if (!seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed)
        }

        return Array.from(seen.values())
    }
}
