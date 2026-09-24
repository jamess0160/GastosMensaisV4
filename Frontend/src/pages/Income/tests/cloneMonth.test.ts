import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { cloneBody, clonable, cloneMonth } from "../sections/cloneMonth";
import { fakeIncomeContext } from "./context";
import type { ApiTypes } from "@/types/api";

const anInflow = (overrides: Partial<ApiTypes.Inflow> = {}): ApiTypes.Inflow => ({
    IdInflow: 1,
    IdWorkspace: 1,
    IdUser: 1,
    Description: "Salário",
    TotalValue: 6200,
    Status: "received",
    Kind: "inflow",
    IdFromAccount: null,
    IdToAccount: 3,
    CompetenceDate: "2026-08-05",
    ExpectedDate: "2026-08-05",
    ReceivedAt: null,
    Notes: null,
    CreatedAt: "2026-08-01T10:00:00Z",
    UpdatedAt: "2026-08-01T10:00:00Z",
    ...overrides,
});

describe("clonable", () => {
    it("deixa de fora a transferência", () => {
        const rows = [anInflow(), anInflow({ IdInflow: 2, Kind: "transfer", IdFromAccount: 1 })];

        expect(clonable(rows).map((row) => row.IdInflow)).toEqual([1]);
    });

    it("deixa de fora a cancelada", () => {
        const rows = [anInflow(), anInflow({ IdInflow: 2, Status: "canceled" })];

        expect(clonable(rows).map((row) => row.IdInflow)).toEqual([1]);
    });
});

describe("cloneBody", () => {
    it("avança as duas datas um mês", () => {
        const body = cloneBody(anInflow());

        expect(body.CompetenceDate).toBe("2026-09-05");
        expect(body.ExpectedDate).toBe("2026-09-05");
    });

    it("apara o dia no mês curto — 31/01 vira 28/02, nunca 03/03", () => {
        const body = cloneBody(anInflow({ CompetenceDate: "2026-01-31", ExpectedDate: null }));

        expect(body.CompetenceDate).toBe("2026-02-28");
        expect(body.ExpectedDate).toBeNull();
    });

    it("nunca manda Status — a cópia nasce em aberto, e só o receive move saldo", () => {
        expect(cloneBody(anInflow())).not.toHaveProperty("Status");
    });

    //  A entrada não tem mais rateio: o corpo da cópia sai da LINHA DA
    //  LISTA, e é isso que tirou um `GET /Inflows/:id` por escolhida
    it("monta o corpo a partir da linha da lista, sem Persons", () => {
        expect(cloneBody(anInflow())).not.toHaveProperty("Persons");
    });
});

describe("cloneMonth", () => {
    //  UMA requisição, e ela é a gravação. Não há handler de
    //  `GET /Inflows/:id` declarado de propósito: requisição sem handler
    //  QUEBRA o teste (ver src/test/server.ts), e é assim que este
    //  arquivo trava que o clone não busca detalhe por entrada escolhida
    it("grava tudo numa chamada só — é o que impede o mês pela metade", async () => {
        const seen: { body?: { Inflows: unknown[] } } = {};
        server.use(
            msw.post("*/api/Inflows/batch", async ({ request }) => {
                seen.body = (await request.json()) as { Inflows: unknown[] };
                return HttpResponse.json({ msg: "2 entradas criadas", IdInflows: [10, 11] });
            }),
        );
        const context = fakeIncomeContext();

        await cloneMonth(context, [anInflow(), anInflow({ IdInflow: 2 })]);

        expect(seen.body?.Inflows).toHaveLength(2);
        expect(context.closeCloneMonth).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledOnce();
    });

    it("recusa a lista vazia sem chamar a API", async () => {
        const context = fakeIncomeContext();

        await cloneMonth(context, []);

        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledOnce();
    });

    it("mostra o erro do ITEM que derrubou o lote — ele é tudo ou nada", async () => {
        // Um item recusado não grava nenhum, e a `msg` diz qual foi,
        // contando a partir de 1. É essa linha que o formulário destaca.
        server.use(
            msw.post("*/api/Inflows/batch", () =>
                HttpResponse.json(
                    { msg: "Item 2: O valor precisa ser maior que zero." },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeIncomeContext();

        await cloneMonth(context, [anInflow(), anInflow({ IdInflow: 2 })]);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Item 2: O valor precisa ser maior que zero.",
        );
        expect(context.closeCloneMonth).not.toHaveBeenCalled();
    });
});
