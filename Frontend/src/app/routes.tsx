import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import styles from "./AppShell.module.css";
import { MODAL_SCREENS } from "./screens";
import { Login } from "@/pages/Login/Login";

/* As rotas espelham as 8 telas do layout (Layout/Hi-fi Desktop), mais
   as duas que o contrato pede e o layout não desenha: criar conta e
   perfil.

   As telas de dentro do chassi vêm de `screens.tsx` e são montadas pelo
   AppShell, não por aqui: ver o cabeçalho de `modalRoute.tsx`. */

const SignUp = lazy(() => import("@/pages/SignUp/SignUp").then((m) => ({ default: m.SignUp })));
const Invite = lazy(() => import("@/pages/Invite/Invite").then((m) => ({ default: m.Invite })));
const ForgotPassword = lazy(() =>
    import("@/pages/ForgotPassword/ForgotPassword").then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = lazy(() =>
    import("@/pages/ResetPassword/ResetPassword").then((m) => ({ default: m.ResetPassword })),
);
const ConfirmEmail = lazy(() =>
    import("@/pages/ConfirmEmail/ConfirmEmail").then((m) => ({ default: m.ConfirmEmail })),
);
const Terms = lazy(() => import("@/pages/Legal/Terms").then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import("@/pages/Legal/Privacy").then((m) => ({ default: m.Privacy })));

const load = (screen: ReactNode) => (
    <Suspense fallback={<div className={styles.center}>Carregando…</div>}>{screen}</Suspense>
);

export const router = createBrowserRouter([
    { path: "/login", element: <Login /> },
    { path: "/cadastro", element: load(<SignUp />) },
    /* FORA do chassi, e é o ponto: quem recebeu o link do convite pode
       não ter conta nenhuma. `GET /Workspaces/invite/Hash=` é a única
       rota pública além das de entrar e cadastrar. */
    { path: "/convite/:hash", element: load(<Invite />) },
    /* As duas da recuperação são públicas por definição: quem esqueceu a
       senha não tem sessão. A proteção não é o cookie, é o link assinado
       que chega ao e-mail do dono da conta.

       O link do e-mail aponta para `/recuperar-senha?Token=…` — para a
       TELA, e não para a API —, e a troca acontece num POST daqui: um
       GET que muda estado seria gasto pelo pré-carregador de link do
       cliente de e-mail, sem ninguém ter clicado. */
    { path: "/esqueci-senha", element: load(<ForgotPassword />) },
    { path: "/recuperar-senha", element: load(<ResetPassword />) },
    /* Também pública, e pelo mesmo motivo: quem não confirmou pode não
       ter sessão nenhuma — o link chega no cadastro e é aberto em outro
       aparelho. */
    { path: "/confirmar-email", element: load(<ConfirmEmail />) },
    /* Os dois documentos legais, públicos pelo mesmo motivo das de
       cima: quem lê os termos ANTES de criar a conta não tem sessão, e
       dentro do chassi o guard mandaria para o login. Eles também são
       abertos em aba nova pelo rótulo do checkbox do cadastro, com o
       formulário meio preenchido esperando na aba de trás. */
    { path: "/termos", element: load(<Terms />) },
    { path: "/privacidade", element: load(<Privacy />) },
    {
        path: "/",
        element: <AppShell />,
        /* Só as MODAIS são rotas aqui. As telas são desenhadas pelo
           próprio chassi, a partir de `SHELL_SCREENS`, porque uma rota
           modal precisa mostrar a tela de onde foi aberta e não a que a
           URL diz — ver `modalRoute.tsx`. O `*` é o que faz qualquer
           URL de tela casar com o chassi; o que ela desenha é decidido
           lá dentro.

           `element: null` é o certo, e não um esquecimento: este `*`
           casa com `/gastos` e com toda outra tela do chassi, então o
           que for posto aqui aparece SEMPRE, por cima da tela. O
           `<Outlet />` do chassi desenha painel modal e mais nada — e o
           404 de URL desconhecida mora no `*` de `ScreenRoutes`, o
           único que só sobra quando nenhuma tela casou.

           Fora do chassi não há 404 a escrever: `/termos` digitado
           errado não casa com nenhuma rota pública, cai neste `path: "/"`
           e vira o chassi — com sessão, o 404 de dentro; sem sessão, o
           guard manda para o login. */
        children: [...MODAL_SCREENS, { path: "*", element: null }],
    },
]);
