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

/** Divide em N partes iguais; o centavo que sobra vai na PRIMEIRA parte,
 *  como a API faz no parcelamento. */
export function splitEvenly(total: ApiTypes.Money, parts: number): ApiTypes.Money[] {
    const totalCents = toCents(total);
    const base = Math.floor(totalCents / parts);
    const remainder = totalCents - base * parts;
    return Array.from({ length: parts }, (_, index) =>
        fromCents(index === 0 ? base + remainder : base),
    );
}

/** Converte o texto de um input de moeda em número. Aceita "1.234,56". */
export function parseMoneyInput(input: string): ApiTypes.Money | null {
    const normalized = input.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    if (!normalized || !/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
    return Number(normalized);
}
