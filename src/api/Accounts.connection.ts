import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Accounts` — uma conta não tem saldo guardado: `Balance` é
 *  calculado a cada leitura. */
class Connection {
    private readonly route = "/Accounts";

    /** Sem query. As formas de pagamento vêm embutidas — não há GET
     *  próprio de PaymentMethods.
     *
     *  `Balance` = InitialBalance + entradas recebidas − transferências
     *  que saíram − pernas de gasto pagas. Pendente é previsão e não
     *  entra. Não é coluna: não recalcule somando lançamentos no cliente. */
    async list(): Promise<ApiTypes.Account[]> {
        const { data } = await http.get<ApiTypes.Account[]>(this.route);
        return data;
    }

    /** A conta já nasce com uma forma pix e uma débito — busque-as no list. */
    async create(body: ApiTypes.AccountCreateBody): Promise<{ IdAccount: number }> {
        const { data } = await http.post<{ IdAccount: number }>(this.route, body);
        return data;
    }

    /** `InitialBalance` congela depois do primeiro lançamento: alterá-lo
     *  responde 406. Desabilite o campo quando a conta já tiver movimento. */
    async update(idAccount: number, body: ApiTypes.AccountUpdateBody): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(
            `${this.route}/IdAccount=${idAccount}`,
            body,
        );
        return data;
    }

    /** Arquiva (Active = false) e arquiva as formas de pagamento junto. */
    async archive(idAccount: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(`${this.route}/IdAccount=${idAccount}`);
        return data;
    }
}

export const AccountsConnection = new Connection();
