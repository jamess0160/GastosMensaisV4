import crypto from "crypto"

//  **O primeiro freio do projeto contra abuso**, e ele é pequeno de propósito: uma janela em
//  memória que decide se *este* endereço já recebeu este e-mail agora há pouco.
//
//  Uma rota pública que dispara e-mail é o lugar onde a falta de rate limiting passa a doer:
//  sem freio nenhum, um laço sobre o `resendConfirmation` enche a caixa de entrada de outra
//  pessoa usando o meu servidor, e queima a reputação do domínio no provedor junto.
//
//  **A janela é um `Map` privado desta section, e não um balde de cache genérico** — essa é a
//  única decisão daqui. O projeto teve um `cacheEngine` exposto por HTTP, e ele era a peça
//  óbvia para guardar isto; era também o motivo para não guardar: qualquer sessão autenticada
//  lia o balde inteiro e escrevia nele, o que publicaria **exatamente** o que a resposta
//  200-sempre existe para esconder — quais e-mails têm conta — e daria a quem quisesse um jeito
//  de limpar o freio. O cache saiu do projeto; a regra fica: o que mora aqui não ganha porta
//  HTTP, nem a de leitura nem a de escrita.
//
//  Duas consequências aceitas, e as duas são o preço de não ter tabela nem Redis:
//
//  - **morre no restart**, o que só significa uma janela perdida por deploy;
//  - **é por processo**: com duas instâncias, o freio afrouxa na proporção. O dia em que isso
//    importar é o dia em que o freio vira uma tabela ou um Redis — e o ponto de troca é este
//    arquivo, que é o único que sabe onde a janela mora.
class Controller {

    //  Curta: ela existe para barrar o laço e o clique repetido, não para punir quem
    //  realmente não recebeu o e-mail. Quem esperar dois minutos pede de novo.
    private readonly windowMs = 2 * 60 * 1000

    private readonly claims = new Map<string, number>()

    /**
     * Tenta reservar a janela para uma chave. `true` = pode mandar, `false` = mandou agora há
     * pouco.
     *
     * **Quem chama nunca muda a resposta HTTP por causa disto.** As rotas que usam este freio
     * respondem 200 com a mesma `msg` de sempre; o que o `false` faz é não mandar o e-mail. Um
     * 429 aqui devolveria a informação que a resposta única esconde: só um endereço com conta
     * chegaria a ter cooldown para estourar.
     */
    public claim(key: string) {
        let now = Date.now()

        this.prune(now)

        let hashed = this.hash(key)

        if (this.claims.has(hashed)) {
            return false
        }

        this.claims.set(hashed, now + this.windowMs)

        return true
    }

    /** Para a suíte: o freio é global e sobreviveria de um teste para o outro. */
    public clear() {
        this.claims.clear()
    }

    /**
     * A chave entra **hasheada**, e não em texto puro.
     *
     * O que se guarda aqui é um endereço de e-mail de alguém que tem conta. Hasheado, o mapa
     * responde a única pergunta que ele precisa responder — "esta chave já passou por aqui?" —
     * sem virar uma lista de e-mails cadastrados dentro do processo, legível num heap dump.
     */
    private hash(key: string) {
        return crypto.createHash("sha256").update(key.trim().toLowerCase()).digest("hex")
    }

    //  Sem timer: a limpeza acontece na chamada seguinte. Um `setInterval` aqui seria mais um
    //  handle vivo no processo — e o `memoryLog` do cache já mostrou o preço disso na suíte.
    private prune(now: number) {
        for (let [key, expiresAt] of this.claims) {
            if (expiresAt <= now) {
                this.claims.delete(key)
            }
        }
    }
}

export const MailCooldown = new Controller()
