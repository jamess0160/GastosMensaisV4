import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Utils`
 *
 *  `/Cache` fica fora daqui de propósito: é o subsistema interno de
 *  cache em memória, não é escopado por workspace e não faz parte do
 *  domínio do app — não consuma a partir das telas. */
class Connection {
    private readonly route = "/Utils";

    /** Público. Epoch em ms, como número. */
    async serverTime(): Promise<number> {
        const { data } = await http.get<number>(`${this.route}/ServerTime`);
        return data;
    }

    /** Público. */
    async health(): Promise<{ msg: string; timeStamp: number; serverTime: string }> {
        const { data } = await http.get<{ msg: string; timeStamp: number; serverTime: string }>(
            `${this.route}/Health`,
        );
        return data;
    }

    /** Só `Log.msg` é obrigatório. */
    async log(body: ApiTypes.LogBody): Promise<string> {
        const { data } = await http.post<string>(`${this.route}/Logs`, body);
        return data;
    }
}

export const UtilsConnection = new Connection();
