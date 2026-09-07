import { TestDatabase, UsersFactory } from "root/Utils/Tests"
import { Database } from "root/Utils/database"
import { lastDueOccurrence } from "./section/lastDueOccurrence"
import { RotineEngine } from "./section/RotineEngine"
import { runForEachWorkspace } from "./section/WorkspaceRunner"
import { RotinesNamespace } from "./section/types"

//  Testes do motor de rotinas. Não há rota nenhuma aqui — é a primeira parte do projeto que o
//  front não enxerga —, então a suíte exerce o motor direto, com o relógio que ela escolhe.
//
//  O que a sustenta é uma decisão de forma: **`lastDueOccurrence` é função pura de
//  `(schedule, now)`**. É ela que permite afirmar o que acontece em 1º de março às 3h sem
//  esperar março, e é por isso que ela ganha o primeiro describe.
//
//  Cada cenário constrói o **seu** motor (`new RotineEngine()`): o registro é estado, e uma
//  rotina registrada na instância global continuaria rodando nos ticks dos testes seguintes.

describe("Rotines", () => {

    describe("lastDueOccurrence", () => {

        //  "Vencida", não "próxima": é dessa pergunta que o catch-up nasce de graça
        it("na agenda diária, volta para ontem antes da hora e fica em hoje depois dela", () => {
            let schedule: RotinesNamespace.Schedule = { kind: "daily", hour: 3 }

            expect(lastDueOccurrence(schedule, "2026-09-07 02:59")).toBe("2026-09-06 03:00")
            expect(lastDueOccurrence(schedule, "2026-09-07 03:00")).toBe("2026-09-07 03:00")
            expect(lastDueOccurrence(schedule, "2026-09-07 23:59")).toBe("2026-09-07 03:00")
        })

        it("na agenda diária, o dia anterior atravessa mês, ano e 29 de fevereiro", () => {
            let schedule: RotinesNamespace.Schedule = { kind: "daily", hour: 3 }

            expect(lastDueOccurrence(schedule, "2026-03-01 00:10")).toBe("2026-02-28 03:00")
            expect(lastDueOccurrence(schedule, "2027-01-01 00:10")).toBe("2026-12-31 03:00")
            //  2028 é bissexto
            expect(lastDueOccurrence(schedule, "2028-03-01 00:10")).toBe("2028-02-29 03:00")
        })

        it("na agenda mensal do dia 1º, volta para o mês anterior antes da virada", () => {
            let schedule: RotinesNamespace.Schedule = { kind: "monthly", day: 1, hour: 3 }

            expect(lastDueOccurrence(schedule, "2026-09-01 02:59")).toBe("2026-08-01 03:00")
            expect(lastDueOccurrence(schedule, "2026-09-01 03:00")).toBe("2026-09-01 03:00")
            expect(lastDueOccurrence(schedule, "2026-09-30 23:59")).toBe("2026-09-01 03:00")
        })

        //  O dia 31 é o caso que o `date()` do moment erraria sozinho: sem o clamp do
        //  Utils.setDayOfMonth, "31 de fevereiro" estouraria para março e a ocorrência de
        //  fevereiro venceria DEPOIS da de março.
        it("na agenda mensal do dia 31, apara o dia em fevereiro e nos meses de 30", () => {
            let schedule: RotinesNamespace.Schedule = { kind: "monthly", day: 31, hour: 3 }

            //  Fevereiro de 2026 tem 28 dias
            expect(lastDueOccurrence(schedule, "2026-02-28 04:00")).toBe("2026-02-28 03:00")
            //  Antes da ocorrência de fevereiro, a vencida é a de janeiro — e janeiro tem 31
            expect(lastDueOccurrence(schedule, "2026-02-28 02:00")).toBe("2026-01-31 03:00")
            //  Abril tem 30
            expect(lastDueOccurrence(schedule, "2026-05-01 00:10")).toBe("2026-04-30 03:00")
            //  Vindo do dia 30 de março, o mês anterior não pode "escorregar" e perder o dia
            //  pedido no caminho: a volta é feita a partir do dia 1º, não do dia 31
            expect(lastDueOccurrence(schedule, "2026-03-30 00:10")).toBe("2026-02-28 03:00")
        })
    })

    describe("Reivindicação e execução", () => {

        beforeEach(async () => {
            await TestDatabase.truncate(["RotineRuns"])
        })

        it("roda a rotina vencida e grava a execução como done", async () => {
            let rotine = buildRotine("grava-execucao")
            let engine = new RotineEngine().register(rotine)

            let executed = await engine.tick("2026-09-01 03:30")

            expect(executed).toEqual(["grava-execucao"])
            expect(rotine.calls).toEqual(["2026-09-01 03:00"])

            let run = await getRun("grava-execucao")
            expect(run.ScheduledFor).toBe("2026-09-01 03:00")
            expect(run.Status).toBe("done")
            expect(run.FinishedAt).not.toBeNull()
            expect(run.Error).toBeNull()
        })

        //  O teste da etapa: é o unique(Name, ScheduledFor) que decide quem roda, não um
        //  lock em memória — que morreria com o processo — nem um select antes do insert,
        //  que tem corrida no meio.
        it("reivindicação dupla no mesmo ScheduledFor roda uma vez só", async () => {
            let first = buildRotine("reivindicacao-dupla")
            let second = buildRotine("reivindicacao-dupla")

            //  Dois motores com o mesmo nome registrado é o que duas instâncias da API são
            await new RotineEngine().register(first).tick("2026-09-01 03:30")
            await new RotineEngine().register(second).tick("2026-09-01 03:31")

            expect(first.calls).toEqual(["2026-09-01 03:00"])
            expect(second.calls).toEqual([])

            expect(await countRuns("reivindicacao-dupla")).toBe(1)
        })

        it("não roda de novo dentro da mesma ocorrência, tick após tick", async () => {
            let rotine = buildRotine("um-por-ocorrencia")
            let engine = new RotineEngine().register(rotine)

            await engine.tick("2026-09-01 03:00")
            await engine.tick("2026-09-01 03:01")
            await engine.tick("2026-09-15 12:00")

            expect(rotine.calls).toEqual(["2026-09-01 03:00"])
        })

        //  Servidor fora do ar no dia 1º e de pé no dia 2: a última ocorrência vencida AINDA é
        //  a do dia 1º, ninguém a registrou, ela roda. Não existe uma linha de lógica de
        //  recuperação em lugar nenhum — o catch-up é consequência da pergunta ser "o que
        //  venceu?" em vez de "que horas são?".
        it("faz catch-up: roda no dia 2 com o ScheduledFor do dia 1º", async () => {
            let rotine = buildRotine("catch-up")
            let engine = new RotineEngine().register(rotine)

            let executed = await engine.tick("2026-09-02 09:15")

            expect(executed).toEqual(["catch-up"])
            expect(rotine.calls).toEqual(["2026-09-01 03:00"])
        })

        //  Rotina é convergente: rodar de novo chega no mesmo estado. Processar cada ocorrência
        //  perdida seria fila, e a discussão seria outra.
        it("não acumula backlog: cinco dias sem execução geram uma execução, não cinco", async () => {
            let rotine = buildRotine("sem-backlog", { kind: "daily", hour: 3 })
            let engine = new RotineEngine().register(rotine)

            await engine.tick("2026-09-06 09:00")

            expect(rotine.calls).toEqual(["2026-09-06 03:00"])
            expect(await countRuns("sem-backlog")).toBe(1)
        })

        it("grava a falha em Error, sem apagar a linha da ocorrência", async () => {
            let rotine: RotinesNamespace.Rotine = {
                name: "rotina-que-estoura",
                schedule: { kind: "monthly", day: 1, hour: 3 },
                run: async () => { throw new Error("dado ruim") },
            }

            //  O tick não pode propagar o erro: uma rotina quebrada não derruba as outras
            let executed = await new RotineEngine().register(rotine).tick("2026-09-01 03:30")

            expect(executed).toEqual(["rotina-que-estoura"])

            let run = await getRun("rotina-que-estoura")
            expect(run.Status).toBe("failed")
            expect(run.Error).toContain("dado ruim")
            expect(run.FinishedAt).not.toBeNull()
        })

        it("uma rotina que falha não impede a seguinte no mesmo tick", async () => {
            let quebrada: RotinesNamespace.Rotine = {
                name: "primeira-quebrada",
                schedule: { kind: "monthly", day: 1, hour: 3 },
                run: async () => { throw new Error("dado ruim") },
            }
            let sadia = buildRotine("segunda-sadia")

            await new RotineEngine().register(quebrada, sadia).tick("2026-09-01 03:30")

            expect(sadia.calls).toEqual(["2026-09-01 03:00"])
            expect((await getRun("segunda-sadia")).Status).toBe("done")
        })

        //  O nome é a chave em RotineRuns: dois registros com o mesmo nome disputariam a mesma
        //  linha e um deles nunca rodaria, em silêncio.
        it("recusa duas rotinas com o mesmo nome no registro", () => {
            let engine = new RotineEngine().register(buildRotine("nome-repetido"))

            expect(() => engine.register(buildRotine("nome-repetido"))).toThrow()
        })
    })

    describe("runForEachWorkspace", () => {

        beforeAll(async () => {
            await TestDatabase.truncate(["Users"])
        })

        //  A regra que vale para toda rotina da pasta: um workspace com dado ruim não pode
        //  deixar os outros sem o mês. E a falha precisa ficar visível — processar tudo e não
        //  contar que um falhou seria pior do que parar.
        it("um workspace que estoura não impede os outros, e a falha sobe no fim", async () => {
            let first = await UsersFactory.create({ Name: "Workspace bom 1" })
            let broken = await UsersFactory.create({ Name: "Workspace ruim" })
            let last = await UsersFactory.create({ Name: "Workspace bom 2" })

            let visited: number[] = []

            let promise = runForEachWorkspace("teste", async (workspace) => {
                visited.push(workspace.IdWorkspace)

                if (workspace.IdWorkspace === broken.workspace.IdWorkspace) {
                    throw new Error("dado ruim")
                }
            })

            await expect(promise).rejects.toThrow(`#${broken.workspace.IdWorkspace}`)

            expect(visited).toContain(first.workspace.IdWorkspace)
            expect(visited).toContain(last.workspace.IdWorkspace)
        })

        //  O erro do laço chega inteiro ao RotineRuns.Error: é lá que o operador descobre qual
        //  workspace ficou sem o mês, meses depois, quando o log já rodou.
        it("a falha do workspace chega ao Error da execução", async () => {
            await TestDatabase.truncate(["RotineRuns"])

            let broken = await UsersFactory.create({ Name: "Workspace que estoura na rotina" })

            let rotine: RotinesNamespace.Rotine = {
                name: "rotina-por-workspace",
                schedule: { kind: "monthly", day: 1, hour: 3 },
                run: async () => {
                    await runForEachWorkspace("rotina-por-workspace", async (workspace) => {
                        if (workspace.IdWorkspace === broken.workspace.IdWorkspace) {
                            throw new Error("dado ruim")
                        }
                    })
                },
            }

            await new RotineEngine().register(rotine).tick("2026-09-01 03:30")

            let run = await getRun("rotina-por-workspace")
            expect(run.Status).toBe("failed")
            expect(run.Error).toContain(`#${broken.workspace.IdWorkspace}`)
        })
    })
})

//  Uma rotina que só anota com qual ScheduledFor foi chamada. É o que separa "rodou" de
//  "rodou pela ocorrência certa", que é a distinção inteira do catch-up.
function buildRotine(name: string, schedule: RotinesNamespace.Schedule = { kind: "monthly", day: 1, hour: 3 }) {
    let calls: string[] = []

    return {
        name,
        schedule,
        calls,
        run: async (ScheduledFor: string) => { calls.push(ScheduledFor) },
    }
}

async function getRun(Name: string) {
    let run = await TestDatabase.connection()
        .select("*")
        .from<Database.RotineRuns>("RotineRuns")
        .where("Name", Name)
        .first()

    if (!run) throw new Error(`Nenhuma execução gravada para a rotina "${Name}"`)

    return run
}

async function countRuns(Name: string) {
    let rows = await TestDatabase.connection().select("*").from<Database.RotineRuns>("RotineRuns").where("Name", Name)

    return rows.length
}
