import { useLocation, useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import { Button, Workspace as Page } from "@/ui/primitives";
import { EmptyState } from "@/ui/states";
import { IconSearch } from "@/ui/icons";

/* ════════════════════════════════════════════════════════════
   A tela que não existe — o 404 de dentro do chassi.

   Ela mora DENTRO do `AppShell`, e não fora, porque quem chega aqui
   continua tendo sessão: jogar a pessoa para uma página nua seria tirar
   dela a sidebar, a barra do mobile e o espaço em que estava. A URL
   errou; a navegação não.

   Não é o `ErrorBoundary` (`src/app/ErrorBoundary.tsx`), e a mensagem
   não pode ser a dele: "algo deu errado" manda procurar um defeito que
   não há. Lá é a tela que QUEBROU, aqui é a que nunca existiu.

   Sem controller e sem sections, como as duas telas legais: não há
   evento nenhum. Voltar para o Início é navegação do roteador, não um
   evento de negócio.
   ════════════════════════════════════════════════════════════ */

export function NotFound() {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    /* `replace` porque o endereço quebrado não merece uma parada no
       histórico: quem clicar em "voltar" depois de sair daqui deve
       chegar de onde veio, e não ao 404 de novo. */
    const goHome = () => navigate("/", { replace: true });

    return (
        <Page className={styles.page}>
            <EmptyState
                icon={<IconSearch />}
                title="Esta página não existe"
                description={
                    <>
                        {/* O endereço aparece porque é a única pista de
                            que o erro está no LINK, e não no app. Sem
                            ele, a frase serve para qualquer coisa e não
                            ajuda em nada. */}
                        Nada no app responde por <code className={styles.path}>{pathname}</code>. O
                        link pode estar velho, ou o endereço veio com um erro de digitação.
                    </>
                }
                action={
                    <Button variant="primary" onClick={goHome}>
                        Ir para o Início
                    </Button>
                }
            />
        </Page>
    );
}
