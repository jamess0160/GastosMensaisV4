import { Users_model } from "../../Users.model"
import { Database } from "root/Utils/database"

export class Create {
    public async run(body: Database.Users) {
        return await Users_model.create(body)
    }
}