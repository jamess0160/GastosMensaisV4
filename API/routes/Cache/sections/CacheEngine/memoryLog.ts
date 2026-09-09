import { BaseSection } from "root/Utils/Base";
import { CacheEngine } from "../CacheEngine";
import { Logs } from "root/Utils/Logs";
import moment from "moment";
import sizeof from "object-sizeof"

export class MemoryLog extends BaseSection<CacheEngine> {

    private timer?: NodeJS.Timeout

    public run() {
        this.timer = setInterval(() => {
            Logs.insertCacheLog({
                msg: "Consumo de memoria do cache",
                data: [
                    `Total: ${(sizeof(this.instance.cache) / 1024 / 1024).toFixed(2)} MB`,
                    ...Object.keys(this.instance.cache).map((key) => {
                        return `${key}: ${(sizeof(this.instance.cache[key]) / 1024 / 1024).toFixed(2)} MB`
                    })
                ]
            }, "Memory")
        }, moment.duration(1, "minute").asMilliseconds());

        //  unref: este intervalo é telemetria, não trabalho. Sem ele o node fica de pé só por
        //  causa do timer — é uma das razões de a suíte precisar de forceExit.
        this.timer.unref()
    }

    //  Existe para os testes: o intervalo dispara sozinho e, se cair depois que o jest
    //  desmontou o ambiente do arquivo, o winston já foi descarregado e o log estoura dentro
    //  de um teste qualquer que estivesse rodando — uma falha aleatória que não é do teste.
    public stop() {
        clearInterval(this.timer)
    }
}