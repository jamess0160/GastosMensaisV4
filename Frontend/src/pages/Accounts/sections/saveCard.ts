import { errorMessage } from "@/api/client";
import { PaymentMethodsConnection } from "@/api/PaymentMethods.connection";
import {
    cardCycleFromDates,
    checkCardCycle,
    closingDaysLabel,
    MAX_CLOSING_OFFSET_DAYS,
    MIN_CLOSING_OFFSET_DAYS,
} from "@/lib/card";
import { currentMonth, formatDate } from "@/lib/date";
import type { AccountsContext } from "../controller";

/** Criar ou editar um cartão de crédito.
 *
 *  O POST só aceita `credit_card`: pix e débito nascem com a conta e não
 *  se criam pela mão — por isso a tela nem oferece escolher o tipo.
 *
 *  No PUT, `Kind` e `IdAccount` NÃO são aceitos: um pix não vira cartão
 *  e um cartão não muda de conta. As duas trocas reescreveriam o
 *  significado de todas as compras já lançadas nele. É por isso que o
 *  corpo do PUT abaixo é menor que o do POST, e não por esquecimento.
 *
 *  Bandeira e final do cartão SAÍRAM (pendência 16): não entram em
 *  regra nenhuma do sistema, e "últimos 4 dígitos" é dado de cartão
 *  guardado à toa. Não há leitura defensiva nem campo legado — o banco
 *  é ajustado junto.
 *
 *  O CICLO DA FATURA. A tela pergunta duas datas — quando a última
 *  fatura fechou e quando ela venceu —, e o que a API guarda é o par
 *  `DueDay` + `ClosingOffsetDays`: o dia do vencimento e quantos dias
 *  antes dele a fatura fecha. A conversão é a de `src/lib/card.ts`.
 *  Mandar `null` em qualquer um dos dois no PUT responde 406, daí a
 *  conferência local antes. Eles não são detalhe: em cartão, um dia de
 *  diferença na compra vira um mês de diferença no caixa.
 *
 *  O `CompetenceMode` vai nos DOIS corpos, sempre. Ele tem default
 *  `purchase` no servidor, então omiti-lo no POST daria no mesmo — mas
 *  aqui a tela PERGUNTA, e o que ela pergunta ela manda. No PUT ele é
 *  opcional e omiti-lo manteria o valor, o que também não serve: o
 *  seletor existe para trocar.
 *
 *  E A FOLGA NÃO É ACEITA EM SILÊNCIO. Fechamento por dias corridos e
 *  fechamento em dia fixo do mês são descrições diferentes do mesmo
 *  cartão, e elas discordam por um dia sempre que a subtração atravessa
 *  a virada do mês (fecha 27 e vence 04: agosto tem 8 dias de folga,
 *  setembro tem 7). Quem digita as duas datas de UM mês grava a folga
 *  daquele mês. Trocar o modelo é migration mais recomputação de perna
 *  gravada, e não cabe aqui — o que cabe é avisar: o primeiro envio é
 *  recusado com a divergência escrita, e o segundo salva. A tela já mostra o
 *  mesmo em `CycleHint`, antes de qualquer clique.
 *
 *  E TROCAR O MODO VALE PARA O FUTURO. `ClosingDate`, `DueDate`,
 *  `CompetenceDate` e `CashDate` são congeladas na perna no lançamento e
 *  ninguém as revisita: virar a chave em novembro não reescreve agosto —
 *  a alternativa seria mês fechado mudando de número sozinho. É a mesma
 *  regra que já valia para o vencimento e a folga. */
export async function saveCard(context: AccountsContext): Promise<void> {
    const draft = context.cardDraft;
    if (!draft) return;

    if (!draft.Name.trim()) {
        context.failSubmit("Informe o nome do cartão.");
        return;
    }
    if (!draft.ClosingDate || !draft.DueDate) {
        context.failSubmit("Informe o fechamento e o vencimento da última fatura.");
        return;
    }

    const cycle = cardCycleFromDates(draft.ClosingDate, draft.DueDate);

    if (cycle.ClosingOffsetDays < MIN_CLOSING_OFFSET_DAYS) {
        context.failSubmit("A fatura tem que fechar antes de vencer.");
        return;
    }
    if (cycle.ClosingOffsetDays > MAX_CLOSING_OFFSET_DAYS) {
        context.failSubmit(
            `O fechamento precisa cair entre ${MIN_CLOSING_OFFSET_DAYS} e ${MAX_CLOSING_OFFSET_DAYS} dias antes do vencimento.`,
        );
        return;
    }

    /*  O aviso do ciclo: uma vez, com o caso concreto, e só depois o
        salvamento. `cycleAcknowledged` volta a `false` a cada troca de
        data no formulário, então o aviso reaparece para um par novo. */
    const check = checkCardCycle(draft.ClosingDate, draft.DueDate, currentMonth());

    if (check.drifts && !draft.cycleAcknowledged) {
        context.acknowledgeCycleDrift();
        context.failSubmit(
            `Confira: com essas datas, a fatura que vence em ${formatDate(check.due)} fecha em ` +
                `${formatDate(check.closing)}. A folga conta dias corridos, então o fechamento cai ` +
                `${closingDaysLabel(check.closingDays)} conforme o mês, e você leu o dia ` +
                `${check.typedClosingDay}. Se estiver certo, salve de novo.`,
        );
        return;
    }

    context.beginSubmit();

    const common = {
        Name: draft.Name.trim(),
        ...cycle,
        CompetenceMode: draft.CompetenceMode,
        Color: draft.Color,
    };

    try {
        if (draft.IdPaymentMethod === null) {
            await PaymentMethodsConnection.createCreditCard({
                IdAccount: draft.IdAccount,
                Kind: "credit_card",
                ...common,
            });
            context.finishSubmit("Cartão criado.");
        } else {
            // Sem `Kind` e sem `IdAccount`: a API não os aceita aqui.
            await PaymentMethodsConnection.update(draft.IdPaymentMethod, common);
            context.finishSubmit(
                "Cartão atualizado — vale para o que vier daqui em diante; as compras já lançadas não mudam de mês.",
            );
        }
        context.closeCardForm();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
