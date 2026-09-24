import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { submitInflow } from "../sections/submitInflow";
import { receiveInflow } from "../sections/receiveInflow";
import { cancelInflow } from "../sections/cancelInflow";
import { anInflowDraft, fakeIncomeContext } from "./context";

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

describe("submitInflow · entrada", () => {
    it("cria com IdFromAccount null — o dinheiro veio de fora", async () => {
        const seen = capture();
        const context = fakeIncomeContext();

        await submitInflow(context);

        expect(seen.body?.Kind).toBe("inflow");
        expect(seen.body?.IdFromAccount).toBeNull();
        expect(context.closeForm).toHaveBeenCalledOnce();
    });

    it("nunca manda Status — a entrada nasce pendente", async () => {
        const seen = capture();

        await submitInflow(fakeIncomeContext());

        expect(seen.body).not.toHaveProperty("Status");
    });

    //  A entrada não tem rateio: nem chave, nem lista vazia. O rateio da
    //  renda saiu do produto na leva 10 — quem reparte a renda do mês por
    //  pessoa é o Orçamento
    it("nunca manda Persons — a entrada não tem rateio", async () => {
        const seen = capture();

        await submitInflow(fakeIncomeContext());

        expect(seen.body).not.toHaveProperty("Persons");
    });

    it("recusa valor zero ou negativo — saída é gasto, não entrada", async () => {
        const context = fakeIncomeContext({ draft: anInflowDraft({ TotalValue: -100 }) });

        await submitInflow(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe um valor maior que zero.");
    });
});

describe("submitInflow · transferência", () => {
    it("manda a conta de origem", async () => {
        const seen = capture();

        await submitInflow(
            fakeIncomeContext({
                draft: anInflowDraft({ Kind: "transfer", IdFromAccount: 2, IdToAccount: 1 }),
            }),
        );

        expect(seen.body?.Kind).toBe("transfer");
        expect(seen.body?.IdFromAccount).toBe(2);
    });

    it("recusa transferência sem conta de origem", async () => {
        const context = fakeIncomeContext({
            draft: anInflowDraft({ Kind: "transfer", IdFromAccount: null }),
        });

        await submitInflow(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Escolha a conta de origem.");
    });

    it("recusa transferência para a mesma conta", async () => {
        const context = fakeIncomeContext({
            draft: anInflowDraft({ Kind: "transfer", IdFromAccount: 1, IdToAccount: 1 }),
        });

        await submitInflow(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "A conta de origem precisa ser diferente da de destino.",
        );
    });
});

describe("submitInflow · edição", () => {
    it("NÃO manda Kind nem contas no PUT", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.put("*/api/Inflows/IdInflow=1", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await submitInflow(fakeIncomeContext({ draft: anInflowDraft({ IdInflow: 1 }) }));

        // Os três reescreveriam o que o lançamento significa e o saldo
        // das contas envolvidas junto.
        expect(body).not.toHaveProperty("Kind");
        expect(body).not.toHaveProperty("IdFromAccount");
        expect(body).not.toHaveProperty("IdToAccount");
        expect(body).not.toHaveProperty("Status");
        // E nem Persons: a entrada não tem rateio desde a leva 10.
        expect(body).not.toHaveProperty("Persons");
    });
});

describe("receiveInflow", () => {
    it("confirma o recebimento sem corpo — é ele que põe o dinheiro no saldo", async () => {
        let body: string | null = null;
        server.use(
            msw.post("*/api/Inflows/IdInflow=1/receive", async ({ request }) => {
                body = await request.text();
                return HttpResponse.json({ msg: "Entrada recebida com sucesso" });
            }),
        );
        const context = fakeIncomeContext();

        await receiveInflow(context, 1);

        expect(body).toBe("");
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Recebimento confirmado — o dinheiro entrou no saldo da conta.",
        );
    });

    it("mostra a msg da API quando a entrada já foi recebida", async () => {
        server.use(
            msw.post("*/api/Inflows/IdInflow=1/receive", () =>
                HttpResponse.json({ msg: "Esta entrada já foi recebida!" }, { status: 406 }),
            ),
        );
        const context = fakeIncomeContext();

        await receiveInflow(context, 1);

        expect(context.failSubmit).toHaveBeenCalledWith("Esta entrada já foi recebida!");
    });
});

describe("cancelInflow", () => {
    it("cancela pelo DELETE e fecha o detalhe", async () => {
        server.use(
            msw.delete("*/api/Inflows/IdInflow=1", () =>
                HttpResponse.json({ msg: "Entrada cancelada com sucesso" }),
            ),
        );
        const context = fakeIncomeContext();

        await cancelInflow(context, 1);

        // Não há delete físico nesta tabela: o Status vira `canceled`.
        expect(context.closeDetail).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledWith("Entrada cancelada.");
    });
});
