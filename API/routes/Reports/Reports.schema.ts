import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { isoDate, periodQuery, referenceMonth } from "root/Utils/joiSchemas"

//  A linha da fatura, descrita uma vez: ela sai em duas listas — o que está na fatura e o que
//  ainda é previsto —, e duas cópias do mesmo objeto divergiriam na primeira coluna nova.
const cardEntry = Joi.object({
    /** A data da **compra**, não a do vencimento */
    Date: isoDate.required(),
    Description: Joi.string().required(),
    /** Positivo: é o que a fatura cobra */
    Value: Joi.number().required(),
    IdExpense: Joi.number().required(),
    IdExpensePayment: Joi.number().required(),
    InstallmentNumber: Joi.number().allow(null).required(),
    InstallmentTotal: Joi.number().allow(null).required(),
    Paid: Joi.boolean().required(),
    /** "Está na fatura" — nasce `true` na perna de cartão, e é o que separa as duas listas */
    Charged: Joi.boolean().required(),
})

class Schema {

    public readonly getMonth = [
        //  Mês, e não From/To como nas listagens de movimento: os agregados do Dashboard são de
        //  um mês civil, e as duas pontas do cálculo (a abertura e o saldo) são **posições**.
        //  Opcional porque a tela abre no mês corrente — mesma regra de GET /Accounts.
        joiController.validateQuery(Joi.object({
            ReferenceMonth: referenceMonth.optional(),
        })),
        joiController.validateResponse(Joi.object({
            /** Normalizado para o dia 1, como o ReferenceMonth do orçamento */
            ReferenceMonth: isoDate.required(),
            /** O saldo realizado no fim do mês anterior — a abertura do "posso gastar" */
            OpeningBalance: Joi.number().required(),
            /**
             * O saldo inicial das contas **abertas dentro do mês**, que o `OpeningBalance` não
             * pode conter: em 01/09 elas ainda não existiam. Mesma linha `opening` do extrato.
             */
            InitialBalances: Joi.number().required(),
            /** Entradas com competência no mês, pendentes e recebidas, sem transferência */
            Inflows: Joi.number().required(),
            /** Pernas com competência no mês, pendentes e pagas */
            Expenses: Joi.number().required(),
            /**
             * Pernas que **pesaram num mês anterior mas cujo dinheiro ainda não saiu** — a
             * compra de agosto no cartão que vence em setembro. É o que costura a abertura
             * (caixa) com o fluxo do mês (competência).
             */
            PastCommitments: Joi.number().required(),
            /** Entradas de meses anteriores nunca recebidas */
            OverdueReceivable: Joi.number().required(),
            /** Pernas de meses anteriores nunca pagas */
            OverduePayable: Joi.number().required(),
            /** "Quanto ainda posso gastar" — a fórmula inteira */
            Available: Joi.number().required(),
            /** "Quanto tenho em conta" — a soma dos Balance das contas ativas no mês */
            CurrentBalance: Joi.number().required(),
            /** Quanto do saldo já tem dono: fatura vencendo no mês e ainda não paga */
            OpenInvoices: Joi.number().required(),
        })),
    ]

    public readonly getStatement = [
        joiController.validateQuery(Joi.object({
            ReferenceMonth: referenceMonth.optional(),
        })),
        joiController.validateResponse(Joi.object({
            ReferenceMonth: isoDate.required(),
            Accounts: Joi.array().items(Joi.object({
                IdAccount: Joi.number().required(),
                Name: Joi.string().required(),
                /** A conta arquivada continua tendo extrato dos meses em que teve movimento */
                Active: Joi.boolean().required(),
                OpeningBalance: Joi.number().required(),
                ClosingBalance: Joi.number().required(),
                //  **A soma das linhas fecha com a diferença entre as duas pontas**, e é a
                //  única coisa que este extrato promete.
                Entries: Joi.array().items(Joi.object({
                    Date: isoDate.required(),
                    Kind: Joi.string().valid("opening", "inflow", "transfer", "expense", "invoice").required(),
                    Description: Joi.string().required(),
                    /** Assinado: com sinal, conferir o extrato é somar a lista */
                    Value: Joi.number().required(),
                    //  Cada linha carrega o id do que a gerou, para a tela navegar do extrato
                    //  até o lançamento. Quais vêm depende do Kind.
                    IdInflow: Joi.number().optional(),
                    IdExpense: Joi.number().optional(),
                    IdExpensePayment: Joi.number().optional(),
                    IdPaymentMethod: Joi.number().optional(),
                })).required(),
            })).required(),
            //  A fatura: o par (cartão, vencimento), que é tudo que uma fatura é neste modelo.
            Cards: Joi.array().items(Joi.object({
                IdPaymentMethod: Joi.number().required(),
                Name: Joi.string().required(),
                DueDate: isoDate.required(),
                /** **Só o que está na fatura** — o previsto ainda não é cobrado */
                Total: Joi.number().required(),
                /** O que está na fatura */
                Entries: Joi.array().items(cardEntry).required(),
                /**
                 * **Previsto:** lançado no cartão e desmarcado porque o emissor ainda não
                 * registrou. Fica fora do `Total` e **dentro** da resposta: o `payInvoice`
                 * quita o ciclo inteiro, então essa perna sai da conta junto.
                 */
                Expected: Joi.array().items(cardEntry).required(),
            })).required(),
        })),
    ]

    //  **Sem validateResponse, e é a primeira rota do projeto assim:** a resposta é um arquivo,
    //  não um JSON — o Joi não descreve bytes. O AsyncHandler continua igual.
    public readonly getExport = [
        //  From/To, como todas as listagens de movimento — não ReferenceMonth: exportar é
        //  recortar, e um recorte de exportação não precisa ser um mês civil. As duas pontas
        //  são opcionais; sem nenhuma, a planilha sai com o histórico inteiro.
        joiController.validateQuery(Joi.object({
            ...periodQuery,
        })),
    ]
}

export const Reports_schema = new Schema()
