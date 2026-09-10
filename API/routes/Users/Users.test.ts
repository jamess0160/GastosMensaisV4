import jwt from "jsonwebtoken"
import { TestClient, TestDatabase, TestEnv, TestUser, UsersFactory } from "root/Utils/Tests"
import { mailer } from "root/Utils/Connections/Mailer"
import { enviromentManager } from "root/Utils/enviromentManager"
import { MailCooldown } from "./sections/MailCooldown.section"
import { TERMS_VERSION } from "./sections/TermsVersion"
import { UsersNamespace } from "./sections/types"

//  Testes integrados da feature Users. Um describe por rota de Users.route.ts, na mesma ordem.
//
//  Nada é mockado: a requisição passa pelo AsyncHandler, pelo schema Joi, pelas sections e
//  chega no banco de teste (recriado a cada execução pelo globalSetup). As asserções olham a
//  resposta HTTP e, quando faz diferença, a linha gravada.
//
//  npm test                                          -> app em memória (supertest)
//  TEST_BASE_URL=http://localhost:4000 npm test      -> mesmo arquivo, servidor real (end to end)

//  Em modo end to end o Mailer vive no processo do servidor, não neste: a caixa de saída é
//  inalcançável daqui. O que depende dela fica de fora ali; o que vale nos dois modos — status
//  e resposta idêntica para e-mail que existe e que não existe — continua rodando.
const describeMailbox = TestEnv.isE2E() ? describe.skip : describe

describe("Users", () => {

    let root: TestUser
    let client: TestClient

    beforeAll(async () => {
        //  Estado conhecido no início da suíte. CASCADE: leva junto tudo que depende de Users.
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Usuário raiz" })
        client = new TestClient(root.token)
    })

    describe("POST /Users/login", () => {

        it("autentica com as credenciais corretas e devolve o token", async () => {
            let response = await client.anonymous().post("/Users/login", { login: root.user.Email, password: root.password })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ msg: "Login realizado com sucesso" })
            expect(TestClient.extractCookieToken(response)).toBeTruthy()
        })

        it("recusa a senha errada", async () => {
            let response = await client.anonymous().post("/Users/login", { login: root.user.Email, password: "senha-errada" })

            expect(response.status).toBe(401)
            expect(TestClient.extractCookieToken(response)).toBeNull()
        })

        it("recusa um login que não existe", async () => {
            let response = await client.anonymous().post("/Users/login", { login: UsersFactory.buildEmail(), password: root.password })

            expect(response.status).toBe(401)
        })

        it("recusa senha em branco antes de chegar no banco", async () => {
            let response = await client.anonymous().post("/Users/login", { login: root.user.Email, password: " " })

            expect(response.status).toBe(406)
        })

        //  Os três atributos do cookie são a segurança da sessão inteira, agora que ele é o
        //  único lugar de onde o token é lido — por isso viram asserção e não comentário:
        //
        //  HttpOnly  → o JavaScript da página não alcança o token, então um XSS não o copia
        //  SameSite=Strict → o navegador não anexa o cookie em requisição vinda de outro site.
        //                    É ISTO que barra CSRF, e não o CORS: CORS decide quem lê a
        //                    resposta, não quem envia a requisição.
        //  Max-Age   → a sessão morre com o token (24h), sem cookie órfão sobrando no navegador
        it("entrega o token num cookie httpOnly e sameSite strict", async () => {
            let response = await client.anonymous().post("/Users/login", { login: root.user.Email, password: root.password })

            let cookies: string[] = response.headers["set-cookie"] ?? []
            let raw = cookies.find((cookie) => cookie.startsWith("token="))

            expect(raw).toContain("HttpOnly")
            expect(raw).toContain("SameSite=Strict")
            expect(raw).toContain("Max-Age=86400")
        })

        //  **A montagem do Express atrás do nginx, provada numa resposta qualquer.**
        //
        //  Os dois lados da etapa, e os dois são invisíveis em localhost:
        //
        //  sem Access-Control-Allow-Origin → o `cors()` aberto saiu. Front e API sobem na mesma
        //  origem, então não há preflight nem resposta cross-origin para liberar; o cabeçalho
        //  presente seria uma porta que o produto não usa. A saída errada aqui é afrouxar o
        //  cookie em vez de manter a mesma origem.
        //  X-Content-Type-Options: nosniff → o helmet está montado. É o cabeçalho que não
        //  depende de https nem de configuração de proxy, e por isso o que vale como trava do
        //  helmet inteiro numa suíte rodando em http.
        it("responde sem cabeçalho de CORS e com os cabeçalhos do helmet", async () => {
            let response = await client.anonymous().post("/Users/login", { login: root.user.Email, password: root.password })

            expect(response.headers["access-control-allow-origin"]).toBeUndefined()
            expect(response.headers["x-content-type-options"]).toBe("nosniff")
        })

        //  O limite de corpo é explícito no express.json, e é a única resposta do app que não
        //  passa por rota nenhuma: quem devolve é o parser, antes do AsyncHandler existir.
        it("recusa com 413 um corpo acima de 100kb", async () => {
            let response = await client.anonymous().post("/Users/login", { login: "a".repeat(200 * 1024), password: root.password })

            expect(response.status).toBe(413)
        })

        //  **O RememberDevice, e as duas armadilhas dele.**
        //
        //  A primeira é esta: o `expiresIn` do token e o `maxAge` do cookie eram dois literais
        //  soltos que coincidiam por sorte. Um cookie que vive mais que o token responde 401
        //  com a credencial na mão; um que vive menos derruba uma sessão ainda válida. Por
        //  isso os dois números são conferidos **um contra o outro** aqui, e não contra uma
        //  constante escrita no teste.
        it("mantém a sessão por 30 dias quando RememberDevice vem true, com cookie e token na mesma duração", async () => {
            let response = await client.anonymous().post("/Users/login", { login: root.user.Email, password: root.password, RememberDevice: true })

            expect(response.status).toBe(200)
            expect(TestClient.cookieMaxAge(response)).toBe(30 * 24 * 60 * 60)
            expect(tokenLifetime(TestClient.extractCookieToken(response)!)).toBe(TestClient.cookieMaxAge(response))
        })

        //  Sem o campo é a sessão de sempre: um cliente que não conhece o RememberDevice
        //  continua ganhando 24h, e o campo é uma adição, não uma quebra.
        it("mantém as 24h quando o RememberDevice não vem, e o cookie acompanha", async () => {
            let response = await client.anonymous().post("/Users/login", { login: root.user.Email, password: root.password })

            expect(TestClient.cookieMaxAge(response)).toBe(24 * 60 * 60)
            expect(tokenLifetime(TestClient.extractCookieToken(response)!)).toBe(TestClient.cookieMaxAge(response))
        })

        it("recusa RememberDevice que não é booleano", async () => {
            let response = await client.anonymous().post("/Users/login", { login: root.user.Email, password: root.password, RememberDevice: "talvez" })

            expect(response.status).toBe(406)
        })

        //  A duração viaja DENTRO do token, e é isso que o switch lê para não rebaixar a
        //  sessão — a asserção do outro lado está em Workspaces.test.ts.
        it("grava a escolha dentro do token", async () => {
            let remembered = await client.anonymous().post("/Users/login", { login: root.user.Email, password: root.password, RememberDevice: true })
            let plain = await client.anonymous().post("/Users/login", { login: root.user.Email, password: root.password })

            expect(decodePayload(TestClient.extractCookieToken(remembered)!).RememberDevice).toBe(true)
            expect(decodePayload(TestClient.extractCookieToken(plain)!).RememberDevice).toBeUndefined()
        })
    })

    describe("POST /Users/logout", () => {

        //  O teste da etapa: o que importa não é o 200 nem o formato do Set-Cookie, é que a
        //  sessão realmente morre — a rota protegida seguinte responde 401.
        it("encerra a sessão: a rota protegida seguinte responde 401", async () => {
            let session = new TestClient()
            await session.login(root.user.Email, root.password)

            expect((await session.get("/Users/getSelf")).status).toBe(200)

            let logout = await session.post("/Users/logout")
            expect(logout.status).toBe(200)

            //  O navegador apagaria o cookie; aqui o cliente faz o mesmo, largando o token.
            session.setToken(null)

            expect((await session.get("/Users/getSelf")).status).toBe(401)
        })

        //  O Set-Cookie do clearCookie repete httpOnly/sameSite da emissão e manda o cookie
        //  expirar — é isso que faz o navegador APAGAR o token em vez de guardar um segundo
        //  cookie ao lado, que deixaria a sessão viva.
        it("devolve um Set-Cookie que expira o token", async () => {
            let session = new TestClient()
            await session.login(root.user.Email, root.password)

            let response = await session.post("/Users/logout")

            let cookies: string[] = response.headers["set-cookie"] ?? []
            let raw = cookies.find((cookie) => cookie.startsWith("token="))

            expect(raw).toBeTruthy()
            expect(TestClient.extractCookieToken(response)).toBe("")
            expect(raw).toContain("HttpOnly")
            expect(raw).toContain("SameSite=Strict")
            expect(raw).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/)
        })

        //  Sem sessão também é 200: exigir token responderia 401 justamente quando o usuário
        //  mais quer sair (token expirado, aba velha), travando o botão "Sair".
        it("responde 200 sem sessão nenhuma", async () => {
            let response = await client.anonymous().post("/Users/logout")

            expect(response.status).toBe(200)
        })

        it("responde 200 com um token inválido", async () => {
            let response = await new TestClient("token-invalido").post("/Users/logout")

            expect(response.status).toBe(200)
        })
    })

    describe("POST /Users/forgotPassword", () => {

        beforeEach(() => {
            mailer.clearSentMessages()
        })

        it("recusa corpo sem Email", async () => {
            expect((await client.anonymous().post("/Users/forgotPassword", {})).status).toBe(406)
        })

        it("recusa e-mail fora do formato", async () => {
            expect((await client.anonymous().post("/Users/forgotPassword", { Email: "não-é-e-mail" })).status).toBe(406)
        })

        //  **O teste que define a rota.** Responder diferente para e-mail que existe e para
        //  e-mail que não existe transformaria a rota num verificador de quais endereços têm
        //  conta — é a mesma razão pela qual o login usa uma msg só para e-mail errado e senha
        //  errada. Aqui as duas respostas são comparadas uma com a outra, e não com um texto
        //  fixo: assim elas continuam iguais mesmo que a frase mude.
        it("responde igual para e-mail que existe e para e-mail que não existe", async () => {
            let owner = await UsersFactory.create()

            let found = await client.anonymous().post("/Users/forgotPassword", { Email: owner.user.Email })
            let missing = await client.anonymous().post("/Users/forgotPassword", { Email: "ninguem@gastos.local" })

            expect(found.status).toBe(200)
            expect(missing.status).toBe(200)
            expect(found.body).toEqual(missing.body)
        })

        describeMailbox("o e-mail que sai", () => {

            it("manda o link para o dono da conta, com o token dentro", async () => {
                let owner = await UsersFactory.create({ Name: "Dona da conta" })

                await client.anonymous().post("/Users/forgotPassword", { Email: owner.user.Email })

                let [message] = mailer.getSentMessages()

                expect(mailer.getSentMessages()).toHaveLength(1)
                expect(message.to[0].address).toBe(owner.user.Email)
                expect(message.text).toContain("Dona da conta")
                //  O link aponta para a TELA, montado a partir do APP_URL — nunca para a API,
                //  e nunca com o Host da requisição, que é forjável
                expect(message.text).toContain(`${process.env.APP_URL}/recuperar-senha?Token=`)
                expect(readToken(message.text)).toBeTruthy()
            })

            it("não manda nada para e-mail que não tem conta", async () => {
                await client.anonymous().post("/Users/forgotPassword", { Email: "ninguem@gastos.local" })

                expect(mailer.getSentMessages()).toHaveLength(0)
            })

            //  O cadastro grava o e-mail em minúsculas; sem o lowercase do schema, quem digita
            //  com a inicial maiúscula na tela de recuperação nunca receberia o link.
            it("reencontra a conta com o e-mail digitado em caixa alta", async () => {
                let owner = await UsersFactory.create()

                await client.anonymous().post("/Users/forgotPassword", { Email: owner.user.Email.toUpperCase() })

                expect(mailer.getSentMessages()).toHaveLength(1)
            })
        })
    })

    describe("POST /Users/resetPassword", () => {

        beforeEach(() => {
            mailer.clearSentMessages()
        })

        it("recusa corpo incompleto", async () => {
            expect((await client.anonymous().post("/Users/resetPassword", { Token: "abc" })).status).toBe(406)
            expect((await client.anonymous().post("/Users/resetPassword", { NewPassword: "NovaSenha@123" })).status).toBe(406)
        })

        it("recusa um token que não é um JWT", async () => {
            let response = await client.anonymous().post("/Users/resetPassword", { Token: "não-é-token", NewPassword: "NovaSenha@123" })

            expect(response.status).toBe(406)
        })

        //  **O desafio da biometria é assinado com o MESMO JWT_SECRET.** Sem o `type` dentro
        //  do token, ele passaria na verificação de assinatura e viraria uma troca de senha —
        //  é a mesma razão pela qual o WebAuthnChallenge carrega o dele.
        it("recusa um token assinado para outra finalidade", async () => {
            let owner = await UsersFactory.create()
            let token = forgeToken({ IdUser: owner.user.IdUser, type: "login", fingerprint: "irrelevante" })

            let response = await client.anonymous().post("/Users/resetPassword", { Token: token, NewPassword: "NovaSenha@123" })

            expect(response.status).toBe(406)
            expect((await client.anonymous().login(owner.user.Email, owner.password)).status).toBe(200)
        })

        it("recusa um token expirado", async () => {
            let owner = await UsersFactory.create()
            let token = forgeToken({ IdUser: owner.user.IdUser, type: "reset", fingerprint: "irrelevante" }, "-1m")

            expect((await client.anonymous().post("/Users/resetPassword", { Token: token, NewPassword: "NovaSenha@123" })).status).toBe(406)
        })

        //  Assinado de verdade, tipo certo, usuário certo — e mesmo assim recusado, porque a
        //  impressão digital não é a da senha que está gravada. É o mecanismo do uso único.
        it("recusa um token cuja impressão digital não bate com a senha atual", async () => {
            let owner = await UsersFactory.create()
            let token = forgeToken({ IdUser: owner.user.IdUser, type: "reset", fingerprint: "0000000000000000" })

            expect((await client.anonymous().post("/Users/resetPassword", { Token: token, NewPassword: "NovaSenha@123" })).status).toBe(406)
        })

        it("recusa um token de um usuário que não existe", async () => {
            let token = forgeToken({ IdUser: 999999, type: "reset", fingerprint: "0000000000000000" })

            expect((await client.anonymous().post("/Users/resetPassword", { Token: token, NewPassword: "NovaSenha@123" })).status).toBe(406)
        })

        describeMailbox("com o link que chegou por e-mail", () => {

            it("troca a senha, e a antiga para de valer", async () => {
                let owner = await UsersFactory.create()
                let Token = await requestToken(owner.user.Email)
                let NewPassword = "SenhaRecuperada@123"

                let response = await client.anonymous().post("/Users/resetPassword", { Token, NewPassword })

                expect(response.status).toBe(200)
                expect((await client.anonymous().login(owner.user.Email, NewPassword)).status).toBe(200)
                expect((await client.anonymous().login(owner.user.Email, owner.password)).status).toBe(401)
            })

            it("guarda a nova senha com hash", async () => {
                let owner = await UsersFactory.create()
                let Token = await requestToken(owner.user.Email)
                let NewPassword = "SenhaRecuperada@456"

                await client.anonymous().post("/Users/resetPassword", { Token, NewPassword })

                expect((await findByEmail(owner.user.Email))?.Password).not.toBe(NewPassword)
            })

            //  **O teste da etapa: uso único sem tabela nenhuma.** Trocar a senha muda o hash,
            //  e a impressão digital dentro do token deixa de casar — o link morre sozinho, sem
            //  lista de revogados e sem rotina de limpeza.
            it("o mesmo link não vale duas vezes", async () => {
                let owner = await UsersFactory.create()
                let Token = await requestToken(owner.user.Email)

                expect((await client.anonymous().post("/Users/resetPassword", { Token, NewPassword: "Primeira@123" })).status).toBe(200)

                let second = await client.anonymous().post("/Users/resetPassword", { Token, NewPassword: "Segunda@123" })

                expect(second.status).toBe(406)
                //  E a senha da primeira troca continua sendo a que vale
                expect((await client.anonymous().login(owner.user.Email, "Primeira@123")).status).toBe(200)
            })

            //  Pedir dois links e usar o mais novo é o caminho de quem não achou o primeiro
            //  e-mail. O primeiro link continua válido até alguém gastar um dos dois.
            it("dois pedidos seguidos: usar o segundo link invalida o primeiro", async () => {
                let owner = await UsersFactory.create()

                let first = await requestToken(owner.user.Email)
                let second = await requestToken(owner.user.Email)

                expect((await client.anonymous().post("/Users/resetPassword", { Token: second, NewPassword: "Segunda@123" })).status).toBe(200)
                expect((await client.anonymous().post("/Users/resetPassword", { Token: first, NewPassword: "Primeira@123" })).status).toBe(406)
            })
        })
    })

    describe("POST /Users/confirmEmail", () => {

        it("recusa corpo sem Token", async () => {
            expect((await client.anonymous().post("/Users/confirmEmail", {})).status).toBe(406)
        })

        it("recusa um token que não é um JWT", async () => {
            expect((await client.anonymous().post("/Users/confirmEmail", { Token: "não-é-token" })).status).toBe(406)
        })

        //  **O mesmo JWT_SECRET assina os três tokens do projeto** — o desafio da biometria, o
        //  da recuperação de senha e este. Sem o `type` dentro, um link de recuperação
        //  confirmaria um e-mail, e é por isso que o teste existe nos dois lados.
        it("recusa um token assinado para outra finalidade", async () => {
            let owner = await UsersFactory.create()
            let token = forgeToken({ IdUser: owner.user.IdUser, Email: owner.user.Email, type: "reset" })

            expect((await client.anonymous().post("/Users/confirmEmail", { Token: token })).status).toBe(406)
            expect((await findByEmail(owner.user.Email))?.EmailConfirmedAt).toBeNull()
        })

        it("recusa um token expirado", async () => {
            let owner = await UsersFactory.create()
            let token = forgeToken({ IdUser: owner.user.IdUser, Email: owner.user.Email, type: "confirm" }, "-1m")

            expect((await client.anonymous().post("/Users/confirmEmail", { Token: token })).status).toBe(406)
        })

        it("recusa um token de um usuário que não existe", async () => {
            let token = forgeToken({ IdUser: 999999, Email: "ninguem@gastos.local", type: "confirm" })

            expect((await client.anonymous().post("/Users/confirmEmail", { Token: token })).status).toBe(406)
        })

        //  Assinado de verdade, tipo certo, usuário certo — e recusado, porque o endereço que
        //  o token atesta não é o que está gravado. É o mecanismo do uso único, o análogo da
        //  impressão digital da senha na recuperação.
        it("recusa um token cujo e-mail não é o que está gravado", async () => {
            let owner = await UsersFactory.create()
            let token = forgeToken({ IdUser: owner.user.IdUser, Email: "outro@gastos.local", type: "confirm" })

            expect((await client.anonymous().post("/Users/confirmEmail", { Token: token })).status).toBe(406)
            expect((await findByEmail(owner.user.Email))?.EmailConfirmedAt).toBeNull()
        })

        describeMailbox("com o link que chegou por e-mail", () => {

            it("confirma o e-mail e carimba o EmailConfirmedAt", async () => {
                let { payload, Token } = await signupReadingConfirmation()

                let response = await client.anonymous().post("/Users/confirmEmail", { Token })

                expect(response.status).toBe(200)
                expect((await findByEmail(payload.Email))?.EmailConfirmedAt).toBeTruthy()
            })

            //  **Confirmar duas vezes não é erro**, e o carimbo não se move. Quem clica no link
            //  de novo — ou o pré-carregador de link do cliente de e-mail, que abre a URL sem
            //  ninguém ter pedido — não pode ver tela de erro para algo que já deu certo, e a
            //  data da confirmação é a prova de quando o endereço foi provado.
            it("confirmar de novo responde 200 sem reescrever a data", async () => {
                let { payload, Token } = await signupReadingConfirmation()

                await client.anonymous().post("/Users/confirmEmail", { Token })

                let first = (await findByEmail(payload.Email))?.EmailConfirmedAt

                expect((await client.anonymous().post("/Users/confirmEmail", { Token })).status).toBe(200)
                expect((await findByEmail(payload.Email))?.EmailConfirmedAt).toEqual(first)
            })

            //  A confirmação não é sessão: ela prova um endereço, não abre acesso a nada.
            it("não devolve Set-Cookie nenhum", async () => {
                let { Token } = await signupReadingConfirmation()

                let response = await client.anonymous().post("/Users/confirmEmail", { Token })

                expect(TestClient.extractCookieToken(response)).toBeNull()
            })
        })
    })

    describe("POST /Users/resendConfirmation", () => {

        beforeEach(() => {
            mailer.clearSentMessages()
            //  O freio é global ao processo e sobreviveria de um teste para o outro.
            MailCooldown.clear()
        })

        it("recusa corpo sem Email", async () => {
            expect((await client.anonymous().post("/Users/resendConfirmation", {})).status).toBe(406)
        })

        it("recusa e-mail fora do formato", async () => {
            expect((await client.anonymous().post("/Users/resendConfirmation", { Email: "não-é-e-mail" })).status).toBe(406)
        })

        //  **O teste que define a rota**, igual ao do forgotPassword: responder diferente para
        //  e-mail que existe e para e-mail que não existe transformaria a rota num verificador
        //  de quais endereços têm conta. As duas respostas são comparadas uma com a outra, para
        //  continuarem iguais mesmo que a frase mude.
        it("responde igual para e-mail que existe e para e-mail que não existe", async () => {
            let owner = await UsersFactory.create()

            let found = await client.anonymous().post("/Users/resendConfirmation", { Email: owner.user.Email })
            let missing = await client.anonymous().post("/Users/resendConfirmation", { Email: "ninguem@gastos.local" })

            expect(found.status).toBe(200)
            expect(missing.status).toBe(200)
            expect(found.body).toEqual(missing.body)
        })

        describeMailbox("o e-mail que sai", () => {

            it("manda o link para o dono da conta, com o token dentro", async () => {
                let owner = await UsersFactory.create({ Name: "Dona da conta" })

                await client.anonymous().post("/Users/resendConfirmation", { Email: owner.user.Email })

                let [message] = mailer.getSentMessages()

                expect(mailer.getSentMessages()).toHaveLength(1)
                expect(message.to[0].address).toBe(owner.user.Email)
                //  O link aponta para a TELA, montado a partir do APP_URL: um link direto para
                //  a API seria um GET que muda estado, e o pré-carregador de link do cliente de
                //  e-mail confirmaria um endereço que ninguém abriu.
                expect(message.text).toContain(`${process.env.APP_URL}/confirmar-email?Token=`)
                expect(readToken(message.text)).toBeTruthy()
            })

            it("não manda nada para e-mail que não tem conta", async () => {
                await client.anonymous().post("/Users/resendConfirmation", { Email: "ninguem@gastos.local" })

                expect(mailer.getSentMessages()).toHaveLength(0)
            })

            //  Quem já confirmou não recebe: seria ruído — e, numa rota pública, bastaria
            //  repetir a chamada para incomodar o dono de uma conta alheia.
            it("não manda nada para quem já confirmou", async () => {
                let owner = await UsersFactory.create({ EmailConfirmedAt: new Date() })

                await client.anonymous().post("/Users/resendConfirmation", { Email: owner.user.Email })

                expect(mailer.getSentMessages()).toHaveLength(0)
            })

            //  **O freio.** Uma rota pública que dispara e-mail é onde a falta de rate limiting
            //  dói primeiro: sem ele, um laço enche a caixa de entrada de outra pessoa usando
            //  este servidor. E a resposta continua sendo a mesma 200 — um 429 aqui devolveria
            //  o que a resposta única esconde, já que só um endereço com conta teria cooldown.
            it("segura o segundo pedido seguido, sem mudar a resposta", async () => {
                let owner = await UsersFactory.create()

                let first = await client.anonymous().post("/Users/resendConfirmation", { Email: owner.user.Email })
                let second = await client.anonymous().post("/Users/resendConfirmation", { Email: owner.user.Email })

                expect(second.status).toBe(200)
                expect(second.body).toEqual(first.body)
                expect(mailer.getSentMessages()).toHaveLength(1)
            })

            //  O freio é por endereço: o pedido de um usuário não pode calar o do outro.
            it("não segura o pedido de outro endereço", async () => {
                let first = await UsersFactory.create()
                let second = await UsersFactory.create()

                await client.anonymous().post("/Users/resendConfirmation", { Email: first.user.Email })
                await client.anonymous().post("/Users/resendConfirmation", { Email: second.user.Email })

                expect(mailer.getSentMessages()).toHaveLength(2)
            })
        })
    })

    describe("GET /Users/getSelf", () => {

        //  A sessão vem do cookie e SÓ do cookie. O header 'authorization' foi tirado de
        //  propósito: com dois caminhos de autenticação, o mais fraco é o que vale, e um header
        //  aceito escapa do sameSite:strict que é justamente o que barra CSRF hoje.
        //
        //  Este teste é a trava dessa decisão: um token perfeitamente válido, no header, é 401.
        it("recusa token válido mandado no header authorization", async () => {
            let response = await client.anonymous().get("/Users/getSelf").set("authorization", root.token)

            expect(response.status).toBe(401)
        })

        it("recusa sem token", async () => {
            let response = await client.anonymous().get("/Users/getSelf")

            expect(response.status).toBe(401)
        })

        it("recusa token inválido", async () => {
            let response = await new TestClient("token-invalido").get("/Users/getSelf")

            expect(response.status).toBe(401)
        })

        it("devolve o usuário dono do token", async () => {
            let response = await client.get("/Users/getSelf")

            expect(response.status).toBe(200)
            expect(response.body).toMatchObject({
                IdUser: root.user.IdUser,
                Name: "Usuário raiz",
                Email: root.user.Email,
                Phone: Number(root.user.Phone),
                Active: true,
            })
        })

        //  O campo que a faixa da tela lê para saber se aparece. Nulo enquanto o endereço não
        //  foi provado, e a factory semeia usuário não confirmado porque o cadastro também.
        it("devolve o EmailConfirmedAt, nulo enquanto o e-mail não foi confirmado", async () => {
            let response = await client.get("/Users/getSelf")

            expect(response.status).toBe(200)
            expect(response.body.EmailConfirmedAt).toBeNull()
        })

        it("não devolve o hash da senha", async () => {
            let response = await client.get("/Users/getSelf")

            expect(response.status).toBe(200)
            expect(response.body.Password).toBeUndefined()
        })

        it("responde 406 quando o usuário do token não existe mais", async () => {
            let removed = await UsersFactory.create()
            await TestDatabase.connection().delete().from("Users").where("IdUser", removed.user.IdUser)

            let response = await new TestClient(removed.token).get("/Users/getSelf")

            expect(response.status).toBe(406)
        })
    })

    describe("POST /Users", () => {

        //  Rota pública: é por ela que nasce o primeiro usuário, sem token nenhum
        it("recusa corpo incompleto", async () => {
            let response = await client.anonymous().post("/Users", { Name: "Sem o resto" })

            expect(response.status).toBe(406)
        })

        it("cria o usuário no banco sem exigir token", async () => {
            let payload = buildPayload({ Name: "Usuário criado pela rota" })

            let response = await client.anonymous().post("/Users", payload)

            expect(response.status).toBe(200)

            let created = await findByEmail(payload.Email)

            expect(created).toBeDefined()
            expect(created?.Name).toBe(payload.Name)
            expect(created?.Active).toBe(true)
        })

        //  O usuário nasce NÃO confirmado, e entra assim mesmo: bloquear o login seria mais
        //  simples de raciocinar e é o que custa cadastro — quem não recebe o e-mail (spam,
        //  typo, provedor lento) ficaria trancado do lado de fora.
        it("nasce com o EmailConfirmedAt nulo", async () => {
            let payload = buildPayload()

            await client.anonymous().post("/Users", payload)

            expect((await findByEmail(payload.Email))?.EmailConfirmedAt).toBeNull()
        })

        //  A VALIDAÇÃO DO ACEITE É DO SERVIDOR, e é isso que estes dois testes travam: antes
        //  dela o checkbox era conferido só na tela, e um POST por curl criava a conta sem
        //  aceitar nada — o Joi deixava passar porque o campo não existia para ser exigido.
        it("recusa o cadastro sem o AcceptedTerms", async () => {
            let { AcceptedTerms, ...payload } = buildPayload()

            let response = await client.anonymous().post("/Users", payload)

            expect(response.status).toBe(406)
            expect(await findByEmail(payload.Email)).toBeUndefined()
        })

        //  Recusar o `false` é outra coisa que recusar a ausência: um cliente que manda o
        //  estado do checkbox como veio precisa falhar alto, não criar a conta desmarcada.
        it("recusa o cadastro com o AcceptedTerms false", async () => {
            let payload = buildPayload({ AcceptedTerms: false })

            let response = await client.anonymous().post("/Users", payload)

            expect(response.status).toBe(406)
            expect(await findByEmail(payload.Email)).toBeUndefined()
        })

        //  O QUE ficou gravado é a versão da API, não uma que o cliente pudesse escolher: o
        //  corpo não tem onde escrevê-la, e é o que impede alguém de afirmar ter concordado
        //  com um documento antigo. A data é a mesma impressa no topo de /termos.
        it("carimba o aceite com a versão do servidor", async () => {
            let payload = buildPayload()

            await client.anonymous().post("/Users", payload)

            let created = await findByEmail(payload.Email)

            expect(created?.TermsAcceptedAt).toBeInstanceOf(Date)
            expect(created?.TermsVersion).toBe(TERMS_VERSION)
        })

        //  Quem se cadastrou antes da leva fica com as duas colunas nulas, e é a verdade:
        //  não havia documento para aceitar. Sem backfill, e nada é bloqueado pelo nulo.
        it("o usuário semeado direto no banco continua sem aceite nenhum", async () => {
            let seeded = await UsersFactory.create()

            let stored = await findByEmail(seeded.user.Email)

            expect(stored?.TermsAcceptedAt).toBeNull()
            expect(stored?.TermsVersion).toBeNull()
            expect((await new TestClient().login(seeded.user.Email, seeded.password)).status).toBe(200)
        })

        describeMailbox("o e-mail de confirmação do cadastro", () => {

            beforeEach(() => {
                mailer.clearSentMessages()
            })

            it("sai UM e-mail, com o link da confirmação", async () => {
                let payload = buildPayload({ Name: "Recém-cadastrado" })

                await client.anonymous().post("/Users", payload)

                let [message] = mailer.getSentMessages()

                expect(mailer.getSentMessages()).toHaveLength(1)
                expect(message.to[0].address).toBe(payload.Email)
                expect(message.text).toContain(`${process.env.APP_URL}/confirmar-email?Token=`)
            })

            //  **O envio pendura no attachOnEnd**, que roda depois do commit: um cadastro que
            //  rolou para trás não pode ter mandado e-mail nenhum — o endereço receberia o
            //  convite para confirmar uma conta que não existe.
            it("não sai e-mail nenhum quando o cadastro é recusado", async () => {
                let payload = buildPayload()

                await client.anonymous().post("/Users", payload)
                mailer.clearSentMessages()

                expect((await client.anonymous().post("/Users", payload)).status).toBe(406)
                expect(mailer.getSentMessages()).toHaveLength(0)
            })
        })

        it("grava a senha com hash, nunca em texto puro", async () => {
            let payload = buildPayload()

            await client.anonymous().post("/Users", payload)

            let created = await findByEmail(payload.Email)

            expect(created?.Password).not.toBe(payload.Password)
        })

        let IdWorkspace: number

        //  Todo dado de domínio é escopado por IdWorkspace: usuário sem workspace não
        //  consegue lançar nada, então os dois nascem na mesma transaction
        it("cria o workspace do usuário junto e devolve os dois ids", async () => {
            let payload = buildPayload({ Name: "Usuário com workspace" })

            let response = await client.anonymous().post("/Users", payload)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                IdUser: expect.any(Number),
                IdWorkspace: expect.any(Number),
            })

            IdWorkspace = response.body.IdWorkspace

            let workspace = await findWorkspace(response.body.IdWorkspace)

            expect(workspace?.IdOwnerUser).toBe(response.body.IdUser)
            expect(workspace?.Name).toBe(payload.Name)
        })

        //  O TESTE DO BURACO ORIGINAL, e ele não pode sumir da suíte: a rota é pública e
        //  aceitava um IdWorkspace no corpo, entrando direto como matrícula 'owner' do tenant
        //  alheio. IdWorkspace é inteiro sequencial — adivinha-se contando.
        //
        //  Um cliente antigo tem que falhar alto, não ganhar um workspace próprio em silêncio.
        it("recusa IdWorkspace no corpo, e não cria matrícula nenhuma com ele", async () => {
            let before = await countMembers(IdWorkspace)

            let response = await client.anonymous().post("/Users", buildPayload({ IdWorkspace } as object))

            expect(response.status).toBe(406)
            expect(await countMembers(IdWorkspace)).toBe(before)
        })

        //  O que entrou no lugar: o hash do convite. 32 bytes aleatórios, que não se adivinham,
        //  e uma linha no banco que diz para QUEM o convite é e com que papel.
        it("entra no workspace do convite quando o InviteHash vem no corpo", async () => {
            let payload = buildPayload({ Name: "Convidado pelo cadastro" })
            let invite = await seedInvite(IdWorkspace, root.user.IdUser, payload.Email, "editor")

            let response = await client.anonymous().post("/Users", { ...payload, InviteHash: invite.Hash })

            expect(response.status).toBe(200)
            expect(response.body.IdWorkspace).toBe(IdWorkspace)

            //  O papel vem da linha do convite, nunca do cliente
            let membership = await findMembership(IdWorkspace, response.body.IdUser)

            expect(membership?.Role).toBe("editor")

            //  E o convite fica gasto, na mesma transaction
            expect(await findInvite(invite.IdWorkspaceInvite)).toMatchObject({
                Status: "accepted",
                IdAcceptedUser: response.body.IdUser,
            })
        })

        //  O e-mail é o que impede o link repassado: o link é compartilhável por desenho (uma
        //  URL que o usuário manda por WhatsApp), então o segredo do hash sozinho não basta.
        it("recusa o cadastro por convite com um e-mail diferente, e não matricula ninguém", async () => {
            let invite = await seedInvite(IdWorkspace, root.user.IdUser, UsersFactory.buildEmail(), "editor")
            let before = await countMembers(IdWorkspace)

            let payload = buildPayload({ Name: "Quem recebeu o encaminhamento" })
            let response = await client.anonymous().post("/Users", { ...payload, InviteHash: invite.Hash })

            expect(response.status).toBe(406)
            expect(await countMembers(IdWorkspace)).toBe(before)
            //  E nem o usuário nasce: o convite é conferido antes da transaction
            expect(await findByEmail(payload.Email)).toBeUndefined()
        })

        it("recusa um InviteHash que não existe", async () => {
            let response = await client.anonymous().post("/Users", buildPayload({ InviteHash: "hash-que-nao-existe" }))

            expect(response.status).toBe(406)
        })

        //  Sem a matrícula o workspace é órfão: as leituras saem de WorkspaceMembers
        it("matricula o dono no workspace criado", async () => {
            let response = await client.anonymous().post("/Users", buildPayload())

            let membership = await TestDatabase.connection()
                .select("*")
                .from("WorkspaceMembers")
                .where("IdWorkspace", response.body.IdWorkspace)
                .first()

            expect(membership?.IdUser).toBe(response.body.IdUser)
            expect(membership?.Role).toBe("owner")
        })

        //  Todo rateio é entre Persons, nunca entre Users: sem esta linha o primeiro gasto
        //  compartilhado exigiria que o usuário se cadastrasse como pessoa antes de conseguir
        //  aparecer no próprio rateio. Vai na mesma transaction, como o workspace.
        it("cria a Person do próprio dono junto", async () => {
            let payload = buildPayload({ Name: "Dono que também é pessoa" })

            let response = await client.anonymous().post("/Users", payload)

            let person = await findPerson(response.body.IdWorkspace)

            //  O IdUser da pessoa é o vínculo com o login, e este é o único lugar que o escreve
            expect(person).toMatchObject({ Name: payload.Name, IdUser: response.body.IdUser })
        })

        //  Homônimo no workspace já existente: o unique(IdWorkspace, Name) derrubaria a
        //  transaction inteira, ou seja, um xará impediria o cadastro. A pessoa é pulada, não
        //  inventada — ver Persons/sections/POST/createSelf.ts.
        it("cadastra sem a Person quando o nome já existe no workspace", async () => {
            let owner = buildPayload({ Name: "Nome repetido" })
            let created = await client.anonymous().post("/Users", owner)

            let guest = buildPayload({ Name: "Nome repetido" })
            let invite = await seedInvite(created.body.IdWorkspace, created.body.IdUser, guest.Email, "editor")

            let response = await client.anonymous().post("/Users", { ...guest, InviteHash: invite.Hash })

            expect(response.status).toBe(200)

            let persons = await findPersons(created.body.IdWorkspace)

            expect(persons).toHaveLength(1)
            expect(persons[0].IdUser).toBe(created.body.IdUser)
        })

        //  O índice único de Email já barraria, mas com 500: a resposta tem que dizer o motivo
        it("recusa um e-mail que já existe", async () => {
            let payload = buildPayload()

            expect((await client.anonymous().post("/Users", payload)).status).toBe(200)

            let response = await client.anonymous().post("/Users", { ...payload, Name: "Outro nome" })

            expect(response.status).toBe(406)
        })

        //  O validateLogin normaliza o login para minúsculo: gravar o e-mail como veio
        //  deixaria quem se cadastrou com maiúscula sem conseguir entrar
        it("normaliza o e-mail para minúsculo", async () => {
            let payload = buildPayload()
            let Email = payload.Email.toUpperCase()

            expect((await client.anonymous().post("/Users", { ...payload, Email })).status).toBe(200)

            expect(await findByEmail(payload.Email)).toBeDefined()

            //  E o login com a caixa original continua funcionando
            expect((await client.anonymous().login(Email, payload.Password)).status).toBe(200)
        })

        it("recusa um e-mail malformado", async () => {
            let response = await client.anonymous().post("/Users", buildPayload({ Email: "nao-e-um-email" }))

            expect(response.status).toBe(406)
        })

        //  Se o workspace falhasse, um usuário pela metade ficaria gravado
        it("não deixa usuário órfão quando o cadastro é recusado", async () => {
            let payload = buildPayload()

            await client.anonymous().post("/Users", payload)
            await client.anonymous().post("/Users", payload)

            let users = await TestDatabase.connection().select("*").from("Users").where("Email", payload.Email)

            expect(users).toHaveLength(1)
        })
    })

    describe("PUT /Users/IdUser=:IdUser", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Users/IdUser=${root.user.IdUser}`, buildUpdatePayload())

            expect(response.status).toBe(401)
        })

        it("recusa IdUser não numérico", async () => {
            let response = await client.put("/Users/IdUser=abc", buildUpdatePayload())

            expect(response.status).toBe(406)
        })

        //  A senha não se troca por aqui: ela tem rota própria, que exige a senha atual
        it("recusa Password no corpo", async () => {
            let response = await client.put(`/Users/IdUser=${root.user.IdUser}`, buildPayload())

            expect(response.status).toBe(406)
        })

        //  **O teste da etapa.** Sem esta regra eu confirmo a@x.com, troco para b@y.com e
        //  continuo "confirmado" num endereço que nunca provei ser meu — o carimbo passaria a
        //  atestar uma coisa que não aconteceu, e a etapa inteira perderia o sentido.
        it("trocar o e-mail derruba a confirmação e o token antigo para de valer", async () => {
            let target = await UsersFactory.create()
            let oldToken = forgeToken({ IdUser: target.user.IdUser, Email: target.user.Email, type: "confirm" })

            expect((await client.anonymous().post("/Users/confirmEmail", { Token: oldToken })).status).toBe(200)
            expect((await findByEmail(target.user.Email))?.EmailConfirmedAt).toBeTruthy()

            let NewEmail = UsersFactory.buildEmail()

            expect((await client.put(`/Users/IdUser=${target.user.IdUser}`, buildUpdatePayload({ Email: NewEmail }))).status).toBe(200)

            expect((await findByEmail(NewEmail))?.EmailConfirmedAt).toBeNull()
            //  O token antigo carrega o endereço que atestava: ele morre sozinho, sem lista de
            //  revogados — o mesmo mecanismo da impressão digital da senha na recuperação.
            expect((await client.anonymous().post("/Users/confirmEmail", { Token: oldToken })).status).toBe(406)
        })

        //  O PUT é substituição: o Email chega em toda chamada, inclusive nas que só mudam o
        //  nome. Zerar a confirmação nessas cobraria de novo por um endereço já provado.
        it("mudar só o nome não derruba a confirmação", async () => {
            let target = await UsersFactory.create()
            let token = forgeToken({ IdUser: target.user.IdUser, Email: target.user.Email, type: "confirm" })

            await client.anonymous().post("/Users/confirmEmail", { Token: token })

            await client.put(`/Users/IdUser=${target.user.IdUser}`, buildUpdatePayload({ Name: "Outro nome", Email: target.user.Email }))

            expect((await findByEmail(target.user.Email))?.EmailConfirmedAt).toBeTruthy()
        })

        describeMailbox("quando o e-mail muda", () => {

            it("manda a confirmação para o endereço novo, e só para ele", async () => {
                let target = await UsersFactory.create()
                let NewEmail = UsersFactory.buildEmail()

                mailer.clearSentMessages()

                await client.put(`/Users/IdUser=${target.user.IdUser}`, buildUpdatePayload({ Email: NewEmail }))

                let [message] = mailer.getSentMessages()

                expect(mailer.getSentMessages()).toHaveLength(1)
                expect(message.to[0].address).toBe(NewEmail)
            })
        })

        it("atualiza os dados e o UpdatedAt", async () => {
            let target = await UsersFactory.create()
            let payload = buildUpdatePayload({ Name: "Nome atualizado", Email: target.user.Email })

            let response = await client.put(`/Users/IdUser=${target.user.IdUser}`, payload)

            expect(response.status).toBe(200)

            let updated = await findByEmail(target.user.Email)

            expect(updated?.Name).toBe("Nome atualizado")
            expect(new Date(updated!.UpdatedAt).getTime()).toBeGreaterThanOrEqual(new Date(target.user.UpdatedAt).getTime())
        })
    })

    describe("PUT /Users/updatePassword", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put("/Users/updatePassword", { oldPassword: root.password, newPassword: "NovaSenha@123" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem a nova senha", async () => {
            let response = await new TestClient(root.token).put("/Users/updatePassword", { oldPassword: root.password })

            expect(response.status).toBe(406)
        })

        it("recusa quando a senha atual não confere", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).put("/Users/updatePassword", { oldPassword: "não é essa", newPassword: "NovaSenha@123" })

            expect(response.status).toBe(406)

            //  A senha antiga continua valendo
            expect((await client.anonymous().login(owner.user.Email, owner.password)).status).toBe(200)
        })

        it("troca a senha do dono do token e permite logar com ela", async () => {
            let owner = await UsersFactory.create()
            let newPassword = "NovaSenha@123"

            let response = await new TestClient(owner.token).put("/Users/updatePassword", { oldPassword: owner.password, newPassword })

            expect(response.status).toBe(200)

            let login = await client.anonymous().login(owner.user.Email, newPassword)

            expect(login.status).toBe(200)
        })

        it("guarda a nova senha com hash", async () => {
            let owner = await UsersFactory.create()
            let newPassword = "OutraSenha@456"

            await new TestClient(owner.token).put("/Users/updatePassword", { oldPassword: owner.password, newPassword })

            let updated = await findByEmail(owner.user.Email)

            expect(updated?.Password).not.toBe(newPassword)
        })
    })

    describe("DELETE /Users", () => {

        it("recusa sem token", async () => {
            let owner = await UsersFactory.create()

            let response = await client.anonymous().delete("/Users", { Password: owner.password })

            expect(response.status).toBe(401)
            expect(await findByEmail(owner.user.Email)).toBeDefined()
        })

        it("recusa corpo sem a senha", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).delete("/Users", {})

            expect(response.status).toBe(406)
            expect(await findByEmail(owner.user.Email)).toBeDefined()
        })

        //  A CONFERÊNCIA DA SENHA É O PONTO DA ROTA, e não formalidade: o cookie de sessão dura
        //  até 30 dias, então "estar logado" não prova que quem clicou é o dono da conta. 401 e
        //  não 406, porque o que foi recusado é a credencial — e a conta continua de pé.
        it("recusa a senha errada e não apaga nada", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).delete("/Users", { Password: "não é essa" })

            expect(response.status).toBe(401)
            expect(response.body.msg).toBe("Senha incorreta")
            expect(await findByEmail(owner.user.Email)).toBeDefined()

            //  A sessão sobrevive à recusa: quem só errou a senha não é deslogado junto.
            expect((await new TestClient(owner.token).get("/Users/getSelf")).status).toBe(200)
        })

        it("apaga a linha do usuário de verdade, em vez de desativá-la", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).delete("/Users", { Password: owner.password })

            expect(response.status).toBe(200)
            expect(await findByEmail(owner.user.Email)).toBeUndefined()
        })

        //  O soft delete manteria o e-mail ocupado: o unique(Email) não conhece o Active, e o
        //  endereço ficaria travado contra um cadastro futuro do próprio dono.
        it("libera o e-mail para um cadastro novo", async () => {
            let owner = await UsersFactory.create()
            let { Email } = owner.user

            await new TestClient(owner.token).delete("/Users", { Password: owner.password })

            expect((await client.anonymous().post("/Users", buildPayload({ Email }))).status).toBe(200)
        })

        it("limpa o cookie, e a sessão que apagou a conta não vale mais", async () => {
            let owner = await UsersFactory.create()
            let session = new TestClient()
            await session.login(owner.user.Email, owner.password)

            let response = await session.delete("/Users", { Password: owner.password })

            let cookies: string[] = response.headers["set-cookie"] ?? []
            let raw = cookies.find((cookie) => cookie.startsWith("token="))

            expect(raw).toBeTruthy()
            expect(TestClient.extractCookieToken(response)).toBe("")
            expect(raw).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/)

            //  O token continua assinado e dentro da validade, e mesmo assim não abre nada: o
            //  usuário que ele nomeia não existe mais. É 406 "Usuário não encontrado!", e não
            //  401 — o acessMiddleware confere a ASSINATURA, e uma assinatura não deixa de
            //  valer porque a linha sumiu. Quem responde é o getSelf, que já tratava o usuário
            //  ausente antes desta rota existir e limpa o cookie de novo ao fazê-lo.
            let orphan = await session.get("/Users/getSelf")

            expect(orphan.status).toBe(406)
            expect(orphan.body.msg).toBe("Usuário não encontrado!")
        })

        //  O espaço de quem era o único integrante some inteiro, em cascata — é isso que o
        //  direito à eliminação significa, e é o que a política de privacidade afirma.
        it("leva junto o espaço de que era a única integrante", async () => {
            let owner = await UsersFactory.create()
            let { IdWorkspace } = owner.workspace

            await new TestClient(owner.token).delete("/Users", { Password: owner.password })

            expect(await findWorkspace(IdWorkspace)).toBeUndefined()
            expect(await findPerson(IdWorkspace)).toBeUndefined()
        })

        //  A GUARDA QUE EXISTE POR CAUSA DA CASCATA. Workspaces.IdOwnerUser é ON DELETE
        //  CASCADE: sem esta recusa, apagar a conta do dono levaria junto o espaço inteiro —
        //  contas, gastos e histórico — de todo mundo que foi convidado para ele.
        it("recusa quem é dono de um espaço com outro membro, mandando transferir", async () => {
            let owner = await UsersFactory.create({ Name: "Dona do espaço" })
            let guest = await UsersFactory.create({ Name: "Convidado" })
            await joinWorkspace(owner.workspace.IdWorkspace, guest.user)

            let response = await new TestClient(owner.token).delete("/Users", { Password: owner.password })

            expect(response.status).toBe(406)
            expect(response.body.msg).toContain("Transfira a propriedade")
            expect(await findByEmail(owner.user.Email)).toBeDefined()
            expect(await findWorkspace(owner.workspace.IdWorkspace)).toBeDefined()
        })

        //  Depois de transferir, a mesma chamada passa: a recusa é sobre o estado do espaço, e
        //  não sobre a pessoa. É o próximo passo que a mensagem manda dar, verificado.
        it("passa a aceitar depois que a propriedade é transferida", async () => {
            let owner = await UsersFactory.create({ Name: "Dona que transfere" })
            let guest = await UsersFactory.create({ Name: "Novo dono" })
            let membership = await joinWorkspace(owner.workspace.IdWorkspace, guest.user)

            let path = "/Workspaces/members/IdWorkspaceMember=" + membership.IdWorkspaceMember + "/transferOwnership"
            let transfer = await new TestClient(owner.token).post(path)

            expect(transfer.status).toBe(200)

            let response = await new TestClient(owner.token).delete("/Users", { Password: owner.password })

            expect(response.status).toBe(200)
            expect(await findWorkspace(owner.workspace.IdWorkspace)).toBeDefined()
        })

        //  O TESTE QUE PROVA QUE O DINHEIRO DE QUEM FICOU NÃO MUDA. O convidado apaga a conta e
        //  o espaço do dono continua de pé: a matrícula do convidado some, o que ele lançou fica
        //  sem autor (SET NULL), e a Person dele continua na lista — ela é o eixo analítico do
        //  rateio, e apagá-la reescreveria o histórico de quem gastou o quê para todo mundo.
        it("o espaço de outra pessoa continua de pé, com o que o convidado lançou", async () => {
            let owner = await UsersFactory.create({ Name: "Dona que fica" })
            let guest = await UsersFactory.create({ Name: "Convidado que sai" })
            let { IdWorkspace } = owner.workspace

            await joinWorkspace(IdWorkspace, guest.user)
            let account = await seedAccount(IdWorkspace, guest.user.IdUser)
            let inflow = await seedInflow(IdWorkspace, guest.user.IdUser, account.IdAccount)

            expect((await new TestClient(guest.token).delete("/Users", { Password: guest.password })).status).toBe(200)

            //  O espaço e o dono continuam lá; quem saiu foi só a matrícula do convidado.
            expect(await findWorkspace(IdWorkspace)).toBeDefined()
            expect(await findMembership(IdWorkspace, owner.user.IdUser)).toBeDefined()
            expect(await findMembership(IdWorkspace, guest.user.IdUser)).toBeUndefined()
            expect(await countMembers(IdWorkspace)).toBe(1)

            //  Os lançamentos ficam, sem autor: o saldo do mês de quem ficou não pode mudar
            //  porque outra pessoa encerrou a conta.
            let storedAccount = await findAccount(account.IdAccount)
            let storedInflow = await findInflow(inflow.IdInflow)

            expect(storedAccount).toBeDefined()
            expect(storedAccount.IdUser).toBeNull()
            expect(storedInflow).toBeDefined()
            expect(storedInflow.IdUser).toBeNull()
            expect(Number(storedInflow.TotalValue)).toBe(150)

            //  E a Person do convidado continua na lista do espaço, desligada do usuário.
            let persons = await findPersons(IdWorkspace)

            expect(persons).toHaveLength(2)

            let guestPerson = persons.find((person: { Name: string }) => person.Name === guest.user.Name)

            expect(guestPerson).toBeDefined()
            expect(guestPerson.IdUser).toBeNull()
        })
    })

    //  O caminho completo do usuário, só com HTTP: nenhuma escrita direta no banco, nenhum token
    //  fabricado pela factory. É este describe que continua fazendo sentido quando a suíte roda
    //  com TEST_BASE_URL apontando para um servidor de verdade.
    describe("Fluxo end to end", () => {

        it("cadastra, autentica, consulta e troca a senha", async () => {
            let payload = buildPayload({ Name: "Usuário do fluxo" })

            expect((await new TestClient().post("/Users", payload)).status).toBe(200)

            let created = new TestClient()
            let login = await created.login(payload.Email, payload.Password)

            expect(login.status).toBe(200)
            expect(created.getToken()).toBeTruthy()

            let self = await created.get("/Users/getSelf")

            expect(self.status).toBe(200)
            expect(self.body.Email).toBe(payload.Email)

            let newPassword = "SenhaDoFluxo@456"

            expect((await created.put("/Users/updatePassword", { oldPassword: payload.Password, newPassword })).status).toBe(200)
            expect((await new TestClient().login(payload.Email, newPassword)).status).toBe(200)
            expect((await new TestClient().login(payload.Email, payload.Password)).status).toBe(401)
        })
    })
})

//  Pede a recuperação e devolve o token que chegou no e-mail. É o caminho do usuário de
//  verdade: nenhum token fabricado, nenhuma leitura direta do banco.
async function requestToken(Email: string) {
    mailer.clearSentMessages()

    await new TestClient().post("/Users/forgotPassword", { Email })

    let [message] = mailer.getSentMessages()
    let token = readToken(message.text)

    if (!token) throw new Error(`Nenhum token no e-mail enviado para ${Email}`)

    return token
}

//  Cadastra pela rota e devolve o token que chegou no e-mail de confirmação. É o caminho do
//  usuário de verdade: nenhum token fabricado, nenhuma leitura direta do banco.
async function signupReadingConfirmation(overrides: Partial<UsersNamespace.CreateUserPayload> = {}) {
    mailer.clearSentMessages()

    let payload = buildPayload(overrides)

    await new TestClient().post("/Users", payload)

    let [message] = mailer.getSentMessages()
    let Token = readToken(message?.text ?? "")

    if (!Token) throw new Error(`Nenhum token de confirmação no e-mail enviado para ${payload.Email}`)

    return { payload, Token }
}

function readToken(text: string) {
    return text.match(/[?&]Token=([^\s&]+)/)?.[1] ?? null
}

//  A vida do token, em segundos — para ser comparada com o Max-Age do cookie que o carrega.
//  Os dois eram literais soltos no mesmo arquivo, coincidindo por sorte, e uma diferença entre
//  eles não dá erro nenhum na hora: só um 401 com a credencial na mão, dias depois.
function tokenLifetime(token: string) {
    let { exp, iat } = decodePayload(token)

    return exp - iat
}

//  Lê o payload sem verificar assinatura, que é o que qualquer cliente consegue fazer: o JWT
//  é assinado, não criptografado.
function decodePayload(token: string): { exp: number, iat: number, RememberDevice?: boolean } {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
}

//  Assina um token à mão para os casos que a rota não produz: outra finalidade, expirado, ou
//  com a impressão digital de outra senha. O segredo é o mesmo do app — o que se está provando
//  é que assinatura válida **não basta**.
function forgeToken(payload: object, expiresIn: string = "30m") {
    return jwt.sign(payload, enviromentManager.getEnv("JWT_SECRET"), { expiresIn } as jwt.SignOptions)
}

//  Corpo do cadastro: com senha
function buildPayload(overrides: Partial<UsersNamespace.CreateUserPayload> = {}): UsersNamespace.CreateUserPayload {
    return {
        Name: "Usuário de teste",
        Email: UsersFactory.buildEmail(),
        Password: "Senha@123",
        Phone: 549987654321,
        AcceptedTerms: true,
        ...overrides,
    }
}

//  Corpo do update: sem senha, que só se troca pela rota dedicada
function buildUpdatePayload(overrides: Partial<UsersNamespace.UpdateUserPayload> = {}): UsersNamespace.UpdateUserPayload {
    let { Password, AcceptedTerms, ...payload } = buildPayload()

    return { ...payload, ...overrides }
}

function findByEmail(Email: string) {
    return TestDatabase.connection().select("*").from("Users").where("Email", Email).first()
}

function findWorkspace(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Workspaces").where("IdWorkspace", IdWorkspace).first()
}

function findPerson(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Persons").where("IdWorkspace", IdWorkspace).first()
}

//  Semeia o convite direto no banco: aqui ele é arranjo de estado, não o objeto do teste — a
//  rota que o cria é coberta em Workspaces.test.ts.
async function seedInvite(IdWorkspace: number, IdInviterUser: number, Email: string, Role: "editor" | "viewer") {
    let [invite] = await TestDatabase.connection()
        .insert({
            IdWorkspace,
            IdInviterUser,
            Email: Email.toLowerCase(),
            Role,
            Hash: `hash-de-teste-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            ExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .into("WorkspaceInvites")
        .returning("*")

    return invite as { IdWorkspaceInvite: number, Hash: string }
}

function findInvite(IdWorkspaceInvite: number) {
    return TestDatabase.connection().select("*").from("WorkspaceInvites").where("IdWorkspaceInvite", IdWorkspaceInvite).first()
}

function findMembership(IdWorkspace: number, IdUser: number) {
    return TestDatabase.connection().select("*").from("WorkspaceMembers").where("IdWorkspace", IdWorkspace).where("IdUser", IdUser).first()
}

async function countMembers(IdWorkspace: number) {
    let rows = await TestDatabase.connection().select("*").from("WorkspaceMembers").where("IdWorkspace", IdWorkspace)

    return rows.length
}

function findPersons(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Persons").where("IdWorkspace", IdWorkspace).orderBy("IdPerson")
}

//  Põe um segundo usuário dentro de um espaço já existente: a matrícula mais a Person dele, que
//  é o que o join do convite faz. Aqui isso é arranjo de estado — a rota que o produz é coberta
//  em Workspaces.test.ts —, e a Person entra junto porque é ela que sobrevive ao encerramento
//  da conta, desligada do usuário.
async function joinWorkspace(IdWorkspace: number, user: { IdUser: number, Name: string }, Role: "editor" | "viewer" = "editor") {
    let [membership] = await TestDatabase.connection()
        .insert({ IdWorkspace, IdUser: user.IdUser, Role })
        .into("WorkspaceMembers")
        .returning("*")

    await TestDatabase.connection()
        .insert({ IdWorkspace, IdUser: user.IdUser, Name: user.Name })
        .into("Persons")

    return membership as { IdWorkspaceMember: number }
}

//  Uma conta e uma entrada lançadas por outra pessoa dentro do espaço, semeadas direto: o que
//  está sob teste é o que sobra delas depois que o autor encerra a conta, não como nasceram.
async function seedAccount(IdWorkspace: number, IdUser: number) {
    let [account] = await TestDatabase.connection()
        .insert({ IdWorkspace, IdUser, Name: "Conta do convidado", InitialBalance: 0 })
        .into("Accounts")
        .returning("*")

    return account as { IdAccount: number }
}

async function seedInflow(IdWorkspace: number, IdUser: number, IdToAccount: number) {
    let [inflow] = await TestDatabase.connection()
        .insert({
            IdWorkspace,
            IdUser,
            IdToAccount,
            Description: "Entrada do convidado",
            TotalValue: 150,
            Status: "received",
            Kind: "inflow",
            CompetenceDate: "2026-09-01",
        })
        .into("Inflows")
        .returning("*")

    return inflow as { IdInflow: number }
}

function findAccount(IdAccount: number) {
    return TestDatabase.connection().select("*").from("Accounts").where("IdAccount", IdAccount).first()
}

function findInflow(IdInflow: number) {
    return TestDatabase.connection().select("*").from("Inflows").where("IdInflow", IdInflow).first()
}
