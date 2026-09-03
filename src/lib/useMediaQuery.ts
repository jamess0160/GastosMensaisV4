import { useCallback, useSyncExternalStore } from "react";

/* ════════════════════════════════════════════════════════════
   O breakpoint do sistema em JavaScript.

   POR QUE ISSO EXISTE, se CSS já resolve. Nas telas de movimento o
   mobile não é a mesma lista com outra roupa: é uma LISTA DE CARDS no
   lugar de uma tabela. Renderizar as duas e esconder uma com
   `display: none` significaria montar centenas de nós a mais — e,
   pior, disparar as mesmas requisições de detalhe duas vezes. O hook
   escolhe UM dos dois.

   Para tudo que é só aparência (esconder um botão, empilhar uma barra)
   o certo continua sendo a media query no CSS: ela não custa render.
   ════════════════════════════════════════════════════════════ */

/** O mesmo 900px do resto do sistema — o ponto em que a sidebar dá
 *  lugar à barra inferior. Mudou aqui, muda nas folhas junto. */
export const MOBILE_QUERY = "(max-width: 900px)";

/** `useSyncExternalStore` e não `useState` + efeito: o valor é lido no
 *  mesmo instante do render, então a primeira pintura já sai com a
 *  forma certa. Com efeito, a tabela apareceria por um quadro antes de
 *  virar lista. */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = window.matchMedia?.(query);
            list?.addEventListener("change", onChange);
            return () => list?.removeEventListener("change", onChange);
        },
        [query],
    );

    /* `matchMedia` não existe no jsdom, onde os testes rodam. Sem esta
       guarda, qualquer teste que renderizasse uma tela quebraria aqui —
       e o desktop é o padrão certo para um ambiente sem viewport. */
    const read = useCallback(() => window.matchMedia?.(query).matches ?? false, [query]);

    return useSyncExternalStore(subscribe, read, () => false);
}

export const useIsMobile = (): boolean => useMediaQuery(MOBILE_QUERY);
