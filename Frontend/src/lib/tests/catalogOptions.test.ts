import { describe, expect, it } from "vitest";
import { withReferencedOptions } from "../catalogOptions";
import { aCategory } from "./factories";
import type { ApiTypes } from "@/types/api";

/* Os dois catálogos que têm arquivados e alimentam seletor: pessoa
   (rótulo em `Name`) e categoria (rótulo em `Description`). O helper não
   conhece nenhum dos dois — é isso que estes testes travam. */

const aPerson = (overrides: Partial<ApiTypes.Person> = {}): ApiTypes.Person => ({
    IdPerson: 1,
    IdWorkspace: 1,
    Name: "Tiago",
    IdUser: null,
    Active: true,
    CreatedAt: "2026-08-01T00:00:00.000Z",
    UpdatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
});

const personReader = {
    id: (person: ApiTypes.Person) => person.IdPerson,
    label: (person: ApiTypes.Person) => person.Name,
};

const categoryReader = {
    id: (category: ApiTypes.Category) => category.IdCategory,
    label: (category: ApiTypes.Category) => category.Description,
};

const TIAGO = aPerson({ IdPerson: 1, Name: "Tiago" });
const LUANA = aPerson({ IdPerson: 2, Name: "Luana" });
const ARQUIVADA = aPerson({ IdPerson: 3, Name: "Ana", Active: false });
const OUTRA_ARQUIVADA = aPerson({ IdPerson: 4, Name: "Bruno", Active: false });

const ACTIVE = [TIAGO, LUANA];
const ALL = [TIAGO, LUANA, ARQUIVADA, OUTRA_ARQUIVADA];

describe("withReferencedOptions", () => {
    it("devolve só as ativas quando o catálogo não tem arquivado nenhum", () => {
        const options = withReferencedOptions(ACTIVE, ACTIVE, [1, 2], personReader);

        expect(options).toEqual([
            { id: 1, label: "Tiago", item: TIAGO },
            { id: 2, label: "Luana", item: LUANA },
        ]);
    });

    /* O caso que dá nome à etapa: a pessoa foi arquivada DEPOIS de o gasto
       ser rateado para ela, e a linha existe no banco. Sem isto o seletor
       desenha o placeholder e a linha parece vazia. */
    it("traz a arquivada que uma linha já aponta, rotulada e no fim", () => {
        const options = withReferencedOptions(ACTIVE, ALL, [1, 3], personReader);

        expect(options).toEqual([
            { id: 1, label: "Tiago", item: TIAGO },
            { id: 2, label: "Luana", item: LUANA },
            { id: 3, label: "Ana (arquivada)", item: ARQUIVADA },
        ]);
    });

    /* Oferecê-la sem estar em uso desfaria a arquivação, que existe
       justamente para tirá-la dos formulários. */
    it("não oferece a arquivada que ninguém aponta", () => {
        const options = withReferencedOptions(ACTIVE, ALL, [1, 2], personReader);

        expect(options.map((option) => option.id)).toEqual([1, 2]);
    });

    it("ignora o id que não está em catálogo nenhum, sem estourar", () => {
        const options = withReferencedOptions(ACTIVE, ALL, [99], personReader);

        expect(options.map((option) => option.id)).toEqual([1, 2]);
    });

    /* O rateio sendo montado tem linha em branco, e a mesma pessoa pode
       aparecer em duas linhas — nenhum dos dois pode virar opção repetida. */
    it("aceita id nulo e id repetido sem duplicar opção", () => {
        const options = withReferencedOptions(ACTIVE, ALL, [null, 3, 3, null], personReader);

        expect(options.map((option) => option.id)).toEqual([1, 2, 3]);
    });

    /* A ordem das ativas é a do catálogo — nas categorias ela é a
       `Position`, que a Personalização deixa arrastar. */
    it("preserva a ordem das ativas e acrescenta as arquivadas depois", () => {
        const options = withReferencedOptions(
            [LUANA, TIAGO],
            [LUANA, TIAGO, ARQUIVADA, OUTRA_ARQUIVADA],
            [3, 4],
            personReader,
        );

        expect(options.map((option) => option.label)).toEqual([
            "Luana",
            "Tiago",
            "Ana (arquivada)",
            "Bruno (arquivada)",
        ]);
    });

    /* O outro catálogo, com o rótulo em outro campo: é o que faz o helper
       viver em `src/lib/` e não dentro da tela do gasto. */
    it("lê o rótulo da categoria em Description", () => {
        const mercado = aCategory({ IdCategory: 10, Description: "Mercado" });
        const viagem = aCategory({ IdCategory: 11, Description: "Viagem", Active: false });

        const options = withReferencedOptions([mercado], [mercado, viagem], [11], categoryReader);

        expect(options).toEqual([
            { id: 10, label: "Mercado", item: mercado },
            { id: 11, label: "Viagem (arquivada)", item: viagem },
        ]);
    });
});
