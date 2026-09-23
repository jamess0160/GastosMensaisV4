import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/BudgetPeriods` — **o orçamento é uma repartição da renda de um mês**,
 *  e cada linha aqui é uma fatia dela.
 *
 *  A rota `/Budgets` deixou de existir junto com a tabela: o teto perene
 *  por alvo ("mercado: 800/mês, para sempre") e a rotina que o congelava
 *  no dia 1º acabaram. O mês não nasce mais sozinho — ele é montado —, e
 *  é isso que faz **qualquer mês** ser legível e editável: passado,
 *  corrente ou futuro, e outubro pode ser montado em setembro.
 *
 *  O alvo tem TRÊS formatos: só categoria, só pessoa, ou os dois juntos
 *  ("250 para o Tiago em alimentação"). As fatias **somam lado a lado**:
 *  "Luana 250" mais "Luana em Mercado 100" dão 350 para a Luana. Não há
 *  aninhamento, e a soma de todas as linhas é o quanto do mês foi
 *  alocado.
 *
 *  **Mês fechado recusa escrita** nas três rotas de escrita: 403. É a
 *  trava que impede reescrever a história de agosto em novembro. */
class Connection {
    private readonly route = "/BudgetPeriods";

    /** `ReferenceMonth` obrigatório, no formato "YYYY-MM" — aqui o mês É a
     *  unidade, ao contrário das listagens de movimento, que usam From/To.
     *  Na resposta ele volta como "YYYY-MM-01".
     *
     *  `Spent` soma PERNAS (600 em 6× custa 100 ao mês), usa a
     *  `CompetenceDate` e conta pendente junto com pago — ao contrário
     *  do saldo da conta. Numa fatia com pessoa ele ainda é rateado pela
     *  parcela, e pode vir NEGATIVO quando os estornos do mês superam as
     *  compras. O alerta é comparação do cliente: a resposta traz
     *  LimitValue, Spent e AlertPercent.
     *
     *  Uma fatia cujo alvo foi ARQUIVADO some da lista do mês — ela não
     *  tem mais o que mostrar. A linha continua no banco: arquivar não é
     *  apagar, e o mês é histórico. */
    async list(referenceMonth: ApiTypes.ReferenceMonth): Promise<ApiTypes.BudgetPeriod[]> {
        const { data } = await http.get<ApiTypes.BudgetPeriod[]>(this.route, {
            params: { ReferenceMonth: referenceMonth },
        });
        return data;
    }

    /** Uma fatia nova no mês. UMA escrita — não há mais definição para
     *  resolver antes. `Status` não é aceito: a linha nasce `open`.
     *
     *  `IdCategory` e `IdPerson` já NÃO são exclusivos: pelo menos um,
     *  possivelmente os dois. Sem nenhum é 406, e repetir o alvo INTEIRO
     *  no mesmo mês também — mas "Mercado" e "Maria em Mercado" são
     *  alvos diferentes e convivem. */
    async create(body: ApiTypes.BudgetPeriodCreateBody): Promise<{ IdBudgetPeriod: number }> {
        const { data } = await http.post<{ IdBudgetPeriod: number }>(this.route, body);
        return data;
    }

    /** `ReferenceMonth` e o alvo não são aceitos: mover a fatia de lugar
     *  é apagar esta e cadastrar outra. */
    async update(
        idBudgetPeriod: number,
        body: ApiTypes.BudgetPeriodUpdateBody,
    ): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(
            `${this.route}/IdBudgetPeriod=${idBudgetPeriod}`,
            body,
        );
        return data;
    }

    /** Delete FÍSICO — o único do projeto. Uma fatia é plano, não
     *  lançamento: nada aponta para ela e nenhum dinheiro passou por ali.
     *  E nada sobrevive a ela: não há mais definição perene por trás. */
    async remove(idBudgetPeriod: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/IdBudgetPeriod=${idBudgetPeriod}`,
        );
        return data;
    }
}

export const BudgetPeriodsConnection = new Connection();
