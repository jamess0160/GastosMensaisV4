import { CategoriesSeed } from "root/routes/Categories/Categories.seed"
import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Categories. Um describe por rota de Categories.route.ts, mais o fluxo
//  end to end no fim.
//
//  **O que era próprio desta feature acabou:** metade das linhas da tabela não era de ninguém.
//  A categoria global (IdWorkspace nulo) era a mesma linha para todos os workspaces, e todo
//  describe de escrita carregava o caso dela. A migration 20260922140000 deu a cada espaço a
//  sua cópia das treze, e com isso os dois retornos que não tinham como ser atendidos —
//  arquivar e reordenar uma pré-definida — viraram o caminho normal. O que sobrou no lugar
//  daqueles casos é o contrário deles: editar uma das treze **não** pode encostar na cópia do
//  vizinho.
//
//  A lista é plana: não há categoria filha de outra.

describe("Categories", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces e, por tabela, as Categories junto. Não há
        //  mais linha sem workspace para sobreviver a isso — o seed deixou de ser uma
        //  migration que roda uma vez na vida do banco e virou parte da criação do espaço.
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono das categorias" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("GET /Categories", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Categories`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Categories`)

            expect(response.status).toBe(406)
        })

        //  O token é assinado de verdade — foi esta API que o emitiu — mas aponta para um
        //  workspace do qual o usuário não é membro. Só a consulta à matrícula pega isso.
        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Categories`)

            expect(response.status).toBe(406)
        })

        //  **O critério da etapa.** Dois espaços, treze categorias cada, com os mesmos nomes e
        //  **ids diferentes**: é isso que torna possível arquivar e reordenar sem mexer no
        //  cadastro de ninguém. Enquanto as treze eram globais, os dois lados liam a MESMA
        //  linha, e os dois ids seriam iguais.
        it("dá treze categorias próprias a cada espaço, com ids diferentes", async () => {
            let first = await createSeededWorkspace("Espaço de um")
            let second = await createSeededWorkspace("Espaço de outro")

            let one = await first.client.get(`/Categories`)
            let two = await second.client.get(`/Categories`)

            expect(one.status).toBe(200)
            expect(one.body).toHaveLength(CategoriesSeed.length)
            expect(two.body).toHaveLength(CategoriesSeed.length)

            //  A lista sai ordenada por Position, que é a do seed — então a comparação é
            //  direta, e ela é o que amarra a semeadura ao arquivo do seed.
            expect(one.body.map(description)).toEqual(CategoriesSeed.map(description))
            expect(two.body.map(description)).toEqual(CategoriesSeed.map(description))

            //  Nenhum id em comum: não há uma linha só servindo os dois
            expect(ids(one.body).filter((id) => ids(two.body).includes(id))).toEqual([])

            //  E cada linha é do espaço que a leu — não há mais IdWorkspace nulo
            expect(one.body.every((item: { IdWorkspace: number }) => item.IdWorkspace === first.IdWorkspace)).toBe(true)
        })

        //  A fábrica insere o workspace direto no banco, sem passar pela criação — então o
        //  espaço dela nasce sem as treze, e a lista aqui é só o que o teste cadastrar. Quem
        //  prova a semeadura é o caso acima, que cria o espaço pela rota.
        it("devolve as categorias do próprio workspace", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            await workspaceClient.post(`/Categories`, { Description: "Faculdade" })

            let response = await workspaceClient.get(`/Categories`)

            expect(response.status).toBe(200)
            expect(response.body.map(description)).toEqual(["Faculdade"])
        })

        it("não devolve a categoria de outro workspace", async () => {
            let owner = await UsersFactory.create()
            await new TestClient(owner.token).post(`/Categories`, { Description: "Segredo do vizinho" })

            let response = await new TestClient((await UsersFactory.create()).token).get(`/Categories`)

            expect(response.body.map(description)).not.toContain("Segredo do vizinho")
        })

        it("não devolve categoria arquivada", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let archived = await workspaceClient.post(`/Categories`, { Description: "Categoria arquivada" })

            await workspaceClient.delete(`/Categories/IdCategory=${archived.body.IdCategory}`)

            let response = await workspaceClient.get(`/Categories`)

            expect(response.body.map(description)).toEqual([])
        })

        //  O outro lado do caso acima, e o que faz arquivar ter volta: sem este recorte a
        //  categoria arquivada não aparecia em lugar nenhum — sumia da tela junto com o botão
        //  que a traria de volta, e "arquivar" era um delete com outro nome.
        it("devolve a arquivada com IncludeArchived=true, e só então", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let archived = await workspaceClient.post(`/Categories`, { Description: "Arquivada" })
            await workspaceClient.post(`/Categories`, { Description: "Viva" })

            await workspaceClient.delete(`/Categories/IdCategory=${archived.body.IdCategory}`)

            expect((await workspaceClient.get(`/Categories`)).body.map(description)).toEqual(["Viva"])

            let response = await workspaceClient.get(`/Categories?IncludeArchived=true`)

            expect(response.status).toBe(200)
            expect(response.body.map(description).sort()).toEqual(["Arquivada", "Viva"])
        })

        //  O recorte não atravessa o tenant: pedir a lista inteira é pedir a do próprio espaço.
        it("não devolve a arquivada de outro workspace nem com IncludeArchived=true", async () => {
            let owner = await UsersFactory.create()
            let ownerClient = new TestClient(owner.token)

            let created = await ownerClient.post(`/Categories`, { Description: "Arquivada do vizinho" })
            await ownerClient.delete(`/Categories/IdCategory=${created.body.IdCategory}`)

            let response = await new TestClient((await UsersFactory.create()).token).get(`/Categories?IncludeArchived=true`)

            expect(response.body.map(description)).not.toContain("Arquivada do vizinho")
        })
    })

    describe("POST /Categories", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Categories`, { Description: "Categoria" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem a Description", async () => {
            let response = await client.post(`/Categories`, {})

            expect(response.status).toBe(406)
        })

        it("recusa cor fora do formato #RRGGBB", async () => {
            let response = await client.post(`/Categories`, { Description: "Categoria", Color: "roxo" })

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let owner = await UsersFactory.create()
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, owner.workspace.IdWorkspace))

            let response = await forged.post(`/Categories`, { Description: "Invasora" })

            expect(response.status).toBe(406)
            expect(await findCategories(owner.workspace.IdWorkspace)).toHaveLength(0)
        })

        it("cria a categoria do workspace", async () => {
            let user = await UsersFactory.create()

            let response = await new TestClient(user.token).post(`/Categories`, {
                Description: "Academia",
                IconKey: "dumbbell",
                Color: "#2E7D32",
                Position: 4,
            })

            expect(response.status).toBe(200)
            expect(response.body.IdCategory).toEqual(expect.any(Number))

            let [category] = await findCategories(user.workspace.IdWorkspace)

            expect(category).toMatchObject({
                Description: "Academia",
                IconKey: "dumbbell",
                Color: "#2E7D32",
                Position: 4,
                //  A coluna é NOT NULL: a rota não tem como criar uma linha sem dono
                IdWorkspace: user.workspace.IdWorkspace,
                Active: true,
            })
        })
    })

    describe("PUT /Categories/IdCategory=:IdCategory", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Categories/IdCategory=1`, { Description: "X" })

            expect(response.status).toBe(401)
        })

        it("recusa categoria inexistente", async () => {
            let response = await client.put(`/Categories/IdCategory=999999`, { Description: "X" })

            expect(response.status).toBe(406)
        })

        it("recusa a categoria de outro workspace", async () => {
            let owner = await UsersFactory.create()
            let created = await new TestClient(owner.token).post(`/Categories`, { Description: "Categoria do dono" })

            let response = await otherClient.put(`/Categories/IdCategory=${created.body.IdCategory}`, { Description: "Invadida" })

            expect(response.status).toBe(406)
            expect((await findCategoryById(created.body.IdCategory)).Description).toBe("Categoria do dono")
        })

        //  **O caso que substituiu o "recusa editar categoria global".** Não há mais o que
        //  recusar: renomear uma das treze é o retorno que a etapa veio atender. O que ainda
        //  precisa de prova é o que a linha compartilhada tornava impossível — a edição ficar
        //  dentro do espaço de quem a fez.
        it("edita uma das treze semeadas sem encostar na cópia do outro espaço", async () => {
            let mine = await createSeededWorkspace("Espaço que renomeia")
            let neighbour = await createSeededWorkspace("Espaço do vizinho")

            let target = (await mine.client.get(`/Categories`)).body.find(named("Mercado"))
            let untouched = (await neighbour.client.get(`/Categories`)).body.find(named("Mercado"))

            let response = await mine.client.put(`/Categories/IdCategory=${target.IdCategory}`, { Description: "Supermercado" })

            expect(response.status).toBe(200)
            expect((await findCategoryById(target.IdCategory)).Description).toBe("Supermercado")
            expect((await findCategoryById(untouched.IdCategory)).Description).toBe("Mercado")
        })

        //  Reordenar é escrever Position, e era o outro retorno que a linha compartilhada
        //  travava: arrastar "Pets" para o topo mudaria a ordem na tela do vizinho.
        it("reordena as semeadas só no próprio espaço", async () => {
            let mine = await createSeededWorkspace("Espaço que reordena")
            let neighbour = await createSeededWorkspace("Espaço que não pediu nada")

            let pets = (await mine.client.get(`/Categories`)).body.find(named("Pets"))

            await mine.client.put(`/Categories/IdCategory=${pets.IdCategory}`, { Description: "Pets", Position: 0 })

            expect((await mine.client.get(`/Categories`)).body.map(description)[0]).toBe("Pets")
            expect((await neighbour.client.get(`/Categories`)).body.map(description)[0]).toBe(CategoriesSeed[0].Description)
        })

        it("edita descrição, cor, ícone e posição", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Categories`, { Description: "Casa", Color: "#000000" })

            let response = await workspaceClient.put(`/Categories/IdCategory=${created.body.IdCategory}`, {
                Description: "Moradia",
                Color: "#5D4037",
                IconKey: "home",
                Position: 2,
            })

            expect(response.status).toBe(200)
            expect(await findCategoryById(created.body.IdCategory)).toMatchObject({
                Description: "Moradia",
                Color: "#5D4037",
                IconKey: "home",
                Position: 2,
            })
        })

        //  Edição parcial: o PUT que só renomeia não pode apagar o resto por omissão
        it("não apaga os campos que o corpo não traz", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Categories`, { Description: "Casa", Color: "#123456", IconKey: "home" })

            await workspaceClient.put(`/Categories/IdCategory=${created.body.IdCategory}`, { Description: "Só a descrição" })

            expect(await findCategoryById(created.body.IdCategory)).toMatchObject({
                Description: "Só a descrição",
                Color: "#123456",
                IconKey: "home",
            })
        })

        //  **O ciclo completo.** Arquivar era de mão única: o DELETE gravava Active = false e
        //  rota nenhuma devolvia. O Active no corpo do PUT é o outro sentido da MESMA coluna,
        //  e é por isso que não virou uma rota `restore` própria.
        it("arquiva e desarquiva pelo Active do corpo", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Categories`, { Description: "Pets" })

            expect((await workspaceClient.put(`/Categories/IdCategory=${created.body.IdCategory}`, { Description: "Pets", Active: false })).status).toBe(200)
            expect((await findCategoryById(created.body.IdCategory)).Active).toBe(false)
            expect((await workspaceClient.get(`/Categories`)).body.map(description)).not.toContain("Pets")

            expect((await workspaceClient.put(`/Categories/IdCategory=${created.body.IdCategory}`, { Description: "Pets", Active: true })).status).toBe(200)
            expect((await findCategoryById(created.body.IdCategory)).Active).toBe(true)
            expect((await workspaceClient.get(`/Categories`)).body.map(description)).toContain("Pets")
        })

        //  O PUT é a única leitura da feature que ENXERGA a arquivada — sem isso ele
        //  responderia "não encontrada" justamente à linha que veio desarquivar.
        it("alcança a categoria já arquivada, que é quem precisa voltar", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Categories`, { Description: "Some e volta" })

            await workspaceClient.delete(`/Categories/IdCategory=${created.body.IdCategory}`)

            let response = await workspaceClient.put(`/Categories/IdCategory=${created.body.IdCategory}`, { Description: "Some e volta", Active: true })

            expect(response.status).toBe(200)
            expect((await findCategoryById(created.body.IdCategory)).Active).toBe(true)
        })

        //  **Desarquivar devolve a linha ao FIM, não ao lugar que ela ocupava.** A posição
        //  antiga já é de outra a essa altura: reaparecer no meio da lista seria uma ordem que
        //  só o desempate por id decide, e `Position` ficaria empatada.
        it("desarquiva para o fim da lista, não para a posição antiga", async () => {
            let mine = await createSeededWorkspace("Espaço que arquiva e volta")

            let pets = (await mine.client.get(`/Categories`)).body.find(named("Pets"))

            await mine.client.delete(`/Categories/IdCategory=${pets.IdCategory}`)
            await mine.client.put(`/Categories/IdCategory=${pets.IdCategory}`, { Description: "Pets", Active: true })

            let list = (await mine.client.get(`/Categories`)).body

            expect(list.map(description).at(-1)).toBe("Pets")
            //  E sem empate: a posição é uma a mais que a maior que estava em uso
            expect(list.filter((item: { Position: number }) => item.Position === pets.Position)).toHaveLength(0)
        })

        //  Quem manda a posição junto está dizendo onde quer a linha, e essa palavra é mais
        //  recente que a regra do "vai para o fim".
        it("respeita a Position que o corpo manda ao desarquivar", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Categories`, { Description: "Escolhe o lugar", Position: 9 })

            await workspaceClient.delete(`/Categories/IdCategory=${created.body.IdCategory}`)
            await workspaceClient.put(`/Categories/IdCategory=${created.body.IdCategory}`, { Description: "Escolhe o lugar", Active: true, Position: 2 })

            expect((await findCategoryById(created.body.IdCategory)).Position).toBe(2)
        })
    })

    //  **A ordem, pela lista COMPLETA de ids.** A `Position` era lida (`orderBy`) e escrita
    //  por rota nenhuma além do PUT de uma linha só — reordenar não existia. E ela é a lista
    //  inteira, não "mova o id X para a posição N": é o que faz a última escrita ganhar
    //  inteira em vez de deixar a ordem meio aplicada.
    describe("PUT /Categories/reorder", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Categories/reorder`, { IdCategories: [1] })

            expect(response.status).toBe(401)
        })

        it("recusa lista vazia", async () => {
            let response = await client.put(`/Categories/reorder`, { IdCategories: [] })

            expect(response.status).toBe(406)
        })

        //  **O critério da etapa.** Subir "Mercado" para o topo muda a ordem em todas as
        //  listas do espaço — e não muda nada no outro.
        it("grava a ordem pedida, e só no próprio espaço", async () => {
            let mine = await createSeededWorkspace("Espaço que reordena pela rota")
            let neighbour = await createSeededWorkspace("Espaço que não pediu nada")

            let before = (await mine.client.get(`/Categories`)).body
            let mercado = before.find(named("Mercado"))

            //  "Mercado" para o topo, o resto na ordem em que já estava
            let IdCategories = [mercado.IdCategory, ...ids(before).filter((id) => id !== mercado.IdCategory)]

            let response = await mine.client.put(`/Categories/reorder`, { IdCategories })

            expect(response.status).toBe(200)

            let after = (await mine.client.get(`/Categories`)).body

            expect(after.map(description)[0]).toBe("Mercado")
            expect(ids(after)).toEqual(IdCategories)
            //  1, 2, 3… sem buraco e sem empate
            expect(after.map((item: { Position: number }) => item.Position)).toEqual(IdCategories.map((_, index) => index + 1))

            //  O vizinho não se mexeu
            expect((await neighbour.client.get(`/Categories`)).body.map(description)).toEqual(CategoriesSeed.map(description))
        })

        //  Aceitar a lista curta seria numerar 1..N só o que veio e deixar o resto com a
        //  numeração velha — duas categorias na mesma posição.
        it("recusa lista incompleta, sem gravar nada", async () => {
            let mine = await createSeededWorkspace("Espaço da lista curta")

            let before = (await mine.client.get(`/Categories`)).body

            let response = await mine.client.put(`/Categories/reorder`, { IdCategories: ids(before).slice(0, 3).reverse() })

            expect(response.status).toBe(406)
            expect(ids((await mine.client.get(`/Categories`)).body)).toEqual(ids(before))
        })

        //  Id de outro tenant: o mesmo 406 de "não encontrada" que toda rota daqui dá — e,
        //  antes disso, nenhuma escrita.
        it("recusa id de outro workspace, sem gravar nada", async () => {
            let mine = await createSeededWorkspace("Espaço que recebe id alheio")
            let neighbour = await createSeededWorkspace("Espaço dono do id")

            let before = (await mine.client.get(`/Categories`)).body
            let intruder = ids((await neighbour.client.get(`/Categories`)).body)[0]

            let response = await mine.client.put(`/Categories/reorder`, { IdCategories: [intruder, ...ids(before)] })

            expect(response.status).toBe(406)
            expect(ids((await mine.client.get(`/Categories`)).body)).toEqual(ids(before))
            expect((await findCategoryById(intruder)).Position).toBe(CategoriesSeed[0].Position)
        })

        //  Id repetido não é pego por nenhuma das outras duas conferências: com [1, 1, 2]
        //  sobre um espaço de [1, 2] não sobra id desconhecido nem id faltando.
        it("recusa o mesmo id duas vezes", async () => {
            let mine = await createSeededWorkspace("Espaço do id repetido")

            let before = ids((await mine.client.get(`/Categories`)).body)

            let response = await mine.client.put(`/Categories/reorder`, { IdCategories: [before[0], ...before] })

            expect(response.status).toBe(406)
            expect(ids((await mine.client.get(`/Categories`)).body)).toEqual(before)
        })

        //  A lista é a das ATIVAS: posição é lugar na lista de escolha, e perder esse lugar é
        //  o que arquivar quer dizer. Mandar a arquivada junto é mandar um id que esta rota
        //  não conhece.
        it("não conta a arquivada nem na lista completa nem como id válido", async () => {
            let mine = await createSeededWorkspace("Espaço com uma arquivada")

            let seeded = (await mine.client.get(`/Categories`)).body
            let pets = seeded.find(named("Pets"))

            await mine.client.delete(`/Categories/IdCategory=${pets.IdCategory}`)

            //  Com ela na lista: id desconhecido
            expect((await mine.client.put(`/Categories/reorder`, { IdCategories: ids(seeded) })).status).toBe(406)

            //  Sem ela: a lista está completa
            let active = ids(seeded).filter((id) => id !== pets.IdCategory)

            expect((await mine.client.put(`/Categories/reorder`, { IdCategories: active })).status).toBe(200)
        })
    })

    describe("DELETE /Categories/IdCategory=:IdCategory", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Categories/IdCategory=1`)

            expect(response.status).toBe(401)
        })

        it("recusa categoria inexistente", async () => {
            let response = await client.delete(`/Categories/IdCategory=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa a categoria de outro workspace", async () => {
            let owner = await UsersFactory.create()
            let created = await new TestClient(owner.token).post(`/Categories`, { Description: "Categoria do dono" })

            let response = await otherClient.delete(`/Categories/IdCategory=${created.body.IdCategory}`)

            expect(response.status).toBe(406)
            expect((await findCategoryById(created.body.IdCategory)).Active).toBe(true)
        })

        //  **O caso que substituiu o "recusa arquivar categoria global".** Antes o
        //  `Active = false` caía num `where("IdWorkspace", X)` que nunca casava com nulo: a
        //  operação não tinha efeito nenhum, e era o retorno número um de quem usa o app.
        it("arquiva uma das treze semeadas, e só no espaço de quem arquivou", async () => {
            let mine = await createSeededWorkspace("Espaço que arquiva")
            let neighbour = await createSeededWorkspace("Espaço que mantém")

            let target = (await mine.client.get(`/Categories`)).body.find(named("Pets"))
            let untouched = (await neighbour.client.get(`/Categories`)).body.find(named("Pets"))

            let response = await mine.client.delete(`/Categories/IdCategory=${target.IdCategory}`)

            expect(response.status).toBe(200)

            //  Some da lista de quem arquivou, e só dela
            expect((await mine.client.get(`/Categories`)).body.map(description)).not.toContain("Pets")
            expect((await neighbour.client.get(`/Categories`)).body.map(description)).toContain("Pets")

            //  Soft delete: a linha continua lá, porque o gasto antigo aponta para ela
            expect((await findCategoryById(target.IdCategory)).Active).toBe(false)
            expect((await findCategoryById(untouched.IdCategory)).Active).toBe(true)
        })

        //  Soft delete e não delete físico: Expenses aponta para cá, e o gasto de março tem
        //  que continuar apontando para a categoria em que foi lançado.
        it("arquiva sem apagar a linha, e só ela", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Categories`, { Description: "Categoria antiga" })
            let untouched = await workspaceClient.post(`/Categories`, { Description: "Categoria viva" })

            let response = await workspaceClient.delete(`/Categories/IdCategory=${created.body.IdCategory}`)

            expect(response.status).toBe(200)

            //  A linha continua no banco: só saiu das listas
            expect((await findCategoryById(created.body.IdCategory)).Active).toBe(false)
            expect((await findCategoryById(untouched.body.IdCategory)).Active).toBe(true)
        })
    })

    describe("Fluxo end to end", () => {

        //  Passo 4 do "como saber que a leva acabou" do ROADMAP, só por HTTP: o cadastro já
        //  nasce com as treze, e elas são dele para mexer.
        it("cadastra o usuário, encontra as treze e faz com elas o que antes não dava", async () => {
            let payload = {
                Name: "Usuário do fluxo de categorias",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
                AcceptedTerms: true,
            }

            expect((await new TestClient().post("/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            //  Antes de cadastrar nada, o usuário já tem com o que lançar um gasto — e agora
            //  as linhas são dele, não de um cadastro compartilhado com a base inteira
            let seeded = await flowClient.get(`/Categories`)

            expect(seeded.status).toBe(200)
            expect(seeded.body.map(description)).toEqual(CategoriesSeed.map(description))

            //  Renomear uma das treze: era 406 até esta etapa
            let mercado = seeded.body.find(named("Mercado"))

            expect((await flowClient.put(`/Categories/IdCategory=${mercado.IdCategory}`, { Description: "Supermercado" })).status).toBe(200)

            //  Arquivar uma das treze: antes respondia sem erro e não tinha efeito
            let pets = seeded.body.find(named("Pets"))

            expect((await flowClient.delete(`/Categories/IdCategory=${pets.IdCategory}`)).status).toBe(200)

            let own = await flowClient.post(`/Categories`, { Description: "Faculdade", Color: "#283593" })

            expect(own.status).toBe(200)

            let list = await flowClient.get(`/Categories`)

            expect(list.body.map(description)).toContain("Supermercado")
            expect(list.body.map(description)).not.toContain("Mercado")
            expect(list.body.map(description)).not.toContain("Pets")
            expect(list.body.find(named("Faculdade"))).toMatchObject({ Color: "#283593" })
            expect(list.body).toHaveLength(CategoriesSeed.length)
        })
    })
})

function description(item: { Description: string }) {
    return item.Description
}

function named(Description: string) {
    return (item: { Description: string }) => item.Description === Description
}

function ids(list: { IdCategory: number }[]) {
    return list.map((item) => item.IdCategory)
}

//  Um espaço criado **pela rota**, que é o que semeia as treze. O workspace da UsersFactory é
//  inserido direto no banco e por isso nasce vazio — o que aqui é uma vantagem: os describes
//  que não falam das semeadas leem uma lista com só o que eles mesmos cadastraram.
//
//  O switch é obrigatório: criar dá matrícula, não move a sessão, e o token é quem carrega o
//  workspace selecionado.
async function createSeededWorkspace(Name: string) {
    let user = await UsersFactory.createClient()

    let created = await user.client.post(`/Workspaces`, { Name })
    let switched = await user.client.post(`/Workspaces/switch`, { IdWorkspace: created.body.IdWorkspace })

    user.client.setToken(TestClient.extractCookieToken(switched)!)

    return { client: user.client, IdWorkspace: created.body.IdWorkspace as number }
}

function findCategories(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Categories").where("IdWorkspace", IdWorkspace).where("Active", true).orderBy("IdCategory")
}

function findCategoryById(IdCategory: number) {
    return TestDatabase.connection().select("*").from("Categories").where("IdCategory", IdCategory).first()
}
