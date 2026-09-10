import { Route, Routes, matchPath, useLocation, useNavigate } from "react-router-dom";
import { MODAL_SCREENS, SHELL_SCREENS } from "./screens";
/* A única tela do chassi que NÃO é `lazy`. As outras são pesadas e
   chegam sob demanda; esta é um card e um botão, e o momento em que ela
   é necessária é justamente o pior para depender de um chunk novo — uma
   URL desconhecida logo depois de um deploy é onde o pedido do chunk
   antigo também responderia 404, trocando a tela de "não existe" por um
   erro de carregamento. */
import { NotFound } from "@/pages/NotFound/NotFound";

/* ════════════════════════════════════════════════════════════
   Rotas modais — o padrão de "abrir por cima da tela atual".

   O formulário de gasto é um slide-over SOBRE uma lista, e tem URL
   própria (`/gastos/novo`) para poder ser aberto por link e voltar no
   histórico. Enquanto ele era rota filha de `/gastos`, abrir o painel
   pelo botão do Início TROCAVA de tela antes de abrir: a URL mandava, e
   a URL só sabia falar de Gastos.

   A correção é a que o React Router documenta: quem navega guarda de
   onde veio (`state.background`), e o chassi desenha a tela de fundo
   dessa origem mais o painel por cima. A URL continua sendo a do painel
   — o link direto funciona igual, e aí o fundo é o padrão, Gastos.

   QUEM DESENHA O QUÊ. As telas saíram das rotas do roteador e passaram
   a ser montadas aqui, sempre — o `<Outlet />` do chassi só desenha
   painel. É isso que faz a tela de fundo NÃO REMONTAR quando o painel
   abre: se ela viesse do `<Outlet />` fora da modal e daqui dentro
   dela, seriam duas posições diferentes na árvore, e abrir o formulário
   apagaria os filtros da lista atrás.
   ════════════════════════════════════════════════════════════ */

/** O fundo de quem chegou por link, sem origem para voltar. */
const DEFAULT_BACKGROUND = "/gastos";

const MODAL_PATHS = MODAL_SCREENS.map((screen) => `/${screen.path}`);

/** Guardamos só o caminho, e não o objeto `Location` inteiro: ele
 *  carrega o próprio `state`, e abrir um painel de dentro do outro
 *  aninharia histórico dentro de histórico. */
type Background = string;

/** Navega para uma rota modal marcando a tela atual como fundo. */
export function useOpenModal() {
    const navigate = useNavigate();
    const location = useLocation();

    return (to: string) =>
        navigate(to, { state: { background: location.pathname + location.search } });
}

/** Qual tela desenhar atrás. Numa rota modal é a de onde o painel foi
 *  aberto; fora dela, a própria URL. */
export function useScreenLocation(): Background {
    const location = useLocation();
    const here = location.pathname + location.search;

    if (!MODAL_PATHS.some((path) => matchPath(path, location.pathname))) return here;

    const state = location.state as { background?: Background } | null;
    return state?.background ?? DEFAULT_BACKGROUND;
}

/** As telas, montadas a partir da MESMA lista em qualquer caminho.
 *
 *  É um `<Routes>` com a localização trocada. Em dev o React Router
 *  avisa que a rota-pai não termina em `*`; aqui isso é esperado,
 *  porque este render é paralelo ao do `<Outlet />` — não uma
 *  continuação dele. */
export function ScreenRoutes({ at }: { at: Background }) {
    return (
        <Routes location={at}>
            {SHELL_SCREENS.map((screen) =>
                screen.index ? (
                    <Route index key="index" element={screen.element} />
                ) : (
                    <Route key={screen.path} path={screen.path} element={screen.element} />
                ),
            )}
            {/* O 404, e é AQUI que ele mora — não no `path: "*"` de
                `routes.tsx`, que casa com toda tela do chassi (só as
                modais são rotas de verdade lá) e portanto desenharia o
                404 por cima de Gastos, do Relatório e de todas as
                outras. Este `*` é o único que só sobra quando nenhuma
                tela casou. */}
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
