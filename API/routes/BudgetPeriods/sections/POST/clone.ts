import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "root/routes/Categories/Categories.model"
import { Persons_model } from "root/routes/Persons/Persons.model"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Utils } from "root/Utils/Utils"
import { BudgetPeriods_model, class_BudgetPeriods_model } from "../../BudgetPeriods.model"
import { ClosedMonth } from "../ClosedMonth.section"
import { BudgetPeriodsNamespace } from "../types"

//  **Repete a repartição de um mês no outro.**
//
//  Sem a rotina do dia 1º, um mês novo nasce vazio — e é isso que a leva 9 quis: nada se
//  materializa sozinho. O preço é remontar em outubro as mesmas oito linhas de setembro, à
//  mão, todo mês, que é o trabalho repetido que faz a funcionalidade parar de ser usada no
//  terceiro mês. Esta rota é o desconto desse preço, e **só isso**: ela não faz nada que o
//  usuário não pudesse fazer com N `POST /BudgetPeriods`.
//
//  **É o mesmo gesto da Renda, e a simetria é de propósito**: as duas telas respondem "o mês
//  que vem se parece com este", e a resposta tem a forma da de lá — uma `msg` e a lista de ids
//  criados, que é como o cliente diz quantas linhas vieram e invalida o cache do mês certo.
//
//  **O desenho do corpo, porém, é o contrário do de lá, e vale dizer por quê.** A Renda clona
//  pelo `POST /Inflows/batch`: o cliente lista o mês passado, o usuário marca item a item, e
//  ao servidor sobra gravar. Aqui não há o que marcar — uma fatia não tem data a avançar, nem
//  rateio a rebuscar, e as três regras que separam o que vem do que não vem (alvo já existente,
//  alvo arquivado, mês fechado) são conhecimento que **só o servidor tem**. Um lote montado no
//  cliente teria que perguntar as três coisas antes de montar o corpo, e a resposta poderia
//  mudar entre a pergunta e a gravação.
//
//  Três coisas ficam de fora da cópia, e cada uma por um motivo diferente:
//
//  - **o alvo que já existe no destino** — clonar duas vezes não duplica nem sobrescreve. É a
//    mesma escolha que a materialização velha fazia ao só inserir o que faltava: o valor que já
//    está no mês é uma decisão que alguém tomou, e uma cópia não tem autoridade para desfazê-la;
//  - **o alvo arquivado** — categoria ou pessoa que saiu das listas não volta pela porta dos
//    fundos. É a mesma regra que faz a fatia de alvo arquivado sumir do `GET` do mês: sem nome
//    e sem cor não há o que mostrar, e orçar quem sumiu do rateio é orçar o que nada alimenta;
//  - **nada**, quando o destino está fechado: aí a rota inteira recusa, antes de escrever uma
//    linha sequer.
//
//  **403 e não 406 para o mês fechado**, como as outras três escritas da feature: o workspace e
//  o papel estão certos, o que falta é o mês estar aberto (ver ClosedMonth.section.ts). Dois
//  códigos para a mesma recusa dentro de uma feature só é pior do que qualquer um dos dois.
//
//  **A origem fechada não recusa.** Fechado quer dizer "não se escreve mais nele", e ler agosto
//  para montar dezembro não escreve em agosto — recusar aqui tiraria justamente o mês mais
//  provável de servir de modelo.
export class Clone {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: BudgetPeriodsNamespace.CloneBudgetMonthPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  A coluna guarda o dia 1: é o que faz os três índices parciais valerem, e é a forma
        //  em que as duas consultas de mês comparam.
        let From = Utils.monthStart(body.From)
        let To = Utils.monthStart(body.To)

        await ClosedMonth.assertMonthOpen(IdWorkspace, To)

        //  As quatro leituras do mês inteiro, nenhuma por linha. As duas listas de cadastro
        //  vêm **só com as ativas** — é o padrão dos dois models, e é ele que faz o alvo
        //  arquivado ficar para trás sem uma segunda consulta dizendo isso.
        let [source, destination, categories, persons] = await Promise.all([
            BudgetPeriods_model.getByMonth(IdWorkspace, From),
            BudgetPeriods_model.getByMonth(IdWorkspace, To),
            Categories_model.getByWorkspace(IdWorkspace),
            Persons_model.getByWorkspace(IdWorkspace),
        ])

        if (!source.length) {
            throw new APIError({
                msg: "O mês de origem não tem orçamento para copiar.",
                status: 406,
                data: { IdWorkspace, From },
            })
        }

        let activeCategories = new Set(categories.map((category) => category.IdCategory))
        let activePersons = new Set(persons.map((person) => person.IdPerson))

        //  **A chave é o alvo INTEIRO**, não uma das duas colunas: "Mercado" e "Maria em
        //  Mercado" são fatias diferentes do mesmo mês e convivem, porque a segunda não é um
        //  teto dentro da primeira — as duas somam lado a lado. Comparar só a categoria faria
        //  a segunda ser pulada por causa da primeira.
        let taken = new Set(destination.map((period) => targetKey(period.IdCategory, period.IdPerson)))

        let pending = source.filter((period) => {
            if (period.IdCategory !== null && !activeCategories.has(period.IdCategory)) return false
            if (period.IdPerson !== null && !activePersons.has(period.IdPerson)) return false

            return !taken.has(targetKey(period.IdCategory, period.IdPerson))
        })

        //  **Zero linha a copiar não é erro.** Clonar de novo um mês já clonado é exatamente
        //  isso, e é o caminho normal de quem clicou duas vezes — responder 406 ensinaria que
        //  o botão quebrou. Quem conta quantas vieram é o cliente, pelo tamanho da lista.
        if (!pending.length) {
            return { msg: "Nada a copiar: o mês de destino já tem estas fatias.", IdBudgetPeriods: [] }
        }

        //  Tudo ou nada, como o lote da Renda e pelo mesmo motivo: com um insert solto por
        //  linha, a terceira recusada deixaria metade do mês montado e sem como voltar atrás.
        //  O `returnId` não aceita insert em lote, então são N inserts dentro de UMA
        //  transaction — que é o que o `createBatch` de lá também faz.
        let IdBudgetPeriods = await KnexTransaction(async (tx) => {
            let model = new class_BudgetPeriods_model(tx)
            let ids: number[] = []

            for (let period of pending) {
                ids.push(await model.create({
                    IdWorkspace,
                    IdCategory: period.IdCategory,
                    IdPerson: period.IdPerson,
                    ReferenceMonth: To,
                    LimitValue: period.LimitValue,
                    AlertPercent: period.AlertPercent,
                    //  Sem Status nem ClosedAt: a cópia nasce aberta, como qualquer fatia. Um
                    //  mês fechado copiado para um aberto traria o carimbo do mês errado e
                    //  travaria o destino contra a edição que a cópia existe para poupar.
                }).returnId("IdBudgetPeriod"))
            }

            return ids
        })

        return { msg: "Orçamento copiado com sucesso", IdBudgetPeriods }
    }
}

//  O alvo como string, para caber num Set: `NULL` não é comparável por igualdade em lugar
//  nenhum — nem no SQL nem aqui —, e é justamente o alvo ausente que distingue um formato do
//  outro.
function targetKey(IdCategory: number | null, IdPerson: number | null) {
    return `${IdCategory ?? ""}|${IdPerson ?? ""}`
}
