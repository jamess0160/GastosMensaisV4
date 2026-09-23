import { Categories_model } from "root/routes/Categories/Categories.model"
import { APIError } from "root/Utils/Logs"

//  A categoria do gasto — **uma só, e obrigatória**.
//
//  Obrigatória porque é ela que responde "com o que eu gasto", que é a pergunta do app: gasto
//  sem categoria vira uma linha que nenhum relatório soma e que ninguém volta para arrumar. A
//  coluna continua nullable no banco porque o `ON DELETE SET NULL` da FK pode zerá-la, mas
//  nenhuma rota aceita gasto sem categoria.
//
//  O id chega do cliente e é sequencial, então tem que ser uma categoria DESTE workspace — não
//  há mais a global que todo espaço enxergava. As tags são o outro lado da moeda e não passam
//  por aqui: elas chegam por texto e são resolvidas em Tags/sections/POST/resolveByName.ts.
class Controller {

    public async assertCategory(IdWorkspace: number, IdCategory: number) {
        let category = await Categories_model.getUnique(IdWorkspace, IdCategory)

        //  Arquivada cai aqui junto com a de outro tenant: o getUnique filtra Active por
        //  padrão, e lançar numa categoria arquivada é lançar no que sumiu das listas. Só o
        //  PUT da própria feature pede o contrário, porque é ele que desarquiva.
        if (!category) {
            throw new APIError({
                msg: "Categoria não encontrada!",
                status: 406,
                data: { IdWorkspace, IdCategory },
            })
        }

        return category
    }
}

export const ExpenseCategory = new Controller()
