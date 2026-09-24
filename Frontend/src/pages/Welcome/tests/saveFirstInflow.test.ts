import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveFirstInflow } from "../sections/saveFirstInflow";
import { today } from "@/lib/date";
import { anInflowDraft, fakeWelcomeContext } from "./context";

const route = "*/api/Inflows";

function capture() {
    const seen: { body?: Record<string, unknown> } = {};
    server.use(
        msw.post(route, async ({ request }) => {
            seen.body = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ IdInflow: 1 });
        }),
    );
    return seen;
}

describe("saveFirstInflow · passo 4", () => {
    it("grava a entrada na conta do passo 1, com competência de hoje", async () => {
        const seen = capture();
        const context = fakeWelcomeContext();

        await saveFirstInflow(context);

        expect(seen.body).toMatchObject({
            Description: "Salário",
            TotalValue: 5000,
            Kind: "inflow",
            IdFromAccount: null,
            IdToAccount: 7,
            // A renda DO MÊS: a competência é a data de hoje, e é por ela
            // que o orçamento do mês vai repartir.
            CompetenceDate: today(),
        });
        expect(context.finishStep).toHaveBeenCalledOnce();
    });

    /*  O rateio da entrada saiu do produto na leva 10: nem chave, nem
        lista vazia. Quem responde "de quem é esse dinheiro" é o
        Orçamento — a tela para onde o painel final leva. */
    it("nunca manda Persons — a entrada não tem rateio", async () => {
        const seen = capture();

        await saveFirstInflow(fakeWelcomeContext());

        expect(seen.body).not.toHaveProperty("Persons");
    });

    //  `Status` não é aceito: a entrada NASCE PENDENTE, e é o `receive`
    //  que põe o dinheiro no saldo.
    it("nunca manda Status", async () => {
        const seen = capture();

        await saveFirstInflow(fakeWelcomeContext());

        expect(seen.body).not.toHaveProperty("Status");
    });

    it("recusa descrição vazia sem gastar requisição", async () => {
        const context = fakeWelcomeContext({ inflowDraft: anInflowDraft({ Description: " " }) });

        await saveFirstInflow(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe a descrição da renda.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    //  Valor negativo seria saída, e saída é gasto.
    it("recusa valor zero ou negativo", async () => {
        const context = fakeWelcomeContext({ inflowDraft: anInflowDraft({ TotalValue: 0 }) });

        await saveFirstInflow(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe um valor maior que zero.");
    });

    it("recusa sem conta de destino", async () => {
        const context = fakeWelcomeContext({ inflowDraft: anInflowDraft({ IdToAccount: null }) });

        await saveFirstInflow(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Escolha a conta de destino.");
    });

    it("vira a msg do 406 em mensagem na tela, e não avança", async () => {
        server.use(
            msw.post(route, () =>
                HttpResponse.json({ msg: "Conta de destino não encontrada!" }, { status: 406 }),
            ),
        );
        const context = fakeWelcomeContext();

        await saveFirstInflow(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Conta de destino não encontrada!");
        expect(context.finishStep).not.toHaveBeenCalled();
    });
});
