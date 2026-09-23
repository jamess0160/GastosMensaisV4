import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./src/styles.module.css";
import { InviteController, type InviteContext } from "./controller";
import { useSessionQuery, useSwitchWorkspace } from "@/app/session";
import { useInvitePreview } from "@/data/invitePreview";
import { ApiUnauthorizedError } from "@/api/client";
import { AuthLayout } from "@/ui/AuthLayout";
import { Button } from "@/ui/primitives";
import { FormError } from "@/ui/form";
import { LoadingRows } from "@/ui/states";
import { formatDateTime } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O aceite de um convite — a única tela pública além de entrar e
   criar conta.

   Ela é pública porque tem que ser: quem recebeu o link ainda pode não
   ter conta, e mandá-lo para o login primeiro esconderia de quem é o
   convite e para qual espaço ele serve. `GET /Workspaces/invite/Hash=`
   responde sem sessão e não devolve id nenhum, de propósito — a rota
   não pode virar sonda para descobrir workspace contando.

   DOIS CAMINHOS saem daqui, e o que os separa é ter conta:
   quem tem chama `join`; quem não tem vai para o cadastro levando o
   hash, e é o `POST /Users` que matricula.
   ════════════════════════════════════════════════════════════ */

const ROLE_LABEL: Record<ApiTypes.WorkspaceRole, string> = {
    editor: "lançar e editar",
    viewer: "consultar",
};

export function Invite() {
    const navigate = useNavigate();
    const params = useParams();
    const hash = params.hash ?? "";
    const switchWorkspace = useSwitchWorkspace();

    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    /* A consulta mora em `src/data/invitePreview.ts` porque o CADASTRO
       lê o mesmo hash pela mesma rota: é de lá que sai o e-mail com que
       o formulário nasce preenchido e travado. Uma chave só é o que
       impede as duas telas de pedirem a mesma coisa duas vezes. */
    const invite = useInvitePreview(hash);

    /* Tem sessão? É o que decide qual dos dois caminhos a tela oferece.
       Quem não tem recebe 401, e aqui isso não é erro — é informação.

       Enquanto a resposta não chega, NENHUM dos dois caminhos aparece:
       mostrar "criar conta" para quem já está logado, e trocá-lo meio
       segundo depois, é o tipo de piscada que faz o usuário clicar no
       botão errado. */
    const session = useSessionQuery();
    const checkingSession = session.isPending;
    const signedIn = session.isSuccess;
    const sameEmail =
        !signedIn || !invite.data
            ? true
            : session.data.Email.trim().toLowerCase() === invite.data.Email.trim().toLowerCase();

    const context = useMemo<InviteContext>(
        () => ({
            hash,
            beginSubmit() {
                setPending(true);
                setError(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishAccept() {
                setPending(false);
                // O `switch` já aconteceu: entrar na home é entrar JÁ no
                // espaço novo, e não no antigo com um aviso.
                navigate("/", { replace: true });
            },
        }),
        [hash, navigate],
    );

    const body = () => {
        if (invite.isPending) return <LoadingRows rows={3} />;

        if (invite.isError) {
            /* Os quatro casos do contrato — inexistente, revogado,
               expirado e já aceito — vêm como 406 com a `msg` dizendo
               qual. Mostrá-la é o que manda o usuário para o lugar
               certo: "expirou, peça outro" e "não encontrado" não levam
               ao mesmo lugar. */
            return (
                <>
                    <FormError>
                        {invite.error instanceof ApiUnauthorizedError
                            ? "Não foi possível ler este convite."
                            : (invite.error as Error).message}
                    </FormError>
                    <div className={styles.actions}>
                        <Button onClick={() => navigate("/login")}>Ir para o login</Button>
                    </div>
                </>
            );
        }

        const preview = invite.data;
        const expired = new Date(preview.ExpiresAt) < new Date();

        return (
            <>
                <div className={styles.card}>
                    <div className={styles.workspace}>{preview.WorkspaceName}</div>

                    <div className={styles.line}>
                        <span className={styles.label}>Convidou</span>
                        <span className={styles.value}>{preview.InviterName}</span>
                    </div>
                    <div className={styles.line}>
                        <span className={styles.label}>Você poderá</span>
                        <span className={styles.value}>{ROLE_LABEL[preview.Role]}</span>
                    </div>
                    <div className={styles.line}>
                        <span className={styles.label}>Vale até</span>
                        <span className={styles.value}>{formatDateTime(preview.ExpiresAt)}</span>
                    </div>
                </div>

                {/* O e-mail não é enfeite: o link é compartilhável por
                    desenho — vai por WhatsApp —, e é o e-mail que fecha a
                    tranca. Dizer isso aqui evita o 406 mais comum. */}
                <div className={`${styles.lock} ${sameEmail ? "" : styles.mismatch}`}>
                    Este convite é de <b>{preview.Email}</b>. Só uma conta com esse e-mail entra —
                    encaminhar o link não dá acesso a mais ninguém.
                    {signedIn && !sameEmail && (
                        <>
                            <br />
                            Você está na conta <b>{session.data.Email}</b>: saia e entre com o
                            e-mail convidado, ou peça um convite para este endereço.
                        </>
                    )}
                </div>

                <FormError>{error}</FormError>

                <div className={styles.actions}>
                    {checkingSession ? (
                        <Button variant="primary" disabled>
                            Verificando sua sessão…
                        </Button>
                    ) : signedIn ? (
                        <Button
                            variant="primary"
                            disabled={pending || expired || !sameEmail}
                            onClick={() =>
                                void InviteController.acceptInvite(context, switchWorkspace)
                            }
                        >
                            {pending ? "Entrando…" : `Entrar em ${preview.WorkspaceName}`}
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="primary"
                                disabled={expired}
                                onClick={() =>
                                    navigate(`/cadastro?convite=${encodeURIComponent(hash)}`)
                                }
                            >
                                Criar conta e entrar
                            </Button>
                            <Button onClick={() => navigate("/login")}>Já tenho conta</Button>
                            <div className={styles.hint}>
                                Se você já tem conta, entre e abra este link de novo — ele continua
                                valendo.
                            </div>
                        </>
                    )}
                </div>
            </>
        );
    };

    return (
        <AuthLayout
            heading="Você foi convidado"
            subheading="Um espaço é onde vivem as contas, as categorias e os lançamentos de quem divide as despesas."
        >
            {body()}
        </AuthLayout>
    );
}
