import { exportSpreadsheet } from "./sections/exportSpreadsheet";
import type { ExportRange } from "@/app/exportSpreadsheet";

/** O que a tela entrega aos eventos.
 *
 *  O Relatório passou a ter UM evento — antes ele era leitura e filtro
 *  puros. `range` é o período que está na tela, e é ele que separa este
 *  caminho de exportação do item da sidebar, que baixa o histórico
 *  inteiro. */
export interface ReportContext {
    range: ExportRange;
    /** Entra em "exportando" e limpa o erro anterior. */
    beginExport(): void;
    failExport(message: string): void;
    finishExport(): void;
}

/** Só DECLARA os eventos da tela — o corpo de cada um vive em
 *  ./sections, um arquivo por evento. */
class Controller {
    readonly exportSpreadsheet = exportSpreadsheet;
}

export const ReportController = new Controller();
