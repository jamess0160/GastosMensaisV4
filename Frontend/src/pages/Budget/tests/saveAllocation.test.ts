import { HttpResponse, http as msw } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { allocationBody, saveAllocation } from "../sections/saveAllocation";
import { aBudgetLine, fakeBudgetContext } from "./context";

/* O rateio do mês numa escrita só. O que este arquivo trava é o que
   separa esta tela das outras: o rateio NÃO precisa fechar contra a
   renda, a linha em branco é rascunho e não erro, e a identidade de uma
   fatia é o ALVO — nenhuma linha leva `IdBudgetPeriod`. */

describe("allocationBody", () => {
    it("monta uma linha por fatia, com o alvo que veio preenchido", () => {
        const result = allocationBody("2026-10", [
            aBudgetLine({ id: null, secondaryId: 4, value: 500 }),
            aBudgetLine({ id: 7, secondaryId: null, value: 250 }),
            aBudgetLine({ id: 7, secondaryId: 4, value: 100 }),
        ]);

        expect(result).toEqual({
            body: {
                ReferenceMonth: "2026-10",
                Lines: [
                    { IdCategory: 4, LimitValue: 500 },
                    { IdPerson: 7, LimitValue: 250 },
                    { IdCategory: 4, IdPerson: 7, LimitValue: 100 },
                ],
            },
        });
    });

    // A fatia é identificada pelo ALVO: mandar o id faria a rota ter
    // duas identidades para a mesma linha, e mover uma fatia de lugar
    // deixaria de ser apagar esta e cadastrar outra.
    it("não manda IdBudgetPeriod nenhum", () => {
        const result = allocationBody("2026-10", [aBudgetLine()]);

        expect(JSON.stringify(result)).not.toContain("IdBudgetPeriod");
    });

    // Quem clica em "adicionar fatia" e desiste não pode ser impedido de
    // salvar o resto.
    it("descarta a linha em branco sem reclamar", () => {
        const result = allocationBody("2026-10", [
            aBudgetLine({ secondaryId: 4, value: 500 }),
            { id: null, secondaryId: null, value: null },
        ]);

        expect(result).toEqual({
            body: { ReferenceMonth: "2026-10", Lines: [{ IdCategory: 4, LimitValue: 500 }] },
        });
    });

    // A lista vazia é legítima: é o usuário apagando todas as linhas.
    // "Este mês não tem orçamento" é uma decisão como outra qualquer.
    it("aceita a lista vazia", () => {
        expect(allocationBody("2026-10", [])).toEqual({
            body: { ReferenceMonth: "2026-10", Lines: [] },
        });
    });

    it("recusa a linha com valor e sem alvo nenhum", () => {
        const result = allocationBody("2026-10", [{ id: null, secondaryId: null, value: 300 }]);

        expect(result).toEqual({
            error: "Toda linha precisa de uma pessoa, uma categoria, ou as duas.",
        });
    });

    it("recusa a linha com alvo e sem valor", () => {
        const result = allocationBody("2026-10", [aBudgetLine({ value: null })]);

        expect(result).toEqual({
            error: "Toda linha do rateio precisa de um valor maior que zero.",
        });
    });

    // Valor zero é não ter a fatia, e isso se faz tirando a linha.
    it("recusa o valor zero", () => {
        expect(allocationBody("2026-10", [aBudgetLine({ value: 0 })])).toEqual({
            error: "Toda linha do rateio precisa de um valor maior que zero.",
        });
    });

    // A API responde 406 a isto; a conferência aqui é para a frase
    // chegar antes de o clique custar uma requisição.
    it("recusa duas linhas para o mesmo alvo", () => {
        const result = allocationBody("2026-10", [
            aBudgetLine({ id: 7, secondaryId: 4, value: 100 }),
            aBudgetLine({ id: 7, secondaryId: 4, value: 200 }),
        ]);

        expect(result).toEqual({
            error: "Há duas linhas para o mesmo alvo. Some os valores numa linha só.",
        });
    });

    // "Mercado" e "Luana em Mercado" são fatias DIFERENTES do mesmo mês:
    // a segunda não é um teto dentro da primeira, as duas somam lado a
    // lado. Comparar só a categoria recusaria uma chamada válida.
    it("não confunde a categoria pura com o alvo duplo da mesma categoria", () => {
        const result = allocationBody("2026-10", [
            aBudgetLine({ id: null, secondaryId: 4, value: 500 }),
            aBudgetLine({ id: 7, secondaryId: 4, value: 100 }),
        ]);

        expect("body" in result).toBe(true);
    });

    // **O rateio do orçamento não fecha com a renda, e não tem que
    // fechar**: sobrar é o que ainda não foi orçado, e estourar é
    // decisão de quem orça. É a diferença com os dois eixos do gasto,
    // em que não fechar é 406 na certa.
    it("não tem nada a dizer sobre a soma das linhas", () => {
        const sobra = allocationBody("2026-10", [aBudgetLine({ value: 1 })]);
        const estouro = allocationBody("2026-10", [aBudgetLine({ value: 999999 })]);

        expect("body" in sobra).toBe(true);
        expect("body" in estouro).toBe(true);
    });
});

describe("saveAllocation", () => {
    it("grava o mês inteiro numa requisição só", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/BudgetPeriods/allocate", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok", IdBudgetPeriods: [1, 2] });
            }),
        );

        const finishSubmit = vi.fn();

        await saveAllocation(
            fakeBudgetContext({
                finishSubmit,
                lines: [
                    aBudgetLine({ secondaryId: 4, value: 500 }),
                    aBudgetLine({ id: 7, secondaryId: null, value: 250 }),
                ],
            }),
        );

        expect(body).toEqual({
            ReferenceMonth: "2026-10",
            Lines: [
                { IdCategory: 4, LimitValue: 500 },
                { IdPerson: 7, LimitValue: 250 },
            ],
        });
        expect(finishSubmit).toHaveBeenCalledWith("Rateio salvo: 2 fatias.");
    });

    it("avisa quando o mês ficou sem orçamento nenhum", async () => {
        server.use(
            msw.post("*/api/BudgetPeriods/allocate", () =>
                HttpResponse.json({ msg: "ok", IdBudgetPeriods: [] }),
            ),
        );

        const finishSubmit = vi.fn();

        await saveAllocation(fakeBudgetContext({ finishSubmit, lines: [] }));

        expect(finishSubmit).toHaveBeenCalledWith("Este mês ficou sem orçamento.");
    });

    // A recusa da tela não chega a custar uma requisição: sem handler
    // declarado, uma chamada ao servidor quebraria o teste — que é
    // exatamente o que se quer provar aqui.
    it("não chama a API quando a linha está meio preenchida", async () => {
        const failSubmit = vi.fn();
        const beginSubmit = vi.fn();

        await saveAllocation(
            fakeBudgetContext({
                failSubmit,
                beginSubmit,
                lines: [aBudgetLine({ value: null })],
            }),
        );

        expect(beginSubmit).not.toHaveBeenCalled();
        expect(failSubmit).toHaveBeenCalledWith(
            "Toda linha do rateio precisa de um valor maior que zero.",
        );
    });

    // Mês FECHADO é 403 desde a etapa 9, e a frase é a da API: o papel
    // está certo, o que falta é o mês estar aberto.
    it("sobe a mensagem da API no mês fechado", async () => {
        server.use(
            msw.post("*/api/BudgetPeriods/allocate", () =>
                HttpResponse.json(
                    { msg: "Este mês já foi fechado e não aceita mais alterações no orçamento." },
                    { status: 403 },
                ),
            ),
        );

        const failSubmit = vi.fn();

        await saveAllocation(fakeBudgetContext({ failSubmit }));

        expect(failSubmit).toHaveBeenCalledWith(
            "Este mês já foi fechado e não aceita mais alterações no orçamento.",
        );
    });
});
