import { Database } from "root/Utils/database"

export namespace BudgetPeriodsNamespace {

    /**
     * Uma linha do orcamento do mes como a rota devolve: a fatia, o alvo inteiro (para a tela
     * ter nome e cor) e o comprometido.
     *
     * Os dois alvos sao anulaveis e PODEM VIR OS DOIS PREENCHIDOS - e a linha "250 para o Tiago
     * em alimentacao". Nao ha mais um campo Scope dizendo qual par ler: com tres formatos
     * possiveis, um discriminador de dois valores mentiria, e o que a tela le e simplesmente o
     * que veio preenchido.
     */
    export interface MonthRow extends Database.BudgetPeriods {
        Category: Database.Categories | null
        Person: Database.Persons | null
        /** Nao e coluna: calculado a cada leitura. Ver BudgetSpent.section.ts. */
        Spent: number
    }

    /**
     * O mes inteiro: as fatias e o que sobrou **fora** delas.
     *
     * E um envelope e nao uma lista porque o `Unbudgeted` e do MES, nao de linha nenhuma. Ele
     * existe porque o casamento e estrito - uma porcao de gasto consome uma fatia ou NENHUMA
     * (ver BudgetSpent.section.ts) -, e a porcao que nao consome nada precisa aparecer em algum
     * lugar, ou a regra vira um sumico silencioso de dinheiro.
     *
     * Fecha a conta que o usuario confere sozinho: soma dos `Spent` + `Unbudgeted` = o gasto do
     * mes inteiro.
     */
    export interface MonthPayload {
        Periods: MonthRow[]
        /**
         * O gasto do mes que nao casou com fatia nenhuma. Num mes sem fatia alguma e o gasto
         * inteiro - o que e a resposta certa, e nao zero.
         */
        Unbudgeted: number
    }

    /** O alvo resolvido da fatia: PELO MENOS um dos dois. Ver BudgetTarget.section.ts. */
    export interface BudgetTargetPayload {
        IdCategory: number | null
        IdPerson: number | null
    }

    export interface CreateBudgetPeriodPayload {
        /**
         * A categoria da fatia. Opcional, mas nao junto com IdPerson: o `or` do schema exige
         * pelo menos um, e o BudgetTarget confere de novo antes de escrever.
         */
        IdCategory?: number
        /** A pessoa da fatia - o eixo **analitico**, nunca o financeiro. */
        IdPerson?: number
        /** "YYYY-MM". O mes que esta sendo orcado - qualquer um, passado, corrente ou futuro. */
        ReferenceMonth: string
        LimitValue: number
        /** A partir de quantos por cento do valor o cliente deve alertar. */
        AlertPercent: number
    }

    /**
     * So o que e do valor. O alvo nao entra: muda-lo seria mover a fatia de lugar, e mover e
     * apagar esta e cadastrar outra.
     */
    export interface UpdateBudgetPeriodPayload {
        LimitValue: number
        AlertPercent?: number
    }
}
