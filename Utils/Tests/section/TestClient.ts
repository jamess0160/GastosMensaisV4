import request, { Response, Test } from "supertest"
import { TestEnv } from "./TestEnv"

type Method = "get" | "post" | "put" | "delete"

//  Cliente HTTP das suítes. Sem TEST_BASE_URL o supertest sobe o app em memória em uma porta
//  efêmera; com TEST_BASE_URL as mesmas chamadas vão para um servidor real (end to end).
//  O teste não muda: é sempre uma requisição HTTP de verdade passando por todo o pipeline.
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

    //  Autentica pela rota real e guarda o token para as próximas chamadas. O login devolve o
    //  token no cookie httpOnly, mas o acessMiddleware lê o header 'authorization' (sem 'Bearer'),
    //  então o cookie é traduzido para header aqui.
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
        let cookies: string[] = response.headers["set-cookie"] ?? []
        let raw = cookies.find((cookie) => cookie.startsWith("token="))

        if (!raw) return null

        return decodeURIComponent(raw.split(";")[0].replace("token=", ""))
    }

    private request(method: Method, url: string, body?: unknown): Test {
        let test = request(TestClient.getTarget())[method](url)

        if (this.token) {
            test = test.set("authorization", this.token)
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
