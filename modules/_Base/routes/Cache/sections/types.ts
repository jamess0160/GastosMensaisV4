export namespace CacheNamespace {

    export interface SetPropOptions {
        fireFormatter?: boolean
        sendToSocket?: boolean
    }

    export interface CacheConsummer<Formatted = any, Raw = any> {
        LogValue?: boolean
        LogFormattedData?: boolean
        LogCurrentCache?: boolean
        restoreCacheData(): unknown
        formatSet?(key: string, value: Raw): MaybePromise<Formatted>
        formatGet?(data: Formatted, key?: string): unknown
        formatSocket?(key: string, value: Formatted | undefined): SocketInfo
    }

    type MaybePromise<T> = T | Promise<T>

    export interface SocketInfo {
        socketKey: string
        value: unknown
    }
}