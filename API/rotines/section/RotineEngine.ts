import { Database } from "root/Utils/database"
import { Logs } from "root/Utils/Logs"
import { logFlags } from "root/Utils/logFlags"
import { RotineRuns_model } from "../RotineRuns.model"
import { currentOccurrenceClock, lastDueOccurrence } from "./lastDueOccurrence"
import { RotinesNamespace } from "./types"

/**
 * O motor de rotinas: um tick de um minuto que só pergunta **o que venceu**. Quem decide se
 * roda é o banco.
 *
 * ### Por que não é "timer + de quanto em quanto tempo"
 *
 * O padrão herdado da V3 acerta a forma (uma pasta que registra tudo) e erra o relógio: ele
 * expressa *intervalo*, e as rotinas daqui são *calendário*. Três consequências, e a terceira
 * é a que mata:
 *
 * 1. **Deriva.** `setInterval(24h)` conta a partir do boot, não das 3h da manhã. Depois de um
 *    mês de uptime a rotina roda em horário aleatório.
 * 2. **Reset no deploy.** Subir versão todo dia às 23h faz a rotina diária **nunca** rodar: o
 *    timer reinicia antes de completar.
 * 3. **Não tem catch-up.** Servidor fora do ar no dia 1º e o mês não foi materializado, sem
 *    que ninguém fique sabendo. Numa rotina mensal, errar uma vez é perder o mês.
 *
 * Aqui o tick é burro de propósito: a cada minuto ele calcula a última ocorrência vencida de
 * cada rotina e tenta **reivindicá-la** em `RotineRuns`. O intervalo do timer não carrega
 * significado nenhum — ele só define com que granularidade a pergunta é feita.
 *
 * ### Fuso
 *
 * `moment` sem timezone usa a hora do servidor. Com o processo em UTC, uma rotina "dia 1º às
 * 00:30" dispara às 21:30 do dia 31 no Brasil e materializa o mês errado — a mesma armadilha
 * que o `CLAUDE.md` documenta para as datas de calendário. A correção é `TZ=America/Sao_Paulo`
 * no processo; escolher um horário de madrugada **não** resolve sozinho.
 *
 * ### Sem disparo manual, por enquanto
 *
 * Não há `POST /Rotines/:Name/run` nem script de CLI: o primeiro acrescenta superfície de
 * autenticação para um caso de uso raríssimo, o segundo é uma segunda entrada no webpack. Como
 * a rotina é convergente e o catch-up já cobre a queda, a resposta em produção é **esperar o
 * próximo tick**.
 */
//  A classe é exportada junto com a instância — o que os outros singletons do projeto não
//  fazem — porque a suíte precisa de um motor **vazio** por cenário: o registro é estado, e um
//  teste que registrasse a sua rotina na instância global a deixaria rodando nos ticks dos
//  testes seguintes. Fora dos testes, use `rotineEngine`.
export class RotineEngine {

    private readonly rotines: RotinesNamespace.Rotine[] = []

    private timer: NodeJS.Timeout | null = null

    //  O tick em andamento, ou null quando nenhum está rodando. É o que o `stop()` espera: um
    //  tick já reivindicou a linha em `RotineRuns` e ainda não carimbou o `FinishedAt`, e o
    //  `unique(Name, ScheduledFor)` faz dessa linha uma ocorrência que **ninguém mais
    //  reivindica** — o catch-up, que existe para cobrir uma queda, não cobre esta.
    //
    //  Guarda a versão já resolvida do tick (nunca a que rejeita), porque quem espera aqui só
    //  quer saber que terminou: o erro do tick tem dono no `safeTick`, e uma segunda espera
    //  sobre a mesma promise rejeitada seria um unhandled rejection.
    private running: Promise<void> | null = null

    //  Um minuto. Não é a frequência de nenhuma rotina — é só de quanto em quanto tempo a
    //  pergunta "o que venceu?" é feita, e o pior atraso que uma rotina pode sofrer.
    private readonly tickInterval = 60 * 1000

    public register(...rotines: RotinesNamespace.Rotine[]) {
        for (let rotine of rotines) {
            let duplicated = this.rotines.find((item) => item.name === rotine.name)

            //  O nome é a chave em RotineRuns: dois registros com o mesmo nome disputariam a
            //  mesma linha e um deles nunca rodaria — em silêncio, que é o pior jeito.
            if (duplicated) {
                throw new Error(`Já existe uma rotina registrada com o nome "${rotine.name}"`)
            }

            this.rotines.push(rotine)
        }

        return this
    }

    public list(): readonly RotinesNamespace.Rotine[] {
        return this.rotines
    }

    /**
     * Liga o tick. Chamado **só pelo `index.ts`**, e só fora de `NODE_ENV=test`: uma rotina
     * disparando no meio da suíte muda o banco debaixo de um teste que está rodando — o mesmo
     * problema que o `memoryLog` do cache já teve que resolver, e que custou uma falha
     * aleatória para ser descoberto.
     */
    public start() {
        if (this.timer) {
            return
        }

        //  unref pelo mesmo motivo do memoryLog: um timer de fundo não pode ser o que segura o
        //  processo vivo no encerramento.
        this.timer = setInterval(() => this.safeTick(), this.tickInterval)
        this.timer.unref?.()

        //  Um tick imediato no boot é o que faz o catch-up acontecer no minuto em que o
        //  servidor volta, e não até 60 segundos depois.
        this.safeTick()
    }

    /**
     * Desliga o tick e **espera o que já estava rodando**. É a primeira coisa que o
     * encerramento do `index.ts` faz, antes de fechar o servidor HTTP.
     *
     * Parar o `setInterval` sem esperar seria a mesma interrupção com outro nome: o tick que
     * está no ar já reivindicou a ocorrência em `RotineRuns`, e morrer antes do `FinishedAt`
     * deixa uma linha órfã que o `unique(Name, ScheduledFor)` impede de ser reivindicada de
     * novo — o mês fica sem fechar e nem o catch-up conserta.
     */
    public async stop() {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }

        //  Depois do clearInterval, para que nenhum tick novo comece enquanto se espera este.
        await this.running
    }

    /**
     * Um tick. **Público de propósito**, para a suíte exercer o motor com o relógio que ela
     * escolher, sem esperar um minuto nem esperar o dia 1º.
     */
    public tick(now: string = currentOccurrenceClock()) {
        let execution = this.runTick(now)

        let tracked = execution.then(() => undefined, () => undefined)

        this.running = tracked

        tracked.then(() => {
            //  Só limpa se ainda for este tick: um tick posterior já teria assumido o lugar.
            if (this.running === tracked) {
                this.running = null
            }
        })

        return execution
    }

    private async runTick(now: string) {
        let executed: string[] = []

        for (let rotine of this.rotines) {
            let ran = await this.runIfDue(rotine, now)

            if (ran) {
                executed.push(rotine.name)
            }
        }

        return executed
    }

    //  O tick do timer não pode rejeitar: uma promise rejeitada aqui não tem quem a espere e
    //  derruba o processo como unhandled rejection.
    private safeTick() {
        this.tick().catch((error) => Logs.handleError("Ocorreu um erro no tick das rotinas", error))
    }

    private async runIfDue(rotine: RotinesNamespace.Rotine, now: string) {
        let ScheduledFor = lastDueOccurrence(rotine.schedule, now)

        //  **A reivindicação é a decisão inteira.** Não se pergunta antes se já rodou: entre o
        //  select e o insert cabe outra instância. Insere-se, e quem não conseguiu não roda.
        let [run] = await RotineRuns_model.claim(rotine.name, ScheduledFor) as Database.RotineRuns[]

        if (!run) {
            return false
        }

        await this.log(rotine.name, { msg: "Rotina iniciada", data: { ScheduledFor } })

        try {
            await rotine.run(ScheduledFor)

            await RotineRuns_model.update(run.IdRotineRun, { Status: "done", FinishedAt: new Date() })

            await this.log(rotine.name, { msg: "Rotina concluída", data: { ScheduledFor } })
        } catch (error: any) {
            //  A linha fica gravada como `failed` com a mensagem: sem isso a falha de uma
            //  rotina mensal só existiria em arquivo de log, e ninguém lê log de mês passado.
            //
            //  Ela **não** é apagada, então o catch-up não repete a ocorrência que falhou:
            //  repetir sozinha esconderia o problema atrás de uma tentativa que talvez desse
            //  certo. O conserto é o dado, e o próximo mês volta ao normal.
            await RotineRuns_model.update(run.IdRotineRun, {
                Status: "failed",
                FinishedAt: new Date(),
                Error: error?.msg ?? error?.message ?? String(error),
            })

            Logs.handleError(`Ocorreu um erro na rotina ${rotine.name}`, error, { ScheduledFor })

            await this.log(rotine.name, { msg: "Rotina falhou", data: { ScheduledFor }, errorMessage: error?.msg ?? error?.message ?? String(error) })
        }

        return true
    }

    //  O log por rotina já existia antes do motor (Logs/rotines/<nome>/, herdado da V3) e a
    //  flag que o liga também: logFlags.rotine.
    private async log(name: string, log: Parameters<typeof Logs.insertRotineLog>[0]) {
        if (!logFlags.rotine) {
            return
        }

        Logs.insertRotineLog(log, name)
    }
}

export const rotineEngine = new RotineEngine()
