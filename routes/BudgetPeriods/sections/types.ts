export namespace BudgetPeriodsNamespace {

    //  Só o que é do mês. A categoria não entra: mudar a categoria de um período seria mover o
    //  teto de lugar, e isso é apagar este e cadastrar outro.
    export interface UpdateBudgetPeriodPayload {
        LimitValue: number
        AlertPercent?: number
    }
}
