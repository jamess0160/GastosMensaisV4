import { MemoryStore, rateLimit } from "express-rate-limit"

//  **O freio das rotas públicas**, e o primeiro rate limiting de verdade do projeto.
//
//  Antes dele existiam dois freios parciais, e nenhum dos dois era isto: o `MailCooldown` é uma
//  janela por endereço que protege **uma** rota, e o `useCooldown` do cliente mora no navegador
//  e some com um `curl`. O que dói primeiro é o `forgotPassword` — rota pública, dispara e-mail,
//  sem freio nenhum do lado do servidor: um laço trivial manda mil recuperações para o endereço
//  de outra pessoa e queima a reputação do domínio de envio junto, porque SPF e DKIM não salvam
//  quem manda mil e-mails iguais.
//
//  **Por IP, e não por e-mail.** Contar por e-mail parece mais preciso e é pior nos dois
//  sentidos: quem ataca escolhe o campo, então o teto por endereço é contornado trocando uma
//  letra — e, ao mesmo tempo, um atacante consegue **trancar a conta de outra pessoa** estourando
//  a cota do endereço dela. O IP é grosseiro, mas é a única coisa que o chamador não escolhe.
//
//  É `req.ip` que vira a chave, e é por isso que este arquivo depende do `trust proxy` do
//  `Utils/server.ts`: atrás do nginx, sem ele, todo request chega de 127.0.0.1 e o teto por IP
//  vira um teto único para a internet inteira.
//
//  **Nada de teto global no app.** Um limitador montado no app inteiro conta as leituras do
//  dashboard de quem está trabalhando junto com o ataque, e o primeiro mês com duas pessoas no
//  mesmo Wi-Fi vira chamado de suporte. São quatro rotas públicas, nomeadas uma a uma.
//
//  **O `MailCooldown` continua onde está.** Ele resolve outra coisa — dois cliques seguidos no
//  mesmo botão, pela mesma pessoa, para o mesmo endereço — e o que esta etapa proíbe é que ele
//  siga sendo a única coisa entre a internet e o `sendMail`.
//
//  **O armazenamento é o `MemoryStore`, e o limite está escrito:** a contagem é por processo, ou
//  seja, uma instância só, e reiniciar o container zera tudo. Está certo para o servidor pessoal
//  desta leva. O dia em que houver duas instâncias, o freio afrouxa na proporção e isto aqui
//  vira um store externo — e este comentário é o que faz esse dia ser notado.
class Controller {

    //  Um store por limitador, guardado para o `reset()`. Compartilhar um só faria as quatro
    //  rotas dividirem a mesma contagem (é o que a própria lib chama de `ERR_ERL_STORE_REUSE`).
    private readonly stores: MemoryStore[] = []

    /**
     * `POST /Users/forgotPassword` — 5 por hora.
     *
     * É a rota mais barata de abusar do projeto: um e-mail sai para o endereço que o corpo
     * disser. Cinco por hora cobre com folga quem errou o endereço e tentou de novo.
     */
    public readonly forgotPassword = this.build({
        windowMs: 60 * 60 * 1000,
        limit: 5,
    })

    /**
     * `POST /Users/resendConfirmation` — 5 por hora.
     *
     * Mesma forma e mesmo teto do `forgotPassword`, porque é o mesmo abuso: rota pública que
     * dispara e-mail para o endereço que veio no corpo.
     */
    public readonly resendConfirmation = this.build({
        windowMs: 60 * 60 * 1000,
        limit: 5,
    })

    /**
     * `POST /Users/login` — 20 a cada 15 minutos.
     *
     * Sem freio, o login é força bruta contra o bcrypt: o custo 12 encarece cada tentativa, mas
     * não limita quantas cabem numa hora. A janela é curta e o teto é alto de propósito — quem
     * está tentando lembrar a própria senha erra três, quatro vezes, e não pode ficar trancado
     * por uma hora por causa disso.
     */
    public readonly login = this.build({
        windowMs: 15 * 60 * 1000,
        limit: 20,
    })

    /**
     * `POST /Users` — 10 por hora.
     *
     * O cadastro é escrita em tabela a partir da internet: sem freio, um laço enche `Users` (e,
     * com ela, um workspace e uma `Persons` por conta criada). Dez por hora é mais do que
     * qualquer pessoa real cria do mesmo IP, e ainda cabe a casa inteira num Wi-Fi só.
     */
    public readonly create = this.build({
        windowMs: 60 * 60 * 1000,
        limit: 10,
    })

    /**
     * Para a suíte: a contagem é global ao processo e sobreviveria de um teste para o outro —
     * o mesmo motivo do `MailCooldown.clear()`.
     *
     * O freio **não** é desligado em `NODE_ENV=test`: é justamente rodando ligado que a suíte
     * consegue provar o 429. O que ela faz é zerar a contagem entre um teste e o seguinte.
     */
    public reset() {
        for (let store of this.stores) {
            void store.resetAll()
        }
    }

    /**
     * A resposta é **429 com uma mensagem em português**, no mesmo formato `{ msg }` de todo
     * erro do app — o `AsyncHandler` não chega a rodar aqui, então o formato é escrito à mão.
     *
     * **O corpo não diz nada sobre o e-mail.** O `forgotPassword` responde igual para endereço
     * com conta e sem conta, e o freio não pode ser o que passa a diferenciar os dois: por isso
     * a mensagem é a mesma nas quatro rotas e fala só de tentativas.
     */
    private build({ windowMs, limit }: { windowMs: number, limit: number }) {
        let store = new MemoryStore()

        this.stores.push(store)

        return rateLimit({
            windowMs,
            limit,
            store,
            //  `RateLimit`/`RateLimit-Policy` (draft-7) em vez do `X-RateLimit-*` antigo. Os
            //  dois juntos seriam a mesma informação duas vezes em toda resposta.
            standardHeaders: "draft-7",
            legacyHeaders: false,
            message: { msg: "Tentativas demais. Espere alguns minutos e tente de novo." },
        })
    }
}

export const RateLimits = new Controller()
