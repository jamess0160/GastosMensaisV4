import { describe, expect, it } from "vitest";
import { legMatches, legTags, type LegFilters } from "@/lib/legFilters";
import { paymentLegs } from "@/lib/aggregate";
import { aLegRow, aTag, anExpense, anExpensePerson } from "@/lib/tests/factories";

/** Os filtros com que a tela de Gastos nasce: tudo menos cancelado. */
const defaultFilters = (overrides: Partial<LegFilters> = {}): LegFilters => ({
    statuses: ["pending", "paid"],
    kinds: [],
    idCategories: [],
    idPersons: [],
    idMethods: [],
    idTags: [],
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
    /* A tag viaja na perna, e o recorte dela é em OU — a perna passa se
       tiver QUALQUER uma das marcadas. */
    it("recorta por etiqueta, e duas marcadas são OU", () => {
        const viagem = aTag("Viagem Chile", { IdTag: 7 });
        const presente = aTag("Presente", { IdTag: 9 });

        const [comViagem] = paymentLegs([aLegRow(anExpense(), {}, [], [viagem])]);
        const [comPresente] = paymentLegs([aLegRow(anExpense(), {}, [], [presente])]);

        expect(legMatches(comViagem, defaultFilters({ idTags: [7] }))).toBe(true);
        expect(legMatches(comPresente, defaultFilters({ idTags: [7] }))).toBe(false);

        // As duas juntas trazem a UNIÃO, não a interseção.
        expect(legMatches(comViagem, defaultFilters({ idTags: [7, 9] }))).toBe(true);
        expect(legMatches(comPresente, defaultFilters({ idTags: [7, 9] }))).toBe(true);
    });

    it("a perna sem etiqueta nenhuma só passa sem recorte de etiqueta", () => {
        expect(legMatches(leg, defaultFilters())).toBe(true);
        expect(legMatches(leg, defaultFilters({ idTags: [7] }))).toBe(false);
    });

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

/* As opções da faixa saem das pernas carregadas, e não de catálogo: é o
   conjunto que nunca oferece tag com zero resultado. */
describe("legTags", () => {
    const viagem = aTag("Viagem Chile", { IdTag: 7 });
    const presente = aTag("Presente", { IdTag: 9 });

    it("devolve cada etiqueta uma vez, em ordem de nome", () => {
        const legs = paymentLegs([
            aLegRow(anExpense({ IdExpense: 1 }), {}, [], [viagem, presente]),
            aLegRow(anExpense({ IdExpense: 2 }), {}, [], [viagem]),
            aLegRow(anExpense({ IdExpense: 3 })),
        ]);

        expect(legTags(legs).map((tag) => tag.Name)).toEqual(["Presente", "Viagem Chile"]);
    });

    it("sem pernas, ou sem etiqueta nenhuma, não há opção", () => {
        expect(legTags([])).toEqual([]);
        expect(legTags(paymentLegs([aLegRow(anExpense())]))).toEqual([]);
    });
});
