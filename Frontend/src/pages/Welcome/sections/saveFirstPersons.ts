import { errorMessage } from "@/api/client";
import { PersonsConnection } from "@/api/Persons.connection";
import type { WelcomeContext } from "../controller";

/** Passo 3 — quem divide o custo.
 *
 *  Uma pessoa por linha, e **uma requisição por pessoa**: não existe
 *  `POST /Persons/batch`, e inventar aqui um laço que finge ser
 *  transaction seria mentir sobre o que a API garante.
 *
 *  Então a falha no meio da fila é o caso a tratar, e não o improvável:
 *  se a terceira de cinco for recusada (nome já usado no espaço, mesmo
 *  arquivado e ignorando caixa, responde 406), as duas primeiras JÁ
 *  EXISTEM. Por isso o rascunho é reescrito com o que ainda não passou —
 *  sem isso, tentar de novo recriaria as duas e a segunda tentativa
 *  morreria no mesmo 406, prendendo o passo para sempre.
 *
 *  Só `Name` viaja: `IdUser` não é aceito de propósito — é único no
 *  banco inteiro, e aceitá-lo do cliente consumiria a vaga de outro
 *  usuário.
 *
 *  Passo OPCIONAL: quem gasta sozinho pula, e pular não escreve nada. */
export async function saveFirstPersons(context: WelcomeContext): Promise<void> {
    const names = context.personsDraft.names.map((name) => name.trim()).filter(Boolean);

    if (names.length === 0) {
        context.failSubmit("Escreva ao menos um nome, ou pule este passo.");
        return;
    }

    context.beginSubmit();

    /* A fila do que ainda falta criar. Ela encolhe a cada sucesso, e o
       que sobrar numa recusa é exatamente o que não foi gravado. */
    const pending = [...names];

    while (pending.length > 0) {
        try {
            await PersonsConnection.create(pending[0]);
        } catch (cause) {
            context.setPersonNames(pending);
            context.failSubmit(errorMessage(cause));
            return;
        }
        pending.shift();
    }

    context.finishStep();
}
