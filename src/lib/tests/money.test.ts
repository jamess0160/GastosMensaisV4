import { describe, expect, it } from "vitest";
import {
    formatMoney,
    parseMoneyInput,
    splitClosesTotal,
    splitEvenly,
    splitRemainder,
    toCents,
} from "../money";

/** O Intl separa "R$" do número com espaço NÃO SEPARÁVEL (U+00A0), não
 *  com espaço comum. Comparar com " " falha sem motivo aparente — é a
 *  pegadinha clássica de teste de moeda. Normalizamos para comparar. */
const normalize = (value: string) => value.replace(/[  ]/g, " ");

describe("formatMoney", () => {
    it("formata em real brasileiro com duas casas", () => {
        expect(normalize(formatMoney(2030.4))).toBe("R$ 2.030,40");
    });

    it("mantém as duas casas em valor redondo", () => {
        expect(normalize(formatMoney(1000))).toBe("R$ 1.000,00");
    });

    it("separa o símbolo com espaço não separável, para o valor nunca quebrar linha", () => {
        expect(formatMoney(1000)).toContain(" ");
    });
});

describe("toCents", () => {
    // O motivo de tudo ser comparado em centavos: 0.1 + 0.2 em ponto
    // flutuante não é 0.3, e a API confere a soma do rateio em centavos.
    it("arredonda o erro de ponto flutuante", () => {
        expect(toCents(0.1 + 0.2)).toBe(30);
        expect(toCents(19.99)).toBe(1999);
    });
});

describe("splitClosesTotal", () => {
    it("aceita rateio que fecha exatamente", () => {
        expect(splitClosesTotal([300, 300], 600)).toBe(true);
    });

    it("recusa rateio que sobra um centavo", () => {
        expect(splitClosesTotal([300, 300.01], 600)).toBe(false);
    });

    it("recusa rateio que falta um centavo", () => {
        expect(splitClosesTotal([300, 299.99], 600)).toBe(false);
    });

    it("fecha mesmo com as partes somando em ponto flutuante impreciso", () => {
        expect(splitClosesTotal([0.1, 0.2], 0.3)).toBe(true);
    });

    it("recusa lista vazia contra total maior que zero", () => {
        expect(splitClosesTotal([], 100)).toBe(false);
    });
});

describe("splitRemainder", () => {
    it("diz quanto falta para fechar", () => {
        expect(splitRemainder([200, 150], 600)).toBe(250);
    });

    it("fica negativo quando passa do total", () => {
        expect(splitRemainder([400, 400], 600)).toBe(-200);
    });
});

describe("splitEvenly", () => {
    it("divide em partes iguais quando não sobra centavo", () => {
        expect(splitEvenly(600, 6)).toEqual([100, 100, 100, 100, 100, 100]);
    });

    // A API põe o centavo que sobra na primeira parcela. Se o cliente
    // puser na última, a prévia da tela não bate com o que foi gravado.
    it("põe o centavo que sobra na primeira parte", () => {
        expect(splitEvenly(100, 3)).toEqual([33.34, 33.33, 33.33]);
    });

    it("gera partes que fecham com o total", () => {
        const parts = splitEvenly(1000, 7);
        expect(splitClosesTotal(parts, 1000)).toBe(true);
    });
});

describe("parseMoneyInput", () => {
    it("lê o formato brasileiro com milhar e vírgula", () => {
        expect(parseMoneyInput("1.234,56")).toBe(1234.56);
    });

    it("lê valor simples", () => {
        expect(parseMoneyInput("50")).toBe(50);
    });

    it("recusa texto que não é número", () => {
        expect(parseMoneyInput("abc")).toBeNull();
    });

    it("recusa mais de duas casas decimais, que o Joi rejeitaria", () => {
        expect(parseMoneyInput("10,999")).toBeNull();
    });

    it("recusa string vazia", () => {
        expect(parseMoneyInput("   ")).toBeNull();
    });
});
