import { buildAppLink } from "../appLink"
import { MailLayout } from "./layout"

//  "Esqueci minha senha". É o primeiro e-mail do projeto, e o mais delicado: **o corpo dele é
//  a credencial** — quem lê o link troca a senha. Daí o TLS obrigatório no transporte e a
//  regra de o `Mailer` nunca registrar o corpo em log.
export function renderResetPassword(params: ResetPasswordParams) {
    //  O link aponta para a TELA, que depois chama o `POST /Users/resetPassword` com o token
    //  no corpo. Um link direto para a API faria um `GET` mudar estado — e o pré-carregador de
    //  link de um cliente de e-mail gastaria o token sem ninguém ter clicado.
    let Link = buildAppLink("recuperar-senha", { Token: params.Token })

    return {
        subject: "Recuperação de senha — Gastos Mensais",
        ...MailLayout.render({
            Title: "Recupere sua senha",
            Greeting: `Olá, ${params.Name}`,
            Paragraphs: [
                "Recebemos um pedido para criar uma nova senha na sua conta do Gastos Mensais.",
                "O link abaixo vale por 30 minutos e só pode ser usado uma vez.",
            ],
            Action: { Label: "Criar nova senha", Url: Link },
            //  A frase importa: um e-mail de recuperação que a pessoa não pediu é o sinal de
            //  que alguém está tentando entrar na conta dela, e o texto tem que dizer que
            //  ignorar basta — nada aconteceu ainda.
            Note: "Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.",
        }),
    }
}

export interface ResetPasswordParams {
    Name: string
    /** O JWT curto assinado por `ResetPasswordToken` — nunca a senha, nunca o hash. */
    Token: string
}
