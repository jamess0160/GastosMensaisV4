import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { submitExpense } from "../sections/submitExpense";
import { aDraft, fakeAddExpenseContext } from "./context";

const route = "*/api/Expenses";

/** Captura o corpo do POST e responde como a API responderia. */
function capture(occurrences = 1) {
    const seen: { body?: Record<string, unknown> } = {};
    server.use(
        msw.post(route, async ({ request }) => {
            seen.body = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ IdExpense: 1, Occurrences: occurrences });
        }),
    );
    return seen;
}

describe("submitExpense · os três formatos", () => {
    it("grava um gasto à vista", async () => {
        const seen = capture();
        const context = fakeAddExpenseContext();

        await submitExpense(context);

        expect(seen.body?.Kind).toBe("single");
        expect(seen.body?.TotalValue).toBe(600);
        expect(context.finishSubmit).toHaveBeenCalledWith(1);
    });

    it("grava um parcelado com InstallmentTotal", async () => {
        const seen = capture();

        await submitExpense(
            fakeAddExpenseContext({
                draft: aDraft({ Kind: "installment", InstallmentTotal: 6 }),
            }),
        );

        expect(seen.body?.Kind).toBe("installment");
        expect(seen.body?.InstallmentTotal).toBe(6);
        // Em parcelado, `TotalValue` é o total da COMPRA, não o da parcela.
        expect(seen.body?.TotalValue).toBe(600);
    });

    it("grava um fixo e reporta as ocorrências criadas", async () => {
        const seen = capture(12);
        const context = fakeAddExpenseContext({
            draft: aDraft({ Kind: "fixed", RecurrenceDay: 5 }),
        });

        await submitExpense(context);

        // `Occurrences` saiu do contrato de ENTRADA — quem limita a série
        // é `RecurrenceEndDate`. Na resposta ele continua sendo lido.
        expect(seen.body).not.toHaveProperty("Occurrences");
        expect(seen.body?.RecurrenceDay).toBe(5);
        expect(context.finishSubmit).toHaveBeenCalledWith(12);
    });

    it("assume uma ocorrência quando a resposta não traz o número", async () => {
        const seen: { body?: Record<string, unknown> } = {};
        server.use(
            msw.post(route, async ({ request }) => {
                seen.body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdExpense: 1 });
            }),
        );
        const context = fakeAddExpenseContext();

        await submitExpense(context);

        expect(context.finishSubmit).toHaveBeenCalledWith(1);
    });
});

describe("submitExpense · os campos exclusivos de cada formato", () => {
    it("NÃO manda InstallmentTotal num gasto à vista — lá ele é proibido", async () => {
        const seen = capture();

        await submitExpense(
            fakeAddExpenseContext({ draft: aDraft({ Kind: "single", InstallmentTotal: 6 }) }),
        );

        expect(seen.body).not.toHaveProperty("InstallmentTotal");
    });

    it("NÃO manda InstallmentTotal num fixo", async () => {
        const seen = capture(12);

        await submitExpense(
            fakeAddExpenseContext({ draft: aDraft({ Kind: "fixed", InstallmentTotal: 6 }) }),
        );

        expect(seen.body).not.toHaveProperty("InstallmentTotal");
    });

    it("NÃO manda recorrência fora do fixo", async () => {
        const seen = capture();

        await submitExpense(
            fakeAddExpenseContext({
                draft: aDraft({
                    Kind: "single",
                    RecurrenceDay: 5,
                    RecurrenceEndDate: "2027-01-01",
                }),
            }),
        );

        expect(seen.body).not.toHaveProperty("RecurrenceDay");
        expect(seen.body).not.toHaveProperty("RecurrenceEndDate");
        expect(seen.body).not.toHaveProperty("Occurrences");
    });

    it("omite RecurrenceDay quando ele está vazio — aí vale o dia da compra", async () => {
        const seen = capture(12);

        await submitExpense(
            fakeAddExpenseContext({
                draft: aDraft({ Kind: "fixed", RecurrenceDay: null }),
            }),
        );

        // `undefined` viraria chave ausente no JSON de qualquer forma,
        // mas explicitar evita que um refactor mande `null` — que o Joi
        // trata como valor, não como ausência.
        expect(seen.body).not.toHaveProperty("RecurrenceDay");
    });

    it("nunca manda Status — ele é derivado", async () => {
        const seen = capture();

        await submitExpense(fakeAddExpenseContext());

        expect(seen.body).not.toHaveProperty("Status");
    });
});

describe("submitExpense · os dois rateios", () => {
    it("manda 2 + 2 linhas, nunca 4, para duas formas e duas pessoas", async () => {
        const seen = capture();

        await submitExpense(
            fakeAddExpenseContext({
                draft: aDraft({
                    TotalValue: 600,
                    payments: [
                        { id: 3, value: 400, paid: true },
                        { id: 4, value: 200, paid: false },
                    ],
                    persons: [
                        { id: 1, value: 300 },
                        { id: 2, value: 300 },
                    ],
                }),
            }),
        );

        // Os dois eixos são independentes: financeiro e analítico não se
        // cruzam num produto cartesiano.
        expect(seen.body?.Payments).toHaveLength(2);
        expect(seen.body?.Persons).toHaveLength(2);
    });

    it("leva o Paid de cada perna — o débito já sai pago no ato", async () => {
        const seen = capture();

        await submitExpense(
            fakeAddExpenseContext({
                draft: aDraft({ payments: [{ id: 3, value: 600, paid: true }] }),
            }),
        );

        expect(seen.body?.Payments).toEqual([{ IdPaymentMethod: 3, Value: 600, Paid: true }]);
    });

    it("recusa antes de chamar a API quando o rateio financeiro não fecha", async () => {
        // Sem handler: qualquer requisição aqui quebra o teste, que é a
        // garantia de que a conferência acontece antes.
        const context = fakeAddExpenseContext({
            draft: aDraft({
                TotalValue: 600,
                payments: [{ id: 3, value: 599.99 }],
            }),
        });

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "A soma das formas de pagamento precisa fechar com o total.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("recusa quando o rateio entre pessoas não fecha", async () => {
        const context = fakeAddExpenseContext({
            draft: aDraft({
                TotalValue: 600,
                persons: [{ id: 1, value: 300 }],
            }),
        });

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "A soma do rateio entre pessoas precisa fechar com o total.",
        );
    });

    it("aceita rateio de pessoas vazio — o eixo analítico é opcional", async () => {
        const seen = capture();
        const context = fakeAddExpenseContext({ draft: aDraft({ persons: [] }) });

        await submitExpense(context);

        expect(seen.body?.Persons).toEqual([]);
        expect(context.finishSubmit).toHaveBeenCalled();
    });

    it("exige ao menos uma forma de pagamento", async () => {
        const context = fakeAddExpenseContext({ draft: aDraft({ payments: [] }) });

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Escolha ao menos uma forma de pagamento.");
    });

    it("recusa parcelado com duas formas de pagamento", async () => {
        const context = fakeAddExpenseContext({
            draft: aDraft({
                Kind: "installment",
                payments: [
                    { id: 3, value: 300 },
                    { id: 4, value: 300 },
                ],
            }),
        });

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Compra parcelada aceita uma forma de pagamento só.",
        );
    });
});

describe("submitExpense · tags", () => {
    it("manda tag como TEXTO, não como id", async () => {
        const seen = capture();

        await submitExpense(
            fakeAddExpenseContext({ draft: aDraft({ tags: ["Viagem Chile", "mercado"] }) }),
        );

        // É o único lugar do sistema em que uma tag nasce: a API reusa a
        // existente, desarquiva a arquivada ou insere a nova.
        expect(seen.body?.Tags).toEqual(["Viagem Chile", "mercado"]);
    });
});

describe("submitExpense · validação local", () => {
    it("exige categoria", async () => {
        const context = fakeAddExpenseContext({ draft: aDraft({ IdCategory: null }) });

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Escolha uma categoria — ela é obrigatória.",
        );
    });

    it("exige valor maior que zero", async () => {
        const context = fakeAddExpenseContext({
            draft: aDraft({ TotalValue: 0, payments: [{ id: 3, value: 0 }] }),
        });

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe um valor maior que zero.");
    });

    it("recusa parcelas fora de 2 a 120", async () => {
        const context = fakeAddExpenseContext({
            draft: aDraft({ Kind: "installment", InstallmentTotal: 200 }),
        });

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith("O número de parcelas vai de 2 a 120.");
    });
});

describe("submitExpense · edição", () => {
    it("edita pela rota com id e sem os campos que não se editam", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.put("*/api/Expenses/IdExpense=5", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await submitExpense(fakeAddExpenseContext({ idExpense: 5 }));

        // `Kind`, `Status` e a recorrência não se editam.
        expect(body).not.toHaveProperty("Kind");
        expect(body).not.toHaveProperty("Status");
        expect(body).not.toHaveProperty("InstallmentTotal");
        expect(body?.Description).toBe("Mercado");
    });

    it("recusa editar uma compra parcelada", async () => {
        const context = fakeAddExpenseContext({
            idExpense: 5,
            draft: aDraft({ Kind: "installment" }),
        });

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Compra parcelada não se edita: cancele e lance de novo.",
        );
    });
});

describe("submitExpense · erro da API", () => {
    it("mostra a msg do 406 como veio", async () => {
        server.use(
            msw.post(route, () =>
                HttpResponse.json(
                    { msg: "A soma do rateio não bate com o valor total!" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeAddExpenseContext();

        await submitExpense(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "A soma do rateio não bate com o valor total!",
        );
    });
});
