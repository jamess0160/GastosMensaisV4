import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";

/* ════════════════════════════════════════════════════════════
   O tema, depois que o app sobe.

   SÃO TRÊS ESTADOS, e não um interruptor: claro, escuro e sistema —
   com "sistema" sendo o padrão. "Sistema" não é meio-termo entre os
   outros dois: é ABRIR MÃO da escolha, e é por isso que ele APAGA o
   `data-theme` em vez de carimbar um valor. Sem o atributo, quem
   responde é a media query de `tokens.css`, e o app passa a seguir o
   aparelho quando ele mudar — inclusive no meio da sessão.

   A ESCOLHA É DO APARELHO, e mora no `localStorage`: o celular escuro
   à noite e o desktop claro no escritório são a mesma pessoa. Não
   custa coluna no banco nem rota, e não precisa de sessão para valer —
   a tela de login também é escura.

   QUEM APLICA O TEMA NA PRIMEIRA PINTURA NÃO É ESTE ARQUIVO, é
   `public/theme.js`, chamado no `<head>`. Este aqui é o dono do tema
   DEPOIS disso: ele lê o mesmo `localStorage`, escuta a preferência do
   sistema e reaplica o atributo quando a escolha muda. Os dois
   concordam por construção — mesma chave, mesma regra —, e a chave
   está escrita nos dois lugares porque um arquivo de `public/` não
   participa do grafo de módulos.

   E ele é CONTEXTO, e não só uma função, por causa do Relatório: os
   gráficos são canvas, leem os tokens por `getComputedStyle` e não
   enxergam `var(--ink-2)`. Eles acompanham o tema de graça, mas só se
   o componente RERENDERIZAR na troca — e o que provoca esse rerender é
   assinar este contexto.
   ════════════════════════════════════════════════════════════ */

/** O que a pessoa escolheu. */
export type ThemeChoice = "light" | "dark" | "system";

/** O que a escolha virou depois de consultar o sistema. Nunca
 *  "system": um tema resolvido é claro ou escuro. */
export type ResolvedTheme = "light" | "dark";

/** A mesma chave de `public/theme.js`. Mudou aqui, muda lá. */
export const THEME_STORAGE_KEY = "gm.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** A cor da barra do navegador no telefone, por tema — as mesmas duas
 *  de `public/theme.js`. No claro é a marca; no escuro, o fundo da
 *  página, porque uma faixa laranja acesa sobre um app escuro é
 *  exatamente o que o tema escuro existe para não fazer. */
const BAR_COLOR: Record<ResolvedTheme, string> = { light: "#ff6a00", dark: "#141312" };

interface Theme {
    choice: ThemeChoice;
    resolved: ResolvedTheme;
    setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
    const theme = useContext(ThemeContext);
    if (!theme) throw new Error("useTheme fora de <ThemeProvider>");
    return theme;
}

/* As duas pontas do `localStorage`, com a mesma guarda de
   `src/lib/deviceKey.ts`: ele LANÇA — não devolve `null` — em
   navegador com dados de site bloqueados e em algumas janelas
   privadas. Uma preferência de aparência não pode derrubar o app, nem
   impedir a troca de tema: sem storage, a escolha vale enquanto a aba
   estiver aberta. */
function readChoice(): ThemeChoice {
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
        return "system";
    }
}

function writeChoice(choice: ThemeChoice): void {
    try {
        /* "sistema" APAGA a chave em vez de gravar a palavra "system":
           assim, ausência e "sem escolha" são a mesma coisa, e
           `public/theme.js` não precisa conhecer um terceiro valor
           para acertar. */
        if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
        else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
        // Storage bloqueado: a escolha vale só nesta aba.
    }
}

/** Carimba (ou apaga) o `data-theme` no `<html>` — a mesma regra de
 *  `public/theme.js`, que já fez isto antes da primeira pintura. */
function applyChoice(choice: ThemeChoice): void {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);

    /* `useMediaQuery` e não um `useState` + efeito: ele lê no mesmo
       instante do render (`useSyncExternalStore`), então o primeiro
       render já sai com o tema resolvido certo — e ele já é a guarda
       do `matchMedia`, que não existe no jsdom dos testes. */
    const systemDark = useMediaQuery(DARK_QUERY);
    const resolved: ResolvedTheme = choice === "system" ? (systemDark ? "dark" : "light") : choice;

    /* A rede de segurança do carimbo: `public/theme.js` já o fez, mas
       ele pode não ter rodado (bloqueado, ou o `index.html` servido por
       outro caminho). Reaplicar o mesmo valor não custa nada. */
    useEffect(() => {
        applyChoice(choice);
    }, [choice]);

    useEffect(() => {
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", BAR_COLOR[resolved]);
    }, [resolved]);

    const setChoice = useCallback((next: ThemeChoice) => {
        /* O ATRIBUTO MUDA ANTES DO ESTADO, e isso importa por causa do
           Relatório. Os gráficos leem os tokens com `getComputedStyle`
           durante o render; se o `data-theme` só fosse carimbado no
           efeito — que roda DEPOIS do render —, o primeiro render
           depois da troca leria a paleta antiga e os eixos ficariam do
           tema anterior até o próximo render. Aqui o DOM já está no
           tema novo quando o React rerenderiza. */
        applyChoice(next);
        writeChoice(next);
        setChoiceState(next);
    }, []);

    const value = useMemo<Theme>(
        () => ({ choice, resolved, setChoice }),
        [choice, resolved, setChoice],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
