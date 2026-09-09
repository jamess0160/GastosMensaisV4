import { describe, expect, it } from "vitest";
import {
    addMonths,
    addMonthsToDate,
    daysBetween,
    daysOfMonth,
    formatDate,
    formatMonthLabel,
    formatMonthShort,
    monthRange,
    monthsBetween,
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

describe("addMonthsToDate", () => {
    it("avança a data mantendo o dia", () => {
        expect(addMonthsToDate("2026-05-05", 1)).toBe("2026-06-05");
    });

    it("apara o dia no mês curto em vez de vazar para o mês seguinte", () => {
        // O erro que isto existe para evitar: `new Date(2026, 1, 31)`
        // é 3 de março. Um salário do dia 31 não pode nascer no dia 3.
        expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    });

    it("respeita fevereiro de ano bissexto", () => {
        expect(addMonthsToDate("2028-01-31", 1)).toBe("2028-02-29");
    });

    it("vira o ano", () => {
        expect(addMonthsToDate("2026-12-15", 1)).toBe("2027-01-15");
    });

    it("anda para trás", () => {
        expect(addMonthsToDate("2026-03-31", -1)).toBe("2026-02-28");
    });
});

describe("monthsBetween", () => {
    it("inclui as duas pontas", () => {
        expect(monthsBetween("2026-05", "2026-07")).toEqual(["2026-05", "2026-06", "2026-07"]);
    });

    it("um mês só devolve ele mesmo", () => {
        expect(monthsBetween("2026-05", "2026-05")).toEqual(["2026-05"]);
    });

    it("intervalo invertido não vira laço infinito", () => {
        expect(monthsBetween("2026-07", "2026-05")).toEqual([]);
    });
});

describe("daysBetween", () => {
    it("vai de ponta a ponta, inclusive", () => {
        expect(daysBetween("2026-05-30", "2026-06-02")).toEqual([
            "2026-05-30",
            "2026-05-31",
            "2026-06-01",
            "2026-06-02",
        ]);
    });

    it("um mês inteiro tem os dias do mês", () => {
        expect(daysBetween("2026-02-01", "2026-02-28")).toHaveLength(28);
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

describe("formatMonthShort", () => {
    it("cabe na linha que já tem uma data", () => {
        expect(formatMonthShort("2026-05")).toBe("mai/2026");
    });

    it("aceita a CalendarDate inteira — é a competência da perna", () => {
        // A perna de um cartão `purchase`: ela vence em setembro e PESA
        // em agosto, e a linha do gasto mostra as duas coisas.
        expect(formatMonthShort("2026-08-21")).toBe("ago/2026");
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
