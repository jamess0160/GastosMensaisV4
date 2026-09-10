import { config } from 'dotenv'
import moment from "moment";

//  Funções de utilidades do projeto
export namespace Utils {

    //#region Utils functions

    let debouncerList: Record<string, NodeJS.Timeout> = {}

    export function debouncer(name: string, time: number, fn: (...params: any[]) => void, ...params: any[]) {
        clearTimeout(debouncerList[name])

        debouncerList[name] = setTimeout(fn, time, ...params)
    }

    export function sleep(time: number) {
        return new Promise((resolve) => {
            setTimeout(resolve, time)
        })
    }

    export async function resolveObjectPromises<T extends Record<string, Promise<any>>>(promises: T): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
        let arrayPromisses = Object.values(promises)
        let resultPromisses = await Promise.all(arrayPromisses)

        let body = {} as { [K in keyof T]: Awaited<T[K]> }
        for (let i = 0; i < resultPromisses.length; i++) {
            const key = Object.keys(promises)[i] as keyof T

            body[key] = resultPromisses[i];
        }

        return body
    }

    export async function validatePromise(value: unknown) {
        if (value instanceof Promise) {
            return await value
        }

        return value
    }

    //#endregion

    //#region Object values functions

    export function getNestedValue<T = any>(path: string, obj: Record<string, any>): T {
        const separator = "."

        return path.split(separator).reduce((old, key) => {
            return old ? old[key] : undefined
        }, obj) as T
    }

    export function setNestedValue(path: string, obj: Record<string, any>, value: any) {
        let [root, nestedPath] = path.split(/\.(.*)/s)

        if (!obj[root] && nestedPath) {
            obj[root] = {}
        }

        obj[root] = nestedPath ? setNestedValue(nestedPath, obj[root], value) : value

        return obj
    }

    const sensitiveKeys = ["password", "newpassword", "senha", "token", "authorization"]

    //  Troca o valor das chaves sensíveis por um marcador antes de o dado ir para o log.
    //  Sem isso o body do cadastro e da troca de senha vai em texto puro para Logs/error.
    export function redactSensitive<T>(data: T): T {
        if (Array.isArray(data)) {
            return data.map((item) => redactSensitive(item)) as T
        }

        if (!data || typeof data !== "object" || data instanceof Date || Buffer.isBuffer(data)) {
            return data
        }

        let redacted: Record<string, any> = {}

        for (let [key, value] of Object.entries(data)) {
            redacted[key] = sensitiveKeys.includes(key.toLowerCase()) ? "[oculto]" : redactSensitive(value)
        }

        return redacted as T
    }

    export function removeNestedValue(path: string, obj: Record<string, any>) {
        let [root, nestedPath] = path.split(/\.(.*)/)

        if (!obj[root]) {
            return obj
        }

        if (nestedPath) {
            obj[root] = removeNestedValue(nestedPath, obj[root])
        } else {
            delete obj[root]
        }

        return obj
    }

    //#endregion

    //#region Array functions

    export function insertIntoIndex<T>(array: T[], item: T, index: number) {
        return [
            ...array.slice(0, index),
            item,
            ...array.slice(index)
        ]
    }

    export function spreadIntoIndex<T>(array: T[], item: T[], index: number) {
        return [
            ...array.slice(0, index - 1),
            ...item,
            ...array.slice(index)
        ]
    }

    //#endregion

    //#region Frame functions

    export function configEnv() {
        config({ path: "./.env" })

        //  Em teste o .env.test entra por cima, declarando só o que muda (banco, portas).
        //  O override é obrigatório: variável já exportada no terminal vence o dotenv.
        if (process.env.NODE_ENV === "test") {
            config({ path: "./.env.test", override: true })
        }
    }

    /**
     * Dinheiro em centavos, para comparar sem o erro do ponto flutuante.
     *
     * As colunas são `decimal(15,2)` e chegam como number: somar 0.1 + 0.2 em JS dá
     * 0.30000000000000004, então `soma das partes === total` só fecha em inteiro. Todo
     * invariante de rateio (entradas e as duas de gastos) compara por aqui.
     */
    export function toCents(value: number) {
        return Math.round(value * 100)
    }

    /**
     * Aritmética de calendário sobre "YYYY-MM-DD", com moment e **sem instante nenhum**.
     *
     * As colunas `date` do Postgres chegam e voltam como string (ver pgTypeParsers): elas são
     * dias do calendário, não instantes. O moment é construído com o formato explícito e no
     * modo estrito, e a saída volta formatada — assim o valor nunca vira um Date solto, que é
     * o que reintroduziria o fuso que os parsers existem para tirar (em UTC-3, meia-noite do
     * dia 01 é o dia 31 do mês anterior).
     *
     * O `add` do moment já **grampeia no fim do mês**: 31/01 + 1 mês é 28/02, não 03/03. É a
     * regra que a fatura do cartão e a recorrência mensal precisam.
     */
    export const calendarFormat = "YYYY-MM-DD"

    export function addMonthsToDate(date: string, months: number) {
        return toCalendar(date).add(months, "months").format(calendarFormat)
    }

    /**
     * Soma dias corridos (negativo subtrai). Atravessa mês e ano sem grampear nada.
     *
     * É o oposto de `setDayOfMonth`, e é de propósito: o fechamento do cartão é o vencimento
     * menos a folga do emissor, e uma folga é uma contagem de dias, não um dia do mês. Por
     * isso o resultado é sempre uma data que existe — 15/03 − 7 é 08/03, 15/02 − 7 é 08/02 —
     * enquanto um "dia 30" precisa virar 28 em fevereiro e deixa de bater com a comparação
     * que decide a fatura. Ver InvoiceDates.section.ts.
     */
    export function addDaysToDate(date: string, days: number) {
        return toCalendar(date).add(days, "days").format(calendarFormat)
    }

    /** Move a data para um dia do mês, grampeando no último dia quando ele não existe. */
    export function setDayOfMonth(date: string, day: number) {
        let target = toCalendar(date)

        //  O `date()` do moment estoura para o mês seguinte quando o dia não existe (31 de
        //  fevereiro vira 03/03): o clamp é nosso, e é o que a recorrência do dia 31 precisa.
        return target.date(Math.min(day, target.daysInMonth())).format(calendarFormat)
    }

    //  Estrito de propósito: uma data fora do formato vira "Invalid date" na saída em vez de
    //  ser adivinhada pelo moment, e o erro aparece onde nasceu.
    function toCalendar(date: string) {
        return moment(date, calendarFormat, true)
    }

    /**
     * "2026-08-10" -> "10/08/2026". **Só para exibição**, e hoje só a planilha usa.
     *
     * Continua sendo string em string, pelo mesmo motivo de todo o resto deste bloco: um
     * `new Date("2026-08-10")` no meio do caminho traria de volta o fuso que os pgTypeParsers
     * existem para tirar, e a data sairia um dia atrás em UTC-3.
     */
    export function toBrazilianDate(date: string) {
        return toCalendar(date).format("DD/MM/YYYY")
    }

    /**
     * O primeiro dia do mês de referência: "2026-08" vira "2026-08-01".
     *
     * A coluna `ReferenceMonth` é `date` e guarda sempre o dia 1 — é o que faz duas linhas do
     * mesmo mês colidirem no `unique(IdBudget, ReferenceMonth)` em vez de conviverem por causa
     * de um dia diferente.
     */
    export function monthStart(reference: string) {
        return moment(reference, "YYYY-MM", true).format(calendarFormat)
    }

    /**
     * O mês corrente, "YYYY-MM", no formato que `monthStart` consome.
     *
     * É o único lugar do projeto que olha o relógio para montar uma data de calendário, e por
     * isso passa pelo mesmo `format` de todo o resto: um `new Date()` solto aqui traria o fuso
     * de volta — em UTC-3, à meia-noite do dia 1 o mês corrente ainda seria o anterior.
     */
    export function currentMonth() {
        return moment().format("YYYY-MM")
    }

    export function buildTree<T>(items: T[], getId: (item: T) => number, getParentId: (item: T) => number | null): TreeNode<T>[] {
        let map = new Map<number, TreeNode<T>>()
        let treeTable: TreeNode<T>[] = []

        for (let item of items) {
            map.set(getId(item), { ...item, TreeItems: [] })
        }

        for (let item of items) {
            let id = getId(item)
            let parentId = getParentId(item)
            let current = map.get(id)!

            if (parentId == null) {
                treeTable.push(current)
            } else {
                let parent = map.get(parentId)
                if (parent) {
                    parent.TreeItems!.push(current)
                }
            }
        }

        return treeTable
    }


    //#endregion
}

type TreeNode<T> = T & { TreeItems?: TreeNode<T>[] }