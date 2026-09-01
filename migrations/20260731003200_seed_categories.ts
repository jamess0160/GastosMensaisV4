import type { Knex } from "knex";

// Categorias globais (IdWorkspace null). IconKey referencia o catalogo de icones
// do app cliente - e uma string, nao um arquivo. Color e RGB em hexadecimal.
//
// Este arquivo e opcional: se preferir que o usuario comece sem nada, e so
// remover a migration.

const categories = [
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


export async function up(knex: Knex): Promise<void> {
    await knex("Categories").insert(categories.map((item) => ({ ...item, IdWorkspace: null })))
}


export async function down(knex: Knex): Promise<void> {
    await knex("Categories")
        .whereNull("IdWorkspace")
        .whereIn("Description", categories.map((item) => item.Description))
        .delete()
}
