import type { ApiTypes } from "@/types/api";

const BRL = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const BRL_NO_SYMBOL = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** "R$ 2.030,44" */
export const formatMoney = (value: ApiTypes.Money): string => BRL.format(value);

/** "2.030,44" — para quando o layout põe o "R$" em outro elemento. */
export const formatAmount = (value: ApiTypes.Money): string => BRL_NO_SYMBOL.format(value);

/** Dinheiro é decimal(15,2) e o Joi valida precision(2). Toda soma de
 *  rateio passa por aqui antes de ir para a API. */
export const toCents = (value: ApiTypes.Money): number => Math.round(value * 100);

export const fromCents = (cents: number): ApiTypes.Money => cents / 100;

export const roundMoney = (value: ApiTypes.Money): ApiTypes.Money => fromCents(toCents(value));

/** Todo split é por valor absoluto e a soma tem que bater exatamente com
 *  o total — a API confere em centavos e responde 406 se não fechar. */
export const splitClosesTotal = (
    parts: readonly ApiTypes.Money[],
    total: ApiTypes.Money,
): boolean => parts.reduce((sum, part) => sum + toCents(part), 0) === toCents(total);

/** O que falta para o rateio fechar. Negativo = passou do total. */
export const splitRemainder = (
    parts: readonly ApiTypes.Money[],
    total: ApiTypes.Money,
): ApiTypes.Money =>
    fromCents(toCents(total) - parts.reduce((sum, part) => sum + toCents(part), 0));

/** Repõe num valor o sinal de outro.
 *
 *  Um gasto é INTEIRO positivo ou INTEIRO negativo: todas as partes, nos
 *  dois eixos, com o sinal do total. Senão dá para montar uma perna de
 *  +200 e outra de −50 fechando em 150, que não é compra nem estorno — e
 *  a API recusa a mistura. */
export const withSignOf = (
    value: ApiTypes.Money | null,
    total: ApiTypes.Money | null,
): ApiTypes.Money | null =>
    value === null ? null : (total ?? 0) < 0 ? -Math.abs(value) : Math.abs(value);

/** Divide em N partes iguais; o centavo que sobra vai na PRIMEIRA parte,
 *  como a API faz no parcelamento. Serve ao estorno sem mudança: com o
 *  total negativo as N partes saem negativas. */
export function splitEvenly(total: ApiTypes.Money, parts: number): ApiTypes.Money[] {
    const totalCents = toCents(total);
    const base = Math.floor(totalCents / parts);
    const remainder = totalCents - base * parts;
    return Array.from({ length: parts }, (_, index) =>
        fromCents(index === 0 ? base + remainder : base),
    );
}

/** Reparte o que SOBRA entre as linhas, somando ao que cada uma já tem.
 *
 *  É a outra metade do `splitEvenly`, e a diferença é o que o gesto quer
 *  dizer: "dividir igualmente" joga fora o que já estava escrito e reparte o
 *  total; "distribuir o que sobra" preserva as fatias que o usuário já
 *  decidiu e fecha a diferença. A primeira é o rateio do gasto, que nasce
 *  vazio; a segunda é o do orçamento, em que sobrar é o estado normal.
 *
 *  O centavo da sobra cai na PRIMEIRA linha, porque é o `splitEvenly` que
 *  reparte — a mesma regra da parcela na API. Depois disto a soma bate com o
 *  total ao centavo, que é o que o botão promete.
 *
 *  Com sobra ZERO ou negativa devolve as linhas como estão: distribuir um
 *  número negativo reduziria fatias que ninguém mandou reduzir, e podia
 *  deixá-las abaixo de zero — o que a API recusa. Quem estourou o total
 *  conserta tirando de onde quer. */
export function distributeRemainder(
    values: readonly (ApiTypes.Money | null)[],
    total: ApiTypes.Money,
): ApiTypes.Money[] {
    const current = values.map((value) => value ?? 0);
    const remainder = splitRemainder(current, total);

    if (values.length === 0 || remainder <= 0) return current;

    const parts = splitEvenly(remainder, values.length);

    return current.map((value, index) => fromCents(toCents(value) + toCents(parts[index])));
}

/** Converte o texto de um input de moeda em número. Aceita "1.234,56". */
export function parseMoneyInput(input: string): ApiTypes.Money | null {
    const normalized = input.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    if (!normalized || !/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
    return Number(normalized);
}
