import type { ExpensesContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Abre a FATURA a partir da tela de Gastos.
 *
 *  **O lugar do botão é a pergunta:** quem está olhando os gastos do mês
 *  é quem se pergunta quanto foi parar no cartão — e até a leva 9 essa
 *  pergunta só tinha resposta descendo por Contas → Extrato → rolar até
 *  o cartão, com o mês da aplicação inteira recortando a fatura no
 *  caminho.
 *
 *  **Com um cartão só, vai direto.** Uma escolha de um item é um clique
 *  que só tem uma saída possível — e a maioria das pessoas tem um cartão.
 *  Com mais de um não há como adivinhar: dois cartões são duas faturas
 *  diferentes, e abrir "a primeira" levaria a pessoa à fatura errada
 *  sem dizer que escolheu por ela.
 *
 *  A lista chega pronta de quem a filtrou — só cartão de crédito, só
 *  ativo —, porque quem desenha o botão é quem já sabe se há algum: sem
 *  cartão nenhum ele nem aparece. */
export function openInvoice(context: ExpensesContext, cards: ApiTypes.PaymentMethod[]): void {
    if (cards.length === 1) {
        context.openInvoiceFor(cards[0].IdPaymentMethod);
        return;
    }

    context.openCardChoice();
}
