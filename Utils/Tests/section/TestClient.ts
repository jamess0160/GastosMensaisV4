import request, { Response, Test } from "supertest"
import { TestEnv } from "./TestEnv"

type Method = "get" | "post" | "put" | "delete"

//  Cliente HTTP das suítes. Sem TEST_BASE_URL o supertest sobe o app em memória em uma porta
//  efêmera; com TEST_BASE_URL as mesmas chamadas vão para um servidor real (end to end).
//  O teste não muda: é sempre uma requisição HTTP de verdade passando por todo o pipeline.
//
//  A sessão inteira é o token: ele carrega quem é (IdUser) e em qual workspace está
//  (IdWorkspace). Por isso este cliente só guarda uma coisa — para montar uma sessão em outro
//  workspace, ou sem workspace nenhum, use UsersFactory.buildToken.
//
//  O token vai no cookie, que é o único lugar de onde o acessMiddleware o lê. Este cliente
//  imita o navegador: recebe o Set-Cookie do login e devolve o cookie nas chamadas seguintes.
export class TestClient {

    private token: string | null = null

    constructor(token?: string) {
        this.token = token ?? null
    }

    public getToken() {
        return this.token
    }

    public setToken(token: string | null) {
        this.token = token
        return this
    }

    //  Autentica pela rota real e guarda a sessão para as próximas chamadas. O login não
    //  devolve o token no corpo: ele sai como cookie httpOnly, exatamente como chega ao
    //  navegador, e é de lá que este cliente o tira.
    public async login(login: string, password: string) {
        let response = await this.anonymous().post("/Base/Users/login", { login, password })

        this.token = TestClient.extractCookieToken(response)

        return response
    }

    public get(url: string) {
        return this.request("get", url)
    }

    public post(url: string, body?: unknown) {
        return this.request("post", url, body)
    }

    public put(url: string, body?: unknown) {
        return this.request("put", url, body)
    }

    public delete(url: string) {
        return this.request("delete", url)
    }

    //  Um cliente novo sem token, para as asserções de rota protegida
    public anonymous() {
        return new TestClient()
    }

    public static extractCookieToken(response: Response) {
        return TestClient.extractCookie(response, "token")
    }

    public static extractCookie(response: Response, name: string) {
        let cookies: string[] = response.headers["set-cookie"] ?? []
        let raw = cookies.find((cookie) => cookie.startsWith(`${name}=`))

        if (!raw) return null

        return decodeURIComponent(raw.split(";")[0].replace(`${name}=`, ""))
    }

    //  Lê o payload do token sem verificar assinatura — é o que qualquer cliente consegue
    //  fazer, e é justamente o ponto: o JWT é assinado, não criptografado.
    public static decodeToken(token: string): { id: number, IdWorkspace?: number } {
        return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
    }

    private request(method: Method, url: string, body?: unknown): Test {
        let test = request(TestClient.getTarget())[method](url)

        if (this.token) {
            //  encodeURIComponent porque é o que o res.cookie do express faz na ida, e o
            //  cookie-parser desfaz na volta. Um JWT não tem caractere que mude com isso,
            //  mas passar pelo mesmo caminho do navegador é o que mantém o teste honesto.
            test = test.set("cookie", `token=${encodeURIComponent(this.token)}`)
        }

        if (body !== undefined) {
            test = test.send(body as object)
        }

        return test
    }

    private static getTarget() {
        if (TestEnv.isE2E()) {
            return TestEnv.getBaseUrl()
        }

        //  import tardio: em modo end to end o app não precisa ser carregado no processo do teste
        const { server } = require("root/Utils/server") as typeof import("root/Utils/server")

        return server.app
    }
}
