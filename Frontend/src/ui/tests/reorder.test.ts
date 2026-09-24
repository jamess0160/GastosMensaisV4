import { describe, expect, it } from "vitest";
import { clampIndex, dropIndex, moveItem, rowHeightFromCenters, sameOrder } from "@/ui/reorder";

/* O que este arquivo cobre é a ARITMÉTICA do arrasto, e só ela.
   O gesto inteiro — `pointerdown`, captura, `pointermove` — não é
   testado aqui de propósito: em jsdom não há layout, então toda altura
   de linha é zero e um `pointermove` sintético provaria que a conta roda
   com os números que o próprio teste inventou. A conta, essa sim, é a
   parte que erra em silêncio: um índice trocado reordena a lista errada
   e GRAVA. */

describe("moveItem", () => {
    const list = ["Casa", "Mercado", "Pets", "Transporte"];

    it("move uma posição para cima — que é trocar com o vizinho", () => {
        // O caminho do teclado é este: ↑ com foco na alça. Mover uma
        // posição e trocar dois vizinhos são a MESMA conta, e é por isso
        // que não existe uma segunda.
        expect(moveItem(list, 1, 0)).toEqual(["Mercado", "Casa", "Pets", "Transporte"]);
    });

    it("move uma posição para baixo", () => {
        expect(moveItem(list, 1, 2)).toEqual(["Casa", "Pets", "Mercado", "Transporte"]);
    });

    it("move do fim para a primeira posição", () => {
        // O caso do retorno: pôr "Mercado" no topo vindo do fim da lista.
        expect(moveItem(list, 3, 0)).toEqual(["Transporte", "Casa", "Mercado", "Pets"]);
    });

    it("move do começo para a última posição", () => {
        expect(moveItem(list, 0, 3)).toEqual(["Mercado", "Pets", "Transporte", "Casa"]);
    });

    it("devolve a mesma ordem quando o destino é a origem", () => {
        expect(moveItem(list, 2, 2)).toEqual(list);
    });

    it("não muda a lista recebida", () => {
        moveItem(list, 0, 3);

        expect(list).toEqual(["Casa", "Mercado", "Pets", "Transporte"]);
    });

    it("prende o destino à lista em vez de abrir buraco", () => {
        // O dedo continua descendo depois da última linha, e o índice
        // cru passaria do fim: `splice` num índice maior que o tamanho
        // não estoura, ele só empilha no fim — e a lista ficaria certa
        // por acidente até alguém somar dois.
        expect(moveItem(list, 0, 99)).toEqual(["Mercado", "Pets", "Transporte", "Casa"]);
        expect(moveItem(list, 3, -5)).toEqual(["Transporte", "Casa", "Mercado", "Pets"]);
    });

    it("ignora origem que não existe", () => {
        expect(moveItem(list, -1, 0)).toEqual(list);
        expect(moveItem(list, 4, 0)).toEqual(list);
    });
});

describe("dropIndex", () => {
    // Treze linhas de 56px, como a tabela da Personalização.
    const height = 56;
    const count = 13;

    it("troca a linha na METADE do caminho, não depois dela inteira", () => {
        // 27px é menos de meia linha: ainda é o lugar de onde saiu.
        expect(dropIndex(4, 27, height, count)).toBe(4);
        // 29px passou da metade: já é a linha de baixo.
        expect(dropIndex(4, 29, height, count)).toBe(5);
    });

    it("conta quantas linhas o ponteiro andou, para os dois lados", () => {
        expect(dropIndex(6, 3 * height, height, count)).toBe(9);
        expect(dropIndex(6, -2 * height, height, count)).toBe(4);
    });

    it("para na primeira e na última linha", () => {
        // Arrastar 20 linhas para cima numa lista de 13 não tem destino
        // negativo: a última posição da lista é o fim do gesto.
        expect(dropIndex(2, -20 * height, height, count)).toBe(0);
        expect(dropIndex(2, 20 * height, height, count)).toBe(12);
    });

    it("devolve a origem quando não há altura medida", () => {
        // Lista de um item, ou medida antes de a lista existir: sem
        // altura, dividir por zero devolveria `Infinity` e o destino
        // viraria `NaN` — que `clampIndex` não pega.
        expect(dropIndex(3, 400, 0, count)).toBe(3);
        expect(dropIndex(3, 400, Number.NaN, count)).toBe(3);
    });
});

describe("rowHeightFromCenters", () => {
    it("mede pela distância entre os centros das alças", () => {
        expect(rowHeightFromCenters([100, 156, 212, 268])).toBe(56);
    });

    it("usa a mediana — uma linha fora do padrão não contamina", () => {
        // O último card com margem própria: a média daria 68, que não é
        // a altura de nenhuma linha da lista.
        expect(rowHeightFromCenters([100, 156, 212, 300])).toBe(56);
    });

    it("devolve zero quando não há duas alças para comparar", () => {
        expect(rowHeightFromCenters([])).toBe(0);
        expect(rowHeightFromCenters([100])).toBe(0);
    });

    it("ignora medida inválida de alça que não está no layout", () => {
        expect(rowHeightFromCenters([Number.NaN, 100, 156])).toBe(56);
    });
});

describe("clampIndex", () => {
    it("prende às pontas", () => {
        expect(clampIndex(-3, 5)).toBe(0);
        expect(clampIndex(9, 5)).toBe(4);
        expect(clampIndex(2, 5)).toBe(2);
    });

    it("devolve zero para lista vazia", () => {
        expect(clampIndex(3, 0)).toBe(0);
    });
});

describe("sameOrder", () => {
    it("é o que decide se soltar no mesmo lugar grava", () => {
        expect(sameOrder([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(sameOrder([1, 2, 3], [1, 3, 2])).toBe(false);
    });

    it("lista de tamanho diferente nunca é a mesma ordem", () => {
        // Arquivar uma categoria durante o arrasto cai aqui.
        expect(sameOrder([1, 2, 3], [1, 2])).toBe(false);
    });
});
