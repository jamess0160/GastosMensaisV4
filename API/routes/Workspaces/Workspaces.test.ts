import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados da feature Workspaces. Um describe por rota de Workspaces.route.ts.
//
//  O PRIMEIRO workspace do usuário nasce dentro do POST /Users, na mesma transaction — é o
//  describe do fluxo end to end que cobre esse nascimento, por HTTP. O POST /Workspaces é o
//  segundo em diante, para quem já tem conta.

describe("Workspaces", () => {

    let root: TestUser
    let client: TestClient

    beforeAll(async () => {
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono do workspace" })
        client = new TestClient(root.token)
    })

    describe("POST /Workspaces", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post("/Workspaces", { Name: "Empresa" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem o Name", async () => {
            let response = await client.post("/Workspaces", {})

            expect(response.status).toBe(406)
        })

        //  Quem cria não foi convidado por ninguém: entra como dono, e o IdOwnerUser é o do
        //  token — não há campo no corpo por onde apontá-lo para outra pessoa.
        it("cria o workspace com o usuário do token como dono e como owner da matrícula", async () => {
            let creator = await UsersFactory.createClient({ Name: "Dono de dois workspaces" })

            let response = await creator.client.post("/Workspaces", { Name: "Empresa" })

            expect(response.status).toBe(200)
            //  Só o id: a linha inteira sai no getSelf
            expect(response.body).toEqual({ IdWorkspace: expect.any(Number) })

            let created = await findWorkspace(response.body.IdWorkspace)

            expect(created).toMatchObject({ Name: "Empresa", IdOwnerUser: creator.user.IdUser })

            //  Sem a matrícula o tenant seria órfão: toda leitura passa por getByMember
            expect((await findMembership(response.body.IdWorkspace, creator.user.IdUser))?.Role).toBe("owner")
        })

        //  Todo rateio é entre Persons, então um workspace em que o criador não é pessoa é um
        //  workspace onde ele não pode aparecer no próprio gasto. O nome é o do USUÁRIO, não o
        //  do workspace: no cadastro os dois coincidem, aqui não — e é aqui que dá para provar.
        it("cria a Person do criador no workspace novo, com o nome do usuário", async () => {
            let creator = await UsersFactory.createClient({ Name: "Pessoa do criador" })

            let response = await creator.client.post("/Workspaces", { Name: "Empresa" })

            let person = (await findPersonsByUser(creator.user.IdUser)).find((item) => item.IdWorkspace === response.body.IdWorkspace)

            expect(person).toMatchObject({ Name: "Pessoa do criador", IdUser: creator.user.IdUser })
        })

        it("passa a listar os dois workspaces no getSelf", async () => {
            let creator = await UsersFactory.createClient()

            let response = await creator.client.post("/Workspaces", { Name: "Empresa" })

            let self = await creator.client.get("/Workspaces/getSelf")

            expect(self.body.map((item: { IdWorkspace: number }) => item.IdWorkspace).sort()).toEqual(
                [creator.workspace.IdWorkspace, response.body.IdWorkspace].sort()
            )
        })

        //  Como o join: criar dá matrícula, não troca a sessão — senão o workspace mudaria
        //  debaixo da tela que o usuário estava usando. Quem quiser operar no novo chama o
        //  switch, que continua sendo a única rota que muda a seleção.
        it("não reemite o token, e o switch é que leva a sessão para o workspace novo", async () => {
            let creator = await UsersFactory.createClient()

            let response = await creator.client.post("/Workspaces", { Name: "Empresa" })

            expect(TestClient.extractCookieToken(response)).toBeNull()
            expect(TestClient.decodeToken(creator.client.getToken()!).IdWorkspace).toBe(creator.workspace.IdWorkspace)

            let switched = await creator.client.post("/Workspaces/switch", { IdWorkspace: response.body.IdWorkspace })

            expect(switched.status).toBe(200)
            expect(TestClient.decodeToken(TestClient.extractCookieToken(switched)!).IdWorkspace).toBe(response.body.IdWorkspace)
        })
    })

    describe("GET /Workspaces/getSelf", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get("/Workspaces/getSelf")

            expect(response.status).toBe(401)
        })

        it("devolve o workspace do usuário do token", async () => {
            let response = await client.get("/Workspaces/getSelf")

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)
            expect(response.body[0]).toMatchObject({
                IdWorkspace: root.workspace.IdWorkspace,
                IdOwnerUser: root.user.IdUser,
            })
        })

        //  O Current é a razão de a rota existir para o chassi: sem ele o cliente não tem como
        //  saber em qual espaço está — a seleção vive dentro do token e o cookie é HttpOnly.
        it("marca com Current o workspace do token, e só ele", async () => {
            let creator = await UsersFactory.createClient({ Name: "Dono de dois workspaces" })

            let created = await creator.client.post("/Workspaces", { Name: "Empresa" })

            //  Criar NÃO troca a sessão: o Current continua no workspace do cadastro
            let self = await creator.client.get("/Workspaces/getSelf")

            expect(self.body).toHaveLength(2)
            expect(self.body.filter((item: { Current: boolean }) => item.Current)).toHaveLength(1)
            expect(self.body.find((item: { Current: boolean }) => item.Current).IdWorkspace).toBe(creator.workspace.IdWorkspace)

            //  E acompanha o TOKEN, não o banco: o Current muda quando o switch reemite o
            //  cookie, e quem continuar mandando o token antigo continua vendo a seleção antiga.
            let switched = await creator.client.post("/Workspaces/switch", { IdWorkspace: created.body.IdWorkspace })

            creator.client.setToken(TestClient.extractCookieToken(switched))

            let after = await creator.client.get("/Workspaces/getSelf")

            expect(after.body.find((item: { Current: boolean }) => item.Current).IdWorkspace).toBe(created.body.IdWorkspace)
        })

        //  A leitura sai de WorkspaceMembers: quem não é membro não enxerga o tenant
        it("não devolve o workspace de outro usuário", async () => {
            let other = await UsersFactory.create()

            let response = await new TestClient(other.token).get("/Workspaces/getSelf")

            expect(response.status).toBe(200)
            expect(response.body.map((item: { IdWorkspace: number }) => item.IdWorkspace)).toEqual([other.workspace.IdWorkspace])
        })
    })

    describe("POST /Workspaces/switch", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post("/Workspaces/switch", { IdWorkspace: root.workspace.IdWorkspace })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem o IdWorkspace", async () => {
            let response = await client.post("/Workspaces/switch", {})

            expect(response.status).toBe(406)
        })

        it("recusa workspace inexistente", async () => {
            let response = await client.post("/Workspaces/switch", { IdWorkspace: 999999 })

            expect(response.status).toBe(406)
        })

        //  É a única rota que recebe um IdWorkspace escrito pelo cliente, e o que sai daqui
        //  vira token assinado: se ela não conferisse a matrícula, todas as rotas seguintes
        //  aceitariam esse token como legítimo — porque, para elas, ele é
        it("recusa o workspace de um usuário que não é membro", async () => {
            let other = await UsersFactory.create()

            let response = await new TestClient(other.token).post("/Workspaces/switch", {
                IdWorkspace: root.workspace.IdWorkspace,
            })

            expect(response.status).toBe(406)
            //  E não emitiu token nenhum
            expect(TestClient.extractCookieToken(response)).toBeNull()
        })

        it("seleciona o workspace do membro e reemite o token com ele dentro", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).post("/Workspaces/switch", {
                IdWorkspace: owner.workspace.IdWorkspace,
            })

            expect(response.status).toBe(200)
            expect(response.body).toMatchObject({
                IdWorkspace: owner.workspace.IdWorkspace,
                IdOwnerUser: owner.user.IdUser,
                //  Mesma forma da linha do getSelf: é o workspace que acabou de virar o da sessão
                Current: true,
            })

            let token = TestClient.extractCookieToken(response)

            expect(token).toBeTruthy()
            expect(TestClient.decodeToken(token!)).toMatchObject({
                id: owner.user.IdUser,
                IdWorkspace: owner.workspace.IdWorkspace,
            })
        })

        //  **A armadilha da sessão de 30 dias, e ela mora aqui e não no login.** O switch é o
        //  único lugar que reemite a credencial: se reemitisse com o default, trocar de
        //  workspace rebaixaria em silêncio uma sessão de 30 dias para 24h, e o usuário seria
        //  deslogado dias depois sem nada explicar por quê. A duração viaja dentro do token,
        //  que é o que o switch lê aqui.
        it("preserva a sessão de 30 dias ao reemitir o token", async () => {
            let owner = await UsersFactory.create()
            let session = new TestClient()

            await session.login(owner.user.Email, owner.password, true)

            let response = await session.post("/Workspaces/switch", { IdWorkspace: owner.workspace.IdWorkspace })

            expect(response.status).toBe(200)
            expect(TestClient.cookieMaxAge(response)).toBe(30 * 24 * 60 * 60)
        })

        it("mantém as 24h da sessão que não pediu para ser lembrada", async () => {
            let owner = await UsersFactory.create()
            let session = new TestClient()

            await session.login(owner.user.Email, owner.password)

            let response = await session.post("/Workspaces/switch", { IdWorkspace: owner.workspace.IdWorkspace })

            expect(TestClient.cookieMaxAge(response)).toBe(24 * 60 * 60)
        })

        //  O token é credencial: não pode ficar ao alcance de script na tela
        it("reemite o token como httpOnly", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).post("/Workspaces/switch", {
                IdWorkspace: owner.workspace.IdWorkspace,
            })

            let raw: string[] = response.headers["set-cookie"] ?? []

            expect(raw.find((cookie) => cookie.startsWith("token="))).toContain("HttpOnly")
        })

        //  Fecha o ciclo: a sessão que não tinha workspace passa a ter, e uma rota de tenant
        //  que respondia 406 passa a responder — com o token novo que o switch devolveu
        it("destrava as rotas de tenant para a sessão que não tinha workspace", async () => {
            let owner = await UsersFactory.create()
            let ownerClient = new TestClient(UsersFactory.buildToken(owner.user.IdUser))

            expect((await ownerClient.get("/Accounts")).status).toBe(406)

            let switched = await ownerClient.post("/Workspaces/switch", { IdWorkspace: owner.workspace.IdWorkspace })

            expect(switched.status).toBe(200)

            ownerClient.setToken(TestClient.extractCookieToken(switched))

            expect((await ownerClient.get("/Accounts")).status).toBe(200)
        })
    })

    //  O convite é o que fechou o buraco do cadastro: o POST /Users aceitava um IdWorkspace do
    //  corpo e entrava direto como matrícula 'owner' do tenant alheio. O que entra no lugar é o
    //  hash desta linha, e é por isso que a suíte cobre com tanto detalhe quem pode criar,
    //  quem pode aceitar e o que acontece com um link repassado.
    describe("POST /Workspaces/invite", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem o Email", async () => {
            let response = await client.post("/Workspaces/invite", { Role: "editor" })

            expect(response.status).toBe(406)
        })

        //  'owner' não se convida: transferir propriedade é operação própria, e continua na
        //  etapa 9 do ROADMAP. Se passasse, um convite entregaria o workspace inteiro.
        it("recusa Role owner no corpo", async () => {
            let response = await client.post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "owner" })

            expect(response.status).toBe(406)
        })

        it("cria o convite e devolve hash e validade", async () => {
            let owner = await UsersFactory.createClient({ Name: "Dona do convite" })
            let Email = UsersFactory.buildEmail()

            let response = await owner.client.post("/Workspaces/invite", { Email, Role: "editor" })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                Hash: expect.any(String),
                ExpiresAt: expect.any(String),
            })

            //  32 bytes em base64url: nem '+', nem '/', nem '=' — ele viaja como parâmetro de
            //  URL, e é o comprimento que faz dele um segredo, ao contrário do id sequencial
            expect(response.body.Hash).toMatch(/^[A-Za-z0-9_-]{43}$/)

            let invite = await findInviteByHash(response.body.Hash)

            expect(invite).toMatchObject({
                IdWorkspace: owner.workspace.IdWorkspace,
                IdInviterUser: owner.user.IdUser,
                Email,
                Role: "editor",
                Status: "pending",
            })
        })

        it("normaliza o e-mail convidado para minúsculo", async () => {
            let owner = await UsersFactory.createClient()
            let Email = UsersFactory.buildEmail()

            let response = await owner.client.post("/Workspaces/invite", { Email: Email.toUpperCase(), Role: "viewer" })

            expect((await findInviteByHash(response.body.Hash))?.Email).toBe(Email.toLowerCase())
        })

        //  Um editor que pudesse convidar promoveria terceiros ao próprio nível sem o dono
        //  saber — por isso assertRole(["owner"]) e não assertMember
        it("recusa convite criado por editor ou viewer", async () => {
            let owner = await UsersFactory.createClient()

            for (let Role of ["editor", "viewer"] as const) {
                let member = await UsersFactory.create()
                await seedMembership(owner.workspace.IdWorkspace, member.user.IdUser, Role)

                let memberClient = new TestClient(UsersFactory.buildToken(member.user.IdUser, owner.workspace.IdWorkspace))
                let response = await memberClient.post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })

                expect(response.status).toBe(403)
            }
        })

        //  Token assinado de verdade, apontando para um workspace de que o usuário não é
        //  membro: a assinatura não pega isso, o assertMember pega
        it("recusa convite de quem não é membro do workspace", async () => {
            let owner = await UsersFactory.create()
            let stranger = await UsersFactory.create()

            let response = await new TestClient(UsersFactory.buildToken(stranger.user.IdUser, owner.workspace.IdWorkspace))
                .post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })

            expect(response.status).toBe(406)
        })

        //  Dois links vivos para o mesmo convite é o pior caso possível: revogar um deixaria o
        //  outro funcionando. Convite repetido renova o existente, com hash e validade novos.
        it("renova o convite pendente do mesmo e-mail em vez de criar um segundo", async () => {
            let owner = await UsersFactory.createClient()
            let Email = UsersFactory.buildEmail()

            let first = await owner.client.post("/Workspaces/invite", { Email, Role: "viewer" })
            let second = await owner.client.post("/Workspaces/invite", { Email, Role: "editor" })

            expect(second.status).toBe(200)
            expect(second.body.Hash).not.toBe(first.body.Hash)

            //  Uma linha só, e o hash antigo morreu junto
            expect(await countInvites(owner.workspace.IdWorkspace)).toBe(1)
            expect(await findInviteByHash(first.body.Hash)).toBeUndefined()
            expect((await findInviteByHash(second.body.Hash))?.Role).toBe("editor")
        })

        //  Erro de quem convida, não do convidado: sem isso o convite só morreria no
        //  unique(IdWorkspace, IdUser) na hora do aceite, com o link já entregue
        it("recusa convite para quem já é membro", async () => {
            let owner = await UsersFactory.createClient()

            let response = await owner.client.post("/Workspaces/invite", { Email: owner.user.Email, Role: "editor" })

            expect(response.status).toBe(406)
        })
    })

    describe("GET /Workspaces/invites", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get("/Workspaces/invites")

            expect(response.status).toBe(401)
        })

        it("recusa leitura por editor", async () => {
            let owner = await UsersFactory.create()
            let member = await UsersFactory.create()
            await seedMembership(owner.workspace.IdWorkspace, member.user.IdUser, "editor")

            let response = await new TestClient(UsersFactory.buildToken(member.user.IdUser, owner.workspace.IdWorkspace)).get("/Workspaces/invites")

            expect(response.status).toBe(403)
        })

        //  "Quem eu convidei e ainda não entrou": é o que uma linha permite e um token opaco
        //  não permitiria — uma das três razões de o convite ser linha e não JWT
        it("lista só os pendentes do próprio workspace", async () => {
            let owner = await UsersFactory.createClient()
            let other = await UsersFactory.createClient()

            let pending = await owner.client.post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })
            let revoked = await owner.client.post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })
            await other.client.post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })

            let toRevoke = await findInviteByHash(revoked.body.Hash)
            expect((await owner.client.delete(`/Workspaces/invite/IdWorkspaceInvite=${toRevoke!.IdWorkspaceInvite}`)).status).toBe(200)

            let response = await owner.client.get("/Workspaces/invites")

            expect(response.status).toBe(200)
            expect(response.body.map((item: { Hash: string }) => item.Hash)).toEqual([pending.body.Hash])
        })
    })

    describe("GET /Workspaces/invite/Hash=:Hash", () => {

        //  Pública: quem recebeu o link ainda pode não ter conta, e exigir token obrigaria a
        //  cadastrar antes de saber para o que se está sendo convidado
        it("descreve o convite sem exigir sessão", async () => {
            let owner = await UsersFactory.createClient({ Name: "Quem convidou" })
            let Email = UsersFactory.buildEmail()

            let created = await owner.client.post("/Workspaces/invite", { Email, Role: "viewer" })

            let response = await client.anonymous().get(`/Workspaces/invite/Hash=${created.body.Hash}`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                WorkspaceName: owner.workspace.Name,
                InviterName: "Quem convidou",
                Email,
                Role: "viewer",
                ExpiresAt: expect.any(String),
            })
        })

        //  Nenhum id na resposta: quem tem o hash já tem o convite, mas a rota não pode virar
        //  sonda para descobrir workspace por id — que é exatamente o buraco que ela fecha
        it("não devolve id nenhum", async () => {
            let owner = await UsersFactory.createClient()
            let created = await owner.client.post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })

            let response = await client.anonymous().get(`/Workspaces/invite/Hash=${created.body.Hash}`)

            expect(Object.keys(response.body).filter((key) => key.startsWith("Id"))).toEqual([])
        })

        it("recusa um hash que não existe", async () => {
            let response = await client.anonymous().get("/Workspaces/invite/Hash=nao-existe")

            expect(response.status).toBe(406)
        })
    })

    describe("POST /Workspaces/join", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post("/Workspaces/join", { Hash: "qualquer" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem o Hash", async () => {
            let response = await client.post("/Workspaces/join", {})

            expect(response.status).toBe(406)
        })

        //  O TESTE DO LINK REPASSADO — o desenho inteiro existe para impedir isto. O link é
        //  compartilhável por desenho (uma URL que vai por WhatsApp), então o segredo do hash
        //  sozinho não basta: quem recebesse o encaminhamento entraria.
        it("recusa o aceite com uma conta de outro e-mail, e não cria matrícula", async () => {
            let owner = await UsersFactory.createClient()
            let invited = await UsersFactory.createClient()
            let intruder = await UsersFactory.createClient()

            let created = await owner.client.post("/Workspaces/invite", { Email: invited.user.Email, Role: "editor" })

            let response = await intruder.client.post("/Workspaces/join", { Hash: created.body.Hash })

            expect(response.status).toBe(406)
            expect(await findMembership(owner.workspace.IdWorkspace, intruder.user.IdUser)).toBeUndefined()
            //  E o convite continua de pé para quem foi convidado de verdade
            expect((await findInviteByHash(created.body.Hash))?.Status).toBe("pending")
        })

        it("matricula o convidado com o papel da linha do convite", async () => {
            let owner = await UsersFactory.createClient()
            let invited = await UsersFactory.createClient()

            let created = await owner.client.post("/Workspaces/invite", { Email: invited.user.Email, Role: "viewer" })

            let response = await invited.client.post("/Workspaces/join", { Hash: created.body.Hash })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ IdWorkspace: owner.workspace.IdWorkspace })

            //  O papel vem do convite, nunca do cliente
            expect((await findMembership(owner.workspace.IdWorkspace, invited.user.IdUser))?.Role).toBe("viewer")

            expect(await findInviteByHash(created.body.Hash)).toMatchObject({
                Status: "accepted",
                IdAcceptedUser: invited.user.IdUser,
            })
        })

        //  ESTE expect é o que prova a migration do índice: Persons tinha unique(IdUser)
        //  GLOBAL, então o convidado ficaria sem pessoa no workspace novo — um membro que não
        //  pode receber um centavo de rateio, já que todo rateio é entre Persons.
        it("cria a Person do convidado no workspace novo, sem tirar a do dele", async () => {
            let owner = await UsersFactory.createClient()
            let invited = await UsersFactory.createClient({ Name: "Convidado com pessoa" })

            let created = await owner.client.post("/Workspaces/invite", { Email: invited.user.Email, Role: "editor" })

            expect((await invited.client.post("/Workspaces/join", { Hash: created.body.Hash })).status).toBe(200)

            let persons = await findPersonsByUser(invited.user.IdUser)

            expect(persons.map((person) => person.IdWorkspace).sort()).toEqual(
                [invited.workspace.IdWorkspace, owner.workspace.IdWorkspace].sort()
            )
        })

        //  O aceite não reemite o token: aceitar dá matrícula, não troca a sessão — juntar as
        //  duas trocaria o workspace debaixo da tela que o usuário estava usando. Quem quiser
        //  operar no workspace novo chama o switch, que é a rota que existe para isso.
        it("não reemite o token, e o switch é que leva a sessão para o workspace novo", async () => {
            let owner = await UsersFactory.createClient()
            let invited = await UsersFactory.createClient()

            let created = await owner.client.post("/Workspaces/invite", { Email: invited.user.Email, Role: "editor" })

            let joined = await invited.client.post("/Workspaces/join", { Hash: created.body.Hash })

            expect(TestClient.extractCookieToken(joined)).toBeNull()
            expect(TestClient.decodeToken(invited.client.getToken()!).IdWorkspace).toBe(invited.workspace.IdWorkspace)

            let switched = await invited.client.post("/Workspaces/switch", { IdWorkspace: owner.workspace.IdWorkspace })

            expect(switched.status).toBe(200)
            expect(TestClient.decodeToken(TestClient.extractCookieToken(switched)!).IdWorkspace).toBe(owner.workspace.IdWorkspace)
        })

        //  O Status é a resposta amigável ao aceite duplo; a garantia de verdade é o
        //  unique(IdWorkspace, IdUser) de WorkspaceMembers, que já existia
        it("recusa o segundo aceite, e a matrícula continua uma só", async () => {
            let owner = await UsersFactory.createClient()
            let invited = await UsersFactory.createClient()

            let created = await owner.client.post("/Workspaces/invite", { Email: invited.user.Email, Role: "editor" })

            expect((await invited.client.post("/Workspaces/join", { Hash: created.body.Hash })).status).toBe(200)

            let second = await invited.client.post("/Workspaces/join", { Hash: created.body.Hash })

            expect(second.status).toBe(406)
            expect(await countMemberships(owner.workspace.IdWorkspace, invited.user.IdUser)).toBe(1)
        })

        //  É por isto que o convite é linha e não JWT: um token de convite valeria até
        //  expirar, mesmo depois de o dono mudar de ideia
        it("recusa convite revogado", async () => {
            let owner = await UsersFactory.createClient()
            let invited = await UsersFactory.createClient()

            let created = await owner.client.post("/Workspaces/invite", { Email: invited.user.Email, Role: "editor" })
            let invite = await findInviteByHash(created.body.Hash)

            await owner.client.delete(`/Workspaces/invite/IdWorkspaceInvite=${invite!.IdWorkspaceInvite}`)

            let response = await invited.client.post("/Workspaces/join", { Hash: created.body.Hash })

            expect(response.status).toBe(406)
            expect(await findMembership(owner.workspace.IdWorkspace, invited.user.IdUser)).toBeUndefined()
        })

        it("recusa convite expirado", async () => {
            let owner = await UsersFactory.createClient()
            let invited = await UsersFactory.createClient()

            let created = await owner.client.post("/Workspaces/invite", { Email: invited.user.Email, Role: "editor" })
            let invite = await findInviteByHash(created.body.Hash)

            await TestDatabase.connection()
                .update({ ExpiresAt: new Date(Date.now() - 1000) })
                .from("WorkspaceInvites")
                .where("IdWorkspaceInvite", invite!.IdWorkspaceInvite)

            let response = await invited.client.post("/Workspaces/join", { Hash: created.body.Hash })

            expect(response.status).toBe(406)
            expect(await findMembership(owner.workspace.IdWorkspace, invited.user.IdUser)).toBeUndefined()
        })
    })

    describe("DELETE /Workspaces/invite/IdWorkspaceInvite=:IdWorkspaceInvite", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete("/Workspaces/invite/IdWorkspaceInvite=1")

            expect(response.status).toBe(401)
        })

        it("revoga o convite pendente", async () => {
            let owner = await UsersFactory.createClient()

            let created = await owner.client.post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })
            let invite = await findInviteByHash(created.body.Hash)

            let response = await owner.client.delete(`/Workspaces/invite/IdWorkspaceInvite=${invite!.IdWorkspaceInvite}`)

            expect(response.status).toBe(200)
            //  Status, não delete físico nem Active: é a convenção da tabela, e a linha guarda
            //  a resposta do "por que meu link parou de funcionar"
            expect((await findInviteByHash(created.body.Hash))?.Status).toBe("revoked")
        })

        //  O id chega do cliente e é sequencial: uma matrícula conferida no próprio tenant
        //  deixaria revogar o convite do vizinho
        it("não revoga o convite de outro workspace", async () => {
            let owner = await UsersFactory.createClient()
            let other = await UsersFactory.createClient()

            let created = await other.client.post("/Workspaces/invite", { Email: UsersFactory.buildEmail(), Role: "editor" })
            let invite = await findInviteByHash(created.body.Hash)

            let response = await owner.client.delete(`/Workspaces/invite/IdWorkspaceInvite=${invite!.IdWorkspaceInvite}`)

            expect(response.status).toBe(406)
            expect((await findInviteByHash(created.body.Hash))?.Status).toBe("pending")
        })

        it("recusa revogar convite já aceito", async () => {
            let owner = await UsersFactory.createClient()
            let invited = await UsersFactory.createClient()

            let created = await owner.client.post("/Workspaces/invite", { Email: invited.user.Email, Role: "editor" })
            let invite = await findInviteByHash(created.body.Hash)

            await invited.client.post("/Workspaces/join", { Hash: created.body.Hash })

            let response = await owner.client.delete(`/Workspaces/invite/IdWorkspaceInvite=${invite!.IdWorkspaceInvite}`)

            expect(response.status).toBe(406)
        })
    })

    describe("PUT /Workspaces", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Workspaces`, { Name: "Novo nome" })

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).put(`/Workspaces`, { Name: "Novo nome" })

            expect(response.status).toBe(406)
        })

        it("recusa corpo sem o Name", async () => {
            let response = await client.put(`/Workspaces`, {})

            expect(response.status).toBe(406)
        })

        //  Token assinado pela própria API, mas apontando para um workspace de que o usuário
        //  não é membro. A assinatura sozinha não pega isso — quem pega é o assertRole
        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let other = await UsersFactory.create()

            let response = await new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace)).put(`/Workspaces`, { Name: "Invadido" })

            expect(response.status).toBe(406)

            let unchanged = await findById(root.workspace.IdWorkspace)

            expect(unchanged?.Name).not.toBe("Invadido")
        })

        it("renomeia o workspace do dono e atualiza o UpdatedAt", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).put(`/Workspaces`, { Name: "Finanças da casa" })

            expect(response.status).toBe(200)

            let updated = await findById(owner.workspace.IdWorkspace)

            expect(updated?.Name).toBe("Finanças da casa")
            expect(new Date(updated!.UpdatedAt).getTime()).toBeGreaterThanOrEqual(new Date(owner.workspace.UpdatedAt).getTime())
        })
    })

    describe("Fluxo end to end", () => {

        it("o cadastro cria o workspace e o dono já o enxerga", async () => {
            let payload = {
                Name: "Usuário do fluxo",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            let created = await new TestClient().post("/Users", payload)

            expect(created.status).toBe(200)
            expect(created.body.IdUser).toEqual(expect.any(Number))
            expect(created.body.IdWorkspace).toEqual(expect.any(Number))

            let client = new TestClient()

            let logged = await client.login(payload.Email, payload.Password)

            expect(logged.status).toBe(200)

            //  O login já sai com um workspace selecionado (AcessControl.startSession →
            //  SelectDefault): sem isso toda rota de tenant responderia 406 até o cliente
            //  chamar o switch — um passo obrigatório depois de todo login.
            //
            //  A seleção viaja dentro do próprio token, e não num cookie à parte: assim o
            //  cliente não consegue reescrevê-la, e a sessão inteira cabe num cookie só.
            expect(TestClient.decodeToken(client.getToken()!)).toMatchObject({
                id: created.body.IdUser,
                IdWorkspace: created.body.IdWorkspace,
            })

            let self = await client.get("/Workspaces/getSelf")

            expect(self.status).toBe(200)
            expect(self.body).toHaveLength(1)
            expect(self.body[0].IdWorkspace).toBe(created.body.IdWorkspace)
            //  O workspace herda o nome do dono no cadastro
            expect(self.body[0].Name).toBe(payload.Name)

            expect((await client.put(`/Workspaces`, { Name: "Meu orçamento" })).status).toBe(200)

            let renamed = await client.get("/Workspaces/getSelf")

            expect(renamed.body[0].Name).toBe("Meu orçamento")
        })

        //  O caminho inteiro do compartilhamento, só por HTTP: dono convida → convidado se
        //  cadastra pelo hash → login → enxerga as contas do workspace compartilhado.
        //  É este describe que continua fazendo sentido contra um servidor de verdade.
        it("o dono convida, o convidado se cadastra pelo hash e passa a enxergar o workspace", async () => {
            let owner = await UsersFactory.createClient({ Name: "Dono que compartilha" })

            //  Uma conta no workspace do dono, para o convidado ter o que enxergar depois
            expect((await owner.client.post("/Accounts", { Name: "Conta da casa", Type: "checking" })).status).toBe(200)

            let guest = {
                Name: "Convidado do fluxo",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            let invite = await owner.client.post("/Workspaces/invite", { Email: guest.Email, Role: "editor" })

            expect(invite.status).toBe(200)

            //  A tela de aceite, ainda sem conta nenhuma
            let described = await new TestClient().get(`/Workspaces/invite/Hash=${invite.body.Hash}`)

            expect(described.status).toBe(200)
            expect(described.body.Email).toBe(guest.Email)

            let created = await new TestClient().post("/Users", { ...guest, InviteHash: invite.body.Hash })

            expect(created.status).toBe(200)
            expect(created.body.IdWorkspace).toBe(owner.workspace.IdWorkspace)

            let guestClient = new TestClient()
            expect((await guestClient.login(guest.Email, guest.Password)).status).toBe(200)

            //  Cadastrado por convite, o único workspace dele é o compartilhado — então o
            //  login já seleciona esse, sem precisar de switch
            let visible = await guestClient.get("/Workspaces/getSelf")

            expect(visible.body.map((item: { IdWorkspace: number }) => item.IdWorkspace)).toEqual([owner.workspace.IdWorkspace])

            let accounts = await guestClient.get("/Accounts")

            expect(accounts.status).toBe(200)
            expect(accounts.body.map((item: { Name: string }) => item.Name)).toContain("Conta da casa")
        })
    })
})

function findInviteByHash(Hash: string) {
    return TestDatabase.connection().select("*").from("WorkspaceInvites").where("Hash", Hash).first()
}

async function countInvites(IdWorkspace: number) {
    let rows = await TestDatabase.connection().select("*").from("WorkspaceInvites").where("IdWorkspace", IdWorkspace)

    return rows.length
}

function findWorkspace(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Workspaces").where("IdWorkspace", IdWorkspace).first()
}

function findMembership(IdWorkspace: number, IdUser: number) {
    return TestDatabase.connection().select("*").from("WorkspaceMembers").where("IdWorkspace", IdWorkspace).where("IdUser", IdUser).first()
}

async function countMemberships(IdWorkspace: number, IdUser: number) {
    let rows = await TestDatabase.connection().select("*").from("WorkspaceMembers").where("IdWorkspace", IdWorkspace).where("IdUser", IdUser)

    return rows.length
}

function findPersonsByUser(IdUser: number): Promise<{ IdWorkspace: number }[]> {
    return TestDatabase.connection().select("*").from("Persons").where("IdUser", IdUser)
}

//  Matrícula semeada direto: arranjar um editor/viewer é estado, e o app só o produz pelo
//  aceite de convite — que é justamente o que alguns destes testes ainda não podem usar.
function seedMembership(IdWorkspace: number, IdUser: number, Role: "owner" | "editor" | "viewer") {
    return TestDatabase.connection().insert({ IdWorkspace, IdUser, Role }).into("WorkspaceMembers")
}

function findById(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Workspaces").where("IdWorkspace", IdWorkspace).first()
}
