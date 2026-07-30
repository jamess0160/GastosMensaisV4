import { Logs } from "root/Utils/Logs"

export class TransactionEvents {

    private readonly events: Record<Events, EventFn[]> = {
        OnEnd: []
    }

    public attachOnEnd(fn: EventFn) {
        this.events.OnEnd.push(fn)
    }

    public async fireOnEnd() {
        try {
            for await (let item of this.events.OnEnd) {
                await this.validatePromise(item())
            }
        } catch (error) {
            Logs.handleError("Ocorreu um erro ao executar os eventos no final da transaction!", error)
        }
    }

    private validatePromise(result: any) {
        if (result instanceof Promise) {
            return result
        }

        return Promise.resolve(result)
    }
}

type Events = "OnEnd"

type EventFn = () => void