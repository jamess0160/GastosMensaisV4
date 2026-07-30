import { Users_model } from "../../Users.model"
import { Database } from "root/Utils/database"

export class Update {
    public async run(IdUser: number, body: UpdateUser) {
        await Users_model.update(IdUser, body)
    }
}

interface UpdateUser extends Database.Users {
    UserGroups?: string[]
}