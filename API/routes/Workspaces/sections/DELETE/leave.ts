import { APIError } from "root/Utils/Logs"
import { WorkspaceMembers_model } from "../../WorkspaceMembers.model"
import { WorkspacesAcessControl } from "../AcessControl.section"

//  Sair do espaço — a própria matrícula.
//
//  Antes disto quem foi convidado ficava no espaço para sempre: a única saída era pedir ao dono
//  para remover, e o convidado não tinha um botão nenhum contra um espaço alheio.
//
//  SEM ID NO CAMINHO, e é a diferença inteira em relação ao removeMember. Um IdWorkspaceMember
//  no caminho viria do cliente e a rota teria que conferir que é o do próprio usuário — quando
//  a sessão já sabe disso. A matrícula que esta rota apaga é a que o assertMember devolveu,
//  então não há nada a conferir contra nada.
//
//  A guarda é a OPOSTA da do removeMember: lá o assertRole exige ser dono, aqui exige NÃO ser.
//  Enquanto ele for dono, sair deixaria o espaço sem quem convida, sem quem remove e sem quem
//  transfere — e um espaço sem dono não é estado do qual se volte. Por isso é 406 com mensagem
//  própria, e não o 403 genérico do assertRole: um erro que não diz o próximo passo é um beco,
//  e o próximo passo aqui é transferir a propriedade.
//
//  A ROTA NÃO REEMITE O TOKEN, e isso é deliberado. POST /Workspaces/switch é a única rota que
//  aceita um IdWorkspace escrito pelo cliente, e uma saída não abre exceção nessa regra. O
//  token continua apontando para o espaço de onde a pessoa acabou de sair — e a partir da
//  próxima requisição ele não vale mais nada ali, porque o assertMember não encontra a
//  matrícula e responde "Workspace não encontrado". Quem escolhe onde continuar é o cliente,
//  chamando getSelf e switch, exatamente como faz depois do join.
//
//  Se não sobrar espaço nenhum, a sessão continua VÁLIDA e sem espaço a que voltar: ninguém é
//  deslogado, o getSelf volta vazio e toda rota escopada responde 406 pelo assertMember. Note
//  que a mensagem é "Workspace não encontrado!", e não "Nenhum workspace selecionado" — esta
//  segunda é a do token sem IdWorkspace nenhum, e o token daqui continua apontando para o
//  espaço de onde a pessoa saiu justamente porque a rota não o reemite. As duas são 406 e o
//  conserto é o mesmo: criar um espaço, que é a única rota da feature que não confere matrícula
//  — o workspace nasce nela.
//
//  Como no removeMember, nada do que a pessoa lançou é tocado: gasto, entrada e conta são do
//  WORKSPACE, e quem responde "quem gastou" é ExpensePersons, que aponta para Persons.
export class Leave {
    public async run(SelectedIdWorkspace: number | undefined, IdUser: number) {
        let membership = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        if (membership.Role === "owner") {
            throw new APIError({
                msg: "O dono não pode sair do próprio espaço. Transfira a propriedade a outro membro e saia depois.",
                status: 406,
                data: { IdWorkspace: membership.IdWorkspace, IdUser },
            })
        }

        //  A matrícula é apagada DE VERDADE, como no removeMember: não há Active em
        //  WorkspaceMembers, porque matrícula inativa é acesso revogado que continua ocupando
        //  a chave única (IdWorkspace, IdUser) e voltaria sozinha num convite futuro ao mesmo
        //  e-mail. Voltar ao espaço é ser convidado de novo.
        await WorkspaceMembers_model.delete(membership.IdWorkspaceMember)

        return { msg: "Você saiu do espaço" }
    }
}
