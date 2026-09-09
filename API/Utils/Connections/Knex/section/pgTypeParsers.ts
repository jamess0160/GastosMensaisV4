/**
 * O node-postgres devolve NUMERIC, BIGINT e DATE em formatos que nao batem com
 * as interfaces do namespace Database. Sem estes parsers:
 *
 *   - NUMERIC (todo campo de dinheiro) chega como string -> "120.00" + "80.00" = "120.0080.00"
 *   - BIGINT chega como string
 *   - DATE chega como Date na meia-noite LOCAL -> 2026-08-05 em UTC-3 exibe dia 04
 *
 * Registrado a partir de AppKnex.ts, antes de qualquer query rodar.
 *
 * Precisao: NUMERIC vira double. Com decimal(15,2) da para representar ate ~9e15
 * centavos sem perda, muito acima de qualquer valor real do app. O armazenamento
 * continua exato (numeric no banco); a conversao so acontece na leitura.
 */
export function registerPgTypeParsers(dbClient: string) {

    if (dbClient !== "pg" && dbClient !== "postgres" && dbClient !== "postgresql") {
        return
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pgTypes = require("pg").types

    const NUMERIC = 1700
    const INT8 = 20
    const DATE = 1082

    pgTypes.setTypeParser(NUMERIC, (value: string | null) => value === null ? null : parseFloat(value))
    pgTypes.setTypeParser(INT8, (value: string | null) => value === null ? null : parseInt(value, 10))

    // DATE fica como string "YYYY-MM-DD": e uma data de calendario (competencia,
    // vencimento), nao um instante. Converter para Date introduz fuso.
    pgTypes.setTypeParser(DATE, (value: string | null) => value)
}
