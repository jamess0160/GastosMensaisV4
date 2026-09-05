import { Knex } from "knex"
import { class_PaymentMethods_model } from "../../PaymentMethods.model"
import { AccountsNamespace } from "root/routes/Accounts/sections/types"

//  As formas de pagamento que nascem com a conta, uma regra por tipo de conta.
//
//  É regra do modelo, não conveniência de cadastro: PaymentMethods é o único lugar onde forma
//  de pagamento existe, então conta sem linha aqui não recebe gasto nenhum. Cartão de crédito
//  é o que o usuário adiciona depois, quantos ele tiver — e só em conta 'checking'
//  (PaymentMethodKind.assertAccountAcceptsKind).
//
//  Recebe a transaction em vez de abrir a sua, como o Workspaces/POST/create faz: quem chama
//  é a criação da conta, e as duas escritas têm que cair ou passar juntas.
export class CreateDefaults {

    private readonly PaymentMethods_model: class_PaymentMethods_model

    constructor(tx: Knex.Transaction) {
        this.PaymentMethods_model = new class_PaymentMethods_model(tx)
    }

    public async run(IdWorkspace: number, IdAccount: number, data: AccountsNamespace.CreateAccountPayload) {

        if (data.Type === "cash") {
            return await this.PaymentMethods_model.create([
                { IdWorkspace, IdAccount, Name: "Dinheiro", Kind: "debit", Position: 1 },
            ])
        }

        //  O vale-alimentação: o mecanismo é o do 'cash' e o que muda é o nome, que ali é fixo
        //  e aqui é o da conta — "Vale Alimentação" é o que o usuário quer ver na hora de
        //  escolher como pagou.
        //
        //  'debit' e não um Kind novo: vale não tem fatura, e o gasto sai do saldo no ato, que
        //  é exatamente o que 'debit' significa no modelo. Um Kind='voucher' seria um valor sem
        //  regra própria — o InvoiceDates continuaria devolvendo nulos e o AccountBalance
        //  continuaria somando igual — e todo switch do sistema ganharia um caso que não muda
        //  nada.
        if (data.Type === "card") {
            return await this.PaymentMethods_model.create([
                { IdWorkspace, IdAccount, Name: data.Name, Kind: "debit", Position: 1 },
            ])
        }

        //  Sem DueDay/ClosingOffsetDays: fatura só existe em cartão de crédito.
        return await this.PaymentMethods_model.create([
            { IdWorkspace, IdAccount, Name: "Pix", Kind: "pix", Position: 1 },
            { IdWorkspace, IdAccount, Name: "Débito", Kind: "debit", Position: 2 },
        ])
    }
}
