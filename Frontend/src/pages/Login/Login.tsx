import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout, authStyles as styles } from "@/ui/AuthLayout";
import { Button } from "@/ui/primitives";
import { ConfirmDialog } from "@/ui/overlay";
import { Checkbox, FormField, Input, PasswordInput } from "@/ui/form";
import { IconFingerprint } from "@/ui/icons";
import { LoginController, type LoginContext } from "./controller";
import { readDeviceKey, writeDeviceKey } from "@/lib/deviceKey";

export function Login() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    /* DESMARCADA por padrão — que é o default do servidor, e não uma
       escolha nossa diferente da dele. */
    const [rememberDevice, setRememberDevice] = useState(false);
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
            rememberDevice,
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
                // O cache é do usuário anterior: entrar não pode mostrar
                // o mês de quem estava logado antes.
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
        [deviceKey, email, password, rememberDevice, navigate, queryClient],
    );

    /* Chegar ao login limpa o que ficou na memória da tela anterior.
     *
     *  Quem encerra a SESSÃO é `POST /Users/logout`, no botão "Sair" —
     *  não esta tela: abrir /login por engano com a sessão de pé não pode
     *  deslogar ninguém. O que se limpa aqui é só o cache do cliente, que
     *  não é de quem está prestes a entrar. */
    useEffect(() => {
        queryClient.clear();
        // Só na montagem: é a chegada à tela que limpa.
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
                        /* O link virou navegação de verdade: as duas
                           telas da recuperação existem, e a rota da API
                           também. */
                        hint={
                            <button
                                type="button"
                                className={styles.fieldAction}
                                onClick={() => navigate("/esqueci-senha")}
                            >
                                Esqueci minha senha
                            </button>
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

                    {/* O layout promete "Lembrar deste navegador · sessão
                        por 30 dias" desde o começo, e o cliente não tinha
                        o controle: prometer 30 dias e deslogar em 24h é
                        pior do que não oferecer. Agora as duas durações
                        existem na API, e a caixa vale para os DOIS
                        caminhos de login — a biometria manda o mesmo
                        valor. */}
                    <Checkbox
                        label="Manter conectado por 30 dias"
                        checked={rememberDevice}
                        onChange={(event) => setRememberDevice(event.target.checked)}
                    />

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
