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

    //  **O `Active` saiu da base e virou parâmetro.** Ele estava aqui, embutido, e era metade
    //  do motivo de arquivar não ter volta: sem uma leitura que enxergasse a linha arquivada,
    //  nem a tela tinha o que listar nem o PUT tinha o que encontrar para desarquivar. A
    //  ordenação fica: `Position` é o que a tela escreve, e `IdCategory` é o desempate — duas
    //  linhas na mesma posição existem (desarquivar devolve uma linha com a posição antiga) e
    //  sem o segundo critério a lista sairia numa ordem diferente a cada leitura.
    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Categories>("Categories").orderBy("Position").orderBy("IdCategory")

    //  Só as do workspace. O `orWhereNull` que trazia as globais junto saiu com elas.
    //
    //  `IncludeArchived` é o mesmo recorte do `IncludeCanceled` de `GET /Expenses`: ausente
    //  esconde, presente traz a lista inteira e quem separa é quem chamou. O **padrão é
    //  esconder** de propósito — o seletor de gasto, o filtro e o relatório chamam sem o
    //  parâmetro, e arquivar tem que tirar a categoria dessas listas para significar algo.
    getByWorkspace(IdWorkspace: number, IncludeArchived = false) {
        let query = this.baseQuery.clone().where("IdWorkspace", IdWorkspace)

        return IncludeArchived ? query : query.where("Active", true)
    }

    //  Mesmo motivo do Accounts.getUnique: o IdCategory chega do cliente e é sequencial, então
    //  buscar só por ele leria a categoria de outro tenant mesmo com a matrícula conferida.
    //
    //  E agora a ausência da linha é a única resposta possível para um id que não é do espaço:
    //  sem linha de ninguém, "de outro tenant" e "não existe" viraram o mesmo 406.
    //
    //  O `IncludeArchived` aqui separa duas perguntas que pareciam uma: **quem escreve na
    //  própria linha** (o PUT, que desarquiva, e o DELETE) precisa alcançar a arquivada;
    //  **quem usa a categoria** (`ExpenseCategory`, `Budgets`) não — lançar num cadastro que
    //  sumiu das listas é o que arquivar existe para impedir. Por isso o padrão é `false`: os
    //  dois chamadores de fora desta feature não passam nada e seguem vendo só as ativas.
    getUnique(IdWorkspace: number, IdCategory: number, IncludeArchived = false) {
        return this.getByWorkspace(IdWorkspace, IncludeArchived).where("IdCategory", IdCategory).first()
    }

    //  A maior posição em uso entre as ativas do espaço — é o que manda a categoria
    //  desarquivada para o FIM da lista, em vez de devolvê-la à posição que ela tinha antes,
    //  que a essa altura já é de outra.
    maxActivePosition(IdWorkspace: number) {
        return this.KnexConnection.max({ Position: "Position" }).from("Categories").where("IdWorkspace", IdWorkspace).where("Active", true).first()
    }

    create(records: MaybeArray<Partial<Database.Categories>>) {
        return this.KnexConnection.insert(records).into("Categories")
    }

    update(IdCategory: number, record: Partial<Database.Categories>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Categories").where("IdCategory", IdCategory)
    }

    //  Regrava a `Position` de uma lista inteira, 1, 2, 3… na ordem em que os ids vieram.
    //
    //  Devolve um UPDATE por linha, e não um só: são valores diferentes por id, e o `CASE
    //  WHEN` que faria isso numa consulta só seria SQL cru — com identificadores PascalCase
    //  para citar à mão, que é exatamente onde o Postgres dobra para minúsculo e falha. São
    //  treze linhas numa transaction; o custo não paga o risco.
    //
    //  **O `IdWorkspace` na cláusula é a segunda barreira**, a mesma do `delete`: mesmo com a
    //  section já tendo conferido cada id, um UPDATE de posição não tem como alcançar a linha
    //  de outro tenant.
    //
    //  Quem chama enlista cada query na transaction com `.transacting(tx)` — a ordem importa
    //  aqui menos do que a atomicidade: ou a lista inteira é renumerada, ou nenhuma linha é.
    updatePositions(IdWorkspace: number, IdCategories: number[]) {
        return IdCategories.map((IdCategory, index) =>
            this.KnexConnection
                .update({ Position: index + 1, UpdatedAt: this.KnexConnection.fn.now() })
                .from("Categories")
                .where("IdWorkspace", IdWorkspace)
                .where("IdCategory", IdCategory)
        )
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
