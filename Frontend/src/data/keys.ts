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
    /** As ATIVAS. É esta a lista que o seletor de gasto, o filtro e o
     *  relatório leem, e é por isso que ela é a chave curta. */
    categories: ["categories"] as const,
    /** As ativas **e as arquivadas**, que é a leitura da Personalização.
     *
     *  **Entrada de cache separada, de propósito.** Pôr `IncludeArchived`
     *  na mesma chave trocaria o que TODAS as telas enxergam: quem abrisse
     *  a Personalização deixaria a categoria arquivada no seletor de gasto
     *  e no donut do relatório, que é exatamente o contrário do que
     *  arquivar quer dizer. Duas chaves são duas requisições, e é o preço
     *  certo — a lista tem treze linhas e é a única tela que precisa da
     *  segunda.
     *
     *  Debaixo do MESMO prefixo `["categories"]` também de propósito: a
     *  invalidação do React Query casa por prefixo, então uma escrita em
     *  categoria continua sendo UMA invalidação que alcança as duas. */
    categoriesWithArchived: ["categories", "archived"] as const,
    /** Os convites PENDENTES do espaço da sessão. Sem mês e sem id: a
     *  rota não recebe nenhum dos dois — ela olha o workspace do cookie,
     *  e trocar de espaço limpa o cache inteiro de qualquer jeito. */
    invites: ["invites"] as const,
    /** UM convite, lido pelo HASH e SEM sessão — a tela pública de
     *  aceite e o cadastro que sai dela leem esta mesma entrada.
     *
     *  Não é um recorte de `invites` acima: aquela é a lista do espaço
     *  da sessão, que só o dono lê. Esta é um convite só, lido por quem
     *  ainda pode não ter conta, e por isso a chave leva o hash — é o
     *  único identificador que o convite tem do lado de fora. */
    invitePreview: (hash: string) => ["invite", hash] as const,
    /** Quem tem acesso ao espaço da sessão. Sem mês e sem id, pelo
     *  mesmo motivo de `invites`: a rota olha o workspace do cookie.
     *
     *  Chave própria, e não junto de `invites`: as duas listas mudam por
     *  motivos diferentes — aceitar um convite tira uma linha de uma e
     *  põe na outra, mas trocar o papel de um membro só mexe nesta. */
    members: ["members"] as const,
    persons: ["persons"] as const,
    /** As contas NÃO são o mesmo em todo mês: a lista é, o `Balance`
     *  não. Ele é recortado pelo `ReferenceMonth` a cada leitura, então
     *  o mês faz parte da chave — sem isso, olhar março mostraria o
     *  saldo de setembro. */
    accounts: (month: ApiTypes.ReferenceMonth) => ["accounts", month] as const,

    /* Movimento — a unidade do cache é o MÊS, que é a unidade de
       navegação das telas. Assim a lista de Gastos e o Dashboard do
       mesmo mês compartilham a resposta em vez de pedirem duas vezes. */
    expense: (idExpense: number) => ["expense", idExpense] as const,
    /** As PERNAS que pesam no mês — a unidade de todo total de gasto, e
     *  a única lista de gasto que o cliente pede.
     *
     *  Não há mais chave `expenses(mês)`: `GET /Expenses` lista COMPRAS,
     *  recortadas por `ExpenseDate`, e a 6ª parcela de uma compra de
     *  março não está nela — a tela de Gastos listava por ali e perdia a
     *  parcela do mês. A rota continua existindo na API; o que acabou
     *  foi o front listar por ela. */
    legs: (month: ApiTypes.ReferenceMonth) => ["legs", month] as const,
    inflows: (month: ApiTypes.ReferenceMonth) => ["inflows", month] as const,
    inflow: (idInflow: number) => ["inflow", idInflow] as const,
    budgets: (month: ApiTypes.ReferenceMonth) => ["budgets", month] as const,
    /** A prévia do comprometido dos alvos que a tela do Orçamento está
     *  MONTANDO — o mesmo número do `Spent`, para um alvo que ainda não
     *  foi gravado.
     *
     *  **A chave é o mês mais os alvos, e nada além deles.** É isso que
     *  faz a prévia ser refeita quando um SELETOR muda e **não** quando
     *  um valor é digitado — e é o que dispensa debounce: digitar "250"
     *  não muda alvo nenhum, então não muda a chave, então não há
     *  requisição. Pôr o valor aqui seria uma requisição por tecla.
     *
     *  `targets` chega já normalizado pelo `useBudgetPreview`: sem os
     *  alvos vazios, sem repetição e em **ordem estável**. Ordem estável
     *  porque a ordem das linhas na tela não é uma pergunta diferente —
     *  arrastar a segunda fatia para cima não muda o comprometido de
     *  nenhuma delas, e sem a normalização isso seria uma entrada de
     *  cache nova e uma requisição a mais.
     *
     *  Debaixo do prefixo `["budgets", month]` de propósito: salvar o
     *  rateio invalida a raiz `budgets`, e a prévia tem que ser refeita
     *  junto — o mês gravado mudou. */
    budgetPreview: (month: ApiTypes.ReferenceMonth, targets: readonly string[]) =>
        ["budgets", month, "preview", targets] as const,

    /* Relatórios — o número já somado pelo servidor. Mesma unidade de
       cache, o MÊS, para o Início e quem mais vier lerem a mesma
       resposta. */
    /** Os nove indicadores do mês. */
    monthReport: (month: ApiTypes.ReferenceMonth) => ["reports", "month", month] as const,
    /** O extrato do mês — a decomposição do mesmo saldo. Debaixo da
     *  mesma raiz `reports` de propósito: quitar uma parcela muda o
     *  indicador e a linha do extrato ao mesmo tempo, e uma raiz só é o
     *  que garante que os dois sejam invalidados juntos. */
    statement: (month: ApiTypes.ReferenceMonth) => ["reports", "statement", month] as const,

    /** UMA fatura: o par (cartão, vencimento), que é tudo que uma fatura
     *  é neste modelo.
     *
     *  **A chave NÃO leva mês, e é o ponto da tela dela.** A fatura vai
     *  de fechamento a fechamento e quase nunca cabe num mês civil —
     *  chavear por mês obrigaria a fatura a se mover junto com o seletor
     *  do chassi, que é exatamente o que fazia "e a fatura passada?"
     *  custar trocar o mês do Início, dos Gastos e do Relatório junto.
     *
     *  `due` é `null` para a fatura ABERTA, que é a requisição sem
     *  `DueDate`: ela é uma entrada de cache própria de propósito, já
     *  que qual vencimento está aberto é resposta do servidor e muda com
     *  o dia — não com nada que o cliente saiba. */
    invoice: (idPaymentMethod: number, due: ApiTypes.CalendarDate | null) =>
        ["invoice", idPaymentMethod, due] as const,

    /* Raízes, para invalidar tudo de um domínio depois de uma escrita
       que atravessa meses (parcelado, série de fixo, estorno). */
    allAccounts: ["accounts"] as const,
    allLegs: ["legs"] as const,
    allInflows: ["inflows"] as const,
    allBudgets: ["budgets"] as const,
    /** A raiz de TODO relatório, e ela é invalidada junto com o
     *  movimento: quitar uma parcela muda seis dos nove números do mês,
     *  e em todos os meses em cache. */
    allReports: ["reports"] as const,
    /** Toda fatura em cache. Quitar, lançar ou cancelar mexe na fatura
     *  de outro ciclo que não o visível — um parcelado nasce com perna
     *  em doze faturas —, então a invalidação é da raiz. */
    allInvoices: ["invoice"] as const,
};
