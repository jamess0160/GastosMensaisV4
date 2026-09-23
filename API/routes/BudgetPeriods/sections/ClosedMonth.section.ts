import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { BudgetPeriods_model } from "../BudgetPeriods.model"

//  **Mês fechado não aceita escrita.**
//
//  `CloseBudgetMonth` é a única coisa no sistema que sabe que um mês acabou, e desde a leva 9 o
//  `ClosedAt` que ela carimba tem um segundo uso: ele é a trava que impede reescrever a
//  história de agosto em novembro. Com a definição perene morta, essa é a única coisa que ainda
//  separa "o mês que estou montando" de "o mês que já passou" — antes, o período congelado
//  fazia esse papel sozinho, porque ninguém montava mês nenhum à mão.
//
//  A regra vive numa section só porque são três escritas que a respeitam por três caminhos
//  diferentes — criar uma fatia num mês, corrigir o valor de uma, e apagar uma — e a terceira a
//  esquecer é a que deixaria o buraco.
//
//  **403 e não 406:** o mês existe e o usuário tem papel para escrever nele; o que falta é o
//  mês estar aberto. É o mesmo formato do viewer barrado pelo papel — a mensagem é que diz
//  qual das duas coisas travou.
class Controller {

    //  **Um mês sem linha nenhuma não está fechado.** Ele nunca foi montado, então não houve o
    //  que encerrar — e montá-lo agora é o caminho normal, inclusive para um mês passado que o
    //  usuário só agora resolveu registrar. O que a trava impede é mexer no mês que ELE já
    //  fechou, não inventar um estado de "mês que não deveria mais existir".
    public async assertMonthOpen(IdWorkspace: number, ReferenceMonth: string) {
        let closed = await BudgetPeriods_model.getClosedInMonth(IdWorkspace, ReferenceMonth)

        if (closed) {
            throw new APIError({
                msg: "Este mês já foi fechado e não aceita mais alterações no orçamento.",
                status: 403,
                data: { IdWorkspace, ReferenceMonth },
            })
        }
    }

    //  Aqui a resposta sai da própria linha, e não de uma segunda consulta: a rotina fecha o
    //  mês inteiro de uma vez, então o `Status` da linha e o do mês são o mesmo fato.
    public assertPeriodOpen(period: Database.BudgetPeriods) {
        if (period.Status === "closed") {
            throw new APIError({
                msg: "Este mês já foi fechado e não aceita mais alterações no orçamento.",
                status: 403,
                data: { IdBudgetPeriod: period.IdBudgetPeriod, ReferenceMonth: period.ReferenceMonth },
            })
        }
    }
}

export const ClosedMonth = new Controller()
