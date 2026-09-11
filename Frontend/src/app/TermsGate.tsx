import { useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import styles from "./AppShell.module.css";
import { sessionKeys, useSignOut } from "./session";
import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import { formatDate } from "@/lib/date";
import { LEGAL_VERSION } from "@/pages/Legal/LegalLayout";
import { Button } from "@/ui/primitives";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O re-aceite dos termos, quando o documento muda.

   Ele mora no CHASSI, ao lado da faixa do e-mail, e pela mesma razão
   dela: o estado do aceite é informação da conta, e vale em qualquer
   lugar do app — não é de uma tela.

   E aqui ele é o OPOSTO da faixa, de propósito. A faixa não trava nada,
   porque o que está pendente é uma verificação e bloquear o login custa
   cadastro. O re-aceite trava, porque o que está pendente é a permissão
   de continuar prestando o serviço sob o texto novo: um "agora não"
   registraria que a pessoa usou o produto sob um documento que ela não
   aceitou, que é o buraco que o aceite do cadastro fechou e que
   reabriria aqui pela porta dos fundos.

   **Quem decide se o aceite está velho é a API.** O cliente lê o
   `TermsOutdated` e não compara nada — ver o comentário do campo em
   `src/types/api.ts`.
   ════════════════════════════════════════════════════════════ */

/** Aceitar de novo.
 *
 *  A rota não recebe corpo: a versão que fica gravada é a da API. E
 *  depois do 200 a conta é RELIDA, porque é o `TermsOutdated` do
 *  `getSelf` que tira o modal da frente — marcar o estado localmente
 *  seria o cliente decidindo, com uma cópia, o que o servidor acabou de
 *  decidir com o dado.
 *
 *  Só a conta é invalidada. Nada mais mudou: o aceite não é do espaço,
 *  não mexe em lançamento nenhum, e zerar o cache inteiro faria o app
 *  rebuscar tudo por causa de um clique que não moveu um centavo. */
export async function acceptTerms(queryClient: QueryClient): Promise<void> {
    await UsersConnection.acceptTerms();

    await queryClient.invalidateQueries({ queryKey: sessionKeys.user });
}

export interface TermsGateCopy {
    title: string;
    body: string;
}

/** O texto do modal tem DUAS FORMAS, e a diferença importa para quem lê.
 *
 *  Com uma versão anterior gravada, os termos mudaram de verdade, e as
 *  duas datas dizem o que mudou de onde para onde. Com `null` não houve
 *  mudança nenhuma — é conta anterior aos documentos, que nunca aceitou
 *  nada —, e dizer "mudaram" a essa pessoa seria mentir sobre o que
 *  aconteceu.
 *
 *  A data vigente é a `LEGAL_VERSION`, a mesma impressa no topo das duas
 *  páginas que os links abrem: aqui ela é TEXTO PARA LER, não valor para
 *  comparar — a comparação é a da API, e é só dela. */
export function termsGateCopy(acceptedVersion: string | null): TermsGateCopy {
    if (!acceptedVersion) {
        return {
            title: "Aceite os termos para continuar",
            body: `Sua conta é anterior aos nossos documentos, então ainda não há um aceite registrado nela. Para continuar usando o Gastos mensais, leia e aceite a versão de ${LEGAL_VERSION}.`,
        };
    }

    return {
        title: "Os termos mudaram",
        body: `Você aceitou a versão de ${formatDate(acceptedVersion)}, e a que vale agora é a de ${LEGAL_VERSION}. Para continuar usando o Gastos mensais, leia e aceite a versão nova.`,
    };
}

/** O modal bloqueante. Fora de data, ele cobre o app inteiro; em dia,
 *  não desenha nada.
 *
 *  **Duas saídas, e não há terceira**: aceitar, ou sair da conta. Não há
 *  botão de fechar, não fecha no Escape e não fecha no clique fora — as
 *  três seriam o "agora não" que esta tela existe para não oferecer.
 *
 *  Os dois links abrem em ABA NOVA, como no rótulo do checkbox do
 *  cadastro, e é por isso que `/termos` e `/privacidade` nasceram fora
 *  do chassi: um modal que cobre o app inteiro não pode mandar navegar
 *  para uma rota que ele mesmo cobriria. */
export function TermsGate({ user }: { user: ApiTypes.User }) {
    const queryClient = useQueryClient();
    const signOut = useSignOut();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!user.TermsOutdated) return null;

    const copy = termsGateCopy(user.TermsVersion);

    /* No sucesso não há o que desligar: a releitura da conta volta com
       `TermsOutdated: false` e este componente deixa de desenhar. O
       `pending` só se desfaz no erro, que é o caso em que a pessoa
       continua aqui e precisa do botão de novo. */
    const onAccept = () => {
        setPending(true);
        setError(null);

        void acceptTerms(queryClient).catch((cause: unknown) => {
            setError(errorMessage(cause));
            setPending(false);
        });
    };

    return (
        <>
            <div className={styles.gateScrim} />
            <div className={styles.gate} role="dialog" aria-modal="true" aria-label={copy.title}>
                <h2 className={styles.gateTitle}>{copy.title}</h2>
                <p className={styles.gateBody}>{copy.body}</p>
                <p className={styles.gateLinks}>
                    <a href="/termos" target="_blank" rel="noopener noreferrer">
                        Termos de uso
                    </a>
                    <a href="/privacidade" target="_blank" rel="noopener noreferrer">
                        Política de privacidade
                    </a>
                </p>

                {error && (
                    <div className={styles.gateError} role="alert">
                        {error}
                    </div>
                )}

                <div className={styles.gateActions}>
                    {/* Sair fica à esquerda e sem destaque: é uma saída
                        de verdade, não a recomendada. */}
                    <Button variant="ghost" onClick={signOut} disabled={pending}>
                        Sair da conta
                    </Button>
                    <Button variant="primary" onClick={onAccept} disabled={pending} autoFocus>
                        {pending ? "Aceitando…" : "Li e aceito"}
                    </Button>
                </div>
            </div>
        </>
    );
}
