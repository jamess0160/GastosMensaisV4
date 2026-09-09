import { errorMessage } from "@/api/client";
import { downloadSpreadsheet } from "@/app/exportSpreadsheet";
import type { ReportContext } from "../controller";

/** Exportar o período QUE ESTÁ NA TELA.
 *
 *  É o que separa este caminho do item da sidebar, que exporta o
 *  histórico inteiro: aqui já existe um seletor de período, e ele é a
 *  resposta — o botão não abre um segundo.
 *
 *  Um período grande não volta instantâneo, e é por isso que o evento
 *  tem começo e fim declarados: sem o "Exportando…", o usuário clica de
 *  novo achando que o primeiro toque não pegou.
 *
 *  Nada de planilha montada aqui. O `.xlsx` vem pronto do servidor, que
 *  lê os números do mesmo lugar que esta tela — montá-lo no navegador
 *  replicaria as regras de agregação, e a planilha passaria a discordar
 *  do gráfico que está ao lado dela. */
export async function exportSpreadsheet(context: ReportContext): Promise<void> {
    context.beginExport();

    try {
        await downloadSpreadsheet(context.range);
        context.finishExport();
    } catch (cause) {
        context.failExport(errorMessage(cause));
    }
}
