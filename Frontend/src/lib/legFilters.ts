import { isLive, type ExpenseLeg } from "@/lib/aggregate";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O predicado de filtro das DUAS telas que recortam pernas.

   Gastos e Relatório fazem a mesma pergunta — "esta perna passa pelos
   filtros?" — e ela estava escrita duas vezes: aqui, vinda de
   `pages/Expenses/src/rows.ts`, e inline no `useMemo` do Relatório.
   Cinco condições iguais em dois lugares significam que toda condição
   nova nasce escrita duas vezes, e que a próxima divergência entre as
   telas não vai dar erro em lugar nenhum.

   Mora em `src/lib/`, ao lado do `aggregate.ts`, pelo mesmo motivo que
   ele: é regra de PERNA e não de tela, e aqui ela se testa sem montar
   componente.

   O que NÃO está aqui é o apara-dias do Relatório. Ele não é filtro do
   usuário: é a correção de que o cache trabalha em meses inteiros, e um
   período que começa no dia 10 traria os nove primeiros de carona. Ele
   é da tela e fica no `useMemo` dela — dobrá-lo para dentro deste
   predicado é o tipo de unificação que parece limpa e esconde uma
   regra.
   ════════════════════════════════════════════════════════════ */

/** O estado da PARCELA, não o da compra.
 *
 *  Um parcelado de seis com três parcelas quitadas aparecia como "em
 *  aberto" nos seis meses, inclusive nos três já pagos — o `Status` do
 *  gasto só vira `paid` quando TODAS as pernas estão pagas, e ele é a
 *  resposta certa para outra pergunta. "Pagos" em setembro quer dizer
 *  "a parcela de setembro está quitada".
 *
 *  **Cancelado continua sendo do gasto**: cancelar é um fato da compra
 *  inteira, e não existe parcela cancelada sozinha.
 *
 *  Ele vive aqui, e não com o resto das regras da linha de Gastos,
 *  porque é `legMatches` quem o lê para responder ao chip de status —
 *  e `src/lib/` não pode importar de `src/pages/`. */
export const legStatus = (leg: ExpenseLeg): ApiTypes.ExpenseStatus =>
    !isLive(leg.expense) ? "canceled" : leg.paid ? "paid" : "pending";

/** Os filtros de perna, mais a busca. Todos são multi-seleção e vazio
 *  quer dizer "sem recorte".
 *
 *  **`statuses` é opcional, e ausente também quer dizer "sem recorte"**
 *  — nunca "nenhum status passa". As duas telas divergem justamente
 *  aqui, e as duas estão certas: Gastos filtra status porque a lista do
 *  mês VEM com os cancelados, para o chip "Cancelados" ter o que
 *  mostrar, e por isso nasce com `["pending", "paid"]`; o Relatório não
 *  tem chip de status e não recorta nenhum. */
export interface LegFilters {
    statuses?: readonly ApiTypes.ExpenseStatus[];
    kinds: readonly ApiTypes.ExpenseKind[];
    idCategories: readonly number[];
    idPersons: readonly number[];
    idMethods: readonly number[];
    /** As etiquetas marcadas na faixa, em OU: ver `legMatches`. */
    idTags: readonly number[];
    search: string;
}

/** O predicado da tabela, da faixa de indicadores, do rodapé e dos
 *  gráficos do Relatório — um só.
 *
 *  Antes eram dois universos: em Gastos o filtro rodava sobre a lista de
 *  compras (a tabela) e sobre as pernas (os indicadores), e por isso a
 *  soma da coluna não fechava com o "Total" do topo. Com a perna como
 *  unidade a pergunta é uma, e os dois números são o mesmo número.
 *
 *  Pessoa e forma de pagamento saem da PERNA: `persons` é o rateio do
 *  gasto (o mesmo em toda perna dele) e `IdPaymentMethod` é de cada
 *  perna — um gasto pago com duas formas passa no filtro de qualquer
 *  uma das duas, pela perna que corresponde a ela. */
export function legMatches(leg: ExpenseLeg, filters: LegFilters): boolean {
    const { statuses, kinds, idCategories, idPersons, idMethods, idTags } = filters;

    if (statuses && statuses.length > 0 && !statuses.includes(legStatus(leg))) return false;
    if (kinds.length > 0 && !kinds.includes(leg.expense.Kind)) return false;
    if (idCategories.length > 0 && !idCategories.includes(leg.expense.IdCategory)) return false;
    if (idMethods.length > 0 && !idMethods.includes(leg.payment.IdPaymentMethod)) return false;
    if (
        idPersons.length > 0 &&
        !leg.persons.some((person) => idPersons.includes(person.IdPerson))
    ) {
        return false;
    }

    /* A tag é do GASTO e viaja na perna desde a leva 11, então o recorte
       não custa consulta nenhuma. Multisseleção em **OU**, igual a
       pessoa: a perna passa se tiver QUALQUER uma das marcadas. "E" —
       os gastos que têm as duas — é outra pergunta, e não é esta. */
    if (idTags.length > 0 && !leg.tags.some((tag) => idTags.includes(tag.IdTag))) return false;

    const term = filters.search.trim().toLowerCase();
    if (term && !leg.expense.Description.toLowerCase().includes(term)) return false;

    return true;
}

/** As etiquetas PRESENTES nas pernas que a tela carregou, uma vez cada,
 *  em ordem de nome.
 *
 *  É a inversão deliberada em relação aos outros filtros: categoria,
 *  pessoa e forma de pagamento saem de catálogo porque são estáveis e
 *  pequenas, e ver "zero neste período" ali é informação. Tag é texto
 *  livre e ilimitada — depois de dois anos o espaço tem duzentas, e uma
 *  faixa de duzentos chips não se usa. Derivá-la das pernas carregadas
 *  dá o conjunto certo por construção: nunca oferece tag com zero
 *  resultado, fica no recorte que está na tela, e não precisa de rota,
 *  catálogo nem cache novos.
 *
 *  O escopo é o de cada tela — o mês em Gastos (de `allLegs`, com os
 *  cancelados, para o universo ser o mesmo dos outros filtros dali) e o
 *  período no Relatório. A consequência que as duas têm que tratar é o
 *  id órfão: a seleção sobrevive à troca de mês, e a tag pode não. */
export function legTags(legs: readonly ExpenseLeg[]): ApiTypes.Tag[] {
    const byId = new Map<number, ApiTypes.Tag>();

    for (const leg of legs) {
        for (const tag of leg.tags) {
            if (!byId.has(tag.IdTag)) byId.set(tag.IdTag, tag);
        }
    }

    return [...byId.values()].sort((a, b) => a.Name.localeCompare(b.Name, "pt-BR"));
}
