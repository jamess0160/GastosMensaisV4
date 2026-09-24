import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveFirstAccount } from "../sections/saveFirstAccount";
import { saveFirstCard } from "../sections/saveFirstCard";
import { saveFirstInflow } from "../sections/saveFirstInflow";
import { saveFirstPersons } from "../sections/saveFirstPersons";
import { aPersonsDraft, fakeWelcomeContext } from "./context";
import type { WelcomeContext } from "../controller";

/* ════════════════════════════════════════════════════════════
   PULAR NÃO ESCREVE NADA.

   Pular é navegação — o passo seguinte, e nada mais —, então a prova é
   por AUSÊNCIA: uma rota que nenhuma section chamou fica com zero
   acertos. E ela cobre junto o erro vizinho, que é o que realmente
   quebraria o assistente: uma section escrevendo o que não é dela (o
   passo 1 criando um cartão "conveniente", o passo 4 criando a pessoa do
   rateio que não existe mais).

   As quatro rotas ficam declaradas nos dois casos: sem handler, o MSW
   quebra o teste em vez de sair para a rede, e um zero só significa
   "ninguém chamou" quando a rota estava lá para ser chamada.
   ════════════════════════════════════════════════════════════ */

function countAll() {
    const hits = { accounts: 0, cards: 0, persons: 0, inflows: 0 };
    server.use(
        msw.post("*/api/Accounts", () => {
            hits.accounts += 1;
            return HttpResponse.json({ IdAccount: 7 });
        }),
        msw.post("*/api/PaymentMethods", () => {
            hits.cards += 1;
            return HttpResponse.json({ IdPaymentMethod: 3 });
        }),
        msw.post("*/api/Persons", () => {
            hits.persons += 1;
            return HttpResponse.json({ IdPerson: hits.persons });
        }),
        msw.post("*/api/Inflows", () => {
            hits.inflows += 1;
            return HttpResponse.json({ IdInflow: 1 });
        }),
    );
    return hits;
}

describe("o assistente, passo a passo", () => {
    it("pular os passos 2, 3 e 4 deixa o espaço só com a conta", async () => {
        const hits = countAll();
        const context = fakeWelcomeContext();

        // Só o passo obrigatório roda; pular os outros três é não
        // chamar as sections deles.
        await saveFirstAccount(context);

        expect(hits).toEqual({ accounts: 1, cards: 0, persons: 0, inflows: 0 });
    });

    it("passar pelos quatro escreve uma vez em cada rota, e uma pessoa por linha", async () => {
        const hits = countAll();
        const context: WelcomeContext = fakeWelcomeContext({
            personsDraft: aPersonsDraft({ names: ["Luana", "Pedro"] }),
        });

        await saveFirstAccount(context);
        await saveFirstCard(context);
        await saveFirstPersons(context);
        await saveFirstInflow(context);

        expect(hits).toEqual({ accounts: 1, cards: 1, persons: 2, inflows: 1 });
        // Quatro escritas, quatro avanços: o painel final não escreve
        // nada, então ele não aparece nesta contagem.
        expect(context.finishStep).toHaveBeenCalledTimes(4);
    });
});
