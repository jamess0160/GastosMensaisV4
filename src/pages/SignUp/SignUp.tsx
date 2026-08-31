import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout, authStyles as styles } from "@/ui/AuthLayout";
import { Checkbox, FormField, Input, PasswordInput } from "@/ui/form";
import { SignUpController, type SignUpContext } from "./controller";

/** "(11) 98888-7777" a partir dos dígitos. A API tipa `Phone` como
 *  número, então o que se guarda no estado são só os dígitos e a máscara
 *  existe só para a leitura. */
function maskPhone(digits: string): string {
    const d = digits.slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function SignUp() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const context = useMemo<SignUpContext>(
        () => ({
            name,
            email,
            phone,
            password,
            passwordConfirmation,
            acceptedTerms,
            beginSubmit() {
                setPending(true);
                setError(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishSignUp() {
                setPending(false);
                queryClient.clear();
                navigate("/", { replace: true });
            },
        }),
        [name, email, phone, password, passwordConfirmation, acceptedTerms, navigate, queryClient],
    );

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        void SignUpController.submitSignUp(context);
    };

    return (
        <AuthLayout
            heading="Criar sua conta"
            subheading="Seu espaço nasce junto com a conta — sem convite e sem configuração."
            topRight={
                <>
                    Já tem conta?
                    <Link to="/login">
                        <strong>Entrar</strong>
                    </Link>
                </>
            }
        >
            <form className={styles.form} onSubmit={onSubmit} noValidate>
                <FormField label="Nome">
                    {(field) => (
                        <Input
                            {...field}
                            name="name"
                            autoComplete="name"
                            placeholder="Como te chamamos"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                        />
                    )}
                </FormField>

                <FormField label="E-mail">
                    {(field) => (
                        <Input
                            {...field}
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder="voce@email.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    )}
                </FormField>

                <FormField label="Telefone">
                    {(field) => (
                        <Input
                            {...field}
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            inputMode="numeric"
                            placeholder="(11) 98888-7777"
                            value={maskPhone(phone)}
                            onChange={(event) =>
                                setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))
                            }
                            required
                        />
                    )}
                </FormField>

                <FormField label="Senha" help="Pelo menos 8 caracteres.">
                    {(field) => (
                        <PasswordInput
                            {...field}
                            name="new-password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    )}
                </FormField>

                <FormField label="Repita a senha">
                    {(field) => (
                        <PasswordInput
                            {...field}
                            name="confirm-password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={passwordConfirmation}
                            onChange={(event) => setPasswordConfirmation(event.target.value)}
                            required
                        />
                    )}
                </FormField>

                <Checkbox
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    label="Li e aceito os termos de uso e a política de privacidade."
                />

                {error && (
                    <div className={styles.error} role="alert">
                        {error}
                    </div>
                )}

                <button className={styles.cta} type="submit" disabled={pending}>
                    {pending ? "Criando conta…" : "Criar conta e entrar"}
                </button>
            </form>
        </AuthLayout>
    );
}
