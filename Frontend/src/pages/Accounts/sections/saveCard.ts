import { errorMessage } from "@/api/client";
import { PaymentMethodsConnection } from "@/api/PaymentMethods.connection";
import { MAX_DAY_OF_MONTH, MIN_DAY_OF_MONTH } from "@/lib/card";
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
 *  O CICLO DA FATURA SÃO DOIS DIAS DO MÊS, e a tela pergunta exatamente
 *  os dois que estão escritos na fatura: em que dia ela fecha e em que
 *  dia ela vence. Não há mais conversão no caminho.
 *
 *  Até a leva 9 a tela pedia as duas DATAS da última fatura e derivava
 *  delas uma folga em dias. A folga errava por construção: `04/09 − 8` é
 *  27/08 e `04/10 − 8` é 26/09, o mesmo cartão com dois dias de
 *  fechamento, porque os meses têm tamanhos diferentes. Com isso a
 *  compra de 27/09 ia para a fatura de novembro em vez da de outubro —
 *  um dia de erro na descrição virando um mês de erro no caixa. Junto
 *  com a folga saiu o aviso de deriva que esta section dava antes de
 *  salvar: não há mais deriva sobre a qual avisar.
 *
 *  **NENHUM DOS DOIS TEM DEFAULT.** A folga tinha (7 dias), e ali o
 *  default era defensável porque uma folga se deduz do que o setor
 *  pratica; um dia do mês não se deduz de nada. Mandar `null` em
 *  qualquer um dos dois no PUT responde 406, daí a conferência local
 *  antes.
 *
 *  **A ORDEM ENTRE OS DOIS DIAS NÃO É ERRO.** `ClosingDay > DueDay` é o
 *  cartão que fecha no mês ANTERIOR ao do vencimento (fecha 27, vence
 *  04) e `ClosingDay <= DueDay` é o que fecha e vence no mesmo mês
 *  (fecha 05, vence 15). Os dois casos existem no mundo, então não há o
 *  que recusar aqui além do intervalo de 1 a 31.
 *
 *  O `CompetenceMode` vai nos DOIS corpos, sempre. Ele tem default
 *  `purchase` no servidor, então omiti-lo no POST daria no mesmo — mas
 *  aqui a tela PERGUNTA, e o que ela pergunta ela manda. No PUT ele é
 *  opcional e omiti-lo manteria o valor, o que também não serve: o
 *  seletor existe para trocar.
 *
 *  E TROCAR O CADASTRO VALE PARA O FUTURO. `ClosingDate`, `DueDate`,
 *  `CompetenceDate` e `CashDate` são congeladas na perna no lançamento e
 *  ninguém as revisita: virar a chave em novembro não reescreve agosto —
 *  a alternativa seria mês fechado mudando de número sozinho. */
export async function saveCard(context: AccountsContext): Promise<void> {
    const draft = context.cardDraft;
    if (!draft) return;

    if (!draft.Name.trim()) {
        context.failSubmit("Informe o nome do cartão.");
        return;
    }
    if (draft.ClosingDay === null || draft.DueDay === null) {
        context.failSubmit("Informe o dia em que a fatura fecha e o dia em que ela vence.");
        return;
    }
    if (!isDayOfMonth(draft.ClosingDay) || !isDayOfMonth(draft.DueDay)) {
        context.failSubmit(
            `Os dois dias têm que estar entre ${MIN_DAY_OF_MONTH} e ${MAX_DAY_OF_MONTH}.`,
        );
        return;
    }

    context.beginSubmit();

    const common = {
        Name: draft.Name.trim(),
        ClosingDay: draft.ClosingDay,
        DueDay: draft.DueDay,
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

const isDayOfMonth = (day: number): boolean =>
    Number.isInteger(day) && day >= MIN_DAY_OF_MONTH && day <= MAX_DAY_OF_MONTH;
