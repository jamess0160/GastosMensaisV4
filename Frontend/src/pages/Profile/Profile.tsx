import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./src/styles.module.css";
import { ProfileController, type ProfileContext, type ProfileScope } from "./controller";
import { Link } from "react-router-dom";
import { useSession, sessionKeys } from "@/app/session";
import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { FormError, FormField, FormGrid, Input, PasswordInput } from "@/ui/form";
import { IconFingerprint } from "@/ui/icons";
import { ConfirmDialog } from "@/ui/overlay";
import { EmptyState } from "@/ui/states";
import { useCooldown } from "@/lib/cooldown";
import { formatDateTime } from "@/lib/date";
import { readDeviceKey } from "@/lib/deviceKey";

const maskPhone = (digits: string): string => {
    const d = digits.slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export function Profile() {
    const { user, workspace, workspaces, isOwner } = useSession();
    const queryClient = useQueryClient();
    const deviceKey = readDeviceKey();

    const [form, setForm] = useState({
        name: user.Name,
        email: user.Email,
        phone: String(user.Phone ?? ""),
    });
    const [passwordForm, setPasswordForm] = useState({
        oldPassword: "",
        newPassword: "",
        confirmation: "",
    });
    const [pending, setPending] = useState<ProfileScope | null>(null);
    const [errors, setErrors] = useState<Partial<Record<ProfileScope, string>>>({});
    const [done, setDone] = useState<Partial<Record<ProfileScope, string>>>({});
    const [removing, setRemoving] = useState<number | null>(null);
    /* O mesmo freio da tela pública de confirmação, e do tamanho da
       janela que a API já usa no reenvio: dois minutos. */
    const confirmationCooldown = useCooldown(120);

    const passkeys = useQuery({
        queryKey: ["passkeys"],
        queryFn: () => UsersAuthConnection.getSelf(),
    });

    const context = useMemo<ProfileContext>(
        () => ({
            user,
            form,
            passwordForm,
            beginSubmit(scope) {
                setPending(scope);
                setErrors((current) => ({ ...current, [scope]: undefined }));
                setDone((current) => ({ ...current, [scope]: undefined }));
            },
            failSubmit(scope, message) {
                setPending(null);
                setErrors((current) => ({ ...current, [scope]: message }));
            },
            finishSubmit(scope, message) {
                setPending(null);
                setDone((current) => ({ ...current, [scope]: message }));
                /* A contagem começa no SUCESSO, não no clique: travar
                   antes de saber se a chamada deu certo faria a pessoa
                   esperar dois minutos por um e-mail que nunca saiu. */
                if (scope === "confirmation") confirmationCooldown.start();
            },
            refresh() {
                void queryClient.invalidateQueries({ queryKey: sessionKeys.user });
                void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
            },
            resetAllCaches() {
                // O switch reemite o cookie: nada do que está em cache
                // pertence mais ao workspace da sessão.
                queryClient.clear();
            },
            clearPasswordForm() {
                setPasswordForm({ oldPassword: "", newPassword: "", confirmation: "" });
            },
        }),
        [user, form, passwordForm, queryClient, confirmationCooldown],
    );

    const onSaveProfile = (event: FormEvent) => {
        event.preventDefault();
        void ProfileController.saveProfile(context);
    };

    const onChangePassword = (event: FormEvent) => {
        event.preventDefault();
        void ProfileController.changePassword(context);
    };

    const active = passkeys.data?.filter((passkey) => passkey.Active) ?? [];

    return (
        <Page>
            <PageHead
                title="Seu perfil"
                subtitle="Dados da conta, senha e os aparelhos que entram por biometria."
            />

            <div className={styles.columns}>
                <div className={styles.stack}>
                    {/* ── Dados ─────────────────────────────────── */}
                    <Card>
                        <form className={styles.section} onSubmit={onSaveProfile} noValidate>
                            <div className={styles.sectionHead}>
                                <div>
                                    <div className={styles.sectionTitle}>Dados da conta</div>
                                    <div className={styles.sectionSub}>O e-mail é o seu login.</div>
                                </div>
                            </div>

                            <FormError>{errors.profile}</FormError>

                            <FormGrid columns={2}>
                                <FormField label="Nome" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            value={form.name}
                                            autoComplete="name"
                                            onChange={(event) =>
                                                setForm((c) => ({ ...c, name: event.target.value }))
                                            }
                                        />
                                    )}
                                </FormField>
                                <FormField label="Telefone" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            type="tel"
                                            inputMode="numeric"
                                            autoComplete="tel"
                                            value={maskPhone(form.phone)}
                                            onChange={(event) =>
                                                setForm((c) => ({
                                                    ...c,
                                                    phone: event.target.value
                                                        .replace(/\D/g, "")
                                                        .slice(0, 11),
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            <FormField label="E-mail" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        type="email"
                                        autoComplete="email"
                                        value={form.email}
                                        onChange={(event) =>
                                            setForm((c) => ({ ...c, email: event.target.value }))
                                        }
                                    />
                                )}
                            </FormField>

                            <div className={styles.actions}>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={pending === "profile"}
                                >
                                    {pending === "profile" ? "Salvando…" : "Salvar dados"}
                                </Button>
                                {done.profile && <span className={styles.ok}>{done.profile}</span>}
                            </div>
                        </form>
                    </Card>

                    {/* ── E-mail confirmado ──────────────────────
                        A faixa do chassi é o LEMBRETE; este bloco é onde
                        se resolve de propósito — e ele fica aqui mesmo
                        depois de confirmado, porque "quando foi provado"
                        é informação da conta, não um aviso pendente. */}
                    <Card>
                        <div className={styles.section}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <div className={styles.sectionTitle}>Confirmação de e-mail</div>
                                    <div className={styles.sectionSub}>
                                        {user.EmailConfirmedAt
                                            ? `Confirmado em ${formatDateTime(user.EmailConfirmedAt)}.`
                                            : "Sem isso, a recuperação de senha não chega até você - mas você ainda consegue acessar todas as funcionalidades."}
                                    </div>
                                </div>
                            </div>

                            <FormError>{errors.confirmation}</FormError>

                            {!user.EmailConfirmedAt && (
                                <div className={styles.actions}>
                                    <Button
                                        onClick={() =>
                                            void ProfileController.resendConfirmation(context)
                                        }
                                        disabled={
                                            pending === "confirmation" ||
                                            confirmationCooldown.blocked
                                        }
                                    >
                                        {pending === "confirmation"
                                            ? "Enviando…"
                                            : confirmationCooldown.blocked
                                              ? `Reenviar em ${confirmationCooldown.remaining}s`
                                              : "Reenviar confirmação"}
                                    </Button>
                                    {/* A `msg` do servidor, como veio: ela
                                        é a mesma para quem já confirmou e
                                        para quem não confirmou. */}
                                    {done.confirmation && (
                                        <span className={styles.ok}>{done.confirmation}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* ── Senha ─────────────────────────────────── */}
                    <Card>
                        <form className={styles.section} onSubmit={onChangePassword} noValidate>
                            <div className={styles.sectionHead}>
                                <div>
                                    <div className={styles.sectionTitle}>Trocar a senha</div>
                                    <div className={styles.sectionSub}>
                                        Você continua conectado nos aparelhos já autenticados.
                                    </div>
                                </div>
                            </div>

                            <FormError>{errors.password}</FormError>

                            <FormField label="Senha atual" required>
                                {(field) => (
                                    <PasswordInput
                                        {...field}
                                        autoComplete="current-password"
                                        value={passwordForm.oldPassword}
                                        onChange={(event) =>
                                            setPasswordForm((c) => ({
                                                ...c,
                                                oldPassword: event.target.value,
                                            }))
                                        }
                                    />
                                )}
                            </FormField>

                            <FormGrid columns={2}>
                                <FormField
                                    label="Nova senha"
                                    required
                                    help="Pelo menos 8 caracteres."
                                >
                                    {(field) => (
                                        <PasswordInput
                                            {...field}
                                            autoComplete="new-password"
                                            value={passwordForm.newPassword}
                                            onChange={(event) =>
                                                setPasswordForm((c) => ({
                                                    ...c,
                                                    newPassword: event.target.value,
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>
                                <FormField label="Repita a nova senha" required>
                                    {(field) => (
                                        <PasswordInput
                                            {...field}
                                            autoComplete="new-password"
                                            value={passwordForm.confirmation}
                                            onChange={(event) =>
                                                setPasswordForm((c) => ({
                                                    ...c,
                                                    confirmation: event.target.value,
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            <div className={styles.actions}>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={pending === "password"}
                                >
                                    {pending === "password" ? "Alterando…" : "Alterar senha"}
                                </Button>
                                {done.password && (
                                    <span className={styles.ok}>{done.password}</span>
                                )}
                            </div>
                        </form>
                    </Card>
                </div>

                <div className={styles.stack}>
                    {/* ── Biometria ─────────────────────────────── */}
                    <Card>
                        <div className={styles.section}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <div className={styles.sectionTitle}>Biometria</div>
                                    <div className={styles.sectionSub}>
                                        Os aparelhos que entram sem senha nesta conta.
                                    </div>
                                </div>
                            </div>

                            <FormError>{errors.passkey}</FormError>

                            {active.length === 0 ? (
                                <EmptyState
                                    inline
                                    icon={<IconFingerprint />}
                                    title="Nenhum aparelho com biometria"
                                    description="O convite aparece no próximo login por senha, neste aparelho."
                                />
                            ) : (
                                <div className={styles.list}>
                                    {active.map((passkey) => (
                                        <div className={styles.item} key={passkey.IdUserAuth}>
                                            <span className={styles.itemMark}>
                                                <IconFingerprint />
                                            </span>
                                            <div className={styles.itemBody}>
                                                <div className={styles.itemName}>
                                                    Aparelho {passkey.DeviceKey.slice(0, 8)}
                                                    {passkey.DeviceKey === deviceKey && (
                                                        <>
                                                            {" "}
                                                            <span className={styles.thisDevice}>
                                                                este
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className={styles.itemSub}>
                                                    Cadastrado em{" "}
                                                    {formatDateTime(passkey.CreatedAt)}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => setRemoving(passkey.IdUserAuth)}
                                                disabled={pending === "passkey"}
                                            >
                                                Remover
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {done.passkey && <span className={styles.ok}>{done.passkey}</span>}
                        </div>
                    </Card>

                    {/* ── Espaço ────────────────────────────────── */}
                    {/* A LISTA saiu daqui. Trocar de espaço é gesto do
                        chassi — o seletor acima do usuário, na barra
                        lateral —, porque o espaço é a raiz de tudo que a
                        tela mostra e repetir o gesto em cada página é
                        como as telas acabam cada uma com o seu. O que
                        fica é o endereço: onde você está, e por onde se
                        gerencia. */}
                    <Card>
                        <div className={styles.section}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <div className={styles.sectionTitle}>Seu espaço</div>
                                    <div className={styles.sectionSub}>
                                        Onde vivem suas contas, categorias e lançamentos.
                                        {workspaces.length > 1 &&
                                            ` Você participa de ${workspaces.length} — troque pelo seletor da barra lateral.`}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.meta}>
                                <div>
                                    <div className={styles.metaLabel}>Espaço atual</div>
                                    <div className={styles.metaValue}>{workspace?.Name ?? "—"}</div>
                                </div>
                                <div>
                                    <div className={styles.metaLabel}>Seu papel</div>
                                    <div className={styles.metaValue}>
                                        {isOwner ? "Dono" : "Membro"}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Link to="/espaco">
                                    <Button>
                                        {isOwner ? "Gerenciar e convidar" : "Ver o espaço"}
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </Card>

                    {/* ── Sessão ────────────────────────────────── */}
                    <Card>
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>Sessão</div>
                            <div className={styles.meta}>
                                <div>
                                    <div className={styles.metaLabel}>Último acesso</div>
                                    <div className={styles.metaValue}>
                                        {user.LastLogin ? formatDateTime(user.LastLogin) : "—"}
                                    </div>
                                </div>
                                <div>
                                    <div className={styles.metaLabel}>Conta criada em</div>
                                    <div className={styles.metaValue}>
                                        {formatDateTime(user.CreatedAt)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <ConfirmDialog
                open={removing !== null}
                onClose={() => setRemoving(null)}
                onConfirm={() => {
                    const id = removing;
                    setRemoving(null);
                    if (id !== null) void ProfileController.removePasskey(context, id);
                }}
                title="Remover a biometria deste aparelho?"
                description="Ele volta a entrar por e-mail e senha. Você pode cadastrar de novo depois."
                confirmLabel="Remover"
                danger
                pending={pending === "passkey"}
            />
        </Page>
    );
}
