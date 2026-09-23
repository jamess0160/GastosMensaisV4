import { Knex } from "knex"
import { Database } from "root/Utils/database"
import { class_Categories_model } from "root/routes/Categories/Categories.model"
import { CategoriesSeed } from "root/routes/Categories/Categories.seed"
import { class_Workspaces_model } from "../../Workspaces.model"
import { class_WorkspaceMembers_model } from "../../WorkspaceMembers.model"

//  Cria o workspace e já matricula o usuário nele.
//
//  Recebe a transaction em vez de abrir a sua: quem chama é o cadastro de usuário, e um
//  workspace sem linha em WorkspaceMembers é um tenant órfão — nenhuma leitura o enxerga,
//  porque getByMember filtra por matrícula. As duas escritas têm que cair ou passar juntas.
//
//  Com IdWorkspace, ele NÃO cria workspace nenhum: só matricula, que é o caso do aceite de
//  convite. O id, aí, vem sempre da linha do convite conferida no servidor — nunca do corpo da
//  requisição, que foi justamente o buraco que o convite fechou.
//
//  E por isso o Role é parâmetro e não 'owner' fixo: quem entra por convite entra com o papel
//  que o convite manda. 'owner' continua sendo o de quem cria o próprio workspace.
export class Create {

    private readonly Workspaces_model: class_Workspaces_model
    private readonly WorkspaceMembers_model: class_WorkspaceMembers_model
    private readonly Categories_model: class_Categories_model

    constructor(tx: Knex.Transaction) {
        this.Workspaces_model = new class_Workspaces_model(tx)
        this.WorkspaceMembers_model = new class_WorkspaceMembers_model(tx)
        this.Categories_model = new class_Categories_model(tx)
    }

    public async run(IdUser: number, Name: string, IdWorkspace?: number, Role: Database.WorkspaceMembers["Role"] = "owner") {
        if (!IdWorkspace) {
            IdWorkspace = await this.Workspaces_model.create({ Name, IdOwnerUser: IdUser }).returnId("IdWorkspace")

            await this.seedCategories(IdWorkspace)
        }

        await this.WorkspaceMembers_model.create({ IdWorkspace, IdUser, Role })

        return IdWorkspace
    }

    //  **As treze categorias com que o espaço nasce**, na mesma transaction — quem se acaba de
    //  cadastrar tem que ter com o que lançar o primeiro gasto, e antes da migration
    //  20260922140000 isso vinha das linhas globais, que eram as mesmas para todo mundo.
    //
    //  Dentro do `if`, e não depois dele: o ramo com IdWorkspace é o aceite de convite, que
    //  matricula alguém num espaço que já existe — semear ali daria treze cópias novas a cada
    //  pessoa que entrasse.
    private seedCategories(IdWorkspace: number) {
        return this.Categories_model.create(CategoriesSeed.map((category) => ({ ...category, IdWorkspace })))
    }
}
