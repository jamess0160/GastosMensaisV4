import type { Knex } from "knex";

// Categorias globais (IdWorkspace null). IconKey referencia o catalogo de icones
// do app cliente - e uma string, nao um arquivo. Color e RGB em hexadecimal.
//
// Este arquivo e opcional: se preferir que o usuario comece sem nada, e so
// remover a migration.

const categories = [
    { Description: "Moradia", IconKey: "home", Color: "#5D4037", Position: 1 },
    { Description: "Alimentacao", IconKey: "utensils", Color: "#F4511E", Position: 2 },
    { Description: "Mercado", IconKey: "shopping-cart", Color: "#EF6C00", Position: 3 },
    { Description: "Transporte", IconKey: "car", Color: "#1565C0", Position: 4 },
    { Description: "Saude", IconKey: "heart-pulse", Color: "#C62828", Position: 5 },
    { Description: "Educacao", IconKey: "graduation-cap", Color: "#283593", Position: 6 },
    { Description: "Lazer", IconKey: "party-popper", Color: "#6A1B9A", Position: 7 },
    { Description: "Assinaturas", IconKey: "repeat", Color: "#00838F", Position: 8 },
    { Description: "Vestuario", IconKey: "shirt", Color: "#AD1457", Position: 9 },
    { Description: "Pets", IconKey: "paw-print", Color: "#8D6E63", Position: 10 },
    { Description: "Impostos e taxas", IconKey: "landmark", Color: "#455A64", Position: 11 },
    { Description: "Investimentos", IconKey: "piggy-bank", Color: "#2E7D32", Position: 12 },
    { Description: "Outros", IconKey: "circle-dashed", Color: "#757575", Position: 13 },
]


export async function up(knex: Knex): Promise<void> {
    await knex("Categories").insert(categories.map((item) => ({ ...item, IdWorkspace: null })))
}


export async function down(knex: Knex): Promise<void> {
    await knex("Categories")
        .whereNull("IdWorkspace")
        .whereIn("Description", categories.map((item) => item.Description))
        .delete()
}
