import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"
import { UsersNamespace } from "./sections/types"

//  Testes integrados da feature Users. Um describe por rota de Users.route.ts, na mesma ordem.
//
//  Nada é mockado: a requisição passa pelo AsyncHandler, pelo schema Joi, pelas sections e
//  chega no banco de teste (recriado a cada execução pelo globalSetup). As asserções olham a
//  resposta HTTP e, quando faz diferença, a linha gravada.
//
//  npm test                                          -> app em memória (supertest)
//  TEST_BASE_URL=http://localhost:4000 npm test      -> mesmo arquivo, servidor real (end to end)

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

//  Corpo do cadastro: com senha
function buildPayload(overrides: Partial<UsersNamespace.CreateUserPayload> = {}): UsersNamespace.CreateUserPayload {
    return {
        Name: "Usuário de teste",
        Email: UsersFactory.buildEmail(),
        Password: "Senha@123",
        Phone: 549987654321,
        ...overrides,
    }
}

//  Corpo do update: sem senha, que só se troca pela rota dedicada
function buildUpdatePayload(overrides: Partial<UsersNamespace.UpdateUserPayload> = {}): UsersNamespace.UpdateUserPayload {
    let { Password, ...payload } = buildPayload()

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
