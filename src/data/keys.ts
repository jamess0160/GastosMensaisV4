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
    /** Os convites PENDENTES do espaço da sessão. Sem mês e sem id: a
     *  rota não recebe nenhum dos dois — ela olha o workspace do cookie,
     *  e trocar de espaço limpa o cache inteiro de qualquer jeito. */
    invites: ["invites"] as const,
    persons: ["persons"] as const,
    /** As contas NÃO são o mesmo em todo mês: a lista é, o `Balance`
     *  não. Ele é recortado pelo `ReferenceMonth` a cada leitura, então
     *  o mês faz parte da chave — sem isso, olhar março mostraria o
     *  saldo de setembro. */
    accounts: (month: ApiTypes.ReferenceMonth) => ["accounts", month] as const,

    /* Movimento — a unidade do cache é o MÊS, que é a unidade de
       navegação das telas. Assim a lista de Gastos e o Dashboard do
       mesmo mês compartilham a resposta em vez de pedirem duas vezes. */
    expenses: (month: ApiTypes.ReferenceMonth) => ["expenses", month] as const,
    expense: (idExpense: number) => ["expense", idExpense] as const,
    /** As PERNAS que pesam no mês — a unidade de todo total de gasto, e
     *  a única lista que descreve o mês por inteiro: a 6ª parcela de uma
     *  compra de março está aqui e não em `expenses`. */
    legs: (month: ApiTypes.ReferenceMonth) => ["legs", month] as const,
    inflows: (month: ApiTypes.ReferenceMonth) => ["inflows", month] as const,
    inflow: (idInflow: number) => ["inflow", idInflow] as const,
    budgets: (month: ApiTypes.ReferenceMonth) => ["budgets", month] as const,

    /* Raízes, para invalidar tudo de um domínio depois de uma escrita
       que atravessa meses (parcelado, série de fixo, estorno). */
    allAccounts: ["accounts"] as const,
    allExpenses: ["expenses"] as const,
    allLegs: ["legs"] as const,
    allInflows: ["inflows"] as const,
    allBudgets: ["budgets"] as const,
};
