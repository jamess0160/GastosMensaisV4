import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { changePassword } from "../sections/changePassword";
import { fakeProfileContext } from "./context";

const route = "*/api/Users/updatePassword";

describe("changePassword", () => {
    it("troca a senha e limpa o formulário", async () => {
        server.use(msw.put(route, () => new HttpResponse(null, { status: 200 })));
        const context = fakeProfileContext();

        await changePassword(context);

        expect(context.clearPasswordForm).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledWith("password", "Senha alterada.");
    });

    it("manda as duas senhas no BODY, nunca na URL", async () => {
        let body: unknown;
        let url = "";
        server.use(
            msw.put(route, async ({ request }) => {
                body = await request.json();
                url = request.url;
                return new HttpResponse(null, { status: 200 });
            }),
        );

        await changePassword(fakeProfileContext());

        // O path cai no log do proxy, no histórico e no Referer: senha
        // ali não se recupera depois de vazada.
        expect(body).toEqual({ oldPassword: "senha-antiga", newPassword: "senha-nova-1" });
        expect(url).not.toContain("senha-nova-1");
    });

    it("mostra a mensagem da API quando a senha antiga não bate", async () => {
        server.use(
            msw.put(route, () =>
                HttpResponse.json(
                    { msg: "Senha antiga não bate com a senha registrada" },
                    { status: 406 },
                ),
            ),
        );
        const context = fakeProfileContext();

        await changePassword(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "password",
            "Senha antiga não bate com a senha registrada",
        );
        expect(context.clearPasswordForm).not.toHaveBeenCalled();
    });

    it("recusa senha nova curta sem gastar requisição", async () => {
        const context = fakeProfileContext({
            passwordForm: { oldPassword: "a", newPassword: "1234", confirmation: "1234" },
        });

        await changePassword(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "password",
            "A nova senha precisa de pelo menos 8 caracteres.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("recusa quando a confirmação não confere", async () => {
        const context = fakeProfileContext({
            passwordForm: {
                oldPassword: "senha-antiga",
                newPassword: "senha-nova-1",
                confirmation: "senha-nova-2",
            },
        });

        await changePassword(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "password",
            "As senhas novas não conferem.",
        );
    });

    it("recusa quando a nova é igual à atual", async () => {
        const context = fakeProfileContext({
            passwordForm: {
                oldPassword: "senha-repetida",
                newPassword: "senha-repetida",
                confirmation: "senha-repetida",
            },
        });

        await changePassword(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "password",
            "A nova senha é igual à atual.",
        );
    });
});
