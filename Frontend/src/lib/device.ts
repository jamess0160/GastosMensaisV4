/* ════════════════════════════════════════════════════════════
   O APARELHO — que não é a mesma pergunta que a JANELA.

   Existe um `useIsMobile` em `src/lib/useMediaQuery.ts`, e ele NÃO
   serve aqui. Aquele é `matchMedia("(max-width: 900px)")`: uma pergunta
   sobre o tamanho da janela, feita para escolher entre a tabela e a
   lista de cards — e ali responder "mobile" numa janela estreita de
   desktop é a resposta certa, porque a tabela realmente não cabe.

   Aqui a pergunta é sobre o aparelho, e o breakpoint daria a resposta
   errada de um jeito que se vê: estreitar a janela do Chrome faria a
   oferta de biometria aparecer, e alargá-la a faria sumir. Pior, o
   convite "usar biometria neste aparelho?" GRAVA CREDENCIAL de verdade
   — dispará-lo por causa do tamanho da janela é registrar passkey por
   acidente de layout. São duas perguntas diferentes, em dois arquivos
   diferentes.
   ════════════════════════════════════════════════════════════ */

/** O tipo mínimo de `navigator.userAgentData`, declarado aqui porque o
 *  lib DOM do TypeScript não o tem: o User-Agent Client Hints é só do
 *  Chromium, e o `lib.dom.d.ts` só descreve o que é padrão em todos.
 *
 *  Só `mobile` interessa — `brands` e `platform` existem na API real e
 *  não são lidos, e declarar o que não se usa seria prometer um
 *  contrato que este arquivo não confere. */
type NavigatorUserAgentData = {
    readonly mobile?: boolean;
};

type NavigatorWithUserAgentData = Navigator & {
    readonly userAgentData?: NavigatorUserAgentData;
};

/** Os quatro aparelhos que rodam este produto no dedo. `iPad` está aqui
 *  para o Safari antigo, que ainda se anunciava assim; o atual cai na
 *  terceira regra. */
const MOBILE_USER_AGENT = /Android|iPhone|iPad|iPod/i;

/** Este é um aparelho móvel?
 *
 *  Três perguntas, nesta ordem, e a primeira que responder decide:
 *
 *  1. `navigator.userAgentData.mobile` — no Chromium é a resposta
 *     DIRETA, booleana, dada pelo navegador. `false` dele é um "não"
 *     tão válido quanto o `true`, então ele vence a string de UA: um
 *     desktop que se diz Android por extensão ou modo de compatibilidade
 *     é desktop;
 *  2. a string de `userAgent` — Safari e Firefox não têm UA-CH, e é o
 *     único sinal que eles dão;
 *  3. o iPad que se diz Macintosh. Desde o iPadOS 13 o Safari do iPad
 *     manda UA de Mac, e o que o desmascara é a tela: um Mac de verdade
 *     não tem `maxTouchPoints`.
 *
 *  Não é segurança, é oferta. Quem forjar o `userAgent` para ver o botão
 *  de biometria não ganha nada com isso: quem valida a passkey é a API,
 *  contra o `DeviceKey` e o desafio dela. */
export function isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;

    const { userAgentData } = navigator as NavigatorWithUserAgentData;
    if (typeof userAgentData?.mobile === "boolean") return userAgentData.mobile;

    if (MOBILE_USER_AGENT.test(navigator.userAgent)) return true;

    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
