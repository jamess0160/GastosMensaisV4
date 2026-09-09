import { Knex } from "knex"
import { KnexConnection } from "./Connections/Knex/KnexConnection"

export abstract class BaseModel {

    protected readonly KnexConnection: Knex

    constructor(conn = KnexConnection) {
        this.KnexConnection = conn
    }
}

export abstract class BaseSection<T> {
    instance: T

    constructor(instance: T) {
        this.instance = instance
    }
}

export type MaybeArray<T> = T | T[]