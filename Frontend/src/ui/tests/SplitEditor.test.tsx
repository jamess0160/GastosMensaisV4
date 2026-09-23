import { describe, expect, it } from "vitest";
import { autoSplitLines, splitIsPristine, type SplitLine } from "@/ui/SplitEditor";

/** O eixo de pessoas de um gasto, do jeito que a tela o monta: a linha
 *  nasce com a pessoa escolhida e o campo de valor vazio. */
const person = (id: number | null, value: number | null = null): SplitLine => ({ id, value });

/** Os valores do rateio — é só o que a divisão automática escreve. */
const valuesOf = (lines: readonly SplitLine[]) => lines.map((line) => line.value);

describe("autoSplitLines", () => {
    it("uma pessoa leva o total inteiro", () => {
        expect(valuesOf(autoSplitLines([person(1)], 300, true))).toEqual([300]);
    });

    it("duas pessoas levam metade cada", () => {
        expect(valuesOf(autoSplitLines([person(1, 300), person(2)], 300, true))).toEqual([
            150, 150,
        ]);
    });

    it("três pessoas levam 33,34 / 33,33 / 33,33 — o centavo da sobra na PRIMEIRA linha", () => {
        const lines = [person(1, 50), person(2, 50), person(3)];

        expect(valuesOf(autoSplitLines(lines, 100, true))).toEqual([33.34, 33.33, 33.33]);
    });

    it("o rateio de três fecha com o total ao centavo", () => {
        const parts = valuesOf(autoSplitLines([person(1), person(2), person(3)], 100, true));
        const cents = parts.reduce<number>((sum, part) => sum + Math.round((part ?? 0) * 100), 0);

        expect(cents).toBe(10000);
    });

    it("a linha SEM pessoa não entra na divisão e fica vazia", () => {
        // Dar valor a ela deixaria o rateio sem fechar: linha sem alvo
        // não conta para o total.
        const lines = [person(1), person(null), person(2)];

        expect(valuesOf(autoSplitLines(lines, 300, true))).toEqual([150, null, 150]);
    });

    it("PARA no primeiro valor digitado à mão: a pessoa nova entra com o campo vazio", () => {
        // Três pessoas em 100 cada, o 200 digitado na primeira, e a
        // quarta acabou de ser escolhida.
        const lines = [person(1, 200), person(2, 100), person(3, 100), person(4)];

        expect(autoSplitLines(lines, 300, false)).toBe(lines);
    });

    it("sem total não há o que dividir", () => {
        const lines = [person(1), person(2)];

        expect(autoSplitLines(lines, null, true)).toBe(lines);
    });

    it("o total digitado DEPOIS das pessoas divide naquele momento", () => {
        const lines = [person(1), person(2)];

        expect(valuesOf(autoSplitLines(autoSplitLines(lines, null, true), 300, true))).toEqual([
            150, 150,
        ]);
    });

    it("sem pessoa nenhuma escolhida não mexe em nada", () => {
        const lines = [person(null)];

        expect(autoSplitLines(lines, 300, true)).toBe(lines);
    });

    it("devolve AS MESMAS linhas quando a divisão já está na tela", () => {
        // É o que impede o efeito de chamar `onChange` em laço.
        const lines = [person(1, 150), person(2, 150)];

        expect(autoSplitLines(lines, 300, true)).toBe(lines);
    });

    it("o estorno divide negativo, com o mesmo sinal do total", () => {
        expect(valuesOf(autoSplitLines([person(1), person(2)], -150, true))).toEqual([-75, -75]);
    });
});

describe("splitIsPristine", () => {
    it("o rateio que nasce vazio está intocado", () => {
        expect(splitIsPristine([])).toBe(true);
        expect(splitIsPristine([person(1), person(null)])).toBe(true);
    });

    it("o rateio que chega GRAVADO não está — editar um gasto não o redistribui", () => {
        expect(splitIsPristine([person(1, 200), person(2, 100)])).toBe(false);
    });
});
