import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, readDraft, writeDraft } from "@/lib/draftStorage";

describe("draftStorage", () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it("guarda e devolve o rascunho", () => {
        writeDraft("expense.new", { Description: "Mercado", TotalValue: 600 });

        expect(readDraft("expense.new")).toEqual({ Description: "Mercado", TotalValue: 600 });
    });

    it("devolve null quando não há rascunho guardado", () => {
        expect(readDraft("expense.new")).toBeNull();
    });

    it("apaga o rascunho", () => {
        writeDraft("expense.new", { Description: "Mercado" });
        clearDraft("expense.new");

        expect(readDraft("expense.new")).toBeNull();
    });

    it("usa sessionStorage, não localStorage", () => {
        writeDraft("expense.new", { Description: "Mercado" });

        // Um rascunho é da sessão do navegador: ressuscitar o gasto de
        // três semanas atrás numa aba nova seria pior do que perdê-lo.
        expect(window.localStorage.getItem("gm.draft.expense.new")).toBeNull();
        expect(window.sessionStorage.getItem("gm.draft.expense.new")).not.toBeNull();
    });

    it("começa em branco quando o storage está bloqueado", () => {
        vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => {
            throw new Error("storage bloqueado");
        });

        // Navegador em modo restrito: o formulário abre vazio em vez de
        // quebrar na montagem.
        expect(readDraft("expense.new")).toBeNull();
    });

    it("não quebra quando não consegue guardar", () => {
        vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
            throw new Error("cota estourada");
        });

        expect(() => writeDraft("expense.new", { Description: "Mercado" })).not.toThrow();
    });

    it("começa em branco quando o que estava guardado não é JSON", () => {
        window.sessionStorage.setItem("gm.draft.expense.new", "{quebrado");

        expect(readDraft("expense.new")).toBeNull();
    });
});
