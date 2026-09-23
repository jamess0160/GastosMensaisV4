import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "root/routes/Categories/Categories.model"
import { Persons_model } from "root/routes/Persons/Persons.model"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Utils } from "root/Utils/Utils"
import { BudgetPeriods_model, class_BudgetPeriods_model } from "../../BudgetPeriods.model"
import { BudgetTarget } from "../BudgetTarget.section"
import { ClosedMonth } from "../ClosedMonth.section"
import { BudgetPeriodsNamespace } from "../types"

//  **O rateio da renda do mês, gravado de uma vez: esta rota SUBSTITUI o mês inteiro.**
//
//  É o gesto que a tela do orçamento faz, e ele não é a soma de N escritas soltas: o usuário
//  mexe em cinco linhas, apaga uma, cria outra e clica em salvar UMA vez. Com POST, PUT e
//  DELETE linha a linha, esse clique seria sete requisições em sequência — e a quarta falhando
//  deixaria o mês num rateio que ninguém escreveu, metade novo e metade velho, sem nada que
//  desfizesse. Aqui é uma transaction: ou o mês fica como a tela mostra, ou não muda nada.
//
//  **A identidade de uma linha é o ALVO, não o `IdBudgetPeriod`** — e o corpo, por isso, não
//  carrega id nenhum. É a mesma regra que o PUT já impõe ao recusar alvo no corpo: mover uma
//  fatia de lugar é apagar esta e cadastrar outra, porque é o alvo que diz o que a linha soma.
//  Daí os quatro casos:
//
//  - **alvo que já existe no mês** — a linha é atualizada no lugar (`LimitValue`,
//    `AlertPercent`). O `IdBudgetPeriod` sobrevive, e com ele o `CreatedAt`: trocar 500 por 600
//    em "Mercado" não é uma fatia nova;
//  - **alvo que ainda não existe** — insere;
//  - **alvo que sumiu da lista** — **apaga fisicamente**, que é o que o DELETE da feature já faz
//    com uma linha só, e pelo mesmo motivo: a fatia é plano, não lançamento — nada aponta para
//    ela e nenhum dinheiro passou por ali. Um `Active = false` aqui seria pior do que inútil: a
//    linha continuaria ocupando o índice parcial do alvo, e o próximo rateio que voltasse a
//    orçar "Mercado" levaria 23505 como 500;
//  - **uma linha que MUDOU de alvo** não é um caso à parte: ela chega como um alvo que sumiu
//    (apaga) mais um alvo novo (insere). Nada se perde nessa troca — o `Spent` não é da linha,
//    é do mês, e é recalculado a cada leitura.
//
//  **A exceção da substituição é o alvo ARQUIVADO, e ela é obrigatória.** `GET /BudgetPeriods`
//  não devolve a fatia cujo alvo foi arquivado — sem nome e sem cor não há o que mostrar —,
//  então ela nunca esteve na tela e o cliente não tem como reenviá-la. Apagá-la aqui seria
//  perder, calado e para sempre, uma linha que ninguém viu: salvar o rateio viraria um delete
//  escondido de tudo que a leitura esconde. A promessa fica sendo "esta rota substitui o que a
//  tela enxerga", que é a única que ela pode cumprir — e é a mesma escolha do `clone`, que
//  deixa o alvo arquivado para trás em vez de copiá-lo.
//
//  **Sobrar é legítimo, e a rota não confere fechamento nenhum contra a renda.** É a diferença
//  que separa este rateio dos dois eixos do gasto: lá a soma das partes TEM que bater com o
//  total, em centavos, e não bater é 406; aqui o que não foi alocado é simplesmente o que não
//  foi alocado, e alocar mais do que entrou é decisão de quem orça — a renda do mês ainda pode
//  crescer. A API nem lê a renda para responder isto: quem avisa do estouro é a tela.
//
//  **Mês fechado recusa com 403**, antes de escrever uma linha, como as outras escritas da
//  feature: o workspace e o papel estão certos, o que falta é o mês estar aberto.
export class Allocate {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: BudgetPeriodsNamespace.AllocateBudgetMonthPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  A coluna guarda o dia 1: é o que faz os três índices parciais valerem.
        let ReferenceMonth = Utils.monthStart(body.ReferenceMonth)

        await ClosedMonth.assertMonthOpen(IdWorkspace, ReferenceMonth)

        //  **O alvo repetido dentro do próprio corpo é 406, e a conferência é aqui porque o Joi
        //  não a alcança**: ele valida linha a linha e não vê o conjunto. Sem isto, a segunda
        //  linha do mesmo alvo ou estouraria o índice parcial como 500, ou — pior — seria
        //  tratada como a mesma fatia e sobrescreveria a primeira calada, gravando um rateio
        //  diferente do que a tela mostrava.
        //  `Omit` dos dois ids: o alvo que entra no Map é o **resolvido** pelo BudgetTarget —
        //  `null` onde o corpo trouxe `undefined` —, e é `null` o que vai para a coluna. O
        //  índice parcial só reconhece o formato da linha pelo `NULL` que ela tem.
        let lines = new Map<string, Omit<BudgetPeriodsNamespace.AllocateBudgetLine, "IdCategory" | "IdPerson"> & BudgetPeriodsNamespace.BudgetTargetPayload>()

        for (let line of body.Lines) {
            //  Pelo menos um alvo, e visível a este workspace — a mesma barreira do POST de uma
            //  linha só, chamada por linha porque cada uma tem o seu alvo.
            let target = await BudgetTarget.assertTarget(IdWorkspace, {
                IdCategory: line.IdCategory,
                IdPerson: line.IdPerson,
                ReferenceMonth: body.ReferenceMonth,
                LimitValue: line.LimitValue,
                AlertPercent: line.AlertPercent ?? DEFAULT_ALERT_PERCENT,
            })

            let key = targetKey(target.IdCategory, target.IdPerson)

            if (lines.has(key)) {
                throw new APIError({
                    msg: "Há duas linhas para o mesmo alvo neste mês. Some os valores numa linha só.",
                    status: 406,
                    data: { IdWorkspace, ReferenceMonth, ...target },
                })
            }

            lines.set(key, { ...line, ...target })
        }

        //  As três leituras do mês inteiro, nenhuma por linha. As duas listas de cadastro vêm
        //  **só com as ativas** — é o padrão dos dois models —, e é delas que sai quem está
        //  arquivado, sem uma segunda consulta dizendo isso.
        let [current, categories, persons] = await Promise.all([
            BudgetPeriods_model.getByMonth(IdWorkspace, ReferenceMonth),
            Categories_model.getByWorkspace(IdWorkspace),
            Persons_model.getByWorkspace(IdWorkspace),
        ])

        let activeCategories = new Set(categories.map((category) => category.IdCategory))
        let activePersons = new Set(persons.map((person) => person.IdPerson))

        //  Visível é o que o GET devolveria — e é só isso que esta rota substitui. Ver o
        //  cabeçalho: a fatia de alvo arquivado não esteve na tela, então ela não some por não
        //  ter voltado no corpo.
        let isVisible = (period: BudgetPeriodsNamespace.BudgetTargetPayload) =>
            (period.IdCategory === null || activeCategories.has(period.IdCategory))
            && (period.IdPerson === null || activePersons.has(period.IdPerson))

        let existingByTarget = new Map(current.map((period) => [targetKey(period.IdCategory, period.IdPerson), period]))

        let removed = current.filter((period) => isVisible(period) && !lines.has(targetKey(period.IdCategory, period.IdPerson)))

        //  Tudo ou nada, como o lote do `clone` e pelo mesmo motivo — e aqui com mais razão: o
        //  delete das linhas que sumiram já aconteceu quando o terceiro insert falha, e não há
        //  `Active` para desfazê-lo depois.
        let IdBudgetPeriods = await KnexTransaction(async (tx) => {
            let model = new class_BudgetPeriods_model(tx)
            let ids: number[] = []

            //  **Apagar antes de escrever, e não depois.** Uma linha que mudou de alvo chega
            //  como remoção mais inserção, e os dois alvos podem ser o mesmo par de colunas de
            //  duas linhas diferentes: inserir primeiro esbarraria no índice parcial da linha
            //  que ainda não foi apagada.
            for (let period of removed) {
                await model.delete(period.IdBudgetPeriod)
            }

            //  A ordem da resposta é a do corpo, que é a ordem da tela — e não a que o banco
            //  devolveria.
            for (let line of lines.values()) {
                let existing = existingByTarget.get(targetKey(line.IdCategory, line.IdPerson))

                if (existing) {
                    //  **Atualiza no lugar, sem tocar no alvo nem no mês**: as duas colunas do
                    //  alvo são a identidade da linha, e já casaram para ela ter sido achada.
                    await model.update(existing.IdBudgetPeriod, {
                        LimitValue: line.LimitValue,
                        ...(line.AlertPercent === undefined ? {} : { AlertPercent: line.AlertPercent }),
                    })

                    ids.push(existing.IdBudgetPeriod)
                    continue
                }

                ids.push(await model.create({
                    IdWorkspace,
                    IdCategory: line.IdCategory,
                    IdPerson: line.IdPerson,
                    ReferenceMonth,
                    LimitValue: line.LimitValue,
                    AlertPercent: line.AlertPercent ?? DEFAULT_ALERT_PERCENT,
                    //  Sem Status nem ClosedAt: a linha nasce aberta, como qualquer fatia — e o
                    //  mês fechado já foi recusado lá em cima.
                }).returnId("IdBudgetPeriod"))
            }

            return ids
        })

        return { msg: "Orçamento do mês salvo com sucesso", IdBudgetPeriods }
    }
}

//  O mesmo default do POST de uma linha só. Escrito aqui e não só no Joi porque o corpo desta
//  rota chega com a linha inteira opcional no campo, e o insert precisa de um número.
const DEFAULT_ALERT_PERCENT = 80

//  O alvo como string, para caber num Map: `NULL` não é comparável por igualdade em lugar
//  nenhum — nem no SQL nem aqui —, e é justamente o alvo ausente que distingue um formato do
//  outro. É a mesma função do `clone`, repetida de propósito: são duas linhas privadas de duas
//  sections, e compartilhá-las amarraria duas rotas que não se conhecem.
function targetKey(IdCategory: number | null, IdPerson: number | null) {
    return `${IdCategory ?? ""}|${IdPerson ?? ""}`
}
