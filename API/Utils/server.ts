import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { Routes } from 'root/routes'

class Server {

    readonly app = express()

    private appLoaded = false

    constructor() {
        this.proxy()
        this.middlewares()
        this.app.use(Routes)

        this.appLoaded = true
    }

    //  **Um salto, e não `true`.** Em produção a API só é alcançada pelo nginx, então todo
    //  request chega de 127.0.0.1: sem isto o `req.ip` é o mesmo para o mundo inteiro (uma
    //  contagem por IP conta todo mundo como uma pessoa só) e o `req.protocol` é `http` mesmo
    //  com o usuário em https — o que desliga o HSTS que o helmet abaixo liga.
    //
    //  `true` confiaria na cadeia inteira de X-Forwarded-For, e aí o próprio cliente escolhe o
    //  IP que o Express enxerga mandando o cabeçalho. O número é a quantidade de proxies entre
    //  a internet e este processo, e aqui existe exatamente um.
    private proxy() {
        this.app.set('trust proxy', 1)
    }

    private middlewares() {
        //  **Não há `cors()` aqui, e a ausência é a decisão.** Front e API sobem na mesma
        //  origem (`/` e `/api` atrás do nginx; o proxy do Vite em desenvolvimento), então o
        //  navegador não emite preflight nenhum e não há resposta cross-origin para liberar.
        //  O que havia antes era um `cors()` aberto, devolvendo `Access-Control-Allow-Origin: *`
        //  em toda resposta — uma porta que o produto não usa. Se um dia existir um cliente de
        //  outra origem, ele volta com a decisão de origem escrita junto.
        //
        //  O helmet vem antes do parser de corpo para que a resposta que o parser gera sozinho
        //  — o 413 do limite abaixo — saia com os mesmos cabeçalhos de todas as outras.
        //
        //  Duas opções são explícitas porque as duas dependem de quem responde o quê:
        //
        //  contentSecurityPolicy: false — esta porta devolve JSON (e um .xlsx). A CSP que
        //  importa é a da *página*, servida pelo nginx, e ligá-la aqui protegeria um documento
        //  HTML que a API nunca entrega — dando a sensação de que o assunto está resolvido.
        //
        //  crossOriginResourcePolicy: same-origin — é o padrão do helmet, escrito por ser o
        //  mesmo desenho de mesma origem de cima. É esta linha que muda no dia em que outra
        //  origem precisar ler uma resposta daqui, e não o cookie.
        //
        //  O HSTS que vem junto só sai quando o request chega como https, que é o que o
        //  `trust proxy` acima passa a fazer o Express enxergar — por isso os dois no mesmo
        //  commit.
        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginResourcePolicy: { policy: 'same-origin' },
        }))
        //  O limite é o mesmo padrão do body-parser (100kb), escrito à mão de propósito: assim
        //  ele é uma decisão — nenhum corpo deste app chega perto disso — e não um efeito
        //  colateral da versão da dependência.
        this.app.use(express.json({ limit: '100kb' }))
        //  Obrigatório: a sessão inteira (IdUser + IdWorkspace, assinados no token) chega pelo
        //  cookie e o acessMiddleware a lê de lá. O express escreve cookie sozinho (res.cookie)
        //  mas não lê — sem isto req.cookies não existe e toda rota protegida responde 401.
        this.app.use(cookieParser())
    }

    public appLoad() {
        return new Promise((resolve) => {
            let interval = setInterval(() => {
                if (this.appLoaded) {
                    clearInterval(interval)
                    resolve(true)
                }
            })
        })
    }
}

export const server = new Server()
