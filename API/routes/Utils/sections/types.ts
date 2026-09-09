import { KeyLogs, Log } from "root/Utils/Logs";

export namespace BaseUtilsNamespace {
    export interface LogBody {
        Type: KeyLogs
        Log: Log
    }
}