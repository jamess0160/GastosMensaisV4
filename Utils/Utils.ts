import { config } from 'dotenv'
import path from "path";
import fs from 'fs/promises'

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

    export async function getConstants(): Promise<Constants> {

        let envPath = process.env.CONSTANTS_PATH

        let constantsPath = envPath ? path.resolve(process.cwd(), ...envPath.split("\\")) : path.resolve(process.cwd(), "Utils", "constants.json")

        let jsonConstants = await fs.readFile(constantsPath)

        if (!jsonConstants) throw new Error(`JSON de constantes não foi encontrado no diretório ${constantsPath}`)

        if (jsonConstants instanceof Buffer) {
            return JSON.parse(jsonConstants.toString())
        }

        return JSON.parse(jsonConstants)
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

export interface Constants {
    MssqlMaxParameters: number
    GroupTypes: {
        "Root": number
        "White Collar": number
        "Manager": number
        "Blue Collar": number
    }
    logs: {
        routeErros: boolean
        rotine: boolean
    }
}

type TreeNode<T> = T & { TreeItems?: TreeNode<T>[] }