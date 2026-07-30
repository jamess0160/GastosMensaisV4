import { Database } from "root/Utils/database"
import { Base_SystemParams_model } from "../../SystemParams.model"
import { Utils } from "root/Utils/Utils"

export class BuildParamTree{

    async run() {
        let systemParams = await Base_SystemParams_model.getAllActive()
        
        return Utils.buildTree<Database.SystemParams>(
            systemParams, 
            item => item.IdSystemParam, 
            item => item.IdSystemParamParent
        )
    }
}


