import { BaseSection } from "root/Utils/Base";
import { CacheEngine } from "../../CacheEngine";

export class Reset extends BaseSection<CacheEngine> {

    public async run(type: string) {
        let consummer = this.instance.events[type]

        if (!consummer) {
            return { msg: `Cache "${type}" não encontrado!` }
        }

        this.instance.cache[type] = {}

        await this.instance.attachConsummer(type, consummer)

        return { msg: "Cache resetado com sucesso!" }
    }

}