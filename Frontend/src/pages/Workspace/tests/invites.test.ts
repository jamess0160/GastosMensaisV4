import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { createInvite } from "../sections/createInvite";
import { revokeInvite } from "../sections/revokeInvite";
import { saveWorkspace } from "../sections/saveWorkspace";
import { anInviteDraft, fakeWorkspaceContext } from "./context";

describe("saveWorkspace", () => {
    it("edita o espaço da SESSÃO — não há id no caminho", async () => {
        let body: unknown;
        let path = "";
        server.use(
            msw.put("*/api/Workspaces", async ({ request }) => {
                body = await request.json();
                path = new URL(request.url).pathname;
                return HttpResponse.json({ msg: "Workspace atualizado com sucesso" });
            }),
        );
        const context = fakeWorkspaceContext();

        await saveWorkspace(context);

        expect(body).toEqual({ Name: "Casa" });
        expect(path).toMatch(/\/Workspaces$/);
        // O nome aparece no seletor da sidebar, em toda tela.
        expect(context.refreshWorkspaces).toHaveBeenCalledOnce();
    });

    it("recusa nome vazio sem gastar requisição", async () => {
        const context = fakeWorkspaceContext({ name: "   " });

        await saveWorkspace(context);

        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith("name", "Informe o nome do espaço.");
    });

    it("mostra a msg do servidor quando quem edita não é o dono", async () => {
        server.use(
            msw.put("*/api/Workspaces", () =>
                HttpResponse.json(
                    { msg: "Apenas o dono pode editar o workspace!" },
                    { status: 403 },
                ),
            ),
        );
        const context = fakeWorkspaceContext();

        await saveWorkspace(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "name",
            "Apenas o dono pode editar o workspace!",
        );
    });
});

describe("createInvite", () => {
    it("manda e-mail e papel, e nunca owner", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Workspaces/invite", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({
                    Hash: "Yk3s",
                    ExpiresAt: "2026-09-13T12:00:00.000Z",
                });
            }),
        );
        const context = fakeWorkspaceContext({
            inviteDraft: anInviteDraft({ Role: "viewer" }),
        });

        await createInvite(context);

        // Propriedade não se convida: `owner` é 406, e o tipo
        // `WorkspaceRole` nem deixa escrevê-lo.
        expect(body).toEqual({ Email: "alguem@exemplo.com", Role: "viewer" });
        expect(context.clearInviteDraft).toHaveBeenCalledOnce();
        expect(context.refreshInvites).toHaveBeenCalledOnce();
    });

    it("diz que o link é entregue pelo usuário — a API não manda e-mail", async () => {
        server.use(
            msw.post("*/api/Workspaces/invite", () =>
                HttpResponse.json({ Hash: "Yk3s", ExpiresAt: "2026-09-13T12:00:00.000Z" }),
            ),
        );
        const context = fakeWorkspaceContext();

        await createInvite(context);

        expect(context.finishSubmit).toHaveBeenCalledWith(
            "invite",
            expect.stringContaining("a API não envia e-mail"),
        );
    });

    it("recusa e-mail sem cara de e-mail sem gastar requisição", async () => {
        const context = fakeWorkspaceContext({ inviteDraft: anInviteDraft({ Email: "alguem" }) });

        await createInvite(context);

        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith(
            "invite",
            "Informe o e-mail de quem você quer convidar.",
        );
    });

    it("mostra a msg da API quando o convidado já é membro", async () => {
        server.use(
            msw.post("*/api/Workspaces/invite", () =>
                HttpResponse.json(
                    { msg: "Esta pessoa já é membro do workspace!" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeWorkspaceContext();

        await createInvite(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "invite",
            "Esta pessoa já é membro do workspace!",
        );
    });
});

describe("revokeInvite", () => {
    it("revoga e relê a lista", async () => {
        server.use(
            msw.delete("*/api/Workspaces/invite/IdWorkspaceInvite=3", () =>
                HttpResponse.json({ msg: "Convite revogado com sucesso" }),
            ),
        );
        const context = fakeWorkspaceContext();

        await revokeInvite(context, 3);

        expect(context.refreshInvites).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "invite",
            "Convite revogado — o link parou de funcionar.",
        );
    });

    it("mostra a msg quando o convite já não está pendente", async () => {
        server.use(
            msw.delete("*/api/Workspaces/invite/IdWorkspaceInvite=3", () =>
                HttpResponse.json({ msg: "Este convite não está mais pendente!" }, { status: 406 }),
            ),
        );
        const context = fakeWorkspaceContext();

        await revokeInvite(context, 3);

        expect(context.refreshInvites).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith(
            "invite",
            "Este convite não está mais pendente!",
        );
    });
});
