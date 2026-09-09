import { APIError } from "root/Utils/Logs"
import { UsersAuth_model } from "../../UsersAuth.model"

//  Remove a biometria de um aparelho.
export class Remove {
    public async run(IdUserAuth: number, IdUser: number) {
        let credential = await UsersAuth_model.getUnique(IdUserAuth)

        //  Dono confere pelo IdUser do token, e a resposta é a mesma de "não existe": sem
        //  isso a rota diria a um usuário quais IdUserAuth existem na conta dos outros.
        if (!credential || credential.IdUser !== IdUser) {
            throw new APIError({
                msg: "Credencial não encontrada!",
                status: 406,
                data: { IdUserAuth, IdUser },
            })
        }

        await UsersAuth_model.delete(IdUserAuth)

        return { msg: "Biometria removida com sucesso" }
    }
}
