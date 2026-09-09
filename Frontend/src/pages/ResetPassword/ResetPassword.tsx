import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout, authStyles as styles } from "@/ui/AuthLayout";
import { FormField, PasswordInput } from "@/ui/form";
import { Button } from "@/ui/primitives";
import { ResetPasswordController, type ResetPasswordContext } from "./controller";

/* ════════════════════════════════════════════════════════════
   "Esqueci minha senha", passo 2 — a tela para onde o link aponta.

   O link do e-mail é `APP_URL/recuperar-senha?Token=…`, e a troca
   acontece num POST desta tela, não num GET que muda estado: assim o
   pré-carregador de link do cliente de e-mail não gasta o token sem
   ninguém ter clicado.

   O token vale 30 minutos e serve UMA vez — trocar a senha muda o hash
   e o próprio link deixa de casar. Inválido, expirado e já usado voltam
   o MESMO 406, e a saída é sempre a mesma: pedir outro link.

   E a troca NÃO abre sessão. Não vem `Set-Cookie` nenhum: o sucesso
   manda para o login, com o aviso de entrar com a senha nova.
   ════════════════════════════════════════════════════════════ */

export function ResetPassword() {
    const navigate = useNavigate();
    const [search] = useSearchParams();
    const token = search.get("Token") ?? "";

    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const context = useMemo<ResetPasswordContext>(
        () => ({
            token,
            password,
            confirmation,
            beginSubmit() {
                setPending(true);
                setError(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishSubmit(message) {
                setPending(false);
                setDone(message);
            },
        }),
        [token, password, confirmation],
    );

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        void ResetPasswordController.submitNewPassword(context);
    };

    if (done) {
        return (
            <AuthLayout
                heading="Senha alterada"
                subheading="Agora é só entrar com ela — a troca não abre sessão sozinha, de propósito."
            >
                <div className={styles.form}>
                    <div className={styles.notice}>{done}</div>
                    <Button variant="primary" onClick={() => navigate("/login", { replace: true })}>
                        Ir para o login
                    </Button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            heading="Criar uma senha nova"
            subheading="Escolha a senha que vai valer daqui pra frente. O link que te trouxe aqui serve uma vez só."
            topRight={
                <>
                    <span>Já lembrou?</span>
                    <Button onClick={() => navigate("/login")}>Entrar</Button>
                </>
            }
        >
            <form className={styles.form} onSubmit={onSubmit}>
                <FormField label="Nova senha">
                    {(field) => (
                        <PasswordInput
                            {...field}
                            name="new-password"
                            autoComplete="new-password"
                            placeholder="Pelo menos 8 caracteres"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    )}
                </FormField>

                <FormField label="Repita a nova senha">
                    {(field) => (
                        <PasswordInput
                            {...field}
                            name="confirm-password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={confirmation}
                            onChange={(event) => setConfirmation(event.target.value)}
                            required
                        />
                    )}
                </FormField>

                {error && (
                    <>
                        <div className={styles.error} role="alert">
                            {error}
                        </div>
                        {/* O caminho de saída junto com o erro: os três
                            motivos de recusa do token — inválido,
                            expirado, já usado — levam ao mesmo lugar, e
                            é ele que precisa estar à mão. */}
                        <Button onClick={() => navigate("/esqueci-senha")}>Pedir outro link</Button>
                    </>
                )}

                <button className={styles.cta} type="submit" disabled={pending}>
                    {pending ? "Salvando…" : "Salvar nova senha"}
                </button>
            </form>
        </AuthLayout>
    );
}
