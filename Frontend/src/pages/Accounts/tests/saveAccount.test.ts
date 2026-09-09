import { HttpResponse, http as msw } from "msw";
import { describe, expect, it, vi } from "vitest";
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

    /*  A ETAPA 2 DA LEVA 6. O fechamento aqui é uma subtração de dias
        corridos a partir do vencimento; o emissor fecha num dia fixo do
        mês. Quando a subtração atravessa a virada, as duas descrições
        discordam por um dia em parte do ano — e um dia no fechamento é um
        mês no caixa. Trocar o modelo é leva própria; o que a tela não pode
        fazer é aceitar isso em silêncio. */
    it("avisa uma vez antes de salvar uma folga cujo fechamento anda de mês para mês", async () => {
        // Fechou 29/08 e venceu 05/09: folga de 7 dias atravessando a
        // virada, então o fechamento derivado cai no 26, 27, 28 ou 29
        // conforme o tamanho do mês anterior.
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ cycleAcknowledged: false }),
        });

        await saveCard(context);

        expect(context.acknowledgeCycleDrift).toHaveBeenCalledOnce();
        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledOnce();
        expect(vi.mocked(context.failSubmit).mock.calls[0][0]).toContain("você leu o dia 29");
    });

    it("salva no segundo envio, com o aviso do ciclo lido", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/PaymentMethods", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdPaymentMethod: 9 });
            }),
        );
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({ cycleAcknowledged: true }),
        });

        await saveCard(context);

        // O aviso informa, não impede: o cartão real existe e precisa ser
        // cadastrado com a melhor descrição que o modelo permite.
        expect(body?.DueDay).toBe(5);
        expect(body?.ClosingOffsetDays).toBe(7);
        expect(context.finishSubmit).toHaveBeenCalledOnce();
    });

    it("salva de primeira o cartão cujo fechamento cai sempre no mesmo dia", async () => {
        server.use(
            msw.post("*/api/PaymentMethods", () => HttpResponse.json({ IdPaymentMethod: 9 })),
        );
        // Vence 28 e fecha 8 dias antes: o dia 20 do MESMO mês, todo mês.
        // A subtração nunca atravessa a virada, então não há o que avisar.
        const context = fakeAccountsContext({
            cardDraft: aCardDraft({
                ClosingDate: "2026-08-20",
                DueDate: "2026-08-28",
                cycleAcknowledged: false,
            }),
        });

        await saveCard(context);

        expect(context.acknowledgeCycleDrift).not.toHaveBeenCalled();
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
