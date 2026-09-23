import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { Utils } from "root/Utils/Utils"

/**
 * **Uma porção de gasto**: o cruzamento de uma perna com uma pessoa do rateio, já somada por
 * alvo. É a unidade que procura uma linha de orçamento.
 *
 * `IdPerson` nulo é a perna de um gasto **sem rateio nenhum** — ela também é uma porção, do
 * valor da perna inteira. `IdCategory` nulo existe só porque a coluna é anulável no banco.
 */
export interface SpentPortion {
    IdCategory: number | null
    IdPerson: number | null
    Value: number
}

/** O alvo de uma linha de orçamento — o mínimo que o casamento precisa ler dela. */
export interface SpentTarget {
    IdBudgetPeriod: number
    IdCategory: number | null
    IdPerson: number | null
}

export interface MonthSpent {
    /** `IdBudgetPeriod` → o comprometido daquela linha. Linha sem porção nenhuma não aparece. */
    ByPeriod: Map<number, number>
    /** A soma das porções que não casaram com linha nenhuma. */
    Unbudgeted: number
}

//  **Quanto já foi comprometido no mês, e de qual linha do orçamento.**
//
//  **Cada porção de gasto consome uma linha, ou nenhuma** — nunca duas. Era o furo que o alvo
//  duplo abriu: com as duas consultas independentes de antes (uma por categoria, outra por
//  pessoa), um gasto de 100 da Luana em Mercado comia 100 do orçamento *dela* **e** 100 do de
//  *Mercado* — 200 consumidos de uma repartição de 1.000 por um gasto de 100. Numa repartição,
//  isso é contar o mesmo dinheiro duas vezes.
//
//  **A pessoa parte o orçamento em dois mundos que não se comunicam:**
//
//  | a porção                  | procura, nesta ordem            | e se não achar       |
//  |---------------------------|---------------------------------|----------------------|
//  | **tem pessoa P**, categoria C | `(P, C)` → `(P, sem categoria)` | **não consome nada** |
//  | **sem pessoa**, categoria C   | `(sem pessoa, C)`               | não consome nada     |
//
//  Uma porção **com dono nunca sai do bolso dela**: um gasto do Tiago em Mercado não cai na
//  linha `(—, Mercado)`, mesmo que ela exista e esteja sobrando. Se caísse, a linha de
//  categoria voltaria a ser um segundo teto sobre o mesmo dinheiro, que é o que esta regra
//  desfaz.
//
//  **O preço da regra estrita, e ele é de propósito:** se *todo* gasto for carimbado com
//  pessoa, as linhas só de categoria nunca consomem nada. Cobrir uma pessoa por inteiro exige
//  dar a ela uma linha **sem categoria** — uma mesada. Nada aqui conserta isso sozinho: o
//  `Unbudgeted` **mostra**, e é o que torna a regra legível em vez de silenciosa.
//
//  **A regra mora em TypeScript, não num LATERAL com ORDER BY.** É a mesma escolha do
//  `InvoiceDates`: uma regra que decide dinheiro, tem três casos e uma precedência precisa ser
//  lida e testada num lugar só. A consulta produz as porções do mês — uma dúzia de linhas, como
//  as do orçamento — e o casamento acontece contra um índice em memória.
//
//  As três regras de sempre continuam valendo e não mudaram:
//
//  1. **Conta a perna, não o gasto.** 600 em 6x não come 600 do orçamento de agosto: come 100
//     em cada um dos seis meses, que é como o dinheiro sai e como a pessoa orça.
//  2. **A data que vale é a `CompetenceDate` da perna**, congelada no lançamento — o mês em que
//     o gasto *pesa*, nunca o mês em que o dinheiro sai (esse é o `CashDate`, e é do saldo).
//  3. **Conta pago e pendente, ao contrário do saldo.** Saldo é realizado; orçamento é
//     comprometido. Só o cancelado sai.
class Controller {

    /**
     * **As porções do mês, numa consulta só.**
     *
     * O `leftJoin` de `ExpensePersons` é o que dá as duas formas de porção em uma passada: a
     * perna rateada vira uma porção por pessoa, e a perna de um gasto **sem rateio** sobrevive
     * ao join com a pessoa nula e o valor inteiro. Um `innerJoin` — o que o `getByPersons`
     * antigo usava — sumiria com ela, e o gasto sem rateio deixaria de aparecer tanto na linha
     * de categoria quanto no `Unbudgeted`.
     *
     *     valor da porção = ExpensePersons.Value * ExpensePayments.Value / Expenses.TotalValue
     *
     * **O rateio é do gasto e a parcela é da perna**, então a porção é a parte daquela pessoa
     * *naquela parcela*. 600 em 6x todos da Maria dão **100 por mês**, não 600. Quem "otimizar"
     * somando antes e rateando depois muda a conta.
     *
     * Agrupa por `(IdCategory, IdPerson)` porque é exatamente a chave que o casamento lê: o
     * par é o que decide a linha, então duas porções do mesmo par sempre terminariam na mesma
     * linha de qualquer jeito.
     *
     * **Não arredonda aqui.** A divisão em `numeric` do Postgres tem precisão de sobra, e o
     * arredondamento acontece **uma vez**, no fim do casamento — arredondar por porção
     * espalharia o erro por todas elas.
     */
    public async getPortions(IdWorkspace: number, ReferenceMonth: string): Promise<SpentPortion[]> {
        //  Meio aberto (>= início, < mês seguinte): não precisa saber quantos dias tem o mês, e
        //  não deixa o dia 31 escapar de um `between` mal montado.
        let nextMonth = Utils.addMonthsToDate(ReferenceMonth, 1)

        let rows = await KnexConnection
            .select("Expenses.IdCategory")
            .select("ExpensePersons.IdPerson")
            .select(KnexConnection.raw(`sum(case when "ExpensePersons"."IdExpensePerson" is null then "ExpensePayments"."Value" else "ExpensePersons"."Value" * "ExpensePayments"."Value" / "Expenses"."TotalValue" end) as "Value"`))
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .leftJoin("ExpensePersons", "ExpensePersons.IdExpense", "Expenses.IdExpense")
            .where("Expenses.IdWorkspace", IdWorkspace)
            //  Gasto cancelado não compromete teto nenhum, como não move saldo.
            .whereNot("Expenses.Status", "canceled")
            .where("ExpensePayments.CompetenceDate", ">=", ReferenceMonth)
            .where("ExpensePayments.CompetenceDate", "<", nextMonth)
            .groupBy("Expenses.IdCategory", "ExpensePersons.IdPerson") as Array<{ IdCategory: number | null, IdPerson: number | null, Value: number }>

        return rows.map((row) => ({
            IdCategory: row.IdCategory,
            IdPerson: row.IdPerson,
            Value: Number(row.Value),
        }))
    }

    /**
     * **O casamento: cada porção acha a sua linha, ou nenhuma.** Função pura — as porções vêm
     * da consulta acima e as linhas vêm do mês já lido.
     *
     * As linhas que entram aqui são as que a rota vai **mostrar**, e isso fecha uma conta que
     * o usuário consegue conferir: `soma dos Spent + Unbudgeted = o gasto do mês inteiro`
     * (a menos de centavos de arredondamento). Uma linha de alvo arquivado sai da tela, e o
     * que ela consumiria volta a procurar linha como qualquer outra porção.
     *
     * Os três índices são separados porque os três formatos de alvo são alvos **diferentes**:
     * "Mercado" e "Maria em Mercado" convivem no mesmo mês, e é por isso que a unicidade no
     * banco também são três índices parciais e não uma `unique` sobre as quatro colunas.
     */
    public match(periods: SpentTarget[], portions: SpentPortion[]): MonthSpent {
        let byPersonCategory = new Map<string, number>()
        let byPerson = new Map<number, number>()
        let byCategory = new Map<number, number>()

        for (let period of periods) {
            if (period.IdPerson !== null && period.IdCategory !== null) {
                byPersonCategory.set(this.pairKey(period.IdPerson, period.IdCategory), period.IdBudgetPeriod)
            } else if (period.IdPerson !== null) {
                byPerson.set(period.IdPerson, period.IdBudgetPeriod)
            } else if (period.IdCategory !== null) {
                byCategory.set(period.IdCategory, period.IdBudgetPeriod)
            }
        }

        let totals = new Map<number, number>()
        let unbudgeted = 0

        for (let portion of portions) {
            let IdBudgetPeriod = this.findPeriod(portion, byPersonCategory, byPerson, byCategory)

            if (IdBudgetPeriod === null) {
                unbudgeted += portion.Value
                continue
            }

            totals.set(IdBudgetPeriod, (totals.get(IdBudgetPeriod) ?? 0) + portion.Value)
        }

        return {
            ByPeriod: new Map([...totals].map(([IdBudgetPeriod, value]) => [IdBudgetPeriod, this.round(value)])),
            Unbudgeted: this.round(unbudgeted),
        }
    }

    /**
     * **A precedência, e é ela que decide o dinheiro.**
     *
     * Com pessoa: o par exato primeiro, a mesada depois, e nada em terceiro — o `return` de
     * dentro do `if` da pessoa é o que impede a porção com dono de escorregar para a linha de
     * categoria. Sem pessoa: só a linha sem pessoa, porque uma porção anônima não tem como
     * escolher de quem seria a mesada.
     *
     * Gasto sem categoria (a coluna é anulável) com pessoa cai direto na mesada dela; sem
     * pessoa **e** sem categoria não há o que procurar, e ele é `Unbudgeted` por construção.
     */
    private findPeriod(
        portion: SpentPortion,
        byPersonCategory: Map<string, number>,
        byPerson: Map<number, number>,
        byCategory: Map<number, number>,
    ): number | null {
        if (portion.IdPerson !== null) {
            if (portion.IdCategory !== null) {
                let exact = byPersonCategory.get(this.pairKey(portion.IdPerson, portion.IdCategory))

                if (exact !== undefined) return exact
            }

            return byPerson.get(portion.IdPerson) ?? null
        }

        if (portion.IdCategory === null) return null

        return byCategory.get(portion.IdCategory) ?? null
    }

    private pairKey(IdPerson: number, IdCategory: number) {
        return `${IdPerson}:${IdCategory}`
    }

    //  Arredonda **uma vez**, no fim, e passando por centavos: `Utils.toCents` é o mesmo
    //  `Math.round(valor * 100)` que todo fechamento de rateio do projeto usa, e é o que impede
    //  um 66.66666666666667 vindo do `numeric` de chegar assim na tela.
    private round(value: number) {
        return Utils.toCents(value) / 100
    }
}

export const BudgetSpent = new Controller()
