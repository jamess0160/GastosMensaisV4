import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { isoDate, periodQuery } from "root/Utils/joiSchemas"
import { tagResponse } from "root/routes/Tags/Tags.schema"

const status = Joi.string().valid("pending", "paid", "canceled")
const kind = Joi.string().valid("single", "installment", "fixed")

//  **Valor de gasto: negativo é válido, zero não.**
//
//  O negativo é o **estorno** — a compra que volta na fatura. Ele não é uma entrada: se fosse
//  um `Inflow`, o saldo da conta subiria no mês do estorno e a fatura continuaria sendo paga
//  cheia, errado dos dois lados. Nenhum dinheiro entra na conta num estorno; **a fatura é que
//  encolhe**, e é por isso que ele é um gasto com o sinal trocado.
//
//  Zero continua proibido, aqui e nos CHECKs do banco: gasto de zero não é lançamento nenhum.
//
//  As regras que o sinal exige — só no cartão, um sinal por gasto, só em `single` — não cabem
//  no Joi porque dependem da forma de pagamento e do Kind ao mesmo tempo. Moram no
//  sections/ExpenseAxes.section.ts.
const money = Joi.number().precision(2).invalid(0)

//  Uma perna do eixo financeiro. O Paid nasce do cliente porque o gasto no débito costuma já
//  estar pago no ato; no cartão ele fica em aberto e se quita pela rota da perna.
const paymentItem = Joi.object({
    IdPaymentMethod: Joi.number().required(),
    Value: money.required(),
    Paid: Joi.boolean().default(false),
})

//  Uma linha do eixo analítico. Valor absoluto, nunca porcentagem.
const splitItem = Joi.object({
    IdPerson: Joi.number().required(),
    Value: money.required(),
})

//  Exportado porque a lista de pernas do período (GET /ExpensePayments) devolve o gasto de
//  origem dentro de cada linha, e a forma dele tem que ser descrita uma vez só.
//
//  A forma da perna (expensePaymentResponse) e a do rateio ficam **aqui**, e não na pasta de
//  ExpensePayments, para não haver import circular: o gasto embute a perna e a perna embute o
//  gasto, então um dos dois lados tem que ser a origem — e é este, que é o dono das duas filhas.
export const expenseResponse = Joi.object({
    IdExpense: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    IdUser: Joi.number().allow(null).required(),
    Description: Joi.string().required(),
    TotalValue: Joi.number().required(),
    //  Derivado das pernas, nunca escrito por rota — ver sections/ExpenseStatus.section.ts.
    Status: status.required(),
    IdCategory: Joi.number().allow(null).required(),
    ExpenseDate: isoDate.required(),
    Kind: kind.required(),
    IdParentExpense: Joi.number().allow(null).required(),
    RecurrenceDay: Joi.number().allow(null).required(),
    RecurrenceEndDate: isoDate.allow(null).required(),
    Notes: Joi.string().allow(null).required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
})

//  A perna como ela sai na leitura: com as datas da fatura em que caiu.
export const expensePaymentResponse = Joi.object({
    IdExpensePayment: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    IdExpense: Joi.number().required(),
    IdPaymentMethod: Joi.number().required(),
    Value: Joi.number().required(),
    InstallmentNumber: Joi.number().allow(null).required(),
    InstallmentTotal: Joi.number().allow(null).required(),
    //  Nulas fora do cartão de crédito: pix e débito não têm fatura.
    ClosingDate: isoDate.allow(null).required(),
    DueDate: isoDate.allow(null).required(),
    //  A data em que a perna pesa, congelada no lançamento: o vencimento quando existe, senão o
    //  dia do gasto. É por ela que o saldo, o orçamento e a lista de pernas filtram o mês.
    CompetenceDate: isoDate.required(),
    //  "A cobrança entrou na fatura" — **nulo fora do cartão**, e é isso que diz se a perna é de
    //  cartão. Não confundir com Paid: marcar Charged não move saldo nenhum.
    Charged: Joi.boolean().allow(null).required(),
    ChargedAt: Joi.date().allow(null).required(),
    //  "O dinheiro saiu da conta". No cartão, quem escreve é o payInvoice — e mais ninguém.
    Paid: Joi.boolean().required(),
    PaidAt: Joi.date().allow(null).required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
})

//  Uma linha do eixo analítico como ela sai na leitura. Sem a pessoa embutida: o cliente já
//  tem a lista de Persons e o nome sai de lá — o mesmo argumento que deixa a forma de pagamento
//  como id na lista de pernas.
export const expensePersonResponse = Joi.object({
    IdExpensePerson: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    IdExpense: Joi.number().required(),
    IdPerson: Joi.number().required(),
    Value: Joi.number().required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
})

class Schema {

    public readonly getByWorkspace = [
        //  From/To é o formato de período compartilhado com Inflows (Utils/joiSchemas.ts).
        joiController.validateQuery(Joi.object({
            ...periodQuery,
            Status: status.optional(),
            Kind: kind.optional(),
            IdCategory: Joi.number().optional(),
            //  Ausente ou false: a resposta de sempre, sem cancelado. True: a lista completa, e
            //  quem separa por status é o cliente — é o que faz o filtro multi-seleção da tela
            //  caber numa requisição só, sobre o mês que já está em cache.
            IncludeCanceled: Joi.boolean().default(false),
        })),
        joiController.validateResponse(Joi.array().items(expenseResponse)),
    ]

    public readonly getUnique = [
        joiController.validateParams(Joi.object({
            IdExpense: Joi.number().required(),
        })),
        //  Os dois eixos saem em listas separadas, e é assim que a resposta ensina o modelo:
        //  duas formas de pagamento e duas pessoas são 2 + 2 linhas, nunca 4.
        joiController.validateResponse(expenseResponse.keys({
            Payments: Joi.array().items(expensePaymentResponse).required(),
            Persons: Joi.array().items(expensePersonResponse).required(),
            //  A tag inteira, não a linha de vínculo: o cliente precisa do nome para desenhar
            //  a etiqueta, e o IdExpenseTag não serve para nada — não há rota que o receba.
            Tags: Joi.array().items(tagResponse).required(),
        })),
    ]

    public readonly create = [
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            //  O CHECK do banco garante <> 0. Em compra parcelada este é o total da compra,
            //  nunca o valor da parcela. **Negativo é estorno** — ver o `money` acima.
            TotalValue: money.required(),
            //  Obrigatória: é ela que responde "com o que eu gasto". A coluna continua nullable
            //  no banco por causa do ON DELETE SET NULL, mas nenhuma rota aceita gasto sem.
            IdCategory: Joi.number().required(),
            ExpenseDate: isoDate.required(),
            Kind: kind.default("single"),
            Notes: Joi.string().trim().allow(null).default(null),
            //  Eixo financeiro: pelo menos uma perna, e a soma fecha com o total.
            Payments: Joi.array().items(paymentItem).min(1).required(),
            //  Eixo analítico: opcional, mas se vier também fecha com o total.
            Persons: Joi.array().items(splitItem).default([]),
            //  **Texto, não id:** a tag não tem cadastro próprio, nasce com o gasto a partir do
            //  que foi digitado (Tags/sections/POST/resolveByName.ts). Opcional — a maioria dos
            //  gastos não tem nenhuma.
            Tags: Joi.array().items(Joi.string().trim().max(100)).default([]),
            //  Só em parcelado. min(2) porque "parcelado em 1x" é uma compra à vista.
            InstallmentTotal: Joi.number().integer().min(2).max(120).when("Kind", {
                is: "installment",
                then: Joi.required(),
                otherwise: Joi.forbidden(),
            }),
            //  Só em fixo. O dia da recorrência é opcional: sem ele, vale o dia da compra.
            RecurrenceDay: Joi.number().integer().min(1).max(31).when("Kind", {
                is: "fixed",
                then: Joi.optional(),
                otherwise: Joi.forbidden(),
            }),
            RecurrenceEndDate: isoDate.allow(null).when("Kind", {
                is: "fixed",
                then: Joi.optional(),
                otherwise: Joi.forbidden(),
            }),
            //  Sem Occurrences: quantas ocorrências nascem de uma vez é regra do servidor, não
            //  escolha de quem lança — a constante mora em sections/POST/createSeries.ts, junto
            //  do código que a usa. Mandar o campo é 406, pelo unknown do Joi.
            //
            //  Ele continua na RESPOSTA: a tela não precisa saber a janela antes de salvar, ela
            //  pergunta gravando e o servidor responde quantas nasceram.
            //
            //  Sem Status: ele é derivado das pernas.
        })),
        joiController.validateResponse(Joi.object({
            IdExpense: Joi.number().required(),
            /** Quantas linhas de gasto nasceram: 1, ou a série inteira em Kind='fixed'. */
            Occurrences: Joi.number().required(),
        })),
    ]

    public readonly update = [
        joiController.validateParams(Joi.object({
            IdExpense: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            TotalValue: money.required(),
            IdCategory: Joi.number().required(),
            ExpenseDate: isoDate.required(),
            Notes: Joi.string().trim().allow(null).optional(),
            //  Cada eixo: omitir mantém o gravado, enviar substitui inteiro.
            Payments: Joi.array().items(paymentItem).min(1).optional(),
            Persons: Joi.array().items(splitItem).optional(),
            //  Texto, como no create. Enviar substitui a lista inteira.
            Tags: Joi.array().items(Joi.string().trim().max(100)).optional(),
            //  Sem Kind, sem Status e sem recorrência: o formato não muda depois de lançado, o
            //  Status é derivado, e a série tem rota própria.
        })),
    ]

    public readonly updateSeries = [
        joiController.validateParams(Joi.object({
            IdExpense: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            TotalValue: money.required(),
            IdCategory: Joi.number().required(),
            Notes: Joi.string().trim().allow(null).optional(),
            Persons: Joi.array().items(splitItem).optional(),
            //  Sem ExpenseDate e sem Payments: mexer na data moveria a ocorrência de mês, e a
            //  forma de pagamento da série se troca ocorrência a ocorrência.
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdExpense: Joi.number().required(),
        })),
    ]

    public readonly removeSeries = this.remove
}

export const Expenses_schema = new Schema()
