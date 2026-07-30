import { Database } from "root/Utils/database";
import { Base_SystemParams_model } from "../SystemParams.model";

export enum SystemParams {
    "Base_MaxLogCount" = 2,
}

class ParamStorage {

    private params: Database.SystemParams[] = []

    public async run(param: SystemParams | string) {

        if (this.params.length === 0) {
            this.params = await Base_SystemParams_model.getAllActive()
        }

        let paramData = this.params.find((item) => {
            return item.IdSystemParam === param
        })

        if (!paramData) {
            throw new Error(`Parametro "${param}" não encontrado!`)
        }

        return paramData
    }

    public clearCache() {
        this.params = []
    }
}

export const getParam = new ParamStorage()