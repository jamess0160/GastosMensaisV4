import { describe, expect, it } from "vitest";
import {
    addMonths,
    daysOfMonth,
    formatDate,
    formatMonthLabel,
    monthRange,
    parts,
    toLocalDate,
    toReferenceMonth,
} from "../date";

describe("o fuso dos testes", () => {
    // Se este teste falhar, todos os outros deste arquivo perdem o
    // sentido: eles existem para provar que o código não cai na
    // armadilha do UTC, e isso só aparece fora do UTC.
    it("roda em UTC-3, como o sistema em produção", () => {
        expect(new Date(2026, 4, 5).getTimezoneOffset()).toBe(180);
    });
});

describe("parts", () => {
    it("quebra a data sem passar pelo parser de Date", () => {
        expect(parts("2026-05-05")).toEqual({ year: 2026, month: 5, day: 5 });
    });

    // O ReferenceMonth volta da API como "2026-05-01", não como "2026-05".
    it("ignora o que vier depois do dia", () => {
        expect(parts("2026-05-01T00:00:00.000Z")).toEqual({ year: 2026, month: 5, day: 1 });
    });
});

describe("formatDate", () => {
    // A armadilha central: em UTC-3, `new Date("2026-05-05")` é 04/05.
    it("não perde um dia em UTC-3", () => {
        expect(formatDate("2026-05-05")).toBe("05/05/2026");
    });

    it("não perde um dia na virada do mês", () => {
        expect(formatDate("2026-06-01")).toBe("01/06/2026");
    });

    it("não perde um dia na virada do ano", () => {
        expect(formatDate("2026-01-01")).toBe("01/01/2026");
    });
});

describe("toLocalDate", () => {
    it("constrói a data em horário local, não em UTC", () => {
        const date = toLocalDate("2026-05-05");
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(4);
        expect(date.getDate()).toBe(5);
    });
});

describe("monthRange", () => {
    it("cobre o mês inteiro de 31 dias", () => {
        expect(monthRange("2026-05")).toEqual({ From: "2026-05-01", To: "2026-05-31" });
    });

    it("cobre fevereiro comum", () => {
        expect(monthRange("2026-02")).toEqual({ From: "2026-02-01", To: "2026-02-28" });
    });

    it("cobre fevereiro bissexto", () => {
        expect(monthRange("2028-02")).toEqual({ From: "2028-02-01", To: "2028-02-29" });
    });
});

describe("addMonths", () => {
    it("avança dentro do ano", () => {
        expect(addMonths("2026-05", 1)).toBe("2026-06");
    });

    it("vira o ano para frente", () => {
        expect(addMonths("2026-12", 1)).toBe("2027-01");
    });

    it("vira o ano para trás", () => {
        expect(addMonths("2026-01", -1)).toBe("2025-12");
    });
});

describe("toReferenceMonth", () => {
    it("reduz a data ao mês que o orçamento espera", () => {
        expect(toReferenceMonth("2026-05-17")).toBe("2026-05");
    });
});

describe("formatMonthLabel", () => {
    it("monta o rótulo do cabeçalho com a inicial maiúscula", () => {
        expect(formatMonthLabel("2026-05")).toBe("Maio · 2026");
    });

    it("aceita o formato que a API devolve", () => {
        expect(formatMonthLabel("2026-05-01")).toBe("Maio · 2026");
    });
});

describe("daysOfMonth", () => {
    it("gera o eixo do relatório diário", () => {
        const days = daysOfMonth("2026-05");
        expect(days).toHaveLength(31);
        expect(days[0]).toBe("2026-05-01");
        expect(days[30]).toBe("2026-05-31");
    });
});
