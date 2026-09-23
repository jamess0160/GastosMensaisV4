//  As treze categorias com que todo workspace nasce.
//
//  **Elas eram uma migration e passaram a ser um arquivo de código** (migration
//  `20260922140000_categories_per_workspace`). Enquanto `IdWorkspace` nulo existia, semear era
//  inserir treze linhas UMA vez na vida do banco — a migration `20260731003200` — e todo
//  workspace enxergava as mesmas. Agora cada espaço tem as suas, então semear é algo que
//  acontece a cada workspace criado, e isso é trabalho de rota, não de migration.
//
//  **A migration desta etapa não importa este arquivo, de propósito.** Ela copia as globais
//  que já estão no banco, linha a linha — não esta lista. São duas razões: o CLI do knex não
//  resolve o alias `root/*`, e, mais importante, uma migration é história congelada. Se um dia
//  alguém corrigir "Alimentacao" para "Alimentação" aqui, a migration tem que continuar
//  produzindo a cópia fiel do que estava no banco naquele dia.
//
//  **A falta de acentuação em "Alimentacao" e "Vestuario" é herdada da migration de 31/07 e
//  não foi corrigida aqui**: a migration copia as globais como estão, e as duas listas têm que
//  bater — corrigir aqui daria um nome a quem migrou e outro a quem se cadastrou depois. O
//  conserto é decisão de conteúdo, e agora cada espaço edita a sua.
//
//  `IconKey` é chave do catálogo de ícones do app cliente, não um caminho de arquivo; `Color`
//  é RGB em hexadecimal.
export interface CategorySeed {
    Description: string
    IconKey: string
    Color: string
    Position: number
}

export const CategoriesSeed: CategorySeed[] = [
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
