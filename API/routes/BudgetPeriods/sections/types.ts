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

    /**
     * Repetir a reparticao de um mes no outro: dois meses, "YYYY-MM", e nada mais.
     *
     * Nao ha lista de itens no corpo, ao contrario do lote da Renda, porque nao ha o que
     * escolher: uma fatia nao tem data a avancar nem rateio a rebuscar, e as tres regras que
     * separam o que vem do que nao vem - alvo ja existente, alvo arquivado, mes fechado - sao
     * conhecimento que so o servidor tem. Ver sections/POST/clone.ts.
     */
    export interface CloneBudgetMonthPayload {
        /** O mes que serve de modelo. Fechado serve igual: ler agosto nao escreve em agosto. */
        From: string
        /** O mes que recebe as copias. FECHADO RECUSA, com 403, antes de escrever uma linha. */
        To: string
    }

    /**
     * Uma linha do rateio da renda do mes, como a tela a manda.
     *
     * **Sem IdBudgetPeriod, de proposito**: a identidade de uma linha e o ALVO, e nao o id. E a
     * mesma regra que o PUT ja impoe ao recusar alvo no corpo - mover uma fatia de lugar e
     * apagar esta e cadastrar outra, porque e o alvo que diz o que a linha soma. Ver
     * sections/POST/allocate.ts.
     */
    export interface AllocateBudgetLine {
        IdCategory?: number
        IdPerson?: number
        LimitValue: number
        /** Ausente vale 80, o mesmo default do POST de uma linha so. */
        AlertPercent?: number
    }

    /**
     * **O rateio do mes inteiro, numa escrita so.**
     *
     * A lista nao e um lote de criacoes: ela e o mes DEPOIS da escrita. O que esta no banco e
     * nao esta aqui e apagado - fisicamente, como o DELETE de uma linha so -, o que esta nos
     * dois e atualizado no lugar, e o que so esta aqui e inserido. Tudo dentro de uma
     * transaction: ou o mes fica como a tela mostra, ou nao muda nada.
     *
     * **A lista VAZIA e legitima** e quer dizer "este mes nao tem orcamento": e o usuario que
     * apagou todas as linhas e salvou. Nao e a chamada montada errada que o `min(1)` do lote da
     * Renda barra - la a lista vazia nao tinha o que significar.
     */
    export interface AllocateBudgetMonthPayload {
        /** "YYYY-MM". FECHADO RECUSA, com 403, antes de escrever uma linha. */
        ReferenceMonth: string
        Lines: AllocateBudgetLine[]
    }

    /**
     * Um alvo da previa: o mesmo alvo da fatia, **sem valor nenhum**.
     *
     * Pelo menos um dos dois, como em toda parte desta feature - o `or` do Joi barra o item sem
     * alvo. Nao ha `LimitValue` nem `AlertPercent` porque a previa nao pergunta nada sobre o
     * valor: ela responde quanto JA foi gasto contra aquele alvo, que e justamente o numero que
     * decide o valor que a pessoa vai digitar.
     */
    export interface PreviewBudgetTarget {
        IdCategory?: number
        IdPerson?: number
    }

    /**
     * **O corpo do `allocate` sem os valores** - e a simetria e deliberada: a previa pergunta o
     * que o allocate faria, e a resposta dela e a mesma que o `GET` do mes daria depois de
     * salvar.
     *
     * **A lista VAZIA e legitima**, pelo mesmo motivo do allocate e com uma resposta que importa:
     * um mes sem fatia nenhuma tem `Unbudgeted` igual ao gasto inteiro dele, e essa e a resposta
     * certa, nao zero.
     */
    export interface PreviewBudgetMonthPayload {
        /** "YYYY-MM". Mes FECHADO responde: ler agosto em novembro nao escreve em agosto. */
        ReferenceMonth: string
        Targets: PreviewBudgetTarget[]
    }

    /** O comprometido de UM alvo. O alvo volta resolvido (`null` onde o corpo omitiu), porque e
     *  por ele que a tela acha a linha - a previa nao tem id para devolver. */
    export interface PreviewTargetSpent extends BudgetTargetPayload {
        /** Ver BudgetSpent.section.ts: a mesma regra, o mesmo numero que o `GET` daria. */
        Spent: number
    }

    /**
     * A previa do mes: o comprometido de cada alvo do corpo, **na ordem em que ele os mandou**, e
     * o que sobrou fora de todos eles.
     *
     * Fecha a mesma conta do `GET`: soma dos `Spent` + `Unbudgeted` = o gasto do mes inteiro.
     */
    export interface PreviewPayload {
        Targets: PreviewTargetSpent[]
        Unbudgeted: number
    }
}
