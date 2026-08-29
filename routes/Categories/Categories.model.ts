import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  Categoria de gasto. Entrada não tem categoria (ver o ROADMAP), então esta tabela é lida
//  só pelo lado de Expenses.
//
//  A tabela tem dois donos possíveis: o workspace, ou ninguém — IdWorkspace nulo marca a
//  categoria pré-definida do sistema, que todo workspace enxerga e nenhum edita.
//
//  **Lista plana:** não há categoria filha de outra. A coluna IdParentCategory existiu e foi
//  derrubada (migration 20260829010000).
export class class_Categories_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Categories>("Categories").where("Active", true).orderBy("Position").orderBy("IdCategory")

    //  As do workspace mais as globais. O OR vai dentro do callback de propósito: solto, ele
    //  se ligaria ao where("Active") do baseQuery e a consulta viraria "(ativa e do workspace)
    //  ou global", trazendo de volta a global arquivada.
    getByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where((query) => query.where("IdWorkspace", IdWorkspace).orWhereNull("IdWorkspace"))
    }

    //  Mesmo motivo do Accounts.getUnique: o IdCategory chega do cliente e é sequencial, então
    //  buscar só por ele leria a categoria de outro tenant mesmo com a matrícula conferida.
    //
    //  A diferença é que aqui a global entra junto — ela é visível a todo mundo, e achá-la é o
    //  que permite responder "é somente leitura" em vez de "não existe". Quem barra a escrita
    //  é o CategoryOwnership, não a ausência da linha.
    getUnique(IdWorkspace: number, IdCategory: number) {
        return this.getByWorkspace(IdWorkspace).where("IdCategory", IdCategory).first()
    }

    create(records: MaybeArray<Partial<Database.Categories>>) {
        return this.KnexConnection.insert(records).into("Categories")
    }

    update(IdCategory: number, record: Partial<Database.Categories>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Categories").where("IdCategory", IdCategory)
    }

    //  Soft delete, como toda tabela de cadastro: Expenses aponta para cá, e o gasto do mês
    //  passado tem que continuar apontando para a categoria em que ele foi de fato lançado.
    //
    //  O IdWorkspace na cláusula não é redundância: é a segunda barreira que impede um
    //  UPDATE de alcançar a linha de outro tenant — ou uma global, que não é de ninguém.
    delete(IdWorkspace: number, IdCategory: number) {
        return this.KnexConnection
            .update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() })
            .from("Categories")
            .where("IdWorkspace", IdWorkspace)
            .where("IdCategory", IdCategory)
    }
}

export const Categories_model = new class_Categories_model()
