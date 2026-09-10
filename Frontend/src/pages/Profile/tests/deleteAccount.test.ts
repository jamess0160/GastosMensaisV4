import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { deleteAccount } from "../sections/deleteAccount";
import { fakeProfileContext } from "./context";

const route = "*/api/Users";

describe("deleteAccount", () => {
    it("apaga a conta e sai da sessão para sempre", async () => {
        server.use(msw.delete(route, () => HttpResponse.json({ msg: "Conta apagada" })));
        const context = fakeProfileContext();

        await deleteAccount(context);

        expect(context.beginSubmit).toHaveBeenCalledWith("account");
        expect(context.leaveForGood).toHaveBeenCalledOnce();
        /* Não há "pronto" a mostrar: a tela que mostraria já foi
           embora, e a conta que a lia não existe mais. */
        expect(context.finishSubmit).not.toHaveBeenCalled();
    });

    it("manda a senha no BODY, nunca na URL", async () => {
        let body: unknown;
        let url = "";
        server.use(
            msw.delete(route, async ({ request }) => {
                body = await request.json();
                url = request.url;
                return HttpResponse.json({ msg: "Conta apagada" });
            }),
        );

        await deleteAccount(fakeProfileContext());

        // O path cai no log do proxy, no histórico e no Referer: senha
        // ali não se recupera depois de vazada.
        expect(body).toEqual({ Password: "senha-atual" });
        expect(url).not.toContain("senha-atual");
    });

    /* O 401 desta rota vem COM `msg`, e é o que o separa do 401 de
       sessão expirada: quem errou a senha continua com a conta de pé e
       não pode ser deslogado por isso. */
    it("mostra a frase da API quando a senha está errada, e não sai da sessão", async () => {
        server.use(
            msw.delete(route, () => HttpResponse.json({ msg: "Senha incorreta" }, { status: 401 })),
        );
        const context = fakeProfileContext();

        await deleteAccount(context);

        expect(context.failSubmit).toHaveBeenCalledWith("account", "Senha incorreta");
        expect(context.leaveForGood).not.toHaveBeenCalled();
    });

    /* A recusa do dono de espaço compartilhado. A `msg` nomeia o próximo
       passo — transferir a propriedade —, e inventar uma frase aqui
       esconderia justamente a saída. */
    it("mostra a recusa do dono de espaço compartilhado como ela veio", async () => {
        const msg =
            "Você é dono de um espaço compartilhado com outras pessoas: Casa. " +
            "Transfira a propriedade a outro membro, ou remova os demais membros, antes de apagar a conta.";
        server.use(msw.delete(route, () => HttpResponse.json({ msg }, { status: 406 })));
        const context = fakeProfileContext();

        await deleteAccount(context);

        expect(context.failSubmit).toHaveBeenCalledWith("account", msg);
        expect(context.leaveForGood).not.toHaveBeenCalled();
    });

    it("recusa o formulário sem senha sem gastar requisição", async () => {
        const context = fakeProfileContext({ deleteForm: { password: "" } });

        await deleteAccount(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "account",
            "Digite a sua senha para confirmar.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.leaveForGood).not.toHaveBeenCalled();
    });
});
