import { Request, Response } from "express"
import { Base_Companys_model } from "./Companys.model"

class Controller {

    getAllActive = async (req: Request, res: Response) => {
        res.json(await Base_Companys_model.getAllActive())
    }

    create = async (req: Request, res: Response) => {
        res.json(await Base_Companys_model.create(req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await Base_Companys_model.update(parseInt(req.params.IdCompany), req.body))
    }

    delete = async (req: Request, res: Response) => {
        res.json(await Base_Companys_model.delete(parseInt(req.params.IdCompany)))
    }

}

export const Base_Companys_controller = new Controller()