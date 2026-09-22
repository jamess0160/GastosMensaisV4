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

    it("OMITE saldo inicial E tipo quando a conta já tem lançamentos", async () => {
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
        // ainda contaria como alteração e responderia 406 — e os dois
        // congelam pela MESMA pergunta ("esta conta tem movimento?").
        expect(body).not.toHaveProperty("InitialBalance");
        expect(body).not.toHaveProperty("InitialBalanceDate");
        expect(body).not.toHaveProperty("Type");
        expect(body?.Name).toBe("Nubank");
    });

    it("cria uma conta de vale com Type: card", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Accounts", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdAccount: 8 });
            }),
        );

        await saveAccount(
            fakeAccountsContext({
                accountDraft: anAccountDraft({ Name: "Vale Alimentação", Type: "card" }),
            }),
        );

        // `card` NÃO é conta de cartão de crédito: é o vale, e ele nasce
        // com UMA forma de débito com o nome da conta.
        expect(body?.Type).toBe("card");
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
        expect(body?.Type).toBe("checking");
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
        // Os dois dias vão como foram digitados: não há conversão entre
        // o que a tela pergunta e o que a API guarda.
        expect(body?.ClosingDay).toBe(27);
        expect(body?.DueDay).toBe(4);
        expect(body).not.toHaveProperty("ClosingOffsetDays");
    });

    /*  A ORDEM ENTRE OS DOIS DIAS NÃO É ERRO. `ClosingDay > DueDay` é o
        cartão que fecha no mês anterior ao do vencimento, e é exatamente
        o par do rascunho padrão (27 e 04) — o que a folga não conseguia
        descrever em todos os meses. Salva de primeira, sem aviso
        nenhum, porque não há mais deriva sobre a qual avisar. */
    it("aceita fechamento depois do vencimento, sem aviso nenhum", async () => {
        server.use(
            msw.post("*/api/PaymentMethods", () => HttpResponse.json({ IdPaymentMethod: 9 })),
        );
        const context = fakeAccountsContext();

        await saveCard(context);

        expect(context.failSubmit).not.toHaveBeenCalled();
        expect(context.finishSubmit).toHaveBeenCalledOnce();
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

    it("recusa dia fora de 1..31, sem gastar requisição", async () => {
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ ClosingDay: 45 }),
        });

        await saveCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Os dois dias têm que estar entre 1 e 31.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("recusa cartão sem os dois dias da fatura", async () => {
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ ClosingDay: null, DueDay: null }),
        });

        await saveCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Informe o dia em que a fatura fecha e o dia em que ela vence.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("manda CompetenceMode no POST — a tela pergunta, e o que ela pergunta ela manda", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/PaymentMethods", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdPaymentMethod: 9 });
            }),
        );

        await saveCard(fakeAccountsContext());

        // `purchase` é o default do SERVIDOR: um cartão criado sem tocar
        // no seletor sai igual a um criado sem o campo no corpo.
        expect(body?.CompetenceMode).toBe("purchase");
    });

    it("manda CompetenceMode no PUT também — o seletor existe para trocar", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.put("*/api/PaymentMethods/IdPaymentMethod=9", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ IdPaymentMethod: 9, CompetenceMode: "invoice" }),
        });

        await saveCard(context);

        // Omitir manteria o valor, o que não serve aqui. E a tela avisa
        // que a troca vale para o futuro: as datas da perna são
        // congeladas no lançamento e ninguém as revisita.
        expect(body?.CompetenceMode).toBe("invoice");
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Cartão atualizado — vale para o que vier daqui em diante; as compras já lançadas não mudam de mês.",
        );
    });

    /*  O AVISO DE DERIVA DA LEVA 6 MORREU AQUI, e o que o substitui não
        é outro aviso antes de salvar: é o dado certo no modelo. A folga
        produzia fechamentos em dias diferentes conforme o tamanho do mês,
        e a tela avisava uma vez antes de gravar o que ela sabia estar
        aproximado. Com os dois dias do mês não há aproximação nenhuma —
        a conferência que sobra é a da CONVERSÃO dos cartões antigos, e
        ela é uma faixa no formulário de edição, não um envio recusado. */
    it("salva de primeira o cartão que fecha e vence no mesmo mês", async () => {
        server.use(
            msw.post("*/api/PaymentMethods", () => HttpResponse.json({ IdPaymentMethod: 9 })),
        );
        // Fecha 05 e vence 15: `ClosingDay <= DueDay`, o outro caso que
        // existe no mundo.
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ ClosingDay: 5, DueDay: 15 }),
        });

        await saveCard(context);

        expect(context.failSubmit).not.toHaveBeenCalled();
        expect(context.finishSubmit).toHaveBeenCalledOnce();
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
