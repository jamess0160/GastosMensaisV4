import { Base_User_model } from "../../../Users/Users.model"
import { Base_PasswordRecovery_model } from "../../PasswordRecovery.model"
import { Md5 } from "ts-md5"

export class SetStatus {
    public async run(IdPasswordRecovery: number, status: boolean) {
        await Base_PasswordRecovery_model.updateStatus(IdPasswordRecovery, status)

        if (status === false) {
            return
        }

        let record = await Base_PasswordRecovery_model.getUnique(IdPasswordRecovery)

        if (!record) throw new Error(`Registro #${IdPasswordRecovery} não encontrado`)

        await Base_User_model.update(record.IdUserAsk, { Pass: Md5.hashStr("123456") })
    }
}