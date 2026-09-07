import { buildAppLink } from "../appLink"
import { MailLayout } from "./layout"

//  "Confirme seu e-mail". Diferente do e-mail de recuperação, o corpo daqui **não é uma
//  credencial**: o token confirma um endereço, não abre sessão nem troca senha. O que ele
//  prova é a posse da caixa de entrada — e é por isso que ele existe.
export function renderConfirmEmail(params: ConfirmEmailParams) {
    //  Aponta para a TELA, como todos os links do projeto: é ela que lê o `Token` da query e
    //  chama o `POST /Users/confirmEmail`. Um link direto para a API faria um `GET` mudar
    //  estado, e o pré-carregador de link de um cliente de e-mail confirmaria sozinho — o que
    //  aqui seria pior do que gastar um token: confirmaria um endereço que ninguém abriu.
    let Link = buildAppLink("confirmar-email", { Token: params.Token })

    return {
        subject: "Confirme seu e-mail — Gastos Mensais",
        ...MailLayout.render({
            Title: "Confirme seu e-mail",
            Greeting: `Olá, ${params.Name}`,
            Paragraphs: [
                "Falta um passo para o seu e-mail ficar confirmado no Gastos Mensais.",
                "O link abaixo vale por 48 horas. Sem a confirmação você continua usando o app normalmente — o que não funciona é a recuperação de senha, que depende de este endereço ser mesmo o seu.",
            ],
            Action: { Label: "Confirmar meu e-mail", Url: Link },
            //  A frase muda de sentido em relação à da recuperação: lá o e-mail não pedido é
            //  sinal de que alguém tenta entrar na conta; aqui é sinal de que alguém digitou
            //  este endereço no cadastro de outra pessoa. Em ambos, ignorar basta.
            Note: "Se não foi você que se cadastrou, ignore este e-mail: sem a confirmação, este endereço não fica ligado a nenhuma conta.",
        }),
    }
}

export interface ConfirmEmailParams {
    Name: string
    /** O JWT curto assinado por `EmailConfirmationToken`. */
    Token: string
}
