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
}

export const ReportsConnection = new Connection();
