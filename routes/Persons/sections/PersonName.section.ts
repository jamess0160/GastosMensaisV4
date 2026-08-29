import { APIError } from "root/Utils/Logs"
import { Persons_model } from "../Persons.model"

//  `unique(IdWorkspace, Name)`: duas pessoas com o mesmo nome no mesmo workspace tornariam o
//  rateio ilegível — não dá para saber a qual das duas o valor foi. O banco garante; esta
//  checagem existe para o caso normal responder 406 em vez de estourar o 23505 como 500.
//
//  Mesmo desenho do e-mail livre no cadastro de usuário: o índice continua sendo a garantia de
//  verdade (duas requisições simultâneas passam as duas por aqui), isto aqui é a mensagem.
//
//  Uma consequência do índice ignorar o Active: **a pessoa arquivada continua ocupando o
//  nome.** Não há rota para reativá-la, então o nome fica ocupado — se isso incomodar na
//  prática, o conserto é uma rota de restore, não afrouxar esta conferência.
class Controller {

    public async assertNameIsFree(IdWorkspace: number, Name: string, IdPerson?: number) {
        let existing = await Persons_model.getByNameIncludingInactive(IdWorkspace, Name)

        //  Renomear mantendo o próprio nome (ou só trocando a caixa) não é conflito consigo mesma
        if (!existing || existing.IdPerson === IdPerson) return

        throw new APIError({
            msg: existing.Active
                ? "Já existe uma pessoa com esse nome neste workspace."
                : "Já existe uma pessoa arquivada com esse nome neste workspace.",
            status: 406,
            data: { IdWorkspace, Name },
        })
    }
}

export const PersonName = new Controller()
