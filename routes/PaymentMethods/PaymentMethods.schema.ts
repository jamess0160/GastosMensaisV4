import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { color, isoDate } from "root/Utils/joiSchemas"

const day = Joi.number().integer().min(1).max(31)

//  A folga do emissor: quantos dias antes do vencimento a fatura fecha. Não há padrão do setor
//  — fica tipicamente entre 6 e 10 dias, e 7 é o mais comum, que é o default aqui. O teto de 28
//  é o que impede uma folga de virar o mês inteiro e jogar o fechamento antes da fatura
//  anterior.
const closingOffset = Joi.number().integer().min(1).max(28)

//  Exportado porque a forma de pagamento sai embutida na conta (GET /Accounts) e é
//  daqui que a forma da linha tem que sair — o schema da conta importa este, e não o
//  contrário: quem embute depende de quem é embutido.
export const paymentMethodResponse = Joi.object({
    IdPaymentMethod: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    IdAccount: Joi.number().required(),
    Name: Joi.string().required(),
    Kind: Joi.string().valid("pix", "debit", "credit_card").required(),
    DueDay: Joi.number().allow(null).required(),
    ClosingOffsetDays: Joi.number().allow(null).required(),
    IconPath: Joi.string().allow(null).required(),
    Color: Joi.string().allow(null).required(),
    Position: Joi.number().allow(null).required(),
    Active: Joi.boolean().required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
})

class Schema {

    //  Sem IdWorkspace em lugar nenhum: ele vem do token da sessão. O IdAccount continua no
    //  body porque é escolha do cliente dentro do workspace que ele já selecionou.
    public readonly create = [
        joiController.validateBody(Joi.object({
            IdAccount: Joi.number().required(),
            Name: Joi.string().trim().max(255).required(),
            //  Só cartão: pix e débito nascem com a conta, em sections/POST/createDefaults.ts.
            Kind: Joi.string().valid("credit_card").required(),
            //  O `when` é o que o ROADMAP pede junto com a checagem da section: vencimento e
            //  fechamento só existem em cartão, e o banco não tem CHECK para isso. O valid()
            //  acima já deixa o Kind fixo, mas a condição fica explícita porque ela é a regra —
            //  não uma consequência de quais Kind esta rota aceita hoje.
            //
            //  Só o vencimento é obrigatório, e é de propósito: é o único dos dois que o
            //  usuário sabe de cabeça. A folga tem default porque pedir um número que ele teria
            //  que deduzir foi exatamente o que fez o modelo anterior aceitar dado inventado.
            //  O dia 29, 30 ou 31 segue aceito — o vencimento é a âncora e é reaplicado a
            //  partir da compra a cada mês, então o grampeamento de fevereiro não arrasta.
            DueDay: day.when("Kind", { is: "credit_card", then: Joi.required(), otherwise: Joi.forbidden() }),
            ClosingOffsetDays: closingOffset.when("Kind", { is: "credit_card", then: closingOffset.default(7), otherwise: Joi.forbidden() }),
            //  Sem Brand e sem LastDigits: nenhuma regra do sistema lia qualquer um dos dois, e
            //  quem identifica o cartão na tela é o Name, que o usuário escreve. Mandá-los é
            //  406 pelo unknown do Joi.
            IconPath: Joi.string().trim().max(255).allow(null).default(null),
            Color: color.allow(null).default(null),
            Position: Joi.number().integer().allow(null).default(null),
        })),
        joiController.validateResponse(Joi.object({
            IdPaymentMethod: Joi.number().required(),
        })),
    ]

    public readonly update = [
        joiController.validateParams(Joi.object({
            IdPaymentMethod: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            //  Sem Kind e sem IdAccount: um pix não vira cartão e um cartão não muda de conta.
            //  As duas trocas reescreveriam o significado das compras já lançadas nele.
            Name: Joi.string().trim().max(255).required(),
            //  Opcionais, e o null é recusado pela section quando a linha é cartão: quem sabe
            //  o Kind gravado é ela, não o schema. Ver PaymentMethodKind.section.ts.
            DueDay: day.allow(null).optional(),
            ClosingOffsetDays: closingOffset.allow(null).optional(),
            IconPath: Joi.string().trim().max(255).allow(null).optional(),
            Color: color.allow(null).optional(),
            Position: Joi.number().integer().allow(null).optional(),
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdPaymentMethod: Joi.number().required(),
        })),
    ]

    //  A fatura é identificada pelo **vencimento**, não por um id: ela não é linha de tabela
    //  nenhuma. O DueDate é o mesmo que veio na perna, em GET /ExpensePayments.
    public readonly payInvoice = [
        joiController.validateParams(Joi.object({
            IdPaymentMethod: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            DueDate: isoDate.required(),
        })),
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
            /** Quantas pernas mudaram de estado — zero quando a fatura já estava assim. */
            Payments: Joi.number().required(),
        })),
    ]

    public readonly unpayInvoice = this.payInvoice
}

export const PaymentMethods_schema = new Schema()
