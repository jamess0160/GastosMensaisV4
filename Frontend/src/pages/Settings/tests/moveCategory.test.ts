import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { moveCategory } from "../sections/moveCategory";
import { fakeSettingsContext } from "./context";

/* A ordem nova chega PRONTA à section: quem a monta é a tela, com o
   `useReorder` — o teclado trocando dois vizinhos, o arrasto movendo um
   item de índice. A conta dos índices tem teste próprio em
   `src/ui/tests/reorder.test.ts`; aqui se prova o que a section faz com
   a lista que recebe. */

describe("moveCategory", () => {
    it("manda a lista COMPLETA de ids na ordem nova, não só a que mexeu", async () => {
        let body: unknown;
        server.use(
            msw.put("*/api/Categories/reorder", async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ msg: "ok" });
            }),
        );
        const context = fakeSettingsContext();

        const saved = await moveCategory(context, [2, 1, 3]);

        // A lista inteira é o que faz a última escrita ganhar inteira: uma
        // escrita parcial sobre `Position` deixaria duas categorias na
        // mesma posição quando duas pessoas reordenam ao mesmo tempo. É
        // também o que faz um arrasto de seis posições custar UMA
        // requisição, e não seis.
        expect(body).toEqual({ IdCategories: [2, 1, 3] });
        expect(context.finishSubmit).toHaveBeenCalledWith("Ordem salva.");
        expect(saved).toBe(true);
    });

    it("não gasta requisição com lista de menos de duas categorias", async () => {
        // Sem handler declarado: uma requisição aqui QUEBRA o teste, que é
        // exatamente o que se quer provar.
        const context = fakeSettingsContext();

        expect(await moveCategory(context, [])).toBe(false);
        expect(await moveCategory(context, [1])).toBe(false);
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("mostra a mensagem da API quando a lista é recusada, e devolve false", async () => {
        server.use(
            msw.put("*/api/Categories/reorder", () =>
                HttpResponse.json(
                    { msg: "A lista precisa trazer todas as categorias ativas do espaço!" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeSettingsContext();

        const saved = await moveCategory(context, [2, 1, 3]);

        // O `false` é o que devolve a lista da tela para a ordem que a API
        // tem: a única ordem verdadeira é a gravada, e uma lista arrastada
        // que ficou na tela sem ter gravado é a pior saída possível.
        expect(saved).toBe(false);
        expect(context.failSubmit).toHaveBeenCalledWith(
            "A lista precisa trazer todas as categorias ativas do espaço!",
        );
    });
});
