import { Users_model } from "../../Users.model"
import { UsersNamespace } from "../types"

export class Create {
    public async run(body: UsersNamespace.UserPayload) {
        await Users_model.create(body)
    }
}