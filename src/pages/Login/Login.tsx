import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout, authStyles as styles } from "@/ui/AuthLayout";
import { Button } from "@/ui/primitives";
import { ConfirmDialog } from "@/ui/overlay";
import { FormField, Input, PasswordInput } from "@/ui/form";
import { clearSignedOut, markSignedOut } from "@/app/session";
import { IconFingerprint } from "@/ui/icons";
import { LoginController, type LoginContext } from "./controller";
import { readDeviceKey, writeDeviceKey } from "@/lib/deviceKey";

export function Login() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [offerBiometrics, setOfferBiometrics] = useState(false);
    const [inviteBiometrics, setInviteBiometrics] = useState(false);
    const [deviceKey, setDeviceKey] = useState(() => readDeviceKey());

    const context = useMemo<LoginContext>(
        () => ({
            deviceKey,
            email,
            password,
            beginSubmit() {
                setPending(true);
                setError(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishSignIn() {
                setPending(false);
                // A sessão nova é o único momento em que a trava de saída
                // cai — ver `markSignedOut` em src/app/session.tsx.
                clearSignedOut();
                queryClient.clear();
                navigate("/", { replace: true });
            },
            setOfferBiometrics,
            setInviteBiometrics(invite) {
                setPending(false);
                setInviteBiometrics(invite);
            },
            rememberDeviceKey(next) {
                writeDeviceKey(next);
                setDeviceKey(next);
            },
        }),
        [deviceKey, email, password, navigate, queryClient],
    );

    /* Chegar ao login é sair.
     *
     *  Sem rota de logout o cookie sobrevive, e sem esta trava abrir
     *  /login com sessão de pé mostrava o formulário mas mantinha o app
     *  logado por trás — voltar para "/" entrava direto na conta
     *  anterior. Marcar aqui cobre os dois caminhos que o usuário chama
     *  de "sair": o botão do menu e digitar o endereço do login. */
    useEffect(() => {
        markSignedOut();
        queryClient.clear();
        // Só na montagem: é a chegada à tela que desconecta.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        void LoginController.loadBiometricsAvailability(context);
        // Só na montagem e quando o aparelho muda: reavaliar a cada tecla
        // digitada no e-mail seria uma chamada por tecla.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceKey]);

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        void LoginController.submitLogin(context);
    };

    return (
        <>
            <AuthLayout
                heading="Entrar na sua conta"
                subheading="Continue de onde parou — seus gastos e parcelas te esperam."
                topRight={
                    <>
                        <span>Ainda não tem conta?</span>
                        {/* Botão de verdade, não link: no layout ele tem
                            borda e fundo próprio — é o segundo caminho da
                            tela, e precisa parecer clicável. */}
                        <Button onClick={() => navigate("/cadastro")}>Criar conta</Button>
                    </>
                }
            >
                <form className={styles.form} onSubmit={onSubmit}>
                    {offerBiometrics && (
                        <>
                            <button
                                type="button"
                                className={styles.social}
                                onClick={() => void LoginController.signInWithBiometrics(context)}
                                disabled={pending}
                            >
                                <IconFingerprint />
                                Entrar com biometria
                            </button>
                            <div className={styles.divider}>
                                <span className={styles.line} />
                                <span>ou com e-mail</span>
                                <span className={styles.line} />
                            </div>
                        </>
                    )}

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

                    <FormField
                        label="Senha"
                        /* Sem rota de recuperação no contrato: o link some
                           do produto sem sumir do layout. */
                        hint={
                            <span title="Ainda sem API" style={{ opacity: 0.5 }}>
                                Esqueci minha senha
                            </span>
                        }
                    >
                        {(field) => (
                            <PasswordInput
                                {...field}
                                name="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                        )}
                    </FormField>

                    {error && (
                        <div className={styles.error} role="alert">
                            {error}
                        </div>
                    )}

                    <button className={styles.cta} type="submit" disabled={pending}>
                        {pending ? "Entrando…" : "Entrar"}
                    </button>
                </form>
            </AuthLayout>

            {/* A sessão já está de pé aqui: o convite acontece depois do
                login por senha, porque registrar passkey é rota
                autenticada. Recusar chama `skipDevice`, que faz o
                `checkDevice` responder `false` e o convite não voltar. */}
            <ConfirmDialog
                open={inviteBiometrics}
                onClose={() => void LoginController.skipBiometrics(context)}
                onConfirm={() => void LoginController.registerBiometrics(context)}
                title="Usar biometria neste aparelho?"
                description={
                    <>
                        Da próxima vez você entra com a digital ou o rosto, sem digitar a senha.
                        Vale só para este aparelho e você pode desfazer no seu perfil.
                        {error && (
                            <div className={styles.error} style={{ marginTop: 12 }} role="alert">
                                {error}
                            </div>
                        )}
                    </>
                }
                confirmLabel="Ativar biometria"
                cancelLabel="Agora não"
                pending={pending}
            />
        </>
    );
}
