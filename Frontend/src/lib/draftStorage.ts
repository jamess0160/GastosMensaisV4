/* ════════════════════════════════════════════════════════════
   Resgate de rascunho.

   O cookie de sessão vale 24h. Quem deixa o formulário de gasto aberto
   e volta no dia seguinte leva 401 no `salvar`, é mandado ao login, e
   perde tudo o que digitou — inclusive o rateio, que é a parte que dá
   trabalho de montar.

   Isto guarda o rascunho no `sessionStorage` a cada mudança e o devolve
   quando a tela monta de novo. `sessionStorage`, e não `localStorage`,
   de propósito: um rascunho é da sessão do navegador, e ressuscitar o
   gasto de três semanas atrás numa aba nova seria pior do que perdê-lo.
   ════════════════════════════════════════════════════════════ */

const PREFIX = "gm.draft.";

export function readDraft<T>(key: string): T | null {
    try {
        const raw = window.sessionStorage.getItem(PREFIX + key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        // Storage bloqueado ou JSON corrompido: começa em branco, que é
        // o comportamento de antes deste arquivo existir.
        return null;
    }
}

export function writeDraft<T>(key: string, value: T): void {
    try {
        window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        // Cota estourada ou storage bloqueado. O formulário continua
        // funcionando; só não sobrevive a um recarregamento.
    }
}

export function clearDraft(key: string): void {
    try {
        window.sessionStorage.removeItem(PREFIX + key);
    } catch {
        // Nada a fazer.
    }
}
