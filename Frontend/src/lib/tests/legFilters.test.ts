import { describe, expect, it } from "vitest";
import { legMatches, type LegFilters } from "@/lib/legFilters";
import { paymentLegs } from "@/lib/aggregate";
import { aLegRow, anExpense, anExpensePerson } from "@/lib/tests/factories";

/** Os filtros com que a tela de Gastos nasce: tudo menos cancelado. */
const defaultFilters = (overrides: Partial<LegFilters> = {}): LegFilters => ({
    statuses: ["pending", "paid"],
    kinds: [],
    idCategories: [],
    idPersons: [],
    idMethods: [],
    search: "",
    ...overrides,
});

describe("legMatches", () => {
    const [leg] = paymentLegs([
        aLegRow(
            anExpense({ Description: "Mercado do bairro", IdCategory: 4, Kind: "single" }),
            { IdPaymentMethod: 2 },
            [anExpensePerson(8, 100)],
        ),
    ]);

    it("vazio em cada filtro é 'sem recorte'", () => {
        expect(legMatches(leg, defaultFilters())).toBe(true);
    });

    it("recorta por categoria, formato e forma de pagamento da PERNA", () => {
        expect(legMatches(leg, defaultFilters({ idCategories: [4] }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ idCategories: [5] }))).toBe(false);
        expect(legMatches(leg, defaultFilters({ kinds: ["single"] }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ kinds: ["fixed"] }))).toBe(false);
        expect(legMatches(leg, defaultFilters({ idMethods: [2] }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ idMethods: [3] }))).toBe(false);
    });

    it("recorta pelo rateio do gasto, que vem igual em toda perna dele", () => {
        expect(legMatches(leg, defaultFilters({ idPersons: [8] }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ idPersons: [9] }))).toBe(false);
    });

    it("a busca é da descrição, sem caixa", () => {
        expect(legMatches(leg, defaultFilters({ search: "  BAIRRO " }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ search: "padaria" }))).toBe(false);
    });

    it("o cancelado só aparece com o chip dele marcado", () => {
        const [cancelado] = paymentLegs([aLegRow(anExpense({ Status: "canceled" }))], true);

        expect(legMatches(cancelado, defaultFilters())).toBe(false);
        expect(legMatches(cancelado, defaultFilters({ statuses: ["canceled"] }))).toBe(true);
    });

    /* O Relatório não tem chip de status: ele chama o predicado SEM
       `statuses`, e isso tem que querer dizer "não recorta por status" —
       se quisesse dizer "nenhum status passa", a tela inteira ficaria
       vazia sem um filtro marcado. */
    it("sem `statuses` nada é recortado por status, cancelado inclusive", () => {
        const semStatus = defaultFilters({ statuses: undefined });
        const [cancelado] = paymentLegs([aLegRow(anExpense({ Status: "canceled" }))], true);

        expect(legMatches(leg, semStatus)).toBe(true);
        expect(legMatches(cancelado, semStatus)).toBe(true);
        // E os outros filtros continuam valendo sem ele.
        expect(legMatches(leg, defaultFilters({ statuses: undefined, kinds: ["fixed"] }))).toBe(
            false,
        );
    });
});
