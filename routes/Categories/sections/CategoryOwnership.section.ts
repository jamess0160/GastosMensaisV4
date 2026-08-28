import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"

//  A trava da etapa: **categoria global é somente leitura.**
//
//  IdWorkspace nulo é a pré-definida do sistema, e ela é a mesma linha para todos os
//  workspaces. Sem esta checagem, um PUT com o id de "Alimentação" renomeia a categoria de
//  todos os usuários da base, e um DELETE a arquiva para todos — a falha mais séria possível
//  aqui, e a que nenhum teste feliz encontra, porque o caminho normal só mexe nas próprias.
//
//  Section própria porque são dois pontos de escrita (PUT e DELETE) e a regra é uma só. A
//  leitura não passa por aqui: ver a global é justamente o ponto dela existir.
class Controller {

    public assertEditable(category: Database.Categories) {

        if (category.IdWorkspace === null) {
            throw new APIError({
                //  Mensagem própria em vez de "não encontrada": a categoria existe e o cliente
                //  a enxerga na lista. O conserto é criar uma categoria própria, não pedir
                //  acesso nem tentar outro id.
                msg: "Categoria pré-definida do sistema: não pode ser editada nem arquivada.",
                status: 406,
                data: { IdCategory: category.IdCategory },
            })
        }
    }
}

export const CategoryOwnership = new Controller()
