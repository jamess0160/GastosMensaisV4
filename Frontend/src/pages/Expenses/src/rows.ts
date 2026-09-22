import { isLive, type ExpenseLeg } from "@/lib/aggregate";
import { today } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O que a linha da lista de Gastos afirma.

   A linha é a PERNA, não a compra: uma geladeira de 600 em 6× comprada
   em junho tem uma linha em cada um dos seis meses, de 100 cada. Listar
   compras — `GET /Expenses`, recortado por `ExpenseDate` — dava uma
   linha em junho e nenhuma nos outros cinco, enquanto a faixa de
   indicadores da MESMA tela já somava a parcela: o mês dizia
   "Total: 1.340" com uma tabela que somava 1.240.

   Três perguntas, e as três mudam de resposta quando a unidade muda.
   Ficam aqui, sem React, porque é o que dá para testar sem montar tela.
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
 *  inteira, e não existe parcela cancelada sozinha. */
export const legStatus = (leg: ExpenseLeg): ApiTypes.ExpenseStatus =>
    !isLive(leg.expense) ? "canceled" : leg.paid ? "paid" : "pending";

/** A parcela está atrasada?
 *
 *  A data é a `CashDate` — quando o dinheiro deveria ter saído da conta
 *  —, e nunca a da compra. Numa perna de cartão a `CashDate` é o
 *  vencimento da FATURA: uma compra de 10/09 num cartão que vence 04/10
 *  está `pending` no dia 11/09 porque a fatura ainda não foi paga, e
 *  nada nela está atrasado. Comparar com a data da compra pintava a
 *  linha de vermelho no dia seguinte a cada compra no cartão.
 *
 *  `reference` existe para o teste: o resto do app chama sem ela. */
export const isLegOverdue = (
    leg: ExpenseLeg,
    reference: ApiTypes.CalendarDate = today(),
): boolean => isLive(leg.expense) && !leg.paid && leg.payment.CashDate < reference;

/** `"3/6"`, ou `null` quando a perna não é parcela de nada.
 *
 *  Os dois campos andam juntos na API; exigir os dois aqui é o que
 *  impede um `"3/null"` de chegar à tela. */
export function installmentLabel(payment: ApiTypes.ExpensePayment): string | null {
    const { InstallmentNumber, InstallmentTotal } = payment;
    if (InstallmentNumber === null || InstallmentTotal === null) return null;
    return `${InstallmentNumber}/${InstallmentTotal}`;
}

/** Os cinco filtros da tela, mais a busca. Todos são multi-seleção e
 *  vazio quer dizer "sem recorte" — menos o status, que nasce com
 *  `["pending", "paid"]` porque a lista do mês VEM com os cancelados. */
export interface LegFilters {
    statuses: readonly ApiTypes.ExpenseStatus[];
    kinds: readonly ApiTypes.ExpenseKind[];
    idCategories: readonly number[];
    idPersons: readonly number[];
    idMethods: readonly number[];
    search: string;
}

/** O predicado da tabela, da faixa de indicadores e do rodapé — um só.
 *
 *  Antes eram dois universos: o filtro rodava sobre a lista de compras
 *  (a tabela) e sobre as pernas (os indicadores), e por isso a soma da
 *  coluna não fechava com o "Total" do topo. Com a perna como unidade a
 *  pergunta é uma, e os dois números são o mesmo número.
 *
 *  Pessoa e forma de pagamento saem da PERNA: `persons` é o rateio do
 *  gasto (o mesmo em toda perna dele) e `IdPaymentMethod` é de cada
 *  perna — um gasto pago com duas formas passa no filtro de qualquer
 *  uma das duas, pela perna que corresponde a ela. */
export function legMatches(leg: ExpenseLeg, filters: LegFilters): boolean {
    const { statuses, kinds, idCategories, idPersons, idMethods } = filters;

    if (statuses.length > 0 && !statuses.includes(legStatus(leg))) return false;
    if (kinds.length > 0 && !kinds.includes(leg.expense.Kind)) return false;
    if (idCategories.length > 0 && !idCategories.includes(leg.expense.IdCategory)) return false;
    if (idMethods.length > 0 && !idMethods.includes(leg.payment.IdPaymentMethod)) return false;
    if (
        idPersons.length > 0 &&
        !leg.persons.some((person) => idPersons.includes(person.IdPerson))
    ) {
        return false;
    }

    const term = filters.search.trim().toLowerCase();
    if (term && !leg.expense.Description.toLowerCase().includes(term)) return false;

    return true;
}
