import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { removeMember } from "../sections/removeMember";
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

describe("removeMember", () => {
    it("endereça a MATRÍCULA, sem corpo, e relê a lista", async () => {
        let method = "";
        let path = "";
        let body: unknown = "não lido";
        server.use(
            msw.delete("*/api/Workspaces/members/IdWorkspaceMember=7", async ({ request }) => {
                method = request.method;
                path = new URL(request.url).pathname;
                body = await request.text();
                return HttpResponse.json({ msg: "Membro removido com sucesso" });
            }),
        );
        const context = fakeWorkspaceContext();

        await removeMember(context, aMember());

        expect(method).toBe("DELETE");
        expect(path).toMatch(/IdWorkspaceMember=7$/);
        // Remover não tem opção: um corpo aqui só daria ao cliente onde
        // escrever o que a rota ignoraria.
        expect(body).toBe("");
        // Quem sumiu de verdade é o servidor que diz — a lista é a
        // própria tela em que a ação acontece.
        expect(context.refreshMembers).toHaveBeenCalledOnce();
    });

    // O aviso é metade "perdeu o acesso" e metade "o que ela lançou
    // continua": gasto, entrada e conta são do espaço, e nenhum saldo
    // muda. Sem essa metade a tela sugeriria que remover apaga histórico.
    it("diz que o acesso acabou e que o que a pessoa lançou continua", async () => {
        server.use(
            msw.delete("*/api/Workspaces/members/IdWorkspaceMember=7", () =>
                HttpResponse.json({ msg: "Membro removido com sucesso" }),
            ),
        );
        const context = fakeWorkspaceContext();

        await removeMember(context, aMember());

        expect(context.beginSubmit).toHaveBeenCalledWith("members");
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "members",
            "Ana não tem mais acesso. O que ela lançou continua aqui.",
        );
    });

    it("mostra a msg do servidor quando quem chamou não é o dono", async () => {
        server.use(
            msw.delete("*/api/Workspaces/members/IdWorkspaceMember=7", () =>
                HttpResponse.json(
                    { msg: "Você não tem permissão para essa ação neste workspace." },
                    { status: 403 },
                ),
            ),
        );
        const context = fakeWorkspaceContext();

        await removeMember(context, aMember());

        expect(context.refreshMembers).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith(
            "members",
            "Você não tem permissão para essa ação neste workspace.",
        );
    });

    // A tela não oferece o botão na própria linha, mas a rota recusa de
    // qualquer jeito — e a msg diz para onde ir: sair é operação do
    // próprio usuário, e o dono só sai depois de transferir.
    it("mostra a msg quando o alvo é a própria matrícula", async () => {
        server.use(
            msw.delete("*/api/Workspaces/members/IdWorkspaceMember=7", () =>
                HttpResponse.json(
                    {
                        msg: "Você não pode remover a si mesmo. Para passar o espaço a outra pessoa, transfira a propriedade.",
                    },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeWorkspaceContext();

        await removeMember(context, aMember({ IsSelf: true }));

        expect(context.refreshMembers).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith(
            "members",
            expect.stringContaining("transfira a propriedade"),
        );
    });
});
