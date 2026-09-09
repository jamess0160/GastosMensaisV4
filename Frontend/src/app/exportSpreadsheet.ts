import { useState } from "react";
import { errorMessage } from "@/api/client";
import { ReportsConnection } from "@/api/Reports.connection";
import { filenameFromDisposition, saveBlob } from "@/lib/download";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   A exportação mora no CHASSI, e não numa tela — porque ela sai de
   dois lugares com dois significados:

     sidebar / menu do mobile  →  o histórico INTEIRO (sem From/To)
     botão do Relatório        →  o período que está NA TELA

   E nenhum dos dois abre um segundo seletor de período. Um item de
   menu global não tem período, e inventar um modal só para perguntá-lo
   duplicaria o seletor que o Relatório já tem: quem quer recortar vai
   ao Relatório, onde recortar é a tela.

   Isto aqui é o corpo compartilhado pelos dois caminhos. A section do
   Relatório o chama com o período; a sidebar, sem nada.
   ════════════════════════════════════════════════════════════ */

export interface ExportRange {
    From: ApiTypes.CalendarDate;
    To: ApiTypes.CalendarDate;
}

/** Baixa a planilha. Sem `range`, o histórico inteiro. */
export async function downloadSpreadsheet(range?: ExportRange): Promise<void> {
    const { blob, disposition } = await ReportsConnection.exportXlsx(range);

    /* O nome vem do servidor, que já sabe o período — montar um aqui a
       partir dos mesmos filtros é criar a segunda fonte do mesmo nome. */
    const fallback = range
        ? `Gastos Mensais - ${range.From} a ${range.To}.xlsx`
        : "Gastos Mensais - completo.xlsx";

    saveBlob(blob, filenameFromDisposition(disposition, fallback));
}

/** O botão de exportar da sidebar e do menu do mobile.
 *
 *  Um histórico inteiro não volta instantâneo, então o estado de
 *  "exportando" é parte da feature, não enfeite: sem ele o usuário
 *  clica de novo achando que não pegou. O erro aparece onde o botão
 *  está — a `msg` do 406 já chega pronta. */
export function useExportSpreadsheet(): {
    exporting: boolean;
    error: string | null;
    run: (range?: ExportRange) => void;
} {
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    return {
        exporting,
        error,
        run(range) {
            if (exporting) return;

            setExporting(true);
            setError(null);

            void (async () => {
                try {
                    await downloadSpreadsheet(range);
                } catch (cause) {
                    setError(errorMessage(cause));
                } finally {
                    setExporting(false);
                }
            })();
        },
    };
}
