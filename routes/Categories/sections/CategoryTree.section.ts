import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { Categories_model } from "../Categories.model"

//  As duas perguntas de árvore, nos dois sentidos do mesmo caminhamento:
//
//  - subindo: o pai proposto é alcançável a partir do filho? Se for, a ligação fecha um ciclo
//    e a árvore deixa de ter raiz — o buildTree devolveria a lista sem o ramo inteiro, e ele
//    sumiria da tela continuando lançável por id.
//  - descendo: quem são os descendentes? É o que o arquivamento precisa saber.
//
//  As duas carregam a lista visível inteira e caminham em memória, em vez de uma consulta
//  recursiva por nível: são poucas dezenas de linhas por workspace, e é uma consulta só.
class Controller {

    //  Confere o pai proposto e devolve a linha dele. O id que a section usa daí em diante é o
    //  que volta daqui: veio do banco, dentro do escopo do workspace.
    public async assertParent(IdWorkspace: number, IdParentCategory: number, IdCategory?: number) {
        let byId = await this.getVisibleById(IdWorkspace)

        let parent = byId.get(IdParentCategory)

        //  Fora da lista visível é: de outro workspace, arquivada, ou inexistente. As três dão
        //  a mesma resposta — dizer qual delas é confirmaria que o id existe em outro tenant.
        if (!parent) {
            throw new APIError({
                msg: "Categoria pai não encontrada!",
                status: 406,
                data: { IdWorkspace, IdParentCategory },
            })
        }

        if (IdCategory) this.assertNoCycle(byId, parent, IdCategory)

        return parent
    }

    //  A categoria e os descendentes dela, para arquivar a subárvore de uma vez.
    //
    //  Sem isso a filha ficaria ativa com o pai arquivado: o buildTree monta a árvore pelo
    //  IdParentCategory e um nó cujo pai não está na lista não é devolvido, então a filha
    //  desapareceria da tela sem estar arquivada — e continuaria aceita como categoria de um
    //  gasto novo, porque o POST só confere se o id está visível.
    public async getBranch(IdWorkspace: number, IdCategory: number) {
        let visible = await Categories_model.getByWorkspace(IdWorkspace)

        //  Só as do workspace: a global não é filha de ninguém daqui, e se um dia virar por
        //  dado ruim, este filtro é o que impede um DELETE de arquivar a categoria de todos.
        let own = visible.filter((category) => category.IdWorkspace === IdWorkspace)

        let branch = [IdCategory]

        //  Percorre a fila, não recursivo: a profundidade não é limitada em lugar nenhum.
        for (let index = 0; index < branch.length; index++) {
            for (let category of own) {
                if (category.IdParentCategory === branch[index] && !branch.includes(category.IdCategory)) {
                    branch.push(category.IdCategory)
                }
            }
        }

        return branch
    }

    //  Sobe do pai proposto até a raiz. Achar a própria categoria no caminho significa que ela
    //  seria a própria avó — inclui o caso mais simples, o de virar pai de si mesma.
    private assertNoCycle(byId: Map<number, Database.Categories>, parent: Database.Categories, IdCategory: number) {
        let seen = new Set<number>()
        let current: Database.Categories | undefined = parent

        while (current) {
            if (current.IdCategory === IdCategory) {
                throw new APIError({
                    msg: "Uma categoria não pode ficar dentro de si mesma.",
                    status: 406,
                    data: { IdCategory, IdParentCategory: parent.IdCategory },
                })
            }

            //  Rede contra ciclo que já esteja gravado: sem ela um dado ruim trava a
            //  requisição em laço infinito em vez de responder.
            if (seen.has(current.IdCategory)) break

            seen.add(current.IdCategory)

            current = current.IdParentCategory ? byId.get(current.IdParentCategory) : undefined
        }
    }

    private async getVisibleById(IdWorkspace: number) {
        let visible = await Categories_model.getByWorkspace(IdWorkspace)

        return new Map(visible.map((category) => [category.IdCategory, category]))
    }
}

export const CategoryTree = new Controller()
