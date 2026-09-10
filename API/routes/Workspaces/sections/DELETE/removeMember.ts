import { APIError } from "root/Utils/Logs"
import { WorkspaceMembers_model } from "../../WorkspaceMembers.model"
import { WorkspacesAcessControl } from "../AcessControl.section"

//  Tirar alguém do espaço.
//
//  Antes disto não havia como: revogar o convite só funciona ANTES do aceite, e depois dele o
//  acesso era definitivo. Convidar o e-mail errado, ou dividir o espaço com quem saiu da casa,
//  não tinha desfazer nenhum.
//
//  Só o dono (assertRole owner), como as rotas de convite e a troca de papel: um editor que
//  pudesse remover terceiros tiraria o próprio dono da decisão de quem entra e quem fica.
//
//  A matrícula é apagada DE VERDADE, e isso é de propósito: não há Active em WorkspaceMembers,
//  porque matrícula inativa é acesso revogado que continua ocupando a chave única
//  (IdWorkspace, IdUser) e voltaria sozinha no primeiro convite futuro ao mesmo e-mail.
//
//  NADA do que a pessoa lançou é tocado. Gasto, entrada e conta são do WORKSPACE, não da
//  matrícula: nenhuma dessas tabelas aponta para WorkspaceMembers. E quem responde "quem
//  gastou" é ExpensePersons, que aponta para Persons — outra tabela, sem relação com quem tem
//  login. Então remover um membro não apaga a pessoa de rateio nenhum, e é isso que mantém o
//  histórico do mês fechando (e o saldo das contas idêntico) depois da remoção.
export class RemoveMember {
    public async run(SelectedIdWorkspace: number | undefined, IdWorkspaceMember: number, IdUser: number) {
        let membership = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner"])

        //  O IdWorkspace entra junto na busca: o id da matrícula chega do cliente e é
        //  sequencial, então uma matrícula conferida no próprio tenant deixaria remover o
        //  membro do vizinho. 406 "não encontrado", como em toda leitura escopada — um 404
        //  confirmaria que a matrícula existe em algum lugar.
        let target = await WorkspaceMembers_model.getUnique(membership.IdWorkspace, IdWorkspaceMember)

        if (!target) {
            throw new APIError({
                msg: "Membro não encontrado!",
                status: 406,
                data: { IdWorkspaceMember, IdUser },
            })
        }

        //  O dono não se remove por aqui — e quem chega até esta linha é sempre o dono, porque
        //  o assertRole acima é o que deixou passar. Sair é operação do próprio usuário, com a
        //  guarda oposta, e o dono só sai depois de transferir a propriedade: um espaço sem
        //  dono não é estado do qual se volta, porque ninguém poderia mais convidar, remover
        //  ou transferir. A comparação é entre matrículas, que é o que a rota endereça.
        if (target.IdWorkspaceMember === membership.IdWorkspaceMember) {
            throw new APIError({
                msg: "Você não pode remover a si mesmo. Para passar o espaço a outra pessoa, transfira a propriedade.",
                status: 406,
                data: { IdWorkspaceMember, IdUser },
            })
        }

        await WorkspaceMembers_model.delete(target.IdWorkspaceMember)

        return { msg: "Membro removido com sucesso" }
    }
}
