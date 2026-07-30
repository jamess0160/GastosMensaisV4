import { BaseSection } from "root/Utils/Base";
import { CacheEngine } from "../CacheEngine";
import { Utils } from "root/Utils/Utils";
import { Logs } from "root/Utils/Logs";
import { CacheNamespace } from "../types";

export class AttachConsummer extends BaseSection<CacheEngine> {

    public async run(type: string, consummer: CacheNamespace.CacheConsummer) {
        this.instance.events[type] = consummer
        try {

            await Utils.validatePromise(consummer.restoreCacheData())
            await this.instance.fireSocket({ type })

            Logs.insertCacheLog({
                msg: `Cache '${type}' inicializado com sucesso!`
            }, type)

        } catch (error) {
            Logs.handleError(`Ocorreu um erro ao executar a função 'restoreCacheData' do cache '${type}'`, error)
        }
    }

}