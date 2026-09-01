import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "./src/styles.module.css";
import { ProfileController, type ProfileContext, type ProfileScope } from "./controller";
import { useSession, sessionKeys } from "@/app/session";
import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { FormError, FormField, FormGrid, Input, PasswordInput } from "@/ui/form";
import { IconFingerprint, IconTransfer } from "@/ui/icons";
import { ConfirmDialog } from "@/ui/overlay";
import { EmptyState } from "@/ui/states";
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
    const { user, workspaces } = useSession();
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
        [user, form, passwordForm, queryClient],
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

                    {/* ── Workspace ─────────────────────────────── */}
                    <Card>
                        <div className={styles.section}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <div className={styles.sectionTitle}>Seu espaço</div>
                                    <div className={styles.sectionSub}>
                                        Onde vivem suas contas, categorias e lançamentos.
                                    </div>
                                </div>
                            </div>

                            <FormError>{errors.workspace}</FormError>

                            {/* Hoje é um workspace por usuário e ele nasce
                                no cadastro. A lista aparece mesmo com um só:
                                o atual já vem desabilitado e rotulado
                                "Espaço atual", e mostrá-lo diz mais do que
                                uma seção vazia. */}
                            {workspaces.length > 0 && (
                                <div className={styles.workspaces}>
                                    {workspaces.map((workspace, index) => (
                                        <button
                                            key={workspace.IdWorkspace}
                                            type="button"
                                            className={`${styles.workspace} ${index === 0 ? styles.workspaceOn : ""}`}
                                            disabled={index === 0 || pending === "workspace"}
                                            onClick={() =>
                                                void ProfileController.switchWorkspace(
                                                    context,
                                                    workspace.IdWorkspace,
                                                )
                                            }
                                        >
                                            <span className={styles.itemMark}>
                                                <IconTransfer />
                                            </span>
                                            <div className={styles.itemBody}>
                                                <div className={styles.itemName}>
                                                    {workspace.Name}
                                                </div>
                                                <div className={styles.itemSub}>
                                                    {index === 0
                                                        ? "Espaço atual"
                                                        : "Trocar para este espaço"}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
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
