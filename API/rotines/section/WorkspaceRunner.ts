import { Knex } from "knex"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { Database } from "root/Utils/database"
import { Logs } from "root/Utils/Logs"
import { Workspaces_model } from "root/routes/Workspaces/Workspaces.model"

/**
 * Roda o mesmo trabalho para cada workspace, **uma transaction por workspace**.
 *
 * A regra vale para toda rotina desta pasta, e o motivo é operacional: um workspace com dado
 * ruim não pode deixar os outros quinhentos sem o mês. Uma transaction por tick faria o
 * primeiro erro desfazer o trabalho já feito para todo mundo — e, pior, o `RotineRuns` da
 * ocorrência continuaria gravado, então o catch-up **não** tentaria de novo.
 *
 * Cada unidade falha sozinha, vira uma linha em `Logs/rotines/<nome>/`, e no fim as falhas
 * sobem juntas num erro só: é ele que o motor grava em `RotineRuns.Error`. Falhar no fim, e
 * não na hora, é o que dá as duas coisas ao mesmo tempo — os outros workspaces processados e
 * a falha visível.
 *
 * **A rotina roda como o sistema, e `assertMember` não se aplica aqui**: o escopo do tenant
 * vem deste laço, não de um token. O que não se pode fazer é o contrário — afrouxar o
 * `assertMember` para aceitar um ator nulo abriria buraco nas rotas. A rotina chama as
 * sections passando o `IdWorkspace` direto, abaixo da camada de acesso.
 */
export async function runForEachWorkspace(name: string, fn: (workspace: Database.Workspaces, tx: Knex.Transaction) => Promise<void>) {
    let workspaces = await Workspaces_model.getAll()
    let failures: string[] = []

    for (let workspace of workspaces) {
        try {
            await KnexTransaction((tx) => fn(workspace, tx))
        } catch (error: any) {
            failures.push(`#${workspace.IdWorkspace}: ${error?.msg ?? error?.message ?? String(error)}`)

            Logs.handleError(`Rotina ${name} falhou no workspace #${workspace.IdWorkspace}`, error, { IdWorkspace: workspace.IdWorkspace })
        }
    }

    if (failures.length) {
        throw new Error(`${failures.length} de ${workspaces.length} workspaces falharam — ${failures.join(" | ")}`)
    }

    return workspaces.length
}
