import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Inflows` — carrega entrada de dinheiro E transferência entre
 *  contas, discriminadas por `Kind`.
 *
 *  Transferência é neutra para o patrimônio: todo total de "quanto
 *  entrou" tem que filtrar `Kind !== "transfer"`, ou o mesmo dinheiro é
 *  contado de novo a cada movimentação entre contas. No saldo da conta,
 *  ao contrário, ela conta nos dois lados. */
class Connection {
    private readonly route = "/Inflows";

    /** Filtra por `CompetenceDate`. Sem `Status`, as canceladas ficam de
     *  fora. As duas pontas do período são independentes. A lista não traz
     *  o rateio — use `get` para isso. */
    async list(query: ApiTypes.InflowListQuery = {}): Promise<ApiTypes.Inflow[]> {
        const { data } = await http.get<ApiTypes.Inflow[]>(this.route, { params: query });
        return data;
    }

    /** A mesma linha, mais `Persons`. */
    async get(idInflow: number): Promise<ApiTypes.InflowDetail> {
        const { data } = await http.get<ApiTypes.InflowDetail>(
            `${this.route}/IdInflow=${idInflow}`,
        );
        return data;
    }

    /** `Status` não é aceito: nasce pendente. */
    async create(body: ApiTypes.InflowCreateBody): Promise<{ IdInflow: number }> {
        const { data } = await http.post<{ IdInflow: number }>(this.route, body);
        return data;
    }

    /** Não se edita `Kind`, contas nem `Status`. Editar uma entrada já
     *  recebida é permitido, e o rateio é reconferido contra o NOVO total
     *  mesmo quando não foi enviado. */
    async update(idInflow: number, body: ApiTypes.InflowUpdateBody): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(
            `${this.route}/IdInflow=${idInflow}`,
            body,
        );
        return data;
    }

    /** Sem body. É ISTO que põe o dinheiro no saldo. Tudo ou nada — não
     *  há estado parcial nem ReceivedValue. */
    async receive(idInflow: number): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(
            `${this.route}/IdInflow=${idInflow}/receive`,
        );
        return data;
    }

    /** O espelho do `receive`: volta para `pending` e RETIRA do saldo o
     *  que o recebimento creditou. Pendência 14 — a rota ainda não
     *  existe, e enquanto não subir a chamada devolve o erro da API.
     *  Está aqui, e não escondida, porque esconder o caminho ensinaria
     *  que ele não existe. */
    async unreceive(idInflow: number): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(
            `${this.route}/IdInflow=${idInflow}/unreceive`,
        );
        return data;
    }

    /** Várias entradas numa transaction só — pendência 15. É o que a
     *  clonagem do mês usa: gravar uma por uma deixaria metade do mês
     *  criado quando a terceira das cinco fosse recusada. */
    async createBatch(
        body: ApiTypes.InflowBatchCreateBody,
    ): Promise<{ msg: string; IdInflows: number[] }> {
        const { data } = await http.post<{ msg: string; IdInflows: number[] }>(
            `${this.route}/batch`,
            body,
        );
        return data;
    }

    /** Cancela (Status = canceled). Não há delete físico nem `Active`
     *  nesta tabela. */
    async cancel(idInflow: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(`${this.route}/IdInflow=${idInflow}`);
        return data;
    }
}

export const InflowsConnection = new Connection();
