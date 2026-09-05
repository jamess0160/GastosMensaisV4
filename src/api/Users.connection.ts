import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Users` */
class Connection {
    private readonly route = "/Users";

    /** Público. Cria usuário, workspace, matrícula e Person numa única
     *  transaction. NÃO loga: chame `login` em seguida. */
    async signUp(body: ApiTypes.SignUpBody): Promise<{ IdUser: number; IdWorkspace: number }> {
        const { data } = await http.post<{ IdUser: number; IdWorkspace: number }>(this.route, body);
        return data;
    }

    /** Público. O 200 vale pelo `Set-Cookie`, não pelo corpo. Já seleciona
     *  o primeiro workspace, então a sessão nunca começa sem workspace. */
    async login(body: ApiTypes.LoginBody): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(`${this.route}/login`, body);
        return data;
    }

    /** Público, sem body. Sobrescreve o cookie `token` com um
     *  `Set-Cookie` expirado — é a ÚNICA forma de encerrar a sessão:
     *  o cookie é `HttpOnly` e o `document.cookie` não o alcança.
     *
     *  NÃO EXIGE SESSÃO DE PROPÓSITO: chamar sem cookie, com cookie
     *  expirado ou com token inválido responde 200 do mesmo jeito. Um
     *  logout que respondesse 401 travaria o botão "Sair" justamente no
     *  caso em que o usuário mais quer sair. */
    async logout(): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(`${this.route}/logout`);
        return data;
    }

    /** `Password` nunca sai na resposta. */
    async getSelf(): Promise<ApiTypes.User> {
        const { data } = await http.get<ApiTypes.User>(`${this.route}/getSelf`);
        return data;
    }

    async update(
        idUser: number,
        body: { Name: string; Email: string; Phone: number },
    ): Promise<void> {
        await http.put(`${this.route}/IdUser=${idUser}`, body);
    }

    /** No body, nunca na URL: o path cai no log do proxy e no Referer. */
    async updatePassword(body: { oldPassword: string; newPassword: string }): Promise<void> {
        await http.put(`${this.route}/updatePassword`, body);
    }
}

export const UsersConnection = new Connection();
