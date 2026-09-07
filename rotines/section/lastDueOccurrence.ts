import moment from "moment"
import { Utils } from "root/Utils/Utils"
import { RotinesNamespace } from "./types"

/**
 * O formato do rótulo de uma ocorrência: `"2026-09-01 03:00"`, na hora local do servidor.
 *
 * Ordenável como texto — é o que permite comparar duas ocorrências com `<=` sem construir
 * nenhum instante — e é exatamente o que vai para `RotineRuns.ScheduledFor`.
 */
export const occurrenceFormat = "YYYY-MM-DD HH:mm"

/**
 * A última ocorrência **vencida** de uma agenda, dado o relógio.
 *
 * É a peça que sustenta a suíte inteira do motor, e por isso é **função pura de
 * `(schedule, now)`**: dá para afirmar o que acontece em 1º de março às 3h sem esperar março.
 * Nenhum `moment()` implícito, nenhum `new Date()`, nenhum fuso — só texto entrando e texto
 * saindo, no mesmo espírito de `Utils.addMonthsToDate`.
 *
 * "Vencida" e não "próxima" porque o motor pergunta o que já deveria ter rodado: é dessa
 * pergunta que o catch-up nasce de graça. No dia 2, sem execução registrada, a última
 * ocorrência vencida da agenda mensal *ainda é a do dia 1º*.
 *
 * **Uma só, nunca um backlog.** Cinco dias fora do ar não viram cinco execuções da rotina
 * diária: rotina aqui é convergente — rodar de novo chega no mesmo estado — e é isso que
 * torna o catch-up seguro. O dia em que alguma precisar processar cada ocorrência perdida,
 * ela não é rotina, é fila.
 */
export function lastDueOccurrence(schedule: RotinesNamespace.Schedule, now: string): string {
    //  O dia do relógio, "YYYY-MM-DD". Toda a aritmética daqui para baixo é de calendário.
    let today = now.slice(0, 10)

    if (schedule.kind === "daily") {
        let occurrence = at(today, schedule.hour)

        //  Antes da hora de hoje, a vencida é a de ontem. O `addDaysToDate` atravessa mês e
        //  ano sozinho — 01/03 menos um dia é 28/02, e em ano bissexto é 29/02.
        return occurrence <= now ? occurrence : at(Utils.addDaysToDate(today, -1), schedule.hour)
    }

    //  `setDayOfMonth` grampeia no último dia do mês: `day: 31` em fevereiro é o dia 28. Sem
    //  isso o `date()` do moment estouraria para março e a rotina de fevereiro venceria depois
    //  da de março.
    let occurrence = at(Utils.setDayOfMonth(today, schedule.day), schedule.hour)

    if (occurrence <= now) {
        return occurrence
    }

    //  O mês anterior. Normalizar para o dia 1 antes de voltar um mês é obrigatório: partindo
    //  do dia 31, o `add` do moment grampearia no fim do mês anterior e o dia pedido se
    //  perderia no caminho.
    let previousMonth = Utils.addMonthsToDate(Utils.setDayOfMonth(today, 1), -1)

    return at(Utils.setDayOfMonth(previousMonth, schedule.day), schedule.hour)
}

/** O relógio agora, no mesmo formato do rótulo — o único ponto do motor que olha as horas. */
export function currentOccurrenceClock() {
    return moment().format(occurrenceFormat)
}

function at(date: string, hour: number) {
    return `${date} ${String(hour).padStart(2, "0")}:00`
}
