import { Users_model } from "../../Users.model"
import { PasswordHasher } from "../PasswordHasher.section"
import { UsersNamespace } from "../types"

export class Create {
    public async run(body: UsersNamespace.CreateUserPayload) {
        await Users_model.create({
            ...body,
            Password: await PasswordHasher.hash(body.Password),
        })
    }
}
