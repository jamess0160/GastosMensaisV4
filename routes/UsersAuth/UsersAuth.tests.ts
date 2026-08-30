import { TestClient, TestDatabase, TestUser, UsersAuthFactory, UsersFactory } from "root/Utils/Tests"

//  Testes integrados da feature UsersAuth (biometria/WebAuthn). Um describe por rota de
//  UsersAuth.route.ts, na mesma ordem.
//
//  Limite conhecido da suíte: fechar o ciclo do register e do authenticate exige uma
//  assinatura de um autenticador real (digital do aparelho). O que dá para cobrir sem ele é
//  tudo que vem antes e depois da verificação criptográfica — geração e amarração do desafio,
//  quem pode chamar o quê, estado do dispositivo e persistência — mais as recusas, que é
//  onde mora o risco: um desafio reaproveitado ou de outro usuário não pode passar.

describe("UsersAuth", () => {

    let root: TestUser
    let client: TestClient

    beforeAll(async () => {
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono da biometria" })
        client = new TestClient(root.token)
    })

    describe("GET /UsersAuth/checkDevice/DeviceKey=:DeviceKey", () => {

        //  Rota pública de propósito: é o primeiro pedido do app, antes de existir token
        it("responde null para um aparelho desconhecido", async () => {
            let response = await client.anonymous().get(`/UsersAuth/checkDevice/DeviceKey=${UsersAuthFactory.buildDeviceKey()}`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ UseAuth: null })
        })

        it("responde true para um aparelho com credencial", async () => {
            let owner = await UsersFactory.create()
            let credential = await UsersAuthFactory.create(owner.user.IdUser)

            let response = await client.anonymous().get(`/UsersAuth/checkDevice/DeviceKey=${credential.DeviceKey}`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ UseAuth: true })
        })

        it("responde false para um aparelho em que o usuário recusou a biometria", async () => {
            let owner = await UsersFactory.create()
            let deviceKey = UsersAuthFactory.buildDeviceKey()

            await new TestClient(owner.token).post("/UsersAuth/skipDevice", { DeviceKey: deviceKey })

            let response = await client.anonymous().get(`/UsersAuth/checkDevice/DeviceKey=${deviceKey}`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ UseAuth: false })
        })

        it("recusa DeviceKey fora do formato", async () => {
            //  O '.' é caractere válido de URL mas não existe em base64url: é o schema que recusa
            let response = await client.anonymous().get("/UsersAuth/checkDevice/DeviceKey=chave.invalida")

            expect(response.status).toBe(406)
        })
    })

    describe("GET /UsersAuth/getSelf", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get("/UsersAuth/getSelf")

            expect(response.status).toBe(401)
        })

        it("lista as credenciais do usuário do token", async () => {
            let owner = await UsersFactory.create()
            let credential = await UsersAuthFactory.create(owner.user.IdUser)
            await UsersAuthFactory.create((await UsersFactory.create()).user.IdUser)

            let response = await new TestClient(owner.token).get("/UsersAuth/getSelf")

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)
            expect(response.body[0].IdUserAuth).toBe(credential.IdUserAuth)
        })

        //  A chave pública é detalhe interno do protocolo: não tem uso no cliente
        it("não devolve a PublicKey nem o Counter", async () => {
            let owner = await UsersFactory.create()
            await UsersAuthFactory.create(owner.user.IdUser)

            let response = await new TestClient(owner.token).get("/UsersAuth/getSelf")

            expect(response.body[0].PublicKey).toBeUndefined()
            expect(response.body[0].Counter).toBeUndefined()
        })
    })

    describe("GET /UsersAuth/options/register", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get("/UsersAuth/options/register")

            expect(response.status).toBe(401)
        })

        it("devolve as options e o desafio assinado", async () => {
            let response = await client.get("/UsersAuth/options/register")

            expect(response.status).toBe(200)
            expect(response.body.options.challenge).toEqual(expect.any(String))
            expect(response.body.options.rp.id).toEqual(expect.any(String))
            expect(response.body.ChallengeToken).toEqual(expect.any(String))
        })

        //  Só a digital do próprio aparelho: chave física externa não serve ao caso de uso
        it("pede um autenticador de plataforma", async () => {
            let response = await client.get("/UsersAuth/options/register")

            expect(response.body.options.authenticatorSelection.authenticatorAttachment).toBe("platform")
        })

        //  Sem isto o navegador deixaria o usuário registrar a mesma digital duas vezes
        it("exclui as credenciais que o usuário já registrou", async () => {
            let owner = await UsersFactory.create()
            let credential = await UsersAuthFactory.create(owner.user.IdUser)

            let response = await new TestClient(owner.token).get("/UsersAuth/options/register")

            expect(response.body.options.excludeCredentials.map((item: { id: string }) => item.id)).toEqual([credential.CredentialId])
        })

        it("gera um desafio diferente a cada chamada", async () => {
            let first = await client.get("/UsersAuth/options/register")
            let second = await client.get("/UsersAuth/options/register")

            expect(first.body.options.challenge).not.toBe(second.body.options.challenge)
        })
    })

    describe("GET /UsersAuth/options/login/DeviceKey=:DeviceKey", () => {

        it("recusa um aparelho sem credencial registrada", async () => {
            let response = await client.anonymous().get(`/UsersAuth/options/login/DeviceKey=${UsersAuthFactory.buildDeviceKey()}`)

            expect(response.status).toBe(406)
        })

        //  Rota pública: é justamente o caminho de quem ainda não tem token
        it("devolve as credenciais do aparelho sem exigir token", async () => {
            let owner = await UsersFactory.create()
            let credential = await UsersAuthFactory.create(owner.user.IdUser)

            let response = await client.anonymous().get(`/UsersAuth/options/login/DeviceKey=${credential.DeviceKey}`)

            expect(response.status).toBe(200)
            expect(response.body.options.allowCredentials.map((item: { id: string }) => item.id)).toEqual([credential.CredentialId])
            expect(response.body.ChallengeToken).toEqual(expect.any(String))
        })

        //  Duas pessoas no mesmo aparelho: o autenticador escolhe, o usuário só é
        //  resolvido depois, pelo CredentialId que voltar assinado
        it("oferece as credenciais de todos os usuários do aparelho", async () => {
            let deviceKey = UsersAuthFactory.buildDeviceKey()
            let first = await UsersFactory.create()
            let second = await UsersFactory.create()

            await UsersAuthFactory.create(first.user.IdUser, { DeviceKey: deviceKey })
            await UsersAuthFactory.create(second.user.IdUser, { DeviceKey: deviceKey })

            let response = await client.anonymous().get(`/UsersAuth/options/login/DeviceKey=${deviceKey}`)

            expect(response.body.options.allowCredentials).toHaveLength(2)
        })
    })

    describe("POST /UsersAuth/register", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post("/UsersAuth/register", buildRegisterBody("token-qualquer"))

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem o ChallengeToken", async () => {
            let response = await client.post("/UsersAuth/register", { Response: { id: "abc" } })

            expect(response.status).toBe(406)
        })

        it("recusa um ChallengeToken forjado", async () => {
            let response = await client.post("/UsersAuth/register", buildRegisterBody("nao-e-um-jwt"))

            expect(response.status).toBe(406)
        })

        //  O desafio é emitido para um usuário: sem essa amarração um token válido pego de
        //  outra conta serviria para pendurar uma passkey na conta errada
        it("recusa o desafio emitido para outro usuário", async () => {
            let other = await UsersFactory.create()
            let options = await new TestClient(other.token).get("/UsersAuth/options/register")

            let response = await client.post("/UsersAuth/register", buildRegisterBody(options.body.ChallengeToken))

            expect(response.status).toBe(406)
            expect(await countCredentials(root.user.IdUser)).toBe(0)
        })

        //  O desafio de login não vale para registrar: o type vai dentro do token justamente
        //  para os dois fluxos não se cruzarem
        it("recusa um desafio de login", async () => {
            let owner = await UsersFactory.create()
            let credential = await UsersAuthFactory.create(owner.user.IdUser)
            let options = await client.anonymous().get(`/UsersAuth/options/login/DeviceKey=${credential.DeviceKey}`)

            let response = await new TestClient(owner.token).post("/UsersAuth/register", buildRegisterBody(options.body.ChallengeToken))

            expect(response.status).toBe(406)
        })

        it("recusa uma assinatura que não confere com o desafio", async () => {
            let owner = await UsersFactory.create()
            let ownerClient = new TestClient(owner.token)
            let options = await ownerClient.get("/UsersAuth/options/register")

            let response = await ownerClient.post("/UsersAuth/register", buildRegisterBody(options.body.ChallengeToken))

            expect(response.status).toBe(406)
            expect(await countCredentials(owner.user.IdUser)).toBe(0)
        })
    })

    describe("POST /UsersAuth/authenticate", () => {

        it("recusa corpo sem a resposta do autenticador", async () => {
            let response = await client.anonymous().post("/UsersAuth/authenticate", { ChallengeToken: "abc" })

            expect(response.status).toBe(406)
        })

        it("recusa um ChallengeToken forjado", async () => {
            let response = await client.anonymous().post("/UsersAuth/authenticate", {
                ChallengeToken: "nao-e-um-jwt",
                Response: { id: "qualquer" },
            })

            expect(response.status).toBe(406)
        })

        it("recusa uma credencial que não existe, sem entregar cookie", async () => {
            let owner = await UsersFactory.create()
            let credential = await UsersAuthFactory.create(owner.user.IdUser)
            let options = await client.anonymous().get(`/UsersAuth/options/login/DeviceKey=${credential.DeviceKey}`)

            let response = await client.anonymous().post("/UsersAuth/authenticate", {
                ChallengeToken: options.body.ChallengeToken,
                Response: { id: "credencial-que-nao-existe" },
            })

            expect(response.status).toBe(401)
            expect(TestClient.extractCookieToken(response)).toBeNull()
        })

        //  Desafio de registro não vale para entrar
        it("recusa um desafio de registro", async () => {
            let options = await client.get("/UsersAuth/options/register")

            let response = await client.anonymous().post("/UsersAuth/authenticate", {
                ChallengeToken: options.body.ChallengeToken,
                Response: { id: "qualquer" },
            })

            expect(response.status).toBe(406)
        })
    })

    describe("POST /UsersAuth/skipDevice", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post("/UsersAuth/skipDevice", {})

            expect(response.status).toBe(401)
        })

        it("gera um DeviceKey quando o cliente ainda não tem um", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).post("/UsersAuth/skipDevice", {})

            expect(response.status).toBe(200)
            expect(response.body.DeviceKey).toEqual(expect.any(String))
        })

        it("mantém o DeviceKey que o cliente já tinha", async () => {
            let owner = await UsersFactory.create()
            let deviceKey = UsersAuthFactory.buildDeviceKey()

            let response = await new TestClient(owner.token).post("/UsersAuth/skipDevice", { DeviceKey: deviceKey })

            expect(response.body.DeviceKey).toBe(deviceKey)
        })

        //  (IdUser, DeviceKey) é único: recusar duas vezes não pode estourar o índice
        it("aceita a mesma recusa duas vezes", async () => {
            let owner = await UsersFactory.create()
            let ownerClient = new TestClient(owner.token)
            let deviceKey = UsersAuthFactory.buildDeviceKey()

            expect((await ownerClient.post("/UsersAuth/skipDevice", { DeviceKey: deviceKey })).status).toBe(200)
            expect((await ownerClient.post("/UsersAuth/skipDevice", { DeviceKey: deviceKey })).status).toBe(200)
        })
    })

    describe("DELETE /UsersAuth/IdUserAuth=:IdUserAuth", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete("/UsersAuth/IdUserAuth=1")

            expect(response.status).toBe(401)
        })

        it("recusa a credencial de outro usuário", async () => {
            let owner = await UsersFactory.create()
            let credential = await UsersAuthFactory.create(owner.user.IdUser)

            let response = await client.delete(`/UsersAuth/IdUserAuth=${credential.IdUserAuth}`)

            expect(response.status).toBe(406)
            expect(await countCredentials(owner.user.IdUser)).toBe(1)
        })

        //  Soft delete: a linha fica para o CredentialId continuar ocupado no índice único
        it("desativa a credencial e o aparelho volta a não ter biometria", async () => {
            let owner = await UsersFactory.create()
            let credential = await UsersAuthFactory.create(owner.user.IdUser)

            let response = await new TestClient(owner.token).delete(`/UsersAuth/IdUserAuth=${credential.IdUserAuth}`)

            expect(response.status).toBe(200)

            let row = await findCredential(credential.IdUserAuth)

            expect(row?.Active).toBe(false)

            let check = await client.anonymous().get(`/UsersAuth/checkDevice/DeviceKey=${credential.DeviceKey}`)

            expect(check.body).toEqual({ UseAuth: null })
        })
    })

    //  Só HTTP, do jeito que o app faz: pergunta pelo aparelho, recusa a biometria, e depois
    //  volta atrás pedindo as options de cadastro. O passo que falta — devolver a assinatura
    //  do autenticador — é o que nenhuma suíte consegue fazer sem um aparelho de verdade.
    describe("Fluxo end to end", () => {

        it("consulta o aparelho, recusa a biometria e depois pede o cadastro", async () => {
            let payload = {
                Name: "Usuário da biometria",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            expect((await new TestClient().post("/Users", payload)).status).toBe(200)

            let app = new TestClient()
            let deviceKey = UsersAuthFactory.buildDeviceKey()

            //  Aparelho novo: o app ainda não sabe nada dele
            expect((await app.get(`/UsersAuth/checkDevice/DeviceKey=${deviceKey}`)).body).toEqual({ UseAuth: null })

            expect((await app.login(payload.Email, payload.Password)).status).toBe(200)

            let skipped = await app.post("/UsersAuth/skipDevice", { DeviceKey: deviceKey })

            expect(skipped.status).toBe(200)
            expect(skipped.body.DeviceKey).toBe(deviceKey)

            //  Agora o app sabe que já perguntou e foi recusado: não pergunta de novo
            expect((await app.get(`/UsersAuth/checkDevice/DeviceKey=${deviceKey}`)).body).toEqual({ UseAuth: false })

            let options = await app.get("/UsersAuth/options/register")

            expect(options.status).toBe(200)
            expect(options.body.ChallengeToken).toEqual(expect.any(String))
            expect(options.body.options.user.name).toBe(payload.Email)
        })
    })
})

//  Envelope válido para o schema, com uma assinatura que nunca vai conferir: serve para
//  exercitar as recusas de desafio, que acontecem antes da verificação criptográfica.
function buildRegisterBody(ChallengeToken: string) {
    return {
        ChallengeToken,
        Response: {
            id: "credencial-de-teste",
            rawId: "credencial-de-teste",
            type: "public-key",
            clientExtensionResults: {},
            response: {
                clientDataJSON: "",
                attestationObject: "",
            },
        },
    }
}

function findCredential(IdUserAuth: number) {
    return TestDatabase.connection().select("*").from("UsersAuth").where("IdUserAuth", IdUserAuth).first()
}

async function countCredentials(IdUser: number) {
    let rows = await TestDatabase.connection().select("*").from("UsersAuth").where("IdUser", IdUser).where("Active", true)

    return rows.length
}
