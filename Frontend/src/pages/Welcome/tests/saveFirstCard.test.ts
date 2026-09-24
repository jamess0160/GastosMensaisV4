import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveFirstCard } from "../sections/saveFirstCard";
import { aCardDraft, fakeWelcomeContext } from "./context";

const route = "*/api/PaymentMethods";

function capture() {
    const seen: { body?: Record<string, unknown> } = {};
    server.use(
        msw.post(route, async ({ request }) => {
            seen.body = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ IdPaymentMethod: 3 });
        }),
    );
    return seen;
}

describe("saveFirstCard · passo 2", () => {
    it("grava o cartão na conta do passo 1, com os dois dias do mês", async () => {
        const seen = capture();
        const context = fakeWelcomeContext();

        await saveFirstCard(context);

        expect(seen.body).toMatchObject({
            IdAccount: 7,
            Kind: "credit_card",
            Name: "Cartão Roxo",
            ClosingDay: 27,
            DueDay: 4,
        });
        expect(context.finishStep).toHaveBeenCalledOnce();
    });

    /*  A tela de Contas manda `CompetenceMode` porque PERGUNTA. O
        assistente não pergunta, então deixa o default do servidor
        (`purchase`) responder: mandar um valor que ninguém escolheu
        seria fingir uma escolha. */
    it("não manda CompetenceMode — o assistente não o pergunta", async () => {
        const seen = capture();

        await saveFirstCard(fakeWelcomeContext());

        expect(seen.body).not.toHaveProperty("CompetenceMode");
    });

    it("recusa nome vazio sem gastar requisição", async () => {
        const context = fakeWelcomeContext({ cardDraft: aCardDraft({ Name: "" }) });

        await saveFirstCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe o nome do cartão.");
        expect(context.finishStep).not.toHaveBeenCalled();
    });

    //  NENHUM DOS DOIS TEM DEFAULT: um dia do mês não se deduz de nada, e
    //  inventar um é gravar exatamente o dado errado.
    it("recusa quando falta um dos dois dias", async () => {
        const context = fakeWelcomeContext({ cardDraft: aCardDraft({ ClosingDay: null }) });

        await saveFirstCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Informe o dia em que a fatura fecha e o dia em que ela vence.",
        );
    });

    it("recusa dia fora de 1 a 31", async () => {
        const context = fakeWelcomeContext({ cardDraft: aCardDraft({ DueDay: 45 }) });

        await saveFirstCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Os dois dias têm que estar entre 1 e 31.");
    });

    //  A ORDEM ENTRE OS DOIS DIAS NÃO É ERRO: fechar 05 e vencer 15 é o
    //  cartão que fecha e vence no mesmo mês, e os dois casos existem.
    it("aceita fechamento antes do vencimento", async () => {
        const seen = capture();

        await saveFirstCard(
            fakeWelcomeContext({ cardDraft: aCardDraft({ ClosingDay: 5, DueDay: 15 }) }),
        );

        expect(seen.body).toMatchObject({ ClosingDay: 5, DueDay: 15 });
    });

    //  O passo 2 escreve NA conta do passo 1. Sem ela não há onde
    //  escrever, e a recusa é local — o 406 da API diria a mesma coisa
    //  gastando uma viagem.
    it("recusa quando a conta do passo 1 ainda não existe", async () => {
        const context = fakeWelcomeContext({ idAccount: null });

        await saveFirstCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Cadastre a conta antes de cadastrar o cartão.",
        );
    });

    it("vira a msg do 406 em mensagem na tela, e não avança", async () => {
        server.use(
            msw.post(route, () =>
                HttpResponse.json(
                    { msg: "Cartão de crédito só existe em conta corrente!" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeWelcomeContext();

        await saveFirstCard(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Cartão de crédito só existe em conta corrente!",
        );
        expect(context.finishStep).not.toHaveBeenCalled();
    });
});
