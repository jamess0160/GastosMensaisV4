import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout, authStyles as styles } from "@/ui/AuthLayout";
import { FormField, Input } from "@/ui/form";
import { Button } from "@/ui/primitives";
import { useCooldown } from "@/lib/cooldown";
import { ForgotPasswordController, type ForgotPasswordContext } from "./controller";

/* ════════════════════════════════════════════════════════════
   "Esqueci minha senha", passo 1 — a tela pública que faltava.

   Ela é pública porque tem que ser: quem esqueceu a senha não tem
   sessão. A proteção não é o token da sessão, é o link assinado que
   chega ao e-mail do dono da conta.

   E a regra que decide o texto inteiro da tela: a resposta é `200`
   SEMPRE, inclusive para e-mail que não tem conta, com a mesma `msg`.
   Nada aqui escreve "e-mail não encontrado" — a informação não está na
   resposta, e é de propósito que não esteja.
   ════════════════════════════════════════════════════════════ */

/** O freio enquanto o servidor não tem rate limiting nesta rota.
 *
 *  Ele é do tamanho da janela que a API já usa no reenvio de
 *  confirmação — dois minutos —, para as duas telas não ensinarem
 *  ritmos diferentes para o mesmo gesto. */
const COOLDOWN_SECONDS = 120;

export function ForgotPassword() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const cooldown = useCooldown(COOLDOWN_SECONDS);

    const context = useMemo<ForgotPasswordContext>(
        () => ({
            email,
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
                setSent(message);
                /* A contagem começa no SUCESSO, não no clique: travar
                   antes de saber se a chamada deu certo deixaria a
                   pessoa esperando dois minutos por um e-mail que nunca
                   foi pedido. */
                cooldown.start();
            },
        }),
        [email, cooldown],
    );

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        void ForgotPasswordController.requestResetLink(context);
    };

    return (
        <AuthLayout
            heading="Recuperar o acesso"
            subheading="Diga o e-mail da conta e mandamos um link para você criar uma senha nova."
            topRight={
                <>
                    <span>Lembrou a senha?</span>
                    <Button onClick={() => navigate("/login")}>Entrar</Button>
                </>
            }
        >
            <form className={styles.form} onSubmit={onSubmit}>
                <FormField label="E-mail">
                    {(field) => (
                        <Input
                            {...field}
                            type="email"
                            name="email"
                            autoComplete="username"
                            placeholder="voce@email.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    )}
                </FormField>

                {/* A `msg` do servidor, como veio. Ela é a mesma para
                    e-mail com conta e sem conta, e é essa frase única que
                    impede a tela de virar um verificador de cadastros. */}
                {sent && <div className={styles.notice}>{sent}</div>}

                {error && (
                    <div className={styles.error} role="alert">
                        {error}
                    </div>
                )}

                <button className={styles.cta} type="submit" disabled={pending || cooldown.blocked}>
                    {pending
                        ? "Enviando…"
                        : cooldown.blocked
                          ? `Pedir de novo em ${cooldown.remaining}s`
                          : sent
                            ? "Enviar de novo"
                            : "Enviar link de recuperação"}
                </button>

                <div className={styles.hint}>
                    O link vale <b>30 minutos</b> e serve uma vez só. Se pedir dois, vale o último.
                </div>
            </form>
        </AuthLayout>
    );
}
