import { mailer } from "./Mailer"
import { KnexTransaction } from "./Knex/KnexConnection"
import { buildAppLink } from "root/Utils/Mail/appLink"
import { MailLayout } from "root/Utils/Mail/templates/layout"

//  A infra de e-mail. Não há rota nenhuma aqui — quem traz rota é a recuperação de senha, que
//  sobe junto — então a suíte exerce as três camadas direto: transporte, mensagem e link.
//
//  **Nada é mockado, como no resto do projeto.** Em `NODE_ENV=test` o `Mailer` usa o
//  `jsonTransport` do nodemailer: o envio acontece de verdade, a mensagem volta serializada e
//  nada sai pela rede. É o que permite afirmar *"saiu um e-mail para este endereço, com este
//  link"* — que é onde os bugs de e-mail moram. Um template com a variável errada passa em
//  qualquer teste que só verifique que o envio foi chamado.

describe("Mailer", () => {

    beforeEach(() => {
        mailer.clearSentMessages()
    })

    describe("send", () => {

        //  Sem isto, a suíte inteira quebraria por causa de uma variável que ela não usa: o
        //  `getEnv` estoura quando falta, e nenhuma máquina de teste tem SMTP configurado.
        it("não lê as MAIL_* nem abre conexão em NODE_ENV=test", async () => {
            let saved = { ...process.env }

            for (let key of ["MAIL_SMTP", "MAIL_SMTP_PORT", "MAIL_SMTP_SECURE", "MAIL_USER", "MAIL_PASSWORD", "MAIL_FROM"]) {
                delete process.env[key]
            }

            try {
                await expect(mailer.send({ to: "alguem@gastos.local", subject: "Oi", text: "Corpo" })).resolves.toBe(true)
            } finally {
                process.env = saved
            }
        })

        it("entrega o destinatário, o assunto e as duas versões do corpo", async () => {
            await mailer.send({ to: "alguem@gastos.local", subject: "Assunto", text: "Em texto", html: "<p>Em html</p>" })

            let [message] = mailer.getSentMessages()

            expect(mailer.getSentMessages()).toHaveLength(1)
            expect(message.to[0].address).toBe("alguem@gastos.local")
            expect(message.subject).toBe("Assunto")
            expect(message.text).toContain("Em texto")
            expect(message.html).toContain("Em html")
        })

        //  A falha que mais importa evitar: um provedor de e-mail impedindo alguém de criar
        //  conta ou de pedir a recuperação da senha. `send` não estoura, nunca — quem quiser
        //  saber se saiu tem o retorno, e o Logs tem a falha inteira.
        //
        //  E a falha aqui é de verdade: o `Mailer` é apontado para uma porta fechada em
        //  127.0.0.1 e tenta abrir o socket. Sem mock, como todo o resto da suíte.
        it("SMTP fora do ar não estoura: devolve false", async () => {
            let saved = { ...process.env }

            //  Fora de NODE_ENV=test o transporte deixa de ser o jsonTransport e vira SMTP
            process.env.NODE_ENV = "production"
            process.env.MAIL_SMTP = "127.0.0.1"
            process.env.MAIL_SMTP_PORT = "1"
            process.env.MAIL_SMTP_SECURE = "false"
            process.env.MAIL_USER = "teste"
            process.env.MAIL_PASSWORD = "teste"
            process.env.MAIL_FROM = "Gastos Mensais <teste@gastos.local>"

            mailer.resetTransport()

            try {
                await expect(mailer.send({ to: "alguem@gastos.local", subject: "Assunto", text: "Corpo" })).resolves.toBe(false)
            } finally {
                process.env = saved
                mailer.resetTransport()
            }
        })
    })

    //  **O e-mail sai depois do commit, nunca antes** — o teste da etapa.
    //
    //  O `KnexTransaction` passa um `TransactionEvents`, e o `fireOnEnd` roda depois que a
    //  transaction resolveu. É exatamente a semântica que o cadastro precisa: ele grava
    //  usuário, workspace e person numa transaction só, e um rollback depois do envio mandaria
    //  boas-vindas para uma conta que não existe.
    describe("attachOnEnd", () => {

        it("não envia nada quando a transaction dá rollback", async () => {
            let promise = KnexTransaction(async (tx, events) => {
                events.attachOnEnd(() => mailer.send({ to: "rollback@gastos.local", subject: "Não deveria sair", text: "Corpo" }))

                throw new Error("rollback")
            })

            await expect(promise).rejects.toThrow("rollback")

            expect(mailer.getSentMessages()).toHaveLength(0)
        })

        it("envia depois do commit", async () => {
            await KnexTransaction(async (tx, events) => {
                events.attachOnEnd(() => mailer.send({ to: "commit@gastos.local", subject: "Saiu", text: "Corpo" }))

                //  Durante a transaction, nada saiu ainda
                expect(mailer.getSentMessages()).toHaveLength(0)
            })

            expect(mailer.getSentMessages()).toHaveLength(1)
            expect(mailer.getSentMessages()[0].to[0].address).toBe("commit@gastos.local")
        })

        //  O `fireOnEnd` engole o erro em `Logs.handleError`, e é isso que impede um SMTP fora
        //  do ar de derrubar a operação que já foi gravada.
        it("um envio quebrado não desfaz nem quebra a transaction", async () => {
            let result = await KnexTransaction(async (tx, events) => {
                events.attachOnEnd(() => { throw new Error("SMTP fora do ar") })

                return "gravado"
            })

            expect(result).toBe("gravado")
        })
    })

    describe("buildAppLink", () => {

        //  O link aponta para o FRONT, e o domínio sai do APP_URL — nunca do Host da
        //  requisição, que é forjável e viraria um link de recuperação para o servidor de
        //  outra pessoa, com o token dentro.
        it("monta o link a partir do APP_URL, com a query codificada", () => {
            expect(buildAppLink("recuperar-senha", { Token: "abc.def" })).toBe(`${process.env.APP_URL}/recuperar-senha?Token=abc.def`)
        })

        it("não duplica a barra entre o APP_URL e o caminho", () => {
            let saved = process.env.APP_URL

            process.env.APP_URL = "https://app.gastos.local/"

            try {
                expect(buildAppLink("/confirmar-email")).toBe("https://app.gastos.local/confirmar-email")
            } finally {
                process.env.APP_URL = saved
            }
        })
    })

    describe("MailLayout", () => {

        it("renderiza as duas versões com o mesmo conteúdo, e o link também em texto", () => {
            let { text, html } = MailLayout.render({
                Title: "Recupere sua senha",
                Greeting: "Olá, Tiago",
                Paragraphs: ["Clique no botão abaixo."],
                Action: { Label: "Criar nova senha", Url: "https://app.gastos.local/recuperar-senha?Token=abc" },
                Note: "Se não foi você, ignore este e-mail.",
            })

            for (let content of [text, html]) {
                expect(content).toContain("Olá, Tiago")
                expect(content).toContain("Recupere sua senha")
                expect(content).toContain("Clique no botão abaixo.")
                //  O endereço aparece escrito nas duas: cliente de e-mail bloqueia botão
                expect(content).toContain("https://app.gastos.local/recuperar-senha?Token=abc")
                expect(content).toContain("Se não foi você, ignore este e-mail.")
            }
        })

        //  O nome vem do cadastro, digitado pelo usuário: sem escape, um `<script>` no nome
        //  viraria HTML na caixa de entrada de quem recebe.
        it("escapa o que veio do usuário no corpo em HTML", () => {
            let { html } = MailLayout.render({
                Title: "Assunto",
                Greeting: "Olá, <script>alert(1)</script>",
                Paragraphs: ["Corpo"],
            })

            expect(html).not.toContain("<script>")
            expect(html).toContain("&lt;script&gt;")
        })
    })
})
