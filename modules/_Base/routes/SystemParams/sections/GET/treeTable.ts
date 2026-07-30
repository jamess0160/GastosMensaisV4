import { BaseDatabase } from "root/modules/_Base/moduleDatabase"
import { Base_SystemParams_model } from "../../SystemParams.model"
import { Utils } from "root/Utils/Utils"

export class BuildParamTree{

    async run() {
        let systemParams = await Base_SystemParams_model.getAllActive()
        
        return Utils.buildTree<BaseDatabase.SystemParams>(
            systemParams, 
            item => item.IdSystemParam, 
            item => item.IdSystemParamParent
        )
    }
}


