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

/**
 * O mês de referência de um orçamento: "YYYY-MM".
 *
 * Aqui o mês **é** a unidade, ao contrário das listagens de movimento (ver `periodQuery`
 * abaixo): um teto vale para o mês civil inteiro, não para um recorte arbitrário. A coluna
 * guarda o dia 1 desse mês — quem converte é `Utils.monthStart`.
 */
export const referenceMonth = Joi.string().trim().pattern(/^\d{4}-\d{2}$/)

/**
 * O recorte por período das listagens de movimento — o mesmo em entradas e em gastos.
 *
 * Intervalo (`From`/`To`, inclusivos nas duas pontas) e não `ReferenceMonth=YYYY-MM`: o mês se
 * escreve como intervalo (`From=2026-08-01&To=2026-08-31`), mas o contrário não — o período de
 * uma fatura de cartão vai de fechamento a fechamento e nunca coincide com o mês civil. Um
 * formato só nas duas features, senão o cliente monta duas telas de filtro para a mesma ideia.
 *
 * As duas pontas são opcionais: só `From` é "daqui para a frente", só `To` é "até aqui".
 */
export const periodQuery = {
    From: isoDate.optional(),
    To: isoDate.optional(),
}
