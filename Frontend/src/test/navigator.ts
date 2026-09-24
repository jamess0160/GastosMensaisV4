/** Forja o `navigator` do jsdom — e desfaz.
 *
 *  O jsdom anuncia um DESKTOP: o `userAgent` dele diz `(win32)` e
 *  `jsdom/29`, sem nenhum dos tokens de celular, e `platform` vem vazia —
 *  `maxTouchPoints` e `userAgentData` nem existem. Isso é ótimo, porque o
 *  desktop é o caso que a maioria dos testes descreve sem precisar de
 *  nada — mas um teste de aparelho móvel tem que forjar.
 *
 *  `navigator.userAgent` e companhia são GETTERS no protótipo, não
 *  propriedades graváveis: `navigator.userAgent = "..."` não faz nada. O
 *  que funciona é `defineProperty` com `configurable: true` no próprio
 *  objeto, sombreando o getter do protótipo.
 *
 *  E o `restoreNavigator` não é opcional. Os arquivos de teste dividem o
 *  processo, e o `navigator` é global: um `userAgent` de iPhone deixado
 *  para trás vaza para a suíte seguinte — que passaria a testar um
 *  aparelho que ninguém pediu, num arquivo que não menciona nada disso.
 *  Chame-o no `afterEach`. */
type NavigatorStub = {
    userAgent?: string;
    platform?: string;
    maxTouchPoints?: number;
    /** O User-Agent Client Hints, que só o Chromium tem. Passar
     *  `undefined` é o que simula Safari e Firefox. */
    userAgentData?: { mobile?: boolean };
};

/** O descritor original de cada propriedade tocada. `undefined` aqui
 *  significa "não era propriedade própria do `navigator`" — e aí desfazer
 *  é apagar a que foi criada, devolvendo o getter do protótipo. */
const originals = new Map<string, PropertyDescriptor | undefined>();

export function stubNavigator(props: NavigatorStub): void {
    for (const [key, value] of Object.entries(props)) {
        if (!originals.has(key)) {
            originals.set(key, Object.getOwnPropertyDescriptor(navigator, key));
        }

        Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
    }
}

export function restoreNavigator(): void {
    for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(navigator, key, descriptor);
        else delete (navigator as unknown as Record<string, unknown>)[key];
    }

    originals.clear();
}

/** O atalho dos testes que só precisam que o aparelho seja móvel, sem
 *  dizer qual: um iPhone pelo `userAgent`, que é o caminho que Safari e
 *  Firefox de verdade tomam. */
export function stubMobileNavigator(): void {
    stubNavigator({
        userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    });
}
