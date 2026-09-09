import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { submitSignUp } from "../sections/submitSignUp";
import { fakeSignUpContext } from "./context";

const signUp = "*/api/Users";
const login = "*/api/Users/login";

describe("submitSignUp", () => {
    it("cria a conta e CHAMA O LOGIN em seguida", async () => {
        /* São duas requisições de propósito: o cadastro não devolve
           cookie. Sem o login, `finishSignUp` navega para dentro do app,
           o `getSelf` responde 401 e o recém-cadastrado cai no login sem
           entender por quê.

           O teste espia a requisição, e não só o `finishSignUp`: com os
           dois handlers de pé, afirmar só o resultado passaria igual se
           a chamada de login sumisse — foi exatamente assim que ela
           sumiu uma vez sem ninguém ver. */
        let loginBody: unknown;
        server.use(msw.post(signUp, () => HttpResponse.json({ IdUser: 1, IdWorkspace: 1 })));
        server.use(
            msw.post(login, async ({ request }) => {
                loginBody = await request.json();
                return HttpResponse.json({ msg: "ok" });
            }),
        );
        const context = fakeSignUpContext();

        await submitSignUp(context);

        // O login vai com o MESMO e-mail e a MESMA senha do cadastro —
        // pedir que o usuário redigite seria pedir duas vezes o que ele
        // acabou de escrever.
        expect(loginBody).toEqual({ login: "tiago@exemplo.com", password: "senha-forte-1" });
        expect(context.finishSignUp).toHaveBeenCalledOnce();
        expect(context.failSubmit).not.toHaveBeenCalled();
    });

    it("manda a senha em texto puro e o telefone como número", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post(signUp, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdUser: 1, IdWorkspace: 1 });
            }),
        );
        server.use(msw.post(login, () => HttpResponse.json({ msg: "ok" })));

        await submitSignUp(fakeSignUpContext());

        // Pré-hashear no cliente não protege nada: o que a API recebe
        // vira a credencial efetiva.
        expect(body?.Password).toBe("senha-forte-1");
        expect(body?.Phone).toBe(11999998888);
    });

    it("NÃO manda IdWorkspace — ele saiu do contrato e agora é 406", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post(signUp, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdUser: 1, IdWorkspace: 1 });
            }),
        );
        server.use(msw.post(login, () => HttpResponse.json({ msg: "ok" })));

        await submitSignUp(fakeSignUpContext());

        // Ele entrava direto como matrícula `owner`, sem convite nem
        // conferência, com um id sequencial que se adivinhava contando.
        expect(body).not.toHaveProperty("IdWorkspace");
    });

    it("sem convite, não manda a chave InviteHash", async () => {
        // O caso comum: quem se cadastra sozinho ganha um espaço novo.
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post(signUp, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdUser: 1, IdWorkspace: 1 });
            }),
        );
        server.use(msw.post(login, () => HttpResponse.json({ msg: "ok" })));

        await submitSignUp(fakeSignUpContext());

        expect(body).not.toHaveProperty("InviteHash");
    });

    it("com convite, manda o InviteHash que veio no link", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post(signUp, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdUser: 1, IdWorkspace: 4 });
            }),
        );
        server.use(msw.post(login, () => HttpResponse.json({ msg: "ok" })));

        await submitSignUp(fakeSignUpContext({ inviteHash: "Yk3s" }));

        // É ele que matricula no espaço de quem convidou — e o e-mail do
        // cadastro tem que bater com o do convite, senão é 406.
        expect(body?.InviteHash).toBe("Yk3s");
    });

    it("mostra a mensagem da API quando o e-mail já está em uso", async () => {
        server.use(
            msw.post(signUp, () =>
                HttpResponse.json({ msg: "E-mail já cadastrado!" }, { status: 406 }),
            ),
        );
        const context = fakeSignUpContext();

        await submitSignUp(context);

        expect(context.failSubmit).toHaveBeenCalledWith("E-mail já cadastrado!");
        expect(context.finishSignUp).not.toHaveBeenCalled();
    });

    it("manda entrar, e não cadastrar de novo, quando só o login falha", async () => {
        // A conta já existe neste ponto: sugerir cadastrar de novo
        // responderia "e-mail já em uso" e deixaria o usuário preso.
        server.use(msw.post(signUp, () => HttpResponse.json({ IdUser: 1, IdWorkspace: 1 })));
        server.use(msw.post(login, () => new HttpResponse(null, { status: 500 })));
        const context = fakeSignUpContext();

        await submitSignUp(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Conta criada, mas não foi possível entrar. Tente fazer login.",
        );
    });

    it("recusa senhas que não conferem sem gastar requisição", async () => {
        // Sem handler declarado: qualquer requisição aqui quebra o teste,
        // que é a garantia de que a conferência é local.
        const context = fakeSignUpContext({ passwordConfirmation: "outra-coisa" });

        await submitSignUp(context);

        expect(context.failSubmit).toHaveBeenCalledWith("As senhas não conferem.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("exige telefone com DDD", async () => {
        const context = fakeSignUpContext({ phone: "99998888" });

        await submitSignUp(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Informe um telefone com DDD.");
    });

    it("exige o aceite dos termos", async () => {
        const context = fakeSignUpContext({ acceptedTerms: false });

        await submitSignUp(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "É preciso aceitar os termos para criar a conta.",
        );
    });
});
