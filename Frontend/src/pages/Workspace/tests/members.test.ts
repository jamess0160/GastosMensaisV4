import { HttpResponse, http as msw } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { leaveWorkspace } from "../sections/leaveWorkspace";
import { removeMember } from "../sections/removeMember";
import { updateMemberRole } from "../sections/updateMemberRole";
import { aMember, fakeWorkspaceContext } from "./context";
import type { ApiTypes } from "@/types/api";

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

/* Sair é a guarda OPOSTA de remover: aquela rota é só do dono, esta é de
   todo mundo MENOS ele. E, ao contrário dela, são DUAS chamadas — o
   `DELETE` não reemite o cookie, então sem o `getSelf` + `switch` em
   seguida o token continuaria apontando para o espaço de onde a pessoa
   acabou de sair. */
describe("leaveWorkspace", () => {
    const otherWorkspace: ApiTypes.Workspace = {
        IdWorkspace: 9,
        Name: "Meu espaço",
        IdOwnerUser: 1,
        Current: true,
        CreatedAt: "2026-09-06T00:00:00.000Z",
        UpdatedAt: "2026-09-06T00:00:00.000Z",
    };

    it("endereça a PRÓPRIA matrícula, sem id no caminho e sem corpo", async () => {
        let method = "";
        let path = "";
        let body: unknown = "não lido";
        server.use(
            msw.delete("*/api/Workspaces/members/self", async ({ request }) => {
                method = request.method;
                path = new URL(request.url).pathname;
                body = await request.text();
                return HttpResponse.json({ msg: "Você saiu do espaço" });
            }),
            msw.get("*/api/Workspaces/getSelf", () => HttpResponse.json([])),
        );
        const context = fakeWorkspaceContext();

        await leaveWorkspace(context, vi.fn());

        expect(method).toBe("DELETE");
        // Um id aqui viria do cliente e a rota teria que conferir que é o
        // do próprio usuário, quando a sessão já sabe disso.
        expect(path).toMatch(/\/Workspaces\/members\/self$/);
        expect(body).toBe("");
        expect(context.beginSubmit).toHaveBeenCalledWith("members");
    });

    // A armadilha da entrega: o `DELETE` não reemite o cookie, porque o
    // `switch` é a única rota que recebe um `IdWorkspace`.
    it("entra no espaço que sobrou — o DELETE não troca a sessão sozinho", async () => {
        server.use(
            msw.delete("*/api/Workspaces/members/self", () =>
                HttpResponse.json({ msg: "Você saiu do espaço" }),
            ),
            msw.get("*/api/Workspaces/getSelf", () =>
                HttpResponse.json([{ ...otherWorkspace, Current: false }]),
            ),
        );
        const switchWorkspace = vi.fn().mockResolvedValue(otherWorkspace);
        const context = fakeWorkspaceContext();

        await leaveWorkspace(context, switchWorkspace);

        expect(switchWorkspace).toHaveBeenCalledWith(9);
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "members",
            "Você saiu do espaço. Agora você está em Meu espaço.",
        );
    });

    // Sem espaço nenhum não há para onde trocar: a releitura da lista é o
    // que faz a tela chegar na criação de espaço.
    it("relê a lista de espaços quando não sobra nenhum, sem tentar trocar", async () => {
        server.use(
            msw.delete("*/api/Workspaces/members/self", () =>
                HttpResponse.json({ msg: "Você saiu do espaço" }),
            ),
            msw.get("*/api/Workspaces/getSelf", () => HttpResponse.json([])),
        );
        const switchWorkspace = vi.fn();
        const context = fakeWorkspaceContext();

        await leaveWorkspace(context, switchWorkspace);

        expect(switchWorkspace).not.toHaveBeenCalled();
        expect(context.refreshWorkspaces).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledWith("members", "Você saiu do espaço.");
    });

    // A tela não mostra o botão para o dono, mas a rota recusa de
    // qualquer jeito — e a msg diz o próximo passo, que é a razão de ela
    // ser 406 com texto próprio e não o 403 genérico.
    it("mostra a msg do servidor quando quem chamou é o dono, e não sai", async () => {
        const switchWorkspace = vi.fn();
        server.use(
            msw.delete("*/api/Workspaces/members/self", () =>
                HttpResponse.json(
                    {
                        msg: "O dono não pode sair do próprio espaço. Transfira a propriedade a outro membro e saia depois.",
                    },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeWorkspaceContext();

        await leaveWorkspace(context, switchWorkspace);

        expect(switchWorkspace).not.toHaveBeenCalled();
        expect(context.refreshWorkspaces).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith(
            "members",
            expect.stringContaining("Transfira a propriedade"),
        );
    });

    // Depois do DELETE bem-sucedido a saída JÁ aconteceu: um erro daí
    // para frente não pode ser lido como "não saiu", e o conserto é o
    // cache velho sair da frente.
    it("não diz que a saída falhou quando o que falhou foi entrar em outro", async () => {
        server.use(
            msw.delete("*/api/Workspaces/members/self", () =>
                HttpResponse.json({ msg: "Você saiu do espaço" }),
            ),
            msw.get("*/api/Workspaces/getSelf", () =>
                HttpResponse.json([{ ...otherWorkspace, Current: false }]),
            ),
        );
        const context = fakeWorkspaceContext();

        await leaveWorkspace(
            context,
            vi.fn().mockRejectedValue(new Error("Workspace não encontrado!")),
        );

        expect(context.refreshWorkspaces).toHaveBeenCalledOnce();
        expect(context.failSubmit).toHaveBeenCalledWith(
            "members",
            expect.stringContaining("Você saiu do espaço, mas não consegui entrar em outro"),
        );
    });
});
