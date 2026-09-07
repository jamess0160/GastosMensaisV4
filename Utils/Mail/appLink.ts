import { enviromentManager } from "root/Utils/enviromentManager"

/**
 * O link que vai dentro de um e-mail, montado a partir do **`APP_URL`**.
 *
 * É a variável que se esquece, e a que mais importa: hoje a API não sabe a própria URL
 * pública, e **todo** e-mail destas etapas carrega um link. Sem ela alguém montaria o link com
 * o `Host` da requisição — e um `Host` forjado vira um link de recuperação de senha apontando
 * para o servidor de outra pessoa, com o token dentro.
 *
 * **O link aponta para o front, não para a API.** `APP_URL/recuperar-senha?Token=…`, e é a tela
 * que chama o `POST` correspondente. É o que impede o e-mail de virar um `GET` que muda
 * estado — clicado por um pré-carregador de link do cliente de e-mail, por exemplo.
 */
export function buildAppLink(path: string, params: Record<string, string> = {}) {
    let base = enviromentManager.getEnv("APP_URL").replace(/\/+$/, "")
    let query = new URLSearchParams(params).toString()

    return `${base}/${path.replace(/^\/+/, "")}${query ? `?${query}` : ""}`
}
