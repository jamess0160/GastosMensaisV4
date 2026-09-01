import { Knex } from "knex"
import { class_PaymentMethods_model } from "../../PaymentMethods.model"
import { AccountsNamespace } from "root/routes/Accounts/sections/types"

//  O pix e o débito que nascem com a conta.
//
//  É regra do modelo, não conveniência de cadastro: PaymentMethods é o único lugar onde forma
//  de pagamento existe, então conta sem linha aqui não recebe gasto nenhum. Cartão de crédito
//  é o que o usuário adiciona depois, quantos ele tiver.
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
                { IdWorkspace, IdAccount, Name: `${data.Name}`, Kind: "debit", Position: 1 },
            ])
        }

        //  Sem ClosingDay/DueDay: fatura só existe em cartão de crédito.
        return await this.PaymentMethods_model.create([
            { IdWorkspace, IdAccount, Name: `${data.Name} - Pix`, Kind: "pix", Position: 1 },
            { IdWorkspace, IdAccount, Name: `${data.Name} - Débito`, Kind: "debit", Position: 2 },
        ])
    }
}
