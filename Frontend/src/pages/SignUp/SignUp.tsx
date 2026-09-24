import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout, authStyles as styles } from "@/ui/AuthLayout";
import { Checkbox, FormField, Input, PasswordInput } from "@/ui/form";
import { Button } from "@/ui/primitives";
import { SignUpController, type SignUpContext } from "./controller";
import { isEmailLocked, readInvite, signUpEmail } from "./src/invite";
import { useInvitePreview } from "@/data/invitePreview";

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

    /* Quem chegou pela tela de aceite traz o hash na URL. Sem ele o
       cadastro cria um espaço novo — que é o caminho normal. */
    const [search] = useSearchParams();
    const inviteHash = search.get("convite");

    /* A MESMA consulta da tela de aceite, pela mesma chave: o hash é o
       mesmo, e o que interessa aqui é o e-mail convidado. Ele preenche e
       trava o campo, para o usuário não descobrir só no 406 que o
       endereço tinha que ser outro. */
    const preview = useInvitePreview(inviteHash);
    const invite = readInvite({
        hash: inviteHash,
        isError: preview.isError,
        error: preview.error,
        data: preview.data,
    });
    const emailLocked = isEmailLocked(invite);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    /* UM valor só para mostrar e para enviar. Um estado à parte para o
       e-mail do convite deixaria a tela mostrar um endereço e o
       `POST /Users` mandar outro — a falha que a trava existe para
       fechar. */
    const emailValue = signUpEmail(invite, email);

    const context = useMemo<SignUpContext>(
        () => ({
            name,
            email: emailValue,
            phone,
            password,
            passwordConfirmation,
            acceptedTerms,
            inviteHash,
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
        [
            name,
            emailValue,
            phone,
            password,
            passwordConfirmation,
            acceptedTerms,
            inviteHash,
            navigate,
            queryClient,
        ],
    );

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        void SignUpController.submitSignUp(context);
    };

    return (
        <AuthLayout
            heading="Criar sua conta"
            subheading={
                /* O convite que não vale mais cai no texto do cadastro
                   comum de propósito: sem espaço para entrar, é isso que
                   a tela passa a ser. */
                invite.kind === "valid"
                    ? `Você foi convidado para ${invite.workspaceName}: a conta entra nesse espaço assim que for criada.`
                    : invite.kind === "loading"
                      ? "Você foi convidado: estamos lendo o convite."
                      : "Seu espaço nasce junto com a conta — sem convite e sem configuração."
            }
            topRight={
                <>
                    <span>Já tem conta?</span>
                    <Button onClick={() => navigate("/login")}>Entrar</Button>
                </>
            }
        >
            <form className={styles.form} onSubmit={onSubmit} noValidate>
                {/* O contexto que a tela anterior tinha e o formulário
                    perderia: de qual espaço é o convite e quem o mandou.
                    Sem isso, o campo travado seria um e-mail que o
                    usuário não escolheu e a tela não explica. */}
                {invite.kind === "valid" && (
                    <div className={styles.notice}>
                        Convite de <b>{invite.inviterName}</b> para <b>{invite.workspaceName}</b>.
                        Só uma conta com o e-mail convidado pode entrar
                    </div>
                )}

                {/* Convite que não serve não trava nada: a tela vira um
                    cadastro comum, e o aviso diz o que mudou. */}
                {invite.kind === "invalid" && (
                    <div className={styles.error} role="alert">
                        {invite.message} Você pode criar sua conta assim mesmo — ela virá com um
                        espaço novo, e o convite pode ser aceito depois.
                    </div>
                )}

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

                {/* `readOnly`, e NUNCA `disabled`: campo desabilitado
                    não é enviado no submit nativo, some da navegação por
                    teclado e é ignorado por leitor de tela. */}
                <FormField
                    label="E-mail"
                >
                    {(field) => (
                        <Input
                            {...field}
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder="voce@email.com"
                            value={emailValue}
                            onChange={(event) => setEmail(event.target.value)}
                            readOnly={emailLocked}
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

                {/* Os dois links abrem em ABA NOVA: na mesma aba, ler
                    os termos jogaria fora o formulário meio preenchido.
                    O `rel` acompanha o `target` por higiene — a aba
                    aberta não precisa de `window.opener`. */}
                <Checkbox
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    label={
                        <>
                            Li e aceito os{" "}
                            <a href="/termos" target="_blank" rel="noopener noreferrer">
                                termos de uso
                            </a>{" "}
                            e a{" "}
                            <a href="/privacidade" target="_blank" rel="noopener noreferrer">
                                política de privacidade
                            </a>
                            .
                        </>
                    }
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
