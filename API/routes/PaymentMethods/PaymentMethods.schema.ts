import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { color, isoDate } from "root/Utils/joiSchemas"

const day = Joi.number().integer().min(1).max(31)

//  O dia do mês em que a fatura fecha. **Mesmo intervalo do vencimento (1 a 31), porque é a
//  mesma coisa: um dia do mês.** Era uma folga em dias (`ClosingOffsetDays`), e a folga errava
//  por construção — 04/09 menos 8 dias é 27/08, mas 04/10 menos 8 dias é 26/09, então o mesmo
//  cartão fechava em dois dias diferentes. O emissor brasileiro fecha num dia fixo do mês.
const closingDay = Joi.number().integer().min(1).max(31)

//  **Em qual mês a compra do cartão pesa.** Enum e não booleano: `IsEveryday: true` é
//  ilegível em seis meses.
//
//      invoice   -> no mês do vencimento da fatura — quem usa o cartão para adiar
//      purchase  -> no mês da compra, como se fosse débito — quem paga a fatura inteira
//
//  Só governa a competência (o orçamento e o "posso gastar"); o saldo da conta continua
//  saindo pela `CashDate` da perna, e por isso é idêntico nos dois modos.
const competenceMode = Joi.string().valid("invoice", "purchase")

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
    ClosingDay: Joi.number().allow(null).required(),
    //  Nulo fora do cartão: sem fatura não há defasagem entre consumo e pagamento a escolher.
    CompetenceMode: competenceMode.allow(null).required(),
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
            //  **Os dois são obrigatórios, e o fechamento não tem default.** A folga que ele
            //  substituiu tinha um (7 dias), e o default era defensável porque uma folga se
            //  deduz do que o setor pratica; um *dia do mês* não se deduz de nada — inventar
            //  um seria gravar exatamente o dado errado que esta etapa existe para corrigir.
            //  São dois números que a pessoa lê na fatura, e a tela pergunta os dois.
            //
            //  O dia 29, 30 ou 31 segue aceito nos dois — eles são reaplicados a cada mês a
            //  partir da compra, então o grampeamento de fevereiro não arrasta.
            DueDay: day.when("Kind", { is: "credit_card", then: Joi.required(), otherwise: Joi.forbidden() }),
            ClosingDay: closingDay.when("Kind", { is: "credit_card", then: Joi.required(), otherwise: Joi.forbidden() }),
            //  **O padrão é 'purchase'**, e o padrão é o que serve a quem não vai configurar
            //  nada: quem usa o cartão para adiar sabe que está adiando e vai procurar a opção.
            //  O caminho contrário — nascer 'invoice' — deixaria o "posso gastar" mostrando o
            //  mês quase inteiro livre no dia 20, com metade do salário já passada no cartão.
            CompetenceMode: competenceMode.when("Kind", { is: "credit_card", then: competenceMode.default("purchase"), otherwise: Joi.forbidden() }),
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
            ClosingDay: closingDay.allow(null).optional(),
            //  **Trocar o modo vale para o futuro.** A data é congelada na perna no lançamento,
            //  então virar a chave em novembro não reescreve agosto. Recalcular um cartão
            //  inteiro, se um dia fizer falta, é ação explícita — nunca efeito de um PUT.
            CompetenceMode: competenceMode.allow(null).optional(),
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
