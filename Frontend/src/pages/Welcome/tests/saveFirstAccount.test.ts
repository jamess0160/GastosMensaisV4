import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveFirstAccount } from "../sections/saveFirstAccount";
import { anAccountDraft, fakeWelcomeContext } from "./context";

const route = "*/api/Accounts";

function capture(idAccount = 7) {
    const seen: { body?: Record<string, unknown> } = {};
    server.use(
        msw.post(route, async ({ request }) => {
            seen.body = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ IdAccount: idAccount });
        }),
    );
    return seen;
}

describe("saveFirstAccount · passo 1", () => {
    it("grava o corpo do POST /Accounts com os quatro campos que o passo pergunta", async () => {
        const seen = capture();
        const context = fakeWelcomeContext();

        await saveFirstAccount(context);

        expect(seen.body).toMatchObject({
            Name: "Nubank",
            Color: "#7238d7",
            InitialBalance: 1200.5,
            InitialBalanceDate: "2026-09-24",
        });
        expect(context.finishStep).toHaveBeenCalledOnce();
    });

    /*  `Type` NÃO é perguntado, e vai explícito como `checking`: é ele
        que decide quais formas de pagamento nascem junto, e cartão de
        crédito (o passo 2) só existe em conta corrente. */
    it("manda Type checking — é ele que faz nascerem o pix e o débito", async () => {
        const seen = capture();

        await saveFirstAccount(fakeWelcomeContext());

        expect(seen.body?.Type).toBe("checking");
    });

    it("guarda o IdAccount criado — é nele que os passos 2 e 4 escrevem", async () => {
        capture(42);
        const context = fakeWelcomeContext();

        await saveFirstAccount(context);

        expect(context.setIdAccount).toHaveBeenCalledWith(42);
    });

    //  O único passo OBRIGATÓRIO da tela, e a recusa é local: nenhuma
    //  requisição sai. Sem handler declarado, uma requisição quebraria o
    //  teste — é o que prova que ela não saiu.
    it("recusa nome vazio sem gastar requisição", async () => {
        const context = fakeWelcomeContext({ accountDraft: anAccountDraft({ Name: "   " }) });

        await saveFirstAccount(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe o nome da conta.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.finishStep).not.toHaveBeenCalled();
    });

    it("manda zero quando o saldo inicial ficou em branco", async () => {
        const seen = capture();

        await saveFirstAccount(
            fakeWelcomeContext({ accountDraft: anAccountDraft({ InitialBalance: null }) }),
        );

        expect(seen.body?.InitialBalance).toBe(0);
    });

    //  Saldo inicial negativo é o cheque especial: não há conferência de
    //  sinal aqui nem na API.
    it("aceita saldo inicial negativo", async () => {
        const seen = capture();

        await saveFirstAccount(
            fakeWelcomeContext({ accountDraft: anAccountDraft({ InitialBalance: -300 }) }),
        );

        expect(seen.body?.InitialBalance).toBe(-300);
    });

    it("vira a msg do 406 em mensagem na tela, e não avança", async () => {
        server.use(
            msw.post(route, () =>
                HttpResponse.json({ msg: "Já existe uma conta com este nome!" }, { status: 406 }),
            ),
        );
        const context = fakeWelcomeContext();

        await saveFirstAccount(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Já existe uma conta com este nome!");
        expect(context.finishStep).not.toHaveBeenCalled();
        expect(context.setIdAccount).not.toHaveBeenCalled();
    });
});
