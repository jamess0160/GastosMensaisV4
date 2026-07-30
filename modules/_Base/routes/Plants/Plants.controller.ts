import { Request, Response } from "express"
import { Base_Plants_model } from "./Plants.model"

class Controller {

    getAllActive = async (req: Request, res: Response) => {
        res.json(await Base_Plants_model.getAllActive())
    }

    create = async (req: Request, res: Response) => {
        res.json(await Base_Plants_model.create(req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await Base_Plants_model.update(parseInt(req.params.IdPlant), req.body))
    }

    delete = async (req: Request, res: Response) => {
        res.json(await Base_Plants_model.delete(parseInt(req.params.IdPlant)))
    }
}

export const Base_Plants_controller = new Controller()