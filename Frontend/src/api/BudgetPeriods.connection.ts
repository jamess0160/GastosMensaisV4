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
 *  **Mês fechado recusa escrita**: 403 em toda rota de escrita. É a trava
 *  que impede reescrever a história de agosto em novembro.
 *
 *  **Esta connection escreve o mês INTEIRO, nunca uma linha por vez.** A
 *  API continua tendo o `POST`, o `PUT` e o `DELETE` de uma fatia só —
 *  são a granularidade certa para a rota, e têm teste —, mas o cliente
 *  não os chama desde a leva 9: o gesto da tela do Orçamento é repartir a
 *  renda e salvar uma vez, e três métodos sem chamador aqui seriam três
 *  caminhos de escrita para manter alinhados com um que ninguém usa. */
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
     *  **Responde um ENVELOPE, não uma lista**: cada porção de gasto
     *  consome uma fatia ou nenhuma, e o `Unbudgeted` é o que não
     *  consumiu nenhuma — um número do MÊS, não de linha alguma. Sem ele
     *  a regra estrita seria um sumiço silencioso de dinheiro.
     *
     *  Uma fatia cujo alvo foi ARQUIVADO some da lista do mês — ela não
     *  tem mais o que mostrar. A linha continua no banco: arquivar não é
     *  apagar, e o mês é histórico. */
    async list(referenceMonth: ApiTypes.ReferenceMonth): Promise<ApiTypes.BudgetMonth> {
        const { data } = await http.get<ApiTypes.BudgetMonth>(this.route, {
            params: { ReferenceMonth: referenceMonth },
        });
        return data;
    }

    /** **O rateio do mês inteiro numa escrita só** — o gesto da tela do
     *  Orçamento: o usuário mexe em cinco linhas, apaga uma, cria outra, e
     *  clica em salvar UMA vez.
     *
     *  O corpo é **o mês depois da escrita**, não um lote de criações: o que
     *  está no banco e não está na lista é apagado, o que está nos dois é
     *  atualizado no lugar, e o que só está na lista é inserido — tudo numa
     *  transaction. Com `POST`, `PUT` e `DELETE` linha a linha, esse clique
     *  seriam sete requisições em sequência, e a quarta falhando deixaria o
     *  mês num rateio que ninguém escreveu.
     *
     *  **Nenhuma linha leva `IdBudgetPeriod`**: a identidade de uma fatia é o
     *  alvo. Uma linha que mudou de alvo não é um caso à parte — ela é uma
     *  remoção mais uma inserção, e o `Spent` não se perde porque ele é do
     *  mês e recalculado a cada leitura.
     *
     *  **O rateio não precisa fechar contra a renda**: sobrar é o normal e
     *  estourar é decisão de quem orça. A API não lê a renda para responder —
     *  o aviso é da tela, como o alerta do teto.
     *
     *  A resposta tem a forma do `clone`: os ids do mês depois da escrita, na
     *  ordem em que o corpo os mandou. */
    async allocate(body: ApiTypes.BudgetMonthAllocateBody): Promise<{
        msg: string;
        IdBudgetPeriods: number[];
    }> {
        const { data } = await http.post<{ msg: string; IdBudgetPeriods: number[] }>(
            `${this.route}/allocate`,
            body,
        );
        return data;
    }

    /** **Repete a repartição de um mês no outro** — `{ From, To }`, os
     *  dois "YYYY-MM".
     *
     *  É o desconto do preço que a leva 9 cobrou ao matar a rotina do dia
     *  1º: nada nasce sozinho, então um mês novo nasce vazio, e remontar
     *  em outubro as mesmas oito linhas de setembro, à mão, todo mês, é o
     *  trabalho repetido que faz a funcionalidade parar de ser usada no
     *  terceiro mês.
     *
     *  Três coisas ficam de fora da cópia, e o cliente não decide nenhuma
     *  delas:
     *
     *  - **o alvo que já existe no destino** — clonar duas vezes não
     *    duplica nem sobrescreve. O valor que já está no mês é uma decisão
     *    que alguém tomou;
     *  - **o alvo arquivado** — categoria ou pessoa que saiu das listas
     *    não volta pela porta dos fundos;
     *  - **nada**: o destino FECHADO recusa a rota inteira, com 403, antes
     *    de escrever uma linha.
     *
     *  A resposta tem a forma do lote da Renda, e a simetria é de
     *  propósito: `IdBudgetPeriods` é o que diz quantas linhas vieram e o
     *  que invalida o cache do mês certo. Vazio é resposta legítima — é o
     *  segundo clique num mês já clonado. */
    async clone(body: ApiTypes.BudgetMonthCloneBody): Promise<{
        msg: string;
        IdBudgetPeriods: number[];
    }> {
        const { data } = await http.post<{ msg: string; IdBudgetPeriods: number[] }>(
            `${this.route}/clone`,
            body,
        );
        return data;
    }
}

export const BudgetPeriodsConnection = new Connection();
