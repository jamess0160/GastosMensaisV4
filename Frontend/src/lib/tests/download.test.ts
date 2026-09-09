import { describe, expect, it } from "vitest";
import { filenameFromDisposition } from "../download";

/* O nome do arquivo vem do SERVIDOR: ele já sabe o período exportado, e
   montar um aqui a partir dos mesmos filtros é criar a segunda fonte do
   mesmo nome — a que diverge quando um dos dois lados muda. */

const fallback = "Gastos Mensais - completo.xlsx";

describe("filenameFromDisposition", () => {
    it("lê o nome entre aspas do cabeçalho", () => {
        expect(
            filenameFromDisposition(
                'attachment; filename="Gastos Mensais - 2026-08-01 a 2026-08-31.xlsx"',
                fallback,
            ),
        ).toBe("Gastos Mensais - 2026-08-01 a 2026-08-31.xlsx");
    });

    it("lê o nome sem aspas", () => {
        expect(filenameFromDisposition("attachment; filename=relatorio.xlsx", fallback)).toBe(
            "relatorio.xlsx",
        );
    });

    // A forma da RFC 6266, que é como um nome com acento viaja.
    it("prefere o filename* e o decodifica", () => {
        expect(
            filenameFromDisposition(
                "attachment; filename=\"fallback.xlsx\"; filename*=UTF-8''Rela%C3%A7%C3%A3o.xlsx",
                fallback,
            ),
        ).toBe("Relação.xlsx");
    });

    it("usa o nosso nome quando o cabeçalho não vem", () => {
        expect(filenameFromDisposition(undefined, fallback)).toBe(fallback);
    });

    it("usa o nosso nome quando o cabeçalho não traz filename nenhum", () => {
        expect(filenameFromDisposition("attachment", fallback)).toBe(fallback);
    });
});
