import { BaseModel } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  As execuções das rotinas. **Não existe uma tabela `Rotines`**: o catálogo é código
//  (`rotines/index.ts`), porque um catálogo em banco permitiria desligar no banco uma rotina
//  que o código ainda acha que existe — e é assim que os dois divergem.
//
//  Sem `IdWorkspace`, ao contrário de toda tabela de domínio: uma execução atravessa todos os
//  workspaces. O escopo do tenant, quando existe, vem do laço de dentro da rotina.
export class class_RotineRuns_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.RotineRuns>("RotineRuns").orderBy("IdRotineRun")

    getLast(Name: string) {
        return this.baseQuery.clone().where("Name", Name).orderBy("IdRotineRun", "desc").first()
    }

    getByOccurrence(Name: string, ScheduledFor: string) {
        return this.baseQuery.clone().where("Name", Name).where("ScheduledFor", ScheduledFor).first()
    }

    /**
     * **A reivindicação** — o coração do motor.
     *
     * Insere a ocorrência e devolve a linha; se outra instância (ou um restart em loop) já a
     * escreveu, o `unique(Name, ScheduledFor)` desvia para o `ignore()` e o retorno vem
     * vazio. Quem recebe vazio **não roda**, e é só isso que impede a execução dupla — não um
     * lock em memória, que morre com o processo, nem uma checagem antes do insert, que tem
     * corrida entre o `select` e o `insert`.
     */
    claim(Name: string, ScheduledFor: string) {
        return this.KnexConnection
            .insert({ Name, ScheduledFor, Status: "running" })
            .into("RotineRuns")
            .onConflict(["Name", "ScheduledFor"])
            .ignore()
            .returning("*")
    }

    update(IdRotineRun: number, record: Partial<Database.RotineRuns>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("RotineRuns").where("IdRotineRun", IdRotineRun)
    }
}

export const RotineRuns_model = new class_RotineRuns_model()
