import nodemailer, { Transporter } from "nodemailer"
import { enviromentManager } from "root/Utils/enviromentManager"
import { Logs } from "root/Utils/Logs"
import { isTest } from "root/Utils/environment"

//  **O transporte, e só o transporte.** Ele sabe de SMTP, pool, timeout e remetente; não sabe
//  o que está mandando. Quem sabe *o que* é o template (`Utils/Mail/templates/`), e quem sabe
//  *por que* é a section que tem a razão de mandar — três camadas, e nenhuma delas conhece as
//  outras duas.
//
//  Mora em `Utils/Connections/` junto com o Knex porque é isso que ele é: uma conexão
//  externa. Veio pronto de outro projeto como `Utils/nodeMailer.ts`, com a forma certa e sete
//  ajustes por fazer — os três primeiros de segurança:
//
//  1. **`ignoreTLS: true` saiu.** Ele desligava o STARTTLS, e como `secure` vem de env o caso
//     provável (porta 587, `secure=false`) era o login SMTP **e o corpo do e-mail**
//     atravessando a rede sem cifra. Num "a rotina terminou" isso passa; aqui o corpo **é** a
//     credencial — quem lê o link troca a senha. Agora é `secure` na 465 ou `requireTLS` na 587.
//  2. **O remetente é `MAIL_FROM`, lido pelo `enviromentManager`**, e não `process.env.MAIL_USER`.
//     Acesso direto ao `process.env` é contra a regra do projeto e o tipo `string | undefined`
//     transformava a falta num `from` vazio em runtime; e o remetente não é o login do SMTP —
//     o provedor exige endereço autorizado, e a tela quer ler `Gastos Mensais <nao-responda@…>`.
//  3. **Um destinatário por chamada**, no lugar de `emails.join(", ")`. Como estava, todo mundo
//     aparecia no mesmo cabeçalho `To` e cada destinatário via a lista inteira. Nos casos de
//     hoje é sempre um só, então não doeria agora — mas o primeiro envio em lote que aparecer
//     vai chamar este método, e aí é vazamento de endereço entre usuários.
//  4. Ganhou `html` além do `text`: todo e-mail destas etapas carrega link.
//  5. Instância única com `pool: true`, como o Knex. Sem pool, cada envio
//     abre TCP + TLS + auth do zero, e esse custo entra direto na latência da requisição.
//  6. **A escolha do transporte vem antes da leitura das envs** — ver `transport()`.
//  7. `sendMail` já devolve promise no nodemailer 10, então o `new Promise` em volta sumiu; e
//     os timeouts são explícitos, porque o default é longo e este envio é aguardado dentro da
//     requisição.
class Controller {

    private transporter: Transporter | null = null

    //  O que a suíte lê. Só é preenchido no transporte de teste — em produção o corpo de um
    //  e-mail de recuperação contém o token, e ele não fica em memória nem em log.
    private readonly sent: MailerNamespace.SentMessage[] = []

    /**
     * Manda um e-mail. **Nunca estoura**, por decisão: um provedor de e-mail fora do ar não
     * pode impedir alguém de criar conta ou de pedir a recuperação da senha.
     *
     * Dentro de uma transaction o `fireOnEnd` já engoliria o erro; aqui a garantia vale
     * também para quem chama direto, sem transaction nenhuma. Quem quiser saber se saiu tem o
     * retorno — e o `Logs` tem a falha inteira.
     */
    public async send(message: MailerNamespace.Message) {
        //  Nunca o corpo. O `text` de um e-mail de recuperação contém o token; o que se
        //  registra é que saiu um e-mail, para quem e com que assunto. Mesma regra do
        //  `Utils.redactSensitive` sobre o `req.body`.
        let data = { to: message.to, subject: message.subject }

        try {
            let info = await this.transport().sendMail({
                from: isTest() ? "Gastos Mensais <teste@gastos.local>" : enviromentManager.getEnv("MAIL_FROM"),
                to: message.to,
                subject: message.subject,
                text: message.text,
                html: message.html,
            })

            if (isTest()) {
                //  O jsonTransport devolve a mensagem serializada em vez de mandá-la pela
                //  rede. É o que permite a suíte afirmar "saiu um e-mail para este endereço,
                //  com este link" **sem mock nenhum** — e é onde os bugs de e-mail moram: um
                //  template com a variável errada passa em qualquer teste que só verifique
                //  que o envio foi chamado.
                this.sent.push(JSON.parse(info.message as unknown as string))
            }

            Logs.insertLog({ msg: "E-mail enviado", data })

            return true
        } catch (error) {
            Logs.handleError("Ocorreu um erro ao enviar um e-mail", error, data)

            return false
        }
    }

    /**
     * Fecha o transporte e faz o próximo envio construir outro.
     *
     * Existe para a suíte poder apontar o `Mailer` para um SMTP que não responde e provar que
     * um envio quebrado **não** quebra quem o disparou — com socket de verdade, sem mock.
     * Fora do teste ninguém chama: o pool é para ser reaproveitado.
     */
    public resetTransport() {
        this.transporter?.close()
        this.transporter = null
    }

    /** Só faz sentido em `NODE_ENV=test`: fora dele a lista está sempre vazia, de propósito. */
    public getSentMessages(): readonly MailerNamespace.SentMessage[] {
        return this.sent
    }

    public clearSentMessages() {
        this.sent.length = 0
    }

    /**
     * O transporte, criado na primeira vez que alguém manda um e-mail.
     *
     * **A escolha vem antes da leitura das envs**: em `NODE_ENV=test` o `Mailer` nem chega a
     * olhar para `MAIL_*`, e como `getEnv(key)` estoura quando falta, sem esta ordem a suíte
     * inteira quebraria por causa de uma variável que ela não usa.
     *
     * E é preguiçoso, não construído no import, para que um ambiente de desenvolvimento sem
     * SMTP configurado continue subindo a API: a falta só aparece quando alguém realmente
     * tenta mandar um e-mail, e aí ela vira uma linha no log em vez de um boot que não
     * acontece. Fora isso o `getEnv` continua obrigatório — não há default silencioso.
     */
    private transport() {
        if (this.transporter) {
            return this.transporter
        }

        this.transporter = isTest() ? this.buildTestTransport() : this.buildSmtpTransport()

        return this.transporter
    }

    private buildTestTransport() {
        //  Nada sai pela rede, e a mensagem volta serializada
        return nodemailer.createTransport({ jsonTransport: true })
    }

    private buildSmtpTransport() {
        let secure = enviromentManager.getEnv("MAIL_SMTP_SECURE") === "true"

        return nodemailer.createTransport({
            host: enviromentManager.getEnv("MAIL_SMTP"),
            port: Number(enviromentManager.getEnv("MAIL_SMTP_PORT")),
            //  465 fala TLS desde o primeiro byte; 587 começa em claro e sobe com STARTTLS.
            secure,
            //  Fora da 465, exigir o STARTTLS é o que substitui o `ignoreTLS` que saiu: sem
            //  isso o nodemailer aceitaria um servidor que simplesmente não oferece cifra, e
            //  o link de recuperação sairia em texto puro pela rede.
            requireTLS: !secure,
            auth: {
                user: enviromentManager.getEnv("MAIL_USER"),
                pass: enviromentManager.getEnv("MAIL_PASSWORD"),
            },
            //  Uma conexão reaproveitada entre envios: sem pool, cada e-mail paga TCP + TLS +
            //  auth do zero, e esse custo cai na latência de quem está esperando na tela.
            pool: true,
            //  Explícitos porque o default do nodemailer é longo e este envio é aguardado
            //  dentro da requisição: um SMTP travado não pode segurar a resposta por minutos.
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 20000,
        })
    }
}

export namespace MailerNamespace {

    /** O que o `Mailer` aceita — e note que ele não sabe *o que* está mandando. */
    export interface Message {
        /** **Um só.** Envio em lote é um laço de chamadas, nunca uma lista neste campo. */
        to: string
        subject: string
        text: string
        html?: string
    }

    export interface SentMessage {
        to: { address: string, name: string }[]
        subject: string
        text: string
        html?: string
    }
}

export const mailer = new Controller()
