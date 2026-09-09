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

    /** Público. Passo 1 de "esqueci minha senha": manda o link para o
     *  e-mail, que aponta para `APP_URL/recuperar-senha?Token=…`.
     *
     *  **Responde 200 sempre**, inclusive para e-mail sem conta, e com a
     *  mesma `msg`. Mostre-a como veio: a informação de "existe ou não"
     *  não está na resposta, e é de propósito que não esteja. */
    async forgotPassword(body: ApiTypes.ForgotPasswordBody): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(`${this.route}/forgotPassword`, body);
        return data;
    }

    /** Público. Passo 2: grava a senha nova.
     *
     *  NÃO abre sessão — não vem `Set-Cookie` nenhum. Depois do sucesso
     *  o caminho é o login, com a senha nova. */
    async resetPassword(body: ApiTypes.ResetPasswordBody): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(`${this.route}/resetPassword`, body);
        return data;
    }

    /** Público. Carimba o `EmailConfirmedAt` com o token do link.
     *
     *  **Idempotente**: chamar de novo responde `200` sem reescrever a
     *  data. É por isso que a tela não pode tratar o segundo clique como
     *  erro — o pré-carregador de link do cliente de e-mail é um
     *  "segundo clique" que ninguém deu. */
    async confirmEmail(body: ApiTypes.ConfirmEmailBody): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(`${this.route}/confirmEmail`, body);
        return data;
    }

    /** Público. Manda o link de confirmação de novo.
     *
     *  Responde 200 sempre e com a mesma `msg`, inclusive para e-mail
     *  sem conta e para quem já confirmou. O freio de 2 minutos da API é
     *  por endereço e não muda a resposta. */
    async resendConfirmation(body: ApiTypes.ResendConfirmationBody): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(`${this.route}/resendConfirmation`, body);
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
