import { MaybeArray } from "root/Utils/Base";
import knex from "knex";
import { DBTypes } from "../KnexConnection";
import { Utils } from "root/Utils/Utils";

export class JoinActives {

    private readonly knexClient: knex.Knex.Client

    constructor(knexConnection: knex.Knex.Client) {
        this.knexClient = knexConnection
    }

    public async run<T extends keyof DBTypes>(data: any, params: Partial<Record<T, JoinActivesParams<T, string>>>) {

        if (!data) {
            return data
        }

        let isArray = Array.isArray(data)
        let keys = Object.keys(params) as T[]

        for await (let key of keys) {

            let param = params[key]

            if (!param) continue

            let destinyColumn = (param.destinyColumn || param.selfPath) as string
            let tableName = param.tableName || key

            if (!param.type || param.type === "multi") {
                data = await this.joinMulti(data, param.selfPath, destinyColumn, tableName, key, param.append)
            } else {
                data = await this.joinSingle(data, param.selfPath, destinyColumn, tableName, key, param.append)
            }
        }

        return isArray ? data : data[0]
    }

    private async joinMulti(data: any, selfPath: string, destinyColumn: string, table: string, destinyTableName: string, append?: appendFn<any>) {
        let records = Array.isArray(data) ? data : [data]

        let idsTable = Array.from(new Set(records.map((item) => Utils.getNestedValue(selfPath, item))))
        idsTable = idsTable.filter((item) => item !== undefined && item !== null)

        if (idsTable.length === 0) {
            return records.map((item) => {
                return Object.assign(item, { [destinyTableName]: [] })
            })
        }

        let binds = await this.getBindRecords(idsTable, table, destinyColumn, append)

        return records.map((item) => {
            let grupo = binds.filter((subItem) => subItem[destinyColumn] === Utils.getNestedValue(selfPath, item))

            return Object.assign(item, { [destinyTableName]: grupo })
        })
    }

    private async joinSingle(data: any, selfPath: string, destinyColumn: string, table: string, destinyTableName: string, append?: appendFn<any>) {
        let records = Array.isArray(data) ? data : [data]

        let idsTable = Array.from(new Set(records.map((item) => Utils.getNestedValue(selfPath, item))))
        idsTable = idsTable.filter((item) => item !== undefined && item !== null)

        if (idsTable.length === 0) {
            return records.map((item) => {
                return Object.assign(item, { [destinyTableName]: undefined })
            })
        }

        let binds = await this.getBindRecords(idsTable, table, destinyColumn, append)

        return records.map((item) => {
            let selected = binds.find((subItem) => subItem[destinyColumn] === Utils.getNestedValue(selfPath, item))

            return Object.assign(item, { [destinyTableName]: selected })
        })
    }

    private async getBindRecords<T extends keyof DBTypes>(idsTable: number[], bindTable: T, destinyColumn: string, append?: appendFn<T>): Promise<any[]> {

        let knexQuery = this.knexClient.queryBuilder().from(bindTable).whereIn(destinyColumn, idsTable).where("Active", 1) as knex.Knex.QueryBuilder<any, any>

        if (append) {
            return append(knexQuery) as any[]
        }

        return this.knexClient.queryBuilder().from(bindTable).whereIn(destinyColumn, idsTable).where("Active", 1)
    }
}

//#region Interfaces / Types 

declare module 'knex' {
    namespace Knex {
        interface QueryBuilder<TRecord extends {}, TResult = any> {
            joinActives<
                R extends
                { [K in keyof DBTypes]?: JoinActivesParams<K, keyof TRecord> }
                & { [K in string]: JoinActivesParams<K, keyof TRecord> }
            >(params: R): KnexJoinReturn<TRecord, TResult, R>
        }

        export type KnexJoinReturn<
            TRecord extends {},
            TResult extends any,
            L extends {
                [K in keyof DBTypes]?: JoinActivesParams<K, string | keyof TRecord>
            }
        > = Promise<TResult extends any[] ? BindTableReturn<TRecord, L>[] : BindTableReturn<TRecord, L> | undefined>
    }
}

type BindTableReturn<
    R extends MaybeArray<Record<string, any>>,
    L extends {
        [K in keyof DBTypes]?: JoinActivesParams<K, string | keyof R>
    }
> = R & {
    [K in keyof L]: K extends keyof DBTypes ?
    (
        L[K] extends { type: infer P, append: appendFn<K> } ?
        (
            P extends "single" ?
            FirstOfArray<BindTableData<K, L[K]['append']>> | undefined
            : BindTableData<K, L[K]['append']>
        )
        : L[K] extends { type: infer P } ?
        (
            P extends "single" ?
            DBTypes[K] | undefined
            : Array<DBTypes[K]>
        )
        : L[K] extends { append: appendFn<K> } ?
        (
            BindTableData<K, L[K]['append']>
        ) : Array<DBTypes[K]>
    )
    : (
        L[K] extends { type: infer P } ?
        (
            P extends "single" ?
            ValidateTableName<R, L, K, "single">
            : ValidateTableName<R, L, K, "multi">
        )
        : ValidateTableName<R, L, K, "multi">
    )
}

type ValidateTableName<
    R extends MaybeArray<Record<string, any>>,
    L extends {
        [K in keyof DBTypes]?: JoinActivesParams<K, string | keyof R>
    },
    K extends keyof L,
    type extends "multi" | "single"
> = L[K] extends { tableName: infer T, append: infer A } ?
    (
        T extends keyof DBTypes ?
        (
            type extends "multi" ? Array<DBTypes[T]> : (DBTypes[T] | undefined)
        ) : never
    )
    : (
        L[K] extends { tableName: infer T } ?
        (
            T extends keyof DBTypes ?
            (
                type extends "multi" ? Array<DBTypes[T]> : (DBTypes[T] | undefined)
            )
            : never
        )
        : never
    )

interface JoinActivesParams<T extends keyof DBTypes | string | number | symbol, R> {
    selfPath: R,
    type?: "multi" | "single"
    destinyColumn?: T extends keyof DBTypes ? keyof DBTypes[T] : string
    tableName?: keyof DBTypes
    append?: appendFn<T>
}

type appendFn<
    T extends keyof DBTypes | string | number | symbol,
> = (knex: knex.Knex.QueryBuilder<
    T extends keyof DBTypes ? DBTypes[T] : any,
    T extends keyof DBTypes ? Array<DBTypes[T]> : any
>) => unknown

type BindTableData<
    K extends keyof DBTypes,
    L extends any
> = L extends appendFn<K> ? Awaited<ReturnType<L>> : DBTypes[K]

type FirstOfArray<T> = T extends Array<any> ? T[0] : T

//#endregion