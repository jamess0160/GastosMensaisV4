import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { payInvoice } from "../sections/payInvoice";
import { anInvoice, fakeInvoiceContext } from "./context";

describe("payInvoice", () => {
    it("quita o CICLO INTEIRO e conta quantas pernas saíram do saldo", async () => {
        server.use(
            msw.post("*/api/PaymentMethods/IdPaymentMethod=7/payInvoice", () =>
                HttpResponse.json({ msg: "ok", Payments: 12 }),
            ),
        );
        const context = fakeInvoiceContext();

        await payInvoice(context, anInvoice());

        // `Payments` é o número que o usuário confere contra o extrato
        // do banco — uma fatura de concentrador tem 40 compras, e é por
        // isso que ninguém as marcava uma a uma.
        expect(context.finishPay).toHaveBeenCalledWith(
            "Fatura quitada — 12 lançamentos saíram do saldo.",
        );
        expect(context.failPay).not.toHaveBeenCalled();
    });

    it("manda o DueDate da RESPOSTA, e não o `null` da fatura aberta", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/PaymentMethods/IdPaymentMethod=7/payInvoice", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok", Payments: 3 });
            }),
        );

        // `due: null` é a tela na fatura ABERTA: o estado dela é a
        // AUSÊNCIA de DueDate, que é a pergunta de leitura "qual está
        // aberta hoje?". A escrita não pode repetir a pergunta — na
        // virada do ciclo o servidor responderia outra fatura.
        await payInvoice(fakeInvoiceContext({ due: null }), anInvoice({ DueDate: "2026-10-04" }));

        expect(body).toEqual({ DueDate: "2026-10-04" });
    });

    it("desfaz a quitação pela rota de desfazer, e devolve as pernas ao saldo", async () => {
        let called = false;
        server.use(
            msw.post("*/api/PaymentMethods/IdPaymentMethod=7/unpayInvoice", () => {
                called = true;
                return HttpResponse.json({ msg: "ok", Payments: 12 });
            }),
        );
        const context = fakeInvoiceContext();

        await payInvoice(context, anInvoice({ Status: "paid" }), true);

        expect(called).toBe(true);
        expect(context.finishPay).toHaveBeenCalledWith(
            "Quitação desfeita — 12 lançamentos voltaram ao saldo.",
        );
    });

    it("concorda o singular — é uma frase que o usuário lê, não um log", async () => {
        server.use(
            msw.post("*/api/PaymentMethods/IdPaymentMethod=7/payInvoice", () =>
                HttpResponse.json({ msg: "ok", Payments: 1 }),
            ),
        );
        const context = fakeInvoiceContext();

        await payInvoice(context, anInvoice());

        expect(context.finishPay).toHaveBeenCalledWith(
            "Fatura quitada — 1 lançamento saiu do saldo.",
        );
    });

    it("trata `Payments: 0` como resposta legítima, não como erro", async () => {
        server.use(
            msw.post("*/api/PaymentMethods/IdPaymentMethod=7/payInvoice", () =>
                HttpResponse.json({ msg: "ok", Payments: 0 }),
            ),
        );
        const context = fakeInvoiceContext();

        await payInvoice(context, anInvoice({ Status: "paid" }));

        // Repetir a chamada é inofensivo: as pernas já pagas são
        // puladas. É isso que resolve lançar hoje uma compra esquecida
        // que pertence a uma fatura já paga.
        expect(context.finishPay).toHaveBeenCalledWith(
            "Esta fatura já estava quitada — nada mudou.",
        );
        expect(context.failPay).not.toHaveBeenCalled();
    });

    it("INVALIDA o movimento só quando algo mudou: o 406 não passa pelo finishPay", async () => {
        server.use(
            msw.post("*/api/PaymentMethods/IdPaymentMethod=7/payInvoice", () =>
                HttpResponse.json({ msg: "Não há fatura com esse vencimento" }, { status: 406 }),
            ),
        );
        const context = fakeInvoiceContext();

        await payInvoice(context, anInvoice());

        // Quem invalida o mês inteiro é o `finishPay`. Nada mudou no
        // servidor, então não há cache a invalidar — e a `msg` do 406
        // chega pronta para a tela.
        expect(context.finishPay).not.toHaveBeenCalled();
        expect(context.failPay).toHaveBeenCalledWith("Não há fatura com esse vencimento");
        expect(context.beginPay).toHaveBeenCalledOnce();
    });
});
