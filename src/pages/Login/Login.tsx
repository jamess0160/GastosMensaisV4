import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import styles from "./src/styles.module.css";
import { LoginController, type LoginContext } from "./controller";
import { readDeviceKey } from "@/lib/deviceKey";

export function Login() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [offerBiometrics, setOfferBiometrics] = useState(false);

    const deviceKey = readDeviceKey();

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
                queryClient.clear();
                navigate("/", { replace: true });
            },
            setOfferBiometrics,
        }),
        [deviceKey, email, password, navigate, queryClient],
    );

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

    const onBiometrics = () => {
        void LoginController.signInWithBiometrics(context);
    };

    return (
        <div className={styles.split}>
            <aside className={styles.brandpane}>
                <div className={styles.grid} />
                <div className={styles.glow} />

                <div className={styles.bpBrand}>
                    <img className={styles.bpMark} src="/logo.png" alt="" />
                    <div className={styles.bpName}>Gastos mensais</div>
                </div>

                <div className={styles.bpTagline}>
                    Todo dinheiro do mês, sem briga e sem planilha.
                </div>
                <p className={styles.bpDesc}>
                    Cadastre gastos do casal, divida entre destinos, acompanhe parcelas e feche o
                    mês sabendo exatamente quem pagou o quê.
                </p>

                <div className={styles.bpFoot}>Gastos mensais · seu mês fechado sem planilha.</div>
            </aside>

            <main className={styles.formpane}>
                <div className={styles.fpTop}>
                    Ainda não tem conta?
                    {/* Sem rota de cadastro no app ainda; POST /Users existe. */}
                    <strong>Criar conta</strong>
                </div>

                <div className={styles.fpMid}>
                    <h1 className={styles.fpHeading}>Entrar na sua conta</h1>
                    <p className={styles.fpSub}>
                        Continue de onde parou — seus gastos e parcelas te esperam.
                    </p>

                    <form className={styles.form} onSubmit={onSubmit}>
                        {offerBiometrics && (
                            <>
                                <button
                                    type="button"
                                    className={styles.social}
                                    onClick={onBiometrics}
                                    disabled={pending}
                                >
                                    Entrar com biometria
                                </button>
                                <div className={styles.divider}>
                                    <span className={styles.line} />
                                    <span>ou com e-mail</span>
                                    <span className={styles.line} />
                                </div>
                            </>
                        )}

                        <div>
                            <div className={styles.fieldLabel}>
                                <span className={styles.label}>E-mail</span>
                            </div>
                            <input
                                className={styles.input}
                                type="email"
                                name="email"
                                autoComplete="username"
                                placeholder="voce@email.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <div className={styles.fieldLabel}>
                                <span className={styles.label}>Senha</span>
                                {/* Sem API de recuperação de senha no contrato. */}
                                <button type="button" className={styles.action} disabled>
                                    Esqueci minha senha
                                </button>
                            </div>
                            <input
                                className={styles.input}
                                type="password"
                                name="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                        </div>

                        {error && <div className={styles.error}>{error}</div>}

                        <button className={styles.cta} type="submit" disabled={pending}>
                            {pending ? "Entrando…" : "Entrar"}
                        </button>
                    </form>
                </div>

                <div className={styles.fpBot}>
                    <span>© {new Date().getFullYear()} Gastos mensais</span>
                    <div className={styles.links}>
                        <span>Termos</span>
                        <span>Privacidade</span>
                        <span>Suporte</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
