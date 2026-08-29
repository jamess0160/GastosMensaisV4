import { Knex } from "knex"
import { class_Persons_model } from "../../Persons.model"

//  A Person do próprio dono, criada junto com o usuário e o workspace.
//
//  É o único lugar em que o IdUser da pessoa é escrito, e o valor não vem do cliente: vem do
//  usuário que acabou de ser inserido na mesma transaction. É o que impede alguém de consumir
//  a vaga de Person de outro usuário — o índice é `unique(IdUser)` no banco inteiro.
//
//  Por que já no cadastro: todo rateio é entre Persons, então sem esta linha o primeiro gasto
//  compartilhado exigiria que o usuário se cadastrasse como pessoa antes de aparecer no
//  próprio rateio — um passo que não faz sentido nenhum para quem acabou de entrar.
//
//  Recebe a transaction em vez de abrir a sua, como o Workspaces/POST/create: se o cadastro
//  falhar depois daqui, esta linha não pode sobrar.
export class CreateSelf {

    private readonly Persons_model: class_Persons_model

    constructor(tx: Knex.Transaction) {
        this.Persons_model = new class_Persons_model(tx)
    }

    public async run(IdWorkspace: number, IdUser: number, Name: string) {
        //  `unique(IdWorkspace, Name)`: em workspace novo a lista está vazia e o nome sempre
        //  cabe. O caso que colide é o cadastro que entra num workspace **já existente** onde
        //  alguém com esse nome já é pessoa — e aí a inserção derrubaria a transaction inteira,
        //  ou seja, um homônimo impediria o cadastro do usuário.
        //
        //  Então a pessoa é pulada, não inventada: nome automático do tipo "Fulano (2)" viraria
        //  um nome esquisito na tela do rateio, e recusar o cadastro seria pior ainda. Quem
        //  entrou assim cadastra a própria pessoa com um nome que a distinga — sem o vínculo de
        //  IdUser, que só a etapa 9 (aceitar convite) tem informação para escrever direito.
        let taken = await this.Persons_model.getByNameIncludingInactive(IdWorkspace, Name)

        if (taken) return null

        return await this.Persons_model.create({ IdWorkspace, IdUser, Name }).returnId("IdPerson")
    }
}
