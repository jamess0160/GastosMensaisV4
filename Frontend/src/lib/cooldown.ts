import { useCallback, useEffect, useState } from "react";

/* ════════════════════════════════════════════════════════════
   O freio é NOSSO enquanto o servidor não tem rate limiting.

   Uma rota pública que dispara e-mail é o primeiro lugar onde a falta
   dele dói: sem freio, um clique repetido em "reenviar" enche a caixa
   de entrada de alguém e queima a reputação do domínio no provedor.

   O que este contador NÃO é: segurança. Ele mora no navegador e
   qualquer um o contorna com `curl` — o freio de verdade é o do
   servidor, e o dia em que ele existir para estas rotas este arquivo
   continua valendo, mas como cortesia de tela. O que ele resolve de
   fato é o clique ansioso: o e-mail demora, a pessoa clica de novo, e
   sem trava nenhuma ela dispara três.
   ════════════════════════════════════════════════════════════ */

export interface Cooldown {
    /** Segundos que faltam. `0` = pode agir. */
    remaining: number;
    /** Atalho de leitura: o botão fica travado enquanto for `true`. */
    blocked: boolean;
    /** Começa a contagem. Chame no SUCESSO da ação, não no clique. */
    start(): void;
}

/** Um contador regressivo de `seconds` segundos.
 *
 *  A contagem começa quando quem chama manda — e o lugar certo é o
 *  sucesso da requisição, não o clique: travar antes de saber se a
 *  chamada deu certo deixaria a pessoa esperando dois minutos por um
 *  e-mail que nunca foi pedido. */
export function useCooldown(seconds: number): Cooldown {
    const [until, setUntil] = useState<number | null>(null);
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        if (until === null) return;

        /* O relógio é a diferença até o instante do fim, e não um
           contador que se decrementa: um `setInterval` de 1s atrasa
           quando a aba fica em segundo plano, e o botão destravaria
           tarde — ou nunca, numa aba que dormiu. */
        const tick = () => {
            const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
            setRemaining(left);
            if (left === 0) setUntil(null);
        };

        tick();
        const timer = window.setInterval(tick, 500);
        return () => window.clearInterval(timer);
    }, [until]);

    const start = useCallback(() => {
        setUntil(Date.now() + seconds * 1000);
        setRemaining(seconds);
    }, [seconds]);

    return { remaining, blocked: remaining > 0, start };
}
