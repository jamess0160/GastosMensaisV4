import type { InvoiceContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Anda um ciclo para trás (`-1`) ou para a frente (`+1`).
 *
 *  **A navegação é por CICLO, e é ela que tira a fatura do seletor de
 *  mês do chassi.** A fatura vai de fechamento a fechamento e quase
 *  nunca cabe num mês civil — empurrá-la para o seletor global é o que
 *  fazia "e a fatura passada?" custar trocar junto o Início, os Gastos e
 *  o Relatório, três telas que a pergunta não tinha por que mexer.
 *
 *  Quem sabe qual é o vencimento vizinho é a API, não esta tela: ele sai
 *  do `PreviousDueDate`/`NextDueDate` da resposta, calculados sobre as
 *  mesmas datas que o servidor gravou em cada perna. Uma aritmética de
 *  ciclo aqui seria a segunda cópia da regra, e ela discordaria
 *  justamente no dia do fechamento — a fatura viria vazia sem nada
 *  acusar.
 *
 *  **Na ponta, não anda.** A seta já está desabilitada nesse caso; este
 *  `return` é o cinto — sem ele um `null` vindo daqui seria lido como
 *  "a aberta", e a seta da ponta teleportaria o usuário para outro
 *  ciclo. */
export function goToCycle(
    context: InvoiceContext,
    invoice: ApiTypes.Invoice,
    direction: -1 | 1,
): void {
    const target = direction === -1 ? invoice.PreviousDueDate : invoice.NextDueDate;

    if (target === null) return;

    goToDue(context, target, invoice.OpenDueDate);
}

/** Vai para um vencimento nomeado — a seta, e também o rodapé das
 *  próximas faturas, que é o outro lugar de onde se salta para um ciclo.
 *
 *  **Chegando na fatura ABERTA, o que se guarda é `null`**, o mesmo
 *  estado do botão "a aberta". Não é detalhe de estado: `null` é a
 *  requisição SEM `DueDate`, que é a que pergunta ao servidor qual
 *  fatura está aberta hoje. Guardar a data literal criaria uma segunda
 *  entrada de cache para a mesma fatura e, pior, congelaria "a aberta"
 *  no vencimento de hoje — quem deixasse a tela aberta na virada do
 *  ciclo continuaria vendo a fatura antiga sob o rótulo de aberta. */
export function goToDue(
    context: InvoiceContext,
    due: ApiTypes.CalendarDate,
    openDueDate: ApiTypes.CalendarDate,
): void {
    context.showCycle(due === openDueDate ? null : due);
}

/** O atalho do meio da navegação: volta para a fatura que está aberta.
 *
 *  Sempre `null`, nunca o `OpenDueDate` que a resposta traz: é a
 *  ausência do `DueDate` na requisição que faz o servidor responder
 *  "a de hoje" — ver acima. */
export function goToOpenCycle(context: InvoiceContext): void {
    context.showCycle(null);
}
