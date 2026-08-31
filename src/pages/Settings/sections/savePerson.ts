import { errorMessage } from "@/api/client";
import { PersonsConnection } from "@/api/Persons.connection";
import type { SettingsContext } from "../controller";

/** Criar ou renomear uma pessoa.
 *
 *  Só `Name` vai: `IdUser` não é aceito de propósito — é único no banco
 *  inteiro, e aceitá-lo do cliente consumiria a vaga de outro usuário.
 *
 *  Nome já usado no workspace responde 406, e a comparação ignora
 *  maiúsculas E alcança as arquivadas: "Luana" colide com uma "luana"
 *  que foi arquivada mês passado. A `msg` explica isso melhor do que
 *  qualquer conferência local conseguiria, então ela vai como veio. */
export async function savePerson(context: SettingsContext): Promise<void> {
    const draft = context.personDraft;

    if (!draft.Name.trim()) {
        context.failSubmit("Informe o nome da pessoa.");
        return;
    }

    context.beginSubmit();

    try {
        if (draft.IdPerson === null) {
            await PersonsConnection.create(draft.Name.trim());
            context.finishSubmit("Pessoa criada.");
        } else {
            await PersonsConnection.update(draft.IdPerson, draft.Name.trim());
            context.finishSubmit("Pessoa atualizada.");
        }
        context.resetPersonDraft();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
