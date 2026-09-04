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

const aDetail = (overrides: Partial<ApiTypes.InflowDetail> = {}): ApiTypes.InflowDetail => ({
    ...anInflow(),
    Persons: [],
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
        const body = cloneBody(aDetail());

        expect(body.CompetenceDate).toBe("2026-09-05");
        expect(body.ExpectedDate).toBe("2026-09-05");
    });

    it("apara o dia no mês curto — 31/01 vira 28/02, nunca 03/03", () => {
        const body = cloneBody(aDetail({ CompetenceDate: "2026-01-31", ExpectedDate: null }));

        expect(body.CompetenceDate).toBe("2026-02-28");
        expect(body.ExpectedDate).toBeNull();
    });

    it("nunca manda Status — a cópia nasce em aberto, e só o receive move saldo", () => {
        expect(cloneBody(aDetail())).not.toHaveProperty("Status");
    });

    it("leva o rateio, que é a parte cara de redigitar", () => {
        const body = cloneBody(
            aDetail({
                Persons: [
                    {
                        IdInflowPerson: 9,
                        IdWorkspace: 1,
                        IdInflow: 1,
                        IdPerson: 4,
                        Value: 6200,
                        CreatedAt: "2026-08-01T10:00:00Z",
                        UpdatedAt: "2026-08-01T10:00:00Z",
                    },
                ],
            }),
        );

        expect(body.Persons).toEqual([{ IdPerson: 4, Value: 6200 }]);
    });

    it("omite Persons quando não há rateio, em vez de mandar lista vazia", () => {
        expect(cloneBody(aDetail())).not.toHaveProperty("Persons");
    });
});

describe("cloneMonth", () => {
    it("grava tudo numa chamada só — é o que impede o mês pela metade", async () => {
        const seen: { body?: { Inflows: unknown[] } } = {};
        server.use(
            msw.get("*/api/Inflows/IdInflow=:id", ({ params }) =>
                HttpResponse.json(aDetail({ IdInflow: Number(params.id) })),
            ),
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

    it("mostra o erro da API — a rota em lote ainda é pendência", async () => {
        server.use(
            msw.get("*/api/Inflows/IdInflow=:id", () => HttpResponse.json(aDetail())),
            msw.post("*/api/Inflows/batch", () =>
                HttpResponse.json({ msg: "Rota não encontrada" }, { status: 404 }),
            ),
        );
        const context = fakeIncomeContext();

        await cloneMonth(context, [anInflow()]);

        expect(context.failSubmit).toHaveBeenCalledOnce();
        expect(context.closeCloneMonth).not.toHaveBeenCalled();
    });
});
