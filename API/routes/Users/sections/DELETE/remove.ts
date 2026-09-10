import { APIError } from "root/Utils/Logs"
import { Workspaces_model } from "root/routes/Workspaces/Workspaces.model"
import { Users_model } from "../../Users.model"
import { PasswordHasher } from "../PasswordHasher.section"

//  Apagar a própria conta — o art. 18 da LGPD, e a coisa mais básica que se espera poder fazer
//  com uma conta que se criou.
//
//  A SENHA É CONFERIDA DE NOVO, mesmo com sessão válida na mão. São dois motivos, e os dois
//  valem sozinhos: a ação é irreversível, e o cookie de sessão dura até 30 dias — aparelho
//  emprestado e aba esquecida são o cenário exato em que esta rota é usada por quem não devia.
//  A senha chega no CORPO, nunca na URL, pelo mesmo motivo escrito no topo do Users.route.ts.
//
//  A GUARDA QUE RESOLVE A CASCATA. Workspaces.IdOwnerUser é ON DELETE CASCADE
//  (migrations/20260731001000_workspaces.ts): um DELETE direto na linha de Users apaga junto
//  TODO workspace de que a pessoa é dona — inclusive um compartilhado, com os gastos, as contas
//  e o histórico de quem foi convidado. Quem encerra a própria conta levaria os dados de outra
//  pessoa junto, em cascata, sem nenhuma mensagem. Por isso, antes de apagar, a rota conta os
//  espaços de que o usuário é dono E que têm outro membro; havendo algum, é 406 dizendo qual é
//  a saída — transferir a propriedade ou remover os demais, as duas rotas que a leva 6 entregou.
//
//  O que acontece com o resto, e que é o que a política de privacidade afirma:
//
//  - os espaços em que a pessoa era a ÚNICA integrante somem inteiros, em cascata: contas,
//    gastos, entradas, orçamento, categorias. É isso que o direito à eliminação significa;
//  - as matrículas em espaços de terceiros somem (WorkspaceMembers é CASCADE), e o espaço
//    continua de pé para quem ficou;
//  - os lançamentos que a pessoa criou em espaços de terceiros FICAM, sem autor:
//    Expenses.IdUser, Inflows.IdUser, Accounts.IdUser e Budgets.IdUser são SET NULL. O dinheiro
//    do mês de quem ficou não pode mudar porque outra pessoa encerrou a conta;
//  - a Person continua no espaço, desligada do usuário (Persons.IdUser é SET NULL): ela é o
//    eixo analítico do rateio, e apagá-la reescreveria o histórico de quem gastou o quê para
//    todo mundo que ficou.
//
//  NÃO HÁ TRANSACTION AQUI, e não é esquecimento: a escrita é UMA — o DELETE na linha de Users.
//  Tudo o mais é o banco resolvendo as foreign keys dentro dessa mesma instrução.
export class Remove {
    public async run(IdUser: number, Password: string) {

        let user = await this.getUser(IdUser)

        let isValid = await PasswordHasher.compare(Password, user.Password)

        if (!isValid) {
            //  401, e não 406: o que foi recusado é a credencial, não o dado enviado. É o
            //  mesmo status do login com senha errada, e o cliente sabe separar os dois 401
            //  pelo corpo — este vem com msg, então não derruba a sessão de quem só errou a
            //  senha e continua com a conta de pé.
            throw new APIError({
                msg: "Senha incorreta",
                status: 401,
            })
        }

        let shared = await Workspaces_model.getOwnedWithOtherMembers(IdUser)

        if (shared.length > 0) {
            //  A mensagem NOMEIA O PRÓXIMO PASSO, como a do leave: um erro que só diz "não
            //  pode" é um beco. As duas saídas existem e são do próprio dono.
            throw new APIError({
                msg: `Você é dono de ${shared.length === 1 ? "um espaço compartilhado" : `${shared.length} espaços compartilhados`} com outras pessoas: ${shared.map((workspace) => workspace.Name).join(", ")}. Transfira a propriedade a outro membro, ou remova os demais membros, antes de apagar a conta.`,
                status: 406,
                data: { IdWorkspaces: shared.map((workspace) => workspace.IdWorkspace) },
            })
        }

        await Users_model.delete(IdUser)

        return { msg: "Conta apagada" }
    }

    private async getUser(IdUser: number) {
        let user = await Users_model.getUnique(IdUser)

        if (!user) {
            throw new Error(`Usuário #${IdUser} não encontrado!`)
        }

        return user
    }
}
