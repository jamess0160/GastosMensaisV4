import { vi } from "vitest";
import type { InvoiceContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Uma fatura de mentira, no cartão que motivou a leva 9: fecha 27 e
 *  vence 04, ou seja `ClosingDay > DueDay` e a fatura é cobrada no mês
 *  SEGUINTE ao que ela fechou. É o par que o modelo da folga não
 *  descrevia em todos os meses. */
export const anInvoice = (overrides: Partial<ApiTypes.Invoice> = {}): ApiTypes.Invoice => ({
    IdPaymentMethod: 7,
    IdAccount: 1,
    Name: "Cartão Roxo",
    CompetenceMode: "purchase",
    DueDate: "2026-10-04",
    ClosingDate: "2026-09-27",
    CycleStart: "2026-08-28",
    CycleEnd: "2026-09-27",
    Status: "open",
    Total: 0,
    Entries: [],
    Expected: [],
    PreviousDueDate: "2026-09-04",
    NextDueDate: "2026-11-04",
    OpenDueDate: "2026-10-04",
    Upcoming: [],
    ...overrides,
});

/** Contexto de mentira para as sections da fatura. */
export function fakeInvoiceContext(overrides: Partial<InvoiceContext> = {}): InvoiceContext {
    return {
        due: null,
        showCycle: vi.fn(),
        ...overrides,
    };
}
