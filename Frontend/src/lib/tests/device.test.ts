import { afterEach, describe, expect, it } from "vitest";
import { restoreNavigator, stubNavigator } from "@/test/navigator";
import { isMobileDevice } from "../device";

const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPAD =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

describe("isMobileDevice", () => {
    // Sem isto o `userAgent` forjado vaza para as outras suítes do processo.
    afterEach(restoreNavigator);

    it("é falso no desktop, que é o que o jsdom anuncia por padrão", () => {
        expect(isMobileDevice()).toBe(false);
    });

    // 1. A resposta direta do Chromium.
    it("acredita no userAgentData.mobile quando ele existe", () => {
        stubNavigator({ userAgentData: { mobile: true }, userAgent: IPHONE });

        expect(isMobileDevice()).toBe(true);
    });

    /* O `false` do navegador vence a string de UA, e é de propósito: um
       desktop que se diz Android por extensão ou modo de compatibilidade
       é desktop. */
    it("acredita no userAgentData.mobile falso mesmo com UA de celular", () => {
        stubNavigator({ userAgentData: { mobile: false }, userAgent: ANDROID });

        expect(isMobileDevice()).toBe(false);
    });

    // 2. Safari e Firefox, que não têm UA-CH: sobra a string.
    it("reconhece iPhone e Android pelo userAgent, sem UA-CH", () => {
        stubNavigator({ userAgentData: undefined, userAgent: IPHONE });
        expect(isMobileDevice()).toBe(true);

        stubNavigator({ userAgent: ANDROID });
        expect(isMobileDevice()).toBe(true);
    });

    /* 3. O iPad do iPadOS 13 em diante manda UA de Mac. Quem o
       desmascara é a tela: um Mac de verdade não tem toque. */
    it("reconhece o iPad que se diz Macintosh", () => {
        stubNavigator({ userAgent: IPAD, platform: "MacIntel", maxTouchPoints: 5 });

        expect(isMobileDevice()).toBe(true);
    });

    it("não confunde um Mac de verdade com o iPad", () => {
        stubNavigator({ userAgent: IPAD, platform: "MacIntel", maxTouchPoints: 0 });

        expect(isMobileDevice()).toBe(false);
    });
});
