import { errorMessage } from "@/api/client";
import { PersonsConnection } from "@/api/Persons.connection";
import type { SettingsContext } from "../controller";

/** Arquivar uma pessoa.
 *
 *  A API recusa (406) a pessoa vinculada a um login (`IdUser`
 *  preenchido): o vínculo não pode ser reconstruído por rota nenhuma, e
 *  arquivar tiraria esse usuário de todo rateio futuro para sempre. A
 *  tela esconde a ação nesse caso — este caminho existe para o que
 *  escapar. */
export async function archivePerson(context: SettingsContext, idPerson: number): Promise<void> {
    context.beginSubmit();

    try {
        await PersonsConnection.archive(idPerson);
        context.finishSubmit("Pessoa arquivada.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
