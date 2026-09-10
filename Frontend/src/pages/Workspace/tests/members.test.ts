import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { updateMemberRole } from "../sections/updateMemberRole";
import { aMember, fakeWorkspaceContext } from "./context";

describe("updateMemberRole", () => {
    it("endereça a MATRÍCULA e manda só o papel novo", async () => {
        let body: unknown;
        let path = "";
        server.use(
            msw.put("*/api/Workspaces/members/IdWorkspaceMember=7", async ({ request }) => {
                body = await request.json();
                path = new URL(request.url).pathname;
                return HttpResponse.json({ msg: "Papel atualizado com sucesso" });
            }),
        );
        const context = fakeWorkspaceContext();

        await updateMemberRole(context, aMember(), "editor");

        // A matrícula é do espaço e já nasce escopada; o IdUser é global,
        // e a lista de membros nem o traz.
        expect(path).toMatch(/IdWorkspaceMember=7$/);
        expect(body).toEqual({ Role: "editor" });
        // Relê a lista: um papel velho na tela é exatamente o que não
        // pode acontecer aqui.
        expect(context.refreshMembers).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "members",
            "Ana agora pode lançar e editar.",
        );
    });

    it("rebaixa para viewer e diz o que a pessoa passou a poder", async () => {
        server.use(
            msw.put("*/api/Workspaces/members/IdWorkspaceMember=7", () =>
                HttpResponse.json({ msg: "Papel atualizado com sucesso" }),
            ),
        );
        const context = fakeWorkspaceContext();

        await updateMemberRole(context, aMember({ Role: "editor" }), "viewer");

        expect(context.finishSubmit).toHaveBeenCalledWith("members", "Ana agora só consulta.");
    });

    // O seletor é um radiogroup: o clique no botão que já está aceso
    // chega aqui igual ao clique no outro.
    it("não gasta requisição quando o papel já é o que está lá", async () => {
        const context = fakeWorkspaceContext();

        await updateMemberRole(context, aMember({ Role: "viewer" }), "viewer");

        expect(context.beginSubmit).not.toHaveBeenCalled();
        expect(context.refreshMembers).not.toHaveBeenCalled();
    });

    it("mostra a msg do servidor quando quem chamou não é o dono", async () => {
        server.use(
            msw.put("*/api/Workspaces/members/IdWorkspaceMember=7", () =>
                HttpResponse.json(
                    { msg: "Você não tem permissão para essa ação neste workspace." },
                    { status: 403 },
                ),
            ),
        );
        const context = fakeWorkspaceContext();

        await updateMemberRole(context, aMember(), "editor");

        expect(context.refreshMembers).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith(
            "members",
            "Você não tem permissão para essa ação neste workspace.",
        );
    });

    // A tela não oferece o seletor na linha do próprio dono, mas a rota
    // recusa de qualquer jeito — e a msg diz para onde ir.
    it("mostra a msg quando o alvo é a própria matrícula", async () => {
        server.use(
            msw.put("*/api/Workspaces/members/IdWorkspaceMember=7", () =>
                HttpResponse.json(
                    {
                        msg: "Você não pode mudar o seu próprio papel. Para passar o espaço a outra pessoa, transfira a propriedade.",
                    },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeWorkspaceContext();

        await updateMemberRole(context, aMember({ IsSelf: true }), "editor");

        expect(context.failSubmit).toHaveBeenCalledWith(
            "members",
            expect.stringContaining("transfira a propriedade"),
        );
    });
});
