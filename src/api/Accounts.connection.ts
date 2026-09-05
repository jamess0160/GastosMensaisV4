import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Accounts` — uma conta não tem saldo guardado: `Balance` é
 *  calculado a cada leitura. */
class Connection {
    private readonly route = "/Accounts";

    /** As formas de pagamento vêm embutidas — não há GET próprio de
     *  PaymentMethods.
     *
     *  `Balance` = InitialBalance + entradas recebidas − transferências
     *  que saíram − pernas de gasto pagas, tudo **com data até o último
     *  dia do `ReferenceMonth`**. Pendente é previsão e não entra. Não é
     *  coluna: não recalcule somando lançamentos no cliente.
     *
     *  O `ReferenceMonth` recorta o SALDO, não a lista: as contas são as
     *  mesmas em qualquer mês. Mande o mês que a tela está exibindo —
     *  omitir devolve o mês corrente, que é o que fazia março mostrar o
     *  saldo de setembro. */
    async list(query: ApiTypes.AccountListQuery = {}): Promise<ApiTypes.Account[]> {
        const { data } = await http.get<ApiTypes.Account[]>(this.route, { params: query });
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
