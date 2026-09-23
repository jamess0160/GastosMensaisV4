import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  Categoria de gasto. Entrada não tem categoria (ver o ROADMAP), então esta tabela é lida
//  só pelo lado de Expenses.
//
//  **Toda categoria é de um workspace.** O `IdWorkspace` nulo — a pré-definida do sistema,
//  que todo espaço enxergava e nenhum editava — deixou de existir na migration
//  20260922140000: cada espaço ganhou a sua cópia das treze. Era o que travava os dois pedidos
//  de quem usa o app, porque arquivar e reordenar uma linha compartilhada mexeria no cadastro
//  do vizinho. Quem semeia as treze agora é a criação de workspace, com a lista do
//  `Categories.seed.ts`.
//
//  **Lista plana:** não há categoria filha de outra. A coluna IdParentCategory existiu e foi
//  derrubada (migration 20260829010000).
export class class_Categories_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Categories>("Categories").where("Active", true).orderBy("Position").orderBy("IdCategory")

    //  Só as do workspace. O `orWhereNull` que trazia as globais junto saiu com elas.
    getByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace)
    }

    //  Mesmo motivo do Accounts.getUnique: o IdCategory chega do cliente e é sequencial, então
    //  buscar só por ele leria a categoria de outro tenant mesmo com a matrícula conferida.
    //
    //  E agora a ausência da linha é a única resposta possível para um id que não é do espaço:
    //  sem linha de ninguém, "de outro tenant" e "não existe" viraram o mesmo 406.
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
    //  UPDATE de alcançar a linha de outro tenant.
    delete(IdWorkspace: number, IdCategory: number) {
        return this.KnexConnection
            .update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() })
            .from("Categories")
            .where("IdWorkspace", IdWorkspace)
            .where("IdCategory", IdCategory)
    }
}

export const Categories_model = new class_Categories_model()
