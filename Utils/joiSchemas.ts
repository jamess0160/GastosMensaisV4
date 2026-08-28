import Joi from "joi"

//  Pedaços de schema que valem para o banco inteiro, não para uma feature. Ficam aqui porque
//  as próximas features repetem os mesmos tipos de coluna — cor em Categories e Tags, data de
//  calendário em Inflows e Expenses — e cada cópia é uma chance de divergir do que a coluna
//  aceita.

/**
 * Data de calendário, como string.
 *
 * Não é Joi.date() de propósito: as colunas `date` do Postgres chegam e voltam como
 * "YYYY-MM-DD" (ver Utils/Connections/Knex/section/pgTypeParsers.ts). Converter para Date
 * reintroduziria o fuso que os parsers existem para tirar — em UTC-3, o dia 05 vira 04.
 * Use Joi.date() só nas colunas `datetime`, que são instantes de verdade.
 */
export const isoDate = Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/)

/** RGB em hexadecimal (#RRGGBB), do jeito que as colunas de 7 caracteres guardam. */
export const color = Joi.string().trim().pattern(/^#[0-9a-fA-F]{6}$/)
