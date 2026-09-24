import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveFirstPersons } from "../sections/saveFirstPersons";
import { aPersonsDraft, fakeWelcomeContext } from "./context";

const route = "*/api/Persons";

describe("saveFirstPersons · passo 3", () => {
    it("cria uma pessoa por linha, na ordem, e só com o Name", async () => {
        const bodies: Record<string, unknown>[] = [];
        server.use(
            msw.post(route, async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);
                return HttpResponse.json({ IdPerson: bodies.length });
            }),
        );
        const context = fakeWelcomeContext({
            personsDraft: aPersonsDraft({ names: ["Luana", "Pedro"] }),
        });

        await saveFirstPersons(context);

        expect(bodies).toEqual([{ Name: "Luana" }, { Name: "Pedro" }]);
        expect(context.finishStep).toHaveBeenCalledOnce();
    });

    //  As linhas em branco são o rascunho de quem abriu uma a mais e não
    //  preencheu: elas não viram requisição.
    it("ignora as linhas em branco", async () => {
        const bodies: Record<string, unknown>[] = [];
        server.use(
            msw.post(route, async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);
                return HttpResponse.json({ IdPerson: bodies.length });
            }),
        );

        await saveFirstPersons(
            fakeWelcomeContext({
                personsDraft: aPersonsDraft({ names: ["  Luana  ", "", "   "] }),
            }),
        );

        expect(bodies).toEqual([{ Name: "Luana" }]);
    });

    it("recusa a lista toda em branco sem gastar requisição", async () => {
        const context = fakeWelcomeContext({ personsDraft: aPersonsDraft({ names: ["", " "] }) });

        await saveFirstPersons(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Escreva ao menos um nome, ou pule este passo.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.finishStep).not.toHaveBeenCalled();
    });

    /*  A falha no meio da fila é o caso a tratar, não o improvável: sem
        reescrever o rascunho com o que sobrou, tentar de novo recriaria a
        primeira e a segunda tentativa morreria no mesmo 406 — o passo
        ficaria preso para sempre. */
    it("deixa no rascunho só o que NÃO foi criado quando uma linha é recusada", async () => {
        let calls = 0;
        server.use(
            msw.post(route, () => {
                calls += 1;
                if (calls === 1) return HttpResponse.json({ IdPerson: 1 });
                return HttpResponse.json(
                    { msg: "Já existe uma pessoa com este nome!" },
                    { status: 406 },
                );
            }),
        );
        const context = fakeWelcomeContext({
            personsDraft: aPersonsDraft({ names: ["Luana", "Pedro", "Ana"] }),
        });

        await saveFirstPersons(context);

        // "Luana" passou e sai da fila; "Pedro" e "Ana" ficam.
        expect(context.setPersonNames).toHaveBeenCalledWith(["Pedro", "Ana"]);
        expect(context.failSubmit).toHaveBeenCalledWith("Já existe uma pessoa com este nome!");
        expect(context.finishStep).not.toHaveBeenCalled();
    });
});
