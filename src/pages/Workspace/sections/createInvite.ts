import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { WorkspaceContext } from "../controller";

/** Um e-mail plausível. A API valida de verdade e normaliza para
 *  minúsculas; isto aqui só evita gastar requisição com o que já se sabe
 *  errado — um "@" perdido, um campo em branco. */
const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Criar o convite.
 *
 *  **A API NÃO MANDA E-MAIL.** Ela devolve o `Hash` e a validade, e quem
 *  entrega o link é o usuário — por WhatsApp, na maioria das vezes. É
 *  por isso que a tela precisa mostrar o link e um botão de copiar: sem
 *  isso o convite existe no banco e não chega a ninguém.
 *
 *  Convidar o MESMO e-mail de novo RENOVA o convite pendente: hash e
 *  validade novos, e o hash anterior para de funcionar. Não nascem dois
 *  links — o que também quer dizer que um link já compartilhado morre
 *  quando se "reenvia" pela tela.
 *
 *  `Role: "owner"` é 406 — propriedade não se convida —, e o tipo
 *  `WorkspaceRole` já não deixa escrevê-lo. Só o `owner` do espaço
 *  convida: quem não é leva 403. */
export async function createInvite(context: WorkspaceContext): Promise<void> {
    const email = context.inviteDraft.Email.trim();

    if (!looksLikeEmail(email)) {
        context.failSubmit("invite", "Informe o e-mail de quem você quer convidar.");
        return;
    }

    context.beginSubmit("invite");

    try {
        await WorkspacesConnection.invite({ Email: email, Role: context.inviteDraft.Role });
        context.clearInviteDraft();
        context.refreshInvites();
        context.finishSubmit(
            "invite",
            `Convite criado para ${email}. Copie o link e mande para essa pessoa — a API não envia e-mail.`,
        );
    } catch (cause) {
        // 406 quando o e-mail já é membro; 403 quando quem chamou não é
        // dono do espaço. As duas mensagens vêm prontas do servidor.
        context.failSubmit("invite", errorMessage(cause));
    }
}
