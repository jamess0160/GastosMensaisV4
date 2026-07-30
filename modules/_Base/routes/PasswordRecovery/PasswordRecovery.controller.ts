import { Request, Response } from "express"
import { Base_PasswordRecovery_model } from "./PasswordRecovery.model"
import { SetStatus } from "./sections/PUT/setStatus"
import { Create } from "./sections/POST/create"

class Controller {

    getAllActiveAndPending = async (req: Request, res: Response) => {
        res.json(await Base_PasswordRecovery_model.getAllActiveAndPending().joinActives({
            Users: {
                selfPath: "IdUserAsk",
                destinyColumn: "IdUser",
                type: "single",
            }
        }))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(req.params.login))
    }

    setStatus = async (req: Request, res: Response) => {
        res.json(await new SetStatus().run(Number(req.params.IdPasswordRecovery), req.params.status === "true"))
    }
}

export const Base_PasswordRecoverys_controller = new Controller()