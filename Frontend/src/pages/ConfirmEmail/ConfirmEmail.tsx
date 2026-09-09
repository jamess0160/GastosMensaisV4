import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout, authStyles as styles } from "@/ui/AuthLayout";
import { FormField, Input } from "@/ui/form";
import { Button } from "@/ui/primitives";
import { useCooldown } from "@/lib/cooldown";
import { ConfirmEmailController, type ConfirmEmailContext } from "./controller";

/* ════════════════════════════════════════════════════════════
   A confirmação de e-mail — a tela para onde o link do cadastro
   aponta (`APP_URL/confirmar-email?Token=…`).

   Ela é pública porque quem não confirmou pode não ter sessão nenhuma:
   o link chega no cadastro e costuma ser aberto em outro aparelho.

   E a armadilha que decide o desenho: **clicar duas vezes responde 200
   das duas**. O estado de sucesso não pode depender de ser a primeira
   vez — quem reabre o link, ou o pré-carregador de link do cliente de
   e-mail, não pode ver erro para algo que deu certo. O link vale 48
   horas.

   Nada é bloqueado por e-mail não confirmado, aqui nem em lugar
   nenhum: quem não recebeu o e-mail (spam, typo, provedor lento)
   ficaria do lado de fora dependendo de o reenvio funcionar.
   ════════════════════════════════════════════════════════════ */

/** O mesmo freio da tela de recuperação, e do tamanho da janela que a
 *  API já usa no reenvio: dois minutos. */
const COOLDOWN_SECONDS = 120;

type Status = "confirming" | "confirmed" | "invalid";

export function ConfirmEmail() {
    const navigate = useNavigate();
    const [search] = useSearchParams();
    const token = search.get("Token") ?? "";

    const [status, setStatus] = useState<Status>("confirming");
    const [message, setMessage] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [resent, setResent] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);
    const [resending, setResending] = useState(false);
    const cooldown = useCooldown(COOLDOWN_SECONDS);

    const context = useMemo<ConfirmEmailContext>(
        () => ({
            token,
            email,
            beginConfirm() {
                setStatus("confirming");
            },
            finishConfirm(text) {
                setStatus("confirmed");
                setMessage(text);
            },
            failConfirm(text) {
                setStatus("invalid");
                setMessage(text);
            },
            beginResend() {
                setResending(true);
                setResendError(null);
                setResent(null);
            },
            finishResend(text) {
                setResending(false);
                setResent(text);
                cooldown.start();
            },
            failResend(text) {
                setResending(false);
                setResendError(text);
            },
        }),
        [token, email, cooldown],
    );

    useEffect(() => {
        void ConfirmEmailController.confirmEmail(context);
        // Só na montagem, e por token: reexecutar a cada tecla digitada
        // no campo de reenvio seria uma confirmação por tecla.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const onResend = (event: FormEvent) => {
        event.preventDefault();
        void ConfirmEmailController.resendConfirmation(context);
    };

    if (status === "confirming") {
        return (
            <AuthLayout heading="Confirmando seu e-mail" subheading="Só um instante.">
                <div className={styles.form}>
                    <div className={styles.notice}>Verificando o link…</div>
                </div>
            </AuthLayout>
        );
    }

    if (status === "confirmed") {
        return (
            <AuthLayout
                heading="E-mail confirmado"
                subheading="Pronto — o endereço da sua conta está provado."
            >
                <div className={styles.form}>
                    <div className={styles.notice}>{message}</div>
                    {/* Para "/" e não para o login: quem já tem sessão
                        cai direto no app, e quem não tem é mandado ao
                        login pelo guard do chassi. O contrário obrigaria
                        quem estava logado a entrar de novo. */}
                    <Button variant="primary" onClick={() => navigate("/", { replace: true })}>
                        Ir para o app
                    </Button>
                    <div className={styles.hint}>
                        Abrir este link de novo continua respondendo sucesso — ele não “gasta”.
                    </div>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            heading="Este link não vale mais"
            subheading="Links de confirmação valem 48 horas. Pedir outro leva um minuto."
            topRight={
                <>
                    <span>Já confirmou?</span>
                    <Button onClick={() => navigate("/login")}>Entrar</Button>
                </>
            }
        >
            <form className={styles.form} onSubmit={onResend}>
                <div className={styles.error} role="alert">
                    {message}
                </div>

                <FormField label="E-mail da conta">
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

                {/* A `msg` do servidor, como veio: ela é a mesma para
                    e-mail com conta, sem conta e já confirmado. */}
                {resent && <div className={styles.notice}>{resent}</div>}

                {resendError && (
                    <div className={styles.error} role="alert">
                        {resendError}
                    </div>
                )}

                <button
                    className={styles.cta}
                    type="submit"
                    disabled={resending || cooldown.blocked}
                >
                    {resending
                        ? "Enviando…"
                        : cooldown.blocked
                          ? `Pedir de novo em ${cooldown.remaining}s`
                          : "Reenviar confirmação"}
                </button>

                <div className={styles.hint}>
                    Enquanto isso, você continua entrando e usando o app normalmente — nada aqui
                    fica trancado por causa da confirmação.
                </div>
            </form>
        </AuthLayout>
    );
}
