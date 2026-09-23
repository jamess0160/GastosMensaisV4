import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveCategory } from "../sections/saveCategory";
import { archiveCategory } from "../sections/archiveCategory";
import { restoreCategory } from "../sections/restoreCategory";
import { moveCategory } from "../sections/moveCategory";
import { savePerson } from "../sections/savePerson";
import { archivePerson } from "../sections/archivePerson";
import { aCategory, aCategoryDraft, aPersonDraft, fakeSettingsContext } from "./context";

describe("saveCategory", () => {
    it("cria mandando a CHAVE do ícone, não um caminho de arquivo", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Categories", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdCategory: 14 });
            }),
        );

        await saveCategory(fakeSettingsContext());

        // `IconKey` indexa o catálogo do cliente; o desenho vive no
        // front. É por isso que Categories tem IconKey e Accounts,
        // IconPath.
        expect(body).toEqual({ Description: "Mercado", IconKey: "market", Color: "#0084ff" });
    });

    it("edita pela rota com id quando o rascunho já tem um", async () => {
        let called = false;
        server.use(
            msw.put("*/api/Categories/IdCategory=14", () => {
                called = true;
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        const context = fakeSettingsContext({
            categoryDraft: aCategoryDraft({ IdCategory: 14 }),
        });
        await saveCategory(context);

        expect(called).toBe(true);
        expect(context.finishSubmit).toHaveBeenCalledWith("Categoria atualizada.");
    });

    it("aceita categoria sem ícone e sem cor — os dois são opcionais", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Categories", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdCategory: 15 });
            }),
        );

        await saveCategory(
            fakeSettingsContext({
                categoryDraft: aCategoryDraft({ IconKey: null, Color: null }),
            }),
        );

        expect(body?.IconKey).toBeNull();
        expect(body?.Color).toBeNull();
    });

    it("recusa nome vazio sem gastar requisição", async () => {
        const context = fakeSettingsContext({
            categoryDraft: aCategoryDraft({ Description: "   " }),
        });

        await saveCategory(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe o nome da categoria.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });
});

describe("archiveCategory", () => {
    it("mostra a mensagem da API quando o id não é do espaço", async () => {
        server.use(
            msw.delete("*/api/Categories/IdCategory=1", () =>
                HttpResponse.json({ msg: "Categoria não encontrada!" }, { status: 406 }),
            ),
        );
        const context = fakeSettingsContext();

        await archiveCategory(context, 1);

        // Não há mais "pré-definida do sistema": desde a leva 9 toda
        // categoria é do espaço, e um id alheio é simplesmente um id que
        // não existe aqui.
        expect(context.failSubmit).toHaveBeenCalledWith("Categoria não encontrada!");
    });
});

describe("restoreCategory", () => {
    it("desarquiva pelo PUT, com Active true e a Description junto", async () => {
        let body: unknown;
        server.use(
            msw.put("*/api/Categories/IdCategory=7", async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: "ok" });
            }),
        );
        const context = fakeSettingsContext();

        await restoreCategory(context, 7, "Pets");

        // É o MESMO PUT da edição: arquivar e desarquivar são os dois
        // sentidos de uma coluna só, e por isso não há rota `restore`. A
        // Description vai junto porque o corpo a exige.
        expect(body).toEqual({ Description: "Pets", Active: true });
        expect(context.finishSubmit).toHaveBeenCalledWith("Categoria desarquivada.");
    });
});

describe("moveCategory", () => {
    const list = [aCategory(1, "Casa"), aCategory(2, "Mercado"), aCategory(3, "Pets")];

    it("manda a lista COMPLETA de ids na ordem nova, não só a que mexeu", async () => {
        let body: unknown;
        server.use(
            msw.put("*/api/Categories/reorder", async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: "ok" });
            }),
        );
        const context = fakeSettingsContext({ activeCategories: list });

        await moveCategory(context, 2, -1);

        // A lista inteira é o que faz a última escrita ganhar inteira: uma
        // escrita parcial sobre `Position` deixaria duas categorias na
        // mesma posição quando duas pessoas reordenam ao mesmo tempo.
        expect(body).toEqual({ IdCategories: [2, 1, 3] });
        expect(context.finishSubmit).toHaveBeenCalledWith("Ordem salva.");
    });

    it("desce trocando com o vizinho de baixo", async () => {
        let body: unknown;
        server.use(
            msw.put("*/api/Categories/reorder", async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await moveCategory(fakeSettingsContext({ activeCategories: list }), 1, 1);

        expect(body).toEqual({ IdCategories: [2, 1, 3] });
    });

    it("não gasta requisição na ponta da lista", async () => {
        // Sem handler declarado: uma requisição aqui QUEBRA o teste, que é
        // exatamente o que se quer provar.
        const context = fakeSettingsContext({ activeCategories: list });

        await moveCategory(context, 1, -1);
        await moveCategory(context, 3, 1);

        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("mostra a mensagem da API quando a lista é recusada", async () => {
        server.use(
            msw.put("*/api/Categories/reorder", () =>
                HttpResponse.json(
                    { msg: "A lista precisa trazer todas as categorias ativas do espaço!" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeSettingsContext({ activeCategories: list });

        await moveCategory(context, 2, -1);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "A lista precisa trazer todas as categorias ativas do espaço!",
        );
    });
});

describe("savePerson", () => {
    it("manda só o Name — IdUser não é aceito de propósito", async () => {
        let body: unknown;
        server.use(
            msw.post("*/api/Persons", async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ IdPerson: 2 });
            }),
        );

        await savePerson(fakeSettingsContext());

        // `IdUser` é único no banco inteiro: aceitá-lo do cliente
        // consumiria a vaga de outro usuário.
        expect(body).toEqual({ Name: "Luana" });
    });

    it("mostra a mensagem da API quando o nome já existe no espaço", async () => {
        server.use(
            msw.post("*/api/Persons", () =>
                HttpResponse.json({ msg: "Já existe uma pessoa com este nome!" }, { status: 406 }),
            ),
        );
        const context = fakeSettingsContext();

        await savePerson(context);

        // A comparação ignora maiúsculas e alcança as arquivadas: nenhuma
        // conferência local daria conta de explicar isso melhor.
        expect(context.failSubmit).toHaveBeenCalledWith("Já existe uma pessoa com este nome!");
    });

    it("renomeia pela rota com id", async () => {
        let body: unknown;
        server.use(
            msw.put("*/api/Persons/IdPerson=2", async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await savePerson(fakeSettingsContext({ personDraft: aPersonDraft({ IdPerson: 2 }) }));

        expect(body).toEqual({ Name: "Luana" });
    });
});

describe("archivePerson", () => {
    it("mostra a mensagem da API quando a pessoa tem login", async () => {
        server.use(
            msw.delete("*/api/Persons/IdPerson=1", () =>
                HttpResponse.json(
                    { msg: "Pessoa vinculada a um usuário não pode ser arquivada!" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeSettingsContext();

        await archivePerson(context, 1);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Pessoa vinculada a um usuário não pode ser arquivada!",
        );
    });
});
