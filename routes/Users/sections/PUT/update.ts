import { Users_model } from "../../Users.model"
import { UsersNamespace } from "../types"

export class Update {
    public async run(IdUser: number, body: UsersNamespace.UpdateUserPayload) {
        await Users_model.update(IdUser, body)
    }
}
