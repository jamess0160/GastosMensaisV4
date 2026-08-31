import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   As chaves de cache num lugar só.

   Espalhar array literal pelas telas é como o cache passa a não
   invalidar: um `["expenses", mes]` num arquivo e um
   `["expense", mes]` noutro convivem sem erro de compilação e o
   usuário vê número velho depois de salvar.
   ════════════════════════════════════════════════════════════ */

export const queryKeys = {
    /* Cadastros — mudam pouco e são lidos por quase toda tela. */
    categories: ["categories"] as const,
    persons: ["persons"] as const,
    accounts: ["accounts"] as const,

    /* Movimento — a unidade do cache é o MÊS, que é a unidade de
       navegação das telas. Assim a lista de Gastos e o Dashboard do
       mesmo mês compartilham a resposta em vez de pedirem duas vezes. */
    expenses: (month: ApiTypes.ReferenceMonth) => ["expenses", month] as const,
    expense: (idExpense: number) => ["expense", idExpense] as const,
    /** Os parcelados de uma janela de meses — a fatia que a lista do mês
     *  não descreve por inteiro. */
    installments: (month: ApiTypes.ReferenceMonth) => ["installments", month] as const,
    inflows: (month: ApiTypes.ReferenceMonth) => ["inflows", month] as const,
    inflow: (idInflow: number) => ["inflow", idInflow] as const,
    budgets: (month: ApiTypes.ReferenceMonth) => ["budgets", month] as const,

    /* Raízes, para invalidar tudo de um domínio depois de uma escrita
       que atravessa meses (parcelado, série de fixo, estorno). */
    allExpenses: ["expenses"] as const,
    allInflows: ["inflows"] as const,
    allBudgets: ["budgets"] as const,
};
