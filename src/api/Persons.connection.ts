import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Persons` — quem recebeu ou de quem é o custo. Os dois rateios
 *  apontam para Persons, nunca para Users: pessoa não precisa ter login. */
class Connection {
    private readonly route = "/Persons";

    async list(): Promise<ApiTypes.Person[]> {
        const { data } = await http.get<ApiTypes.Person[]>(this.route);
        return data;
    }

    /** Só `Name`: `IdUser` não é aceito de propósito — é único no banco
     *  inteiro, e aceitá-lo do cliente consumiria a vaga de outro usuário.
     *  Nome já usado no workspace (mesmo arquivado, ignorando caixa): 406. */
    async create(name: string): Promise<{ IdPerson: number }> {
        const { data } = await http.post<{ IdPerson: number }>(this.route, { Name: name });
        return data;
    }

    async update(idPerson: number, name: string): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(`${this.route}/IdPerson=${idPerson}`, {
            Name: name,
        });
        return data;
    }

    /** Recusa (406) a pessoa vinculada a um login: o vínculo não pode ser
     *  reconstruído por rota nenhuma. */
    async archive(idPerson: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(`${this.route}/IdPerson=${idPerson}`);
        return data;
    }
}

export const PersonsConnection = new Connection();
