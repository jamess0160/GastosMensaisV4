import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveAccount } from "../sections/saveAccount";
import { saveCard } from "../sections/saveCard";
import { anAccountDraft, aCardDraft, fakeAccountsContext } from "./context";

describe("saveAccount", () => {
    it("cria a conta e avisa que ela já nasce com pix e débito", async () => {
        server.use(msw.post("*/api/Accounts", () => HttpResponse.json({ IdAccount: 7 })));
        const context = fakeAccountsContext();

        await saveAccount(context);

        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Conta criada — ela já nasce com pix e débito.",
        );
        expect(context.closeAccountForm).toHaveBeenCalledOnce();
    });

    it("aceita saldo inicial negativo — é o cheque especial", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Accounts", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdAccount: 7 });
            }),
        );

        await saveAccount(
            fakeAccountsContext({ accountDraft: anAccountDraft({ InitialBalance: -350.5 }) }),
        );

        expect(body?.InitialBalance).toBe(-350.5);
    });

    it("OMITE o saldo inicial quando a conta já tem lançamentos", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.put("*/api/Accounts/IdAccount=3", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await saveAccount(
            fakeAccountsContext({
                accountDraft: anAccountDraft({ IdAccount: 3, balanceFrozen: true }),
            }),
        );

        // No PUT, campo omitido é campo mantido. Reenviar o mesmo valor
        // ainda contaria como alteração e responderia 406.
        expect(body).not.toHaveProperty("InitialBalance");
        expect(body).not.toHaveProperty("InitialBalanceDate");
        expect(body?.Name).toBe("Nubank");
    });

    it("manda o saldo inicial quando a conta ainda não tem movimento", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.put("*/api/Accounts/IdAccount=3", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await saveAccount(
            fakeAccountsContext({
                accountDraft: anAccountDraft({ IdAccount: 3, balanceFrozen: false }),
            }),
        );

        expect(body?.InitialBalance).toBe(1000);
    });

    it("mostra a mensagem da API quando o saldo congelado escapa", async () => {
        server.use(
            msw.put("*/api/Accounts/IdAccount=3", () =>
                HttpResponse.json(
                    {
                        msg: "Esta conta já tem lançamentos: o saldo inicial não pode mais ser alterado.",
                    },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeAccountsContext({
            accountDraft: anAccountDraft({ IdAccount: 3 }),
        });

        await saveAccount(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Esta conta já tem lançamentos: o saldo inicial não pode mais ser alterado.",
        );
    });
});

describe("saveCard", () => {
    it("cria mandando Kind: credit_card — o único valor aceito", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/PaymentMethods", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdPaymentMethod: 9 });
            }),
        );

        await saveCard(fakeAccountsContext());

        expect(body?.Kind).toBe("credit_card");
        expect(body?.IdAccount).toBe(1);
        // A tela pergunta duas datas; a API guarda vencimento + folga.
        expect(body?.DueDay).toBe(5);
        expect(body?.ClosingOffsetDays).toBe(7);
        expect(body).not.toHaveProperty("ClosingDay");
    });

    it("NÃO manda Kind nem IdAccount no PUT — a API não os aceita", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.put("*/api/PaymentMethods/IdPaymentMethod=9", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await saveCard(fakeAccountsContext({ cardDraft: aCardDraft({ IdPaymentMethod: 9 }) }));

        // Um pix não vira cartão e um cartão não muda de conta: as duas
        // trocas reescreveriam o significado das compras já lançadas.
        expect(body).not.toHaveProperty("Kind");
        expect(body).not.toHaveProperty("IdAccount");
    });

    it("recusa fatura que fecha depois de vencer, sem gastar requisição", async () => {
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ ClosingDate: "2026-09-10", DueDate: "2026-09-05" }),
        });

        await saveCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith("A fatura tem que fechar antes de vencer.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("recusa folga acima de 28 dias — é o limite do schema", async () => {
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ ClosingDate: "2026-08-01", DueDate: "2026-09-05" }),
        });

        await saveCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "O fechamento precisa cair entre 1 e 28 dias antes do vencimento.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("recusa cartão sem as datas da fatura", async () => {
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ ClosingDate: null, DueDate: null }),
        });

        await saveCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Informe o fechamento e o vencimento da última fatura.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("não manda bandeira nem final do cartão — eles saíram do cadastro", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/PaymentMethods", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdPaymentMethod: 9 });
            }),
        );

        await saveCard(fakeAccountsContext({ cardDraft: aCardDraft() }));

        expect(body).not.toHaveProperty("Brand");
        expect(body).not.toHaveProperty("LastDigits");
    });
});
