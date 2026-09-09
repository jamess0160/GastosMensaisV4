import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Reports` — a feature SEM TABELA PRÓPRIA.
 *
 *  Ela não guarda nada: chama as mesmas sections que `GET /Accounts` e
 *  `GET /Budgets` já usam e devolve o número somado. Existe porque as
 *  regras de agregação se contradizem de propósito, e enquanto elas
 *  moravam replicadas no cliente, duas implementações da mesma pergunta
 *  terminavam mostrando dois totais diferentes na mesma tela.
 *
 *  A consequência para quem lê daqui: **nenhum destes números se
 *  recalcula no cliente para conferir**. Se um deles divergir do da tela
 *  dele, é bug da API — e é lá que se conserta. */
class Connection {
    private readonly route = "/Reports";

    /** Os nove números do Início.
     *
     *  `ReferenceMonth` é opcional e o default é o mês corrente — mas a
     *  tela manda sempre o mês que está exibindo, pela mesma razão de
     *  `GET /Accounts`: omitir devolveria setembro enquanto o usuário
     *  olha março.
     *
     *  `Available` ("posso gastar") e `CurrentBalance` ("tenho em
     *  conta") vão discordar, e é a resposta certa: um é o mês que a
     *  pessoa está vivendo, o outro é o dinheiro que já saiu.
     *  `OpenInvoices` é a ponte entre os dois. Ver `ApiTypes.MonthReport`
     *  para a tabela inteira das regras. */
    async month(referenceMonth?: ApiTypes.ReferenceMonth): Promise<ApiTypes.MonthReport> {
        const params: ApiTypes.MonthReportQuery = referenceMonth
            ? { ReferenceMonth: referenceMonth }
            : {};
        const { data } = await http.get<ApiTypes.MonthReport>(`${this.route}/Month`, { params });
        return data;
    }

    /** O extrato do mês — a DECOMPOSIÇÃO do saldo, não uma consulta
     *  nova.
     *
     *  `OpeningBalance` + a soma das linhas = `ClosingBalance`, e esse
     *  `ClosingBalance` é o mesmo `Balance` que `GET /Accounts` devolve
     *  para o mês. Vale para esta rota a regra do cabeçalho: a tela
     *  EXIBE o fechamento que a API afirmou, e não o recalcula somando
     *  a coluna.
     *
     *  Como em `month`, o mês vai sempre, embora seja opcional na rota:
     *  omitir devolveria setembro enquanto o usuário olha março. */
    async statement(referenceMonth?: ApiTypes.ReferenceMonth): Promise<ApiTypes.StatementReport> {
        const params: ApiTypes.StatementQuery = referenceMonth
            ? { ReferenceMonth: referenceMonth }
            : {};
        const { data } = await http.get<ApiTypes.StatementReport>(`${this.route}/Statement`, {
            params,
        });
        return data;
    }

    /** A planilha do período — a ÚNICA rota do projeto que não responde
     *  JSON.
     *
     *  Quem monta o `.xlsx` é o servidor, e é a escolha certa: ele lê os
     *  números do mesmo lugar que a tela, então a planilha não pode
     *  discordar dela. Montar o arquivo no navegador replicaria as
     *  regras de agregação — o problema que criou a feature de Reports.
     *
     *  **Sem `From` e sem `To` sai o histórico inteiro.** É o
     *  comportamento da rota, não uma omissão daqui: é ele que faz o
     *  item de menu global funcionar sem um seletor de período próprio.
     *
     *  A resposta inteira volta, e não só o corpo: o nome do arquivo
     *  vive no `Content-Disposition`, e quem o traduz é
     *  `filenameFromDisposition`. */
    async exportXlsx(range?: { From: ApiTypes.CalendarDate; To: ApiTypes.CalendarDate }): Promise<{
        blob: Blob;
        disposition: string | undefined;
    }> {
        const response = await http.get<Blob>(`${this.route}/Export`, {
            params: range ?? {},
            /* Vale para o erro também: um 406 chega como `Blob`, e é por
               isso que o interceptor de `client.ts` desempacota o corpo
               antes de ler a `msg`. */
            responseType: "blob",
        });

        return {
            blob: response.data,
            disposition: response.headers["content-disposition"] as string | undefined,
        };
    }
}

export const ReportsConnection = new Connection();
