import { Workspaces_model } from "../../Workspaces.model"

//  Escolhe o workspace da sessão que acabou de nascer, e devolve o id para quem vai emitir o
//  token. Não escreve nada: quem emite a sessão é o AcessControl.startSession, num lugar só.
//
//  Sem isso a sessão nasceria sem workspace e toda rota de tenant responderia 406 até o cliente
//  chamar o switch — um passo obrigatório depois de todo login, só para escolher o único
//  workspace que ele tem. Com isso, o switch volta a ser o que o nome diz: trocar.
//
//  Hoje é sempre um workspace por usuário. Quando o compartilhamento chegar (etapa 9 do
//  ROADMAP), o primeiro da lista é só um padrão razoável — quem escolhe de verdade é o switch.
export class SelectDefault {
    public async run(IdUser: number): Promise<number> {
        let [workspace] = await Workspaces_model.getByMember(IdUser)

        //  Usuário sem nenhuma matrícula não deveria existir: o cadastro cria o workspace na mesma transaction
        if (!workspace) {
            throw new Error("Usuário sem workspace")
        }

        return workspace?.IdWorkspace
    }
}
