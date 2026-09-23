import type { Knex } from "knex";


// CADA WORKSPACE PASSA A TER AS SUAS TREZE CATEGORIAS. IdWorkspace nulo deixa de
// existir.
//
// A tabela tinha dois donos possiveis - o workspace, ou NINGUEM. As treze
// categorias semeadas pela migration 20260731003200 tinham IdWorkspace null e a
// leitura era sempre "IdWorkspace = X or IdWorkspace is null". Isso deixava os
// dois pedidos de quem usa o app impossiveis de atender:
//
//   - ARQUIVAR uma global e Active=false numa linha que TODO workspace enxerga. A
//     guarda do model (where IdWorkspace = X, que nunca casa com null) fazia a
//     operacao simplesmente nao ter efeito;
//   - REORDENAR e escrever Position, e a Position de uma global e a mesma para
//     todo mundo. Arrastar "Pets" para o topo mudaria a ordem no espaco do vizinho.
//
// A REPONTAGEM E A RAZAO DE ESTA MIGRATION VIR ANTES da que reescreve o orcamento:
// o orcamento tambem aponta para categoria, e migra-lo primeiro faria a repontagem
// acontecer duas vezes, sobre um esquema que muda no meio. As tabelas que apontam
// para Categories sao exatamente duas - Expenses.IdCategory (ON DELETE SET NULL) e
// Budgets.IdCategory (ON DELETE CASCADE). BudgetPeriods NAO tem IdCategory: ela
// aponta para Budgets. Sem a repontagem, o expurgo apagaria silenciosamente o
// orcamento de todo mundo e deixaria todo gasto antigo sem categoria.
//
// A COPIA SAI DAS LINHAS QUE ESTAO NO BANCO, NAO DE UMA LISTA ESCRITA AQUI. E o
// que torna esta migration independente do seed que hoje vive em
// routes/Categories/Categories.seed.ts: o CLI do knex carrega os .js um a um, sem
// o alias root/*, mas o motivo de fundo e outro - uma migration e historia
// congelada, e ela tem que continuar produzindo a copia fiel do que estava no
// banco no dia em que rodou, mesmo que o seed do app mude depois. A acentuacao
// ausente de "Alimentacao" e "Vestuario" vem junto como esta, de proposito:
// corrigi-la e decisao de conteudo, e dela em diante cada espaco edita a sua.
export async function up(knex: Knex): Promise<void> {

    // O migrate do knex ja envolve cada migration numa transaction, e e dela que
    // os quatro passos abaixo dependem: um expurgo sem a copia e sem a repontagem
    // nao tem conserto, porque a informacao de qual categoria o gasto tinha some
    // junto com a linha.
    let globals = await knex("Categories").whereNull("IdWorkspace").select("*").orderBy("IdCategory") as CategoryRow[]
    let workspaces = await knex("Workspaces").select("IdWorkspace").orderBy("IdWorkspace") as WorkspaceRow[]

    for (let workspace of workspaces) {
        for (let global of globals) {

            // 1. a copia, preservando Description, IconKey, Color e Position - e o
            //    Active junto, que uma global arquivada a mao nao pode voltar viva.
            let [copy] = await knex("Categories")
                .insert({
                    IdWorkspace: workspace.IdWorkspace,
                    Description: global.Description,
                    IconKey: global.IconKey,
                    Color: global.Color,
                    Position: global.Position,
                    Active: global.Active,
                })
                .returning("IdCategory") as InsertedId[]

            // 2. a repontagem, escopada pelo workspace: o gasto de marco continua
            //    apontando para a categoria em que foi lancado, com o mesmo nome,
            //    icone e cor - so que agora numa linha que e do espaco dele.
            await repoint(knex, workspace.IdWorkspace, global.IdCategory, copy.IdCategory)
        }
    }

    // 3. o expurgo. Depois da repontagem nenhuma linha aponta mais para elas.
    await knex("Categories").whereNull("IdWorkspace").delete()

    // 4. e a coluna passa a exigir dono. Sem isso o proximo INSERT esquecido
    //    recria o problema inteiro, e a leitura teria que voltar a se defender.
    await knex.schema.alterTable("Categories", (table) => {
        table.integer("IdWorkspace").notNullable().alter()
    })
}


// A VOLTA REFAZ AS TREZE GLOBAIS E DESFAZ AS COPIAS.
//
// AQUI A LISTA ESTA DUPLICADA, e e o unico jeito: as linhas globais foram
// apagadas pelo up, entao nao ha de onde le-las de volta. Ela e a copia literal da
// migration 20260731003200, congelada - se o seed do app mudar, esta lista NAO
// muda, ou o rollback devolveria um banco diferente do que existia antes do up.
//
// O QUE A VOLTA RECONHECE COMO COPIA e a linha de workspace cuja tupla
// (Description, IconKey, Color, Position) bate exatamente com uma das treze. Duas
// consequencias, e as duas sao o comportamento menos destrutivo possivel:
//
//   - a copia que o usuario EDITOU (renomeou "Pets" para "Bichos", trocou a cor,
//     arrastou de posicao) nao bate mais e FICA, como categoria propria dele. O
//     rollback nao tem como desfazer a edicao, e apagar a linha levaria o trabalho
//     junto;
//   - uma categoria que o usuario criou a mao identica a uma das treze - mesmo
//     nome, mesmo IconKey, mesma cor, mesma Position - e indistinguivel da copia e
//     some junto, com os gastos dela repontados para a global. E exatamente o
//     estado anterior ao up, que e o que se pede ao dar rollback.
export async function down(knex: Knex): Promise<void> {

    // A coluna volta a aceitar null ANTES da insercao das globais: elas sao
    // justamente as linhas sem dono.
    await knex.schema.alterTable("Categories", (table) => {
        table.integer("IdWorkspace").nullable().alter()
    })

    for (let seed of SEEDED_GLOBALS) {
        let [global] = await knex("Categories")
            .insert({ ...seed, IdWorkspace: null })
            .returning("IdCategory") as InsertedId[]

        let copies = await knex("Categories")
            .whereNotNull("IdWorkspace")
            .where({ Description: seed.Description, IconKey: seed.IconKey, Color: seed.Color, Position: seed.Position })
            .select("IdCategory", "IdWorkspace") as CategoryRow[]

        for (let copy of copies) {
            await repoint(knex, copy.IdWorkspace!, copy.IdCategory, global.IdCategory)

            await knex("Categories").where("IdCategory", copy.IdCategory).delete()
        }
    }
}


// A repontagem dos dois - e SO dos dois - lugares que apontam para Categories.
// Escopada pelo IdWorkspace tanto quanto pelo IdCategory: nos dois sentidos desta
// migration o id de origem e visivel a mais de um tenant, e sem o escopo um UPDATE
// alcancaria a linha do vizinho.
async function repoint(knex: Knex, IdWorkspace: number, from: number, to: number): Promise<void> {
    await knex("Expenses").where({ IdWorkspace, IdCategory: from }).update({ IdCategory: to, UpdatedAt: knex.fn.now() })
    await knex("Budgets").where({ IdWorkspace, IdCategory: from }).update({ IdCategory: to, UpdatedAt: knex.fn.now() })
}


// Copia literal e congelada da migration 20260731003200. Ver o comentario do down.
const SEEDED_GLOBALS = [
    { Description: "Casa", IconKey: "House", Color: "#36da0d", Position: 1 },
    { Description: "Alimentacao", IconKey: "Utensils", Color: "#F4511E", Position: 2 },
    { Description: "Mercado", IconKey: "ShoppingCart", Color: "#EF6C00", Position: 3 },
    { Description: "Transporte", IconKey: "Car", Color: "#1565C0", Position: 4 },
    { Description: "Saude", IconKey: "HeartPulse", Color: "#C62828", Position: 5 },
    { Description: "Educacao", IconKey: "GraduationCap", Color: "#283593", Position: 6 },
    { Description: "Lazer", IconKey: "PartyPopper", Color: "#6A1B9A", Position: 7 },
    { Description: "Assinaturas", IconKey: "Repeat2", Color: "#00838F", Position: 8 },
    { Description: "Vestuario", IconKey: "Shirt", Color: "#AD1457", Position: 9 },
    { Description: "Pets", IconKey: "PawPrint", Color: "#8D6E63", Position: 10 },
    { Description: "Impostos e taxas", IconKey: "Landmark", Color: "#455A64", Position: 11 },
    { Description: "Investimentos", IconKey: "PiggyBank", Color: "#2E7D32", Position: 12 },
    { Description: "Outros", IconKey: "CircleDashed", Color: "#757575", Position: 13 },
]


interface CategoryRow {
    IdCategory: number
    IdWorkspace: number | null
    Description: string
    IconKey: string | null
    Color: string | null
    Position: number | null
    Active: boolean
}

interface WorkspaceRow {
    IdWorkspace: number
}

interface InsertedId {
    IdCategory: number
}
