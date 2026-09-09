import { ApiUnauthorizedError } from "@/api/client";
import { UtilsConnection } from "@/api/Utils.connection";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Telemetria de erro não tratado.

   `POST /Utils/Logs` é rota AUTENTICADA: um erro que acontece na tela
   de login, ou depois da sessão expirar, não tem como ser reportado —
   e insistir só geraria um 401 atrás do outro. Por isso o envio é
   silencioso e falha em silêncio: telemetria que quebra a tela é pior
   do que telemetria nenhuma.
   ════════════════════════════════════════════════════════════ */

/** Erros que NÃO valem log.
 *
 *  O 401 é fluxo normal — a sessão expira todo dia por desenho, e o
 *  guard já trata. Registrá-lo encheria o log de ruído e esconderia o
 *  que importa. */
function isExpected(error: unknown): boolean {
    return error instanceof ApiUnauthorizedError;
}

/** Recorta a pilha: o log da API guarda um array de linhas, e uma
 *  pilha inteira de produção passa de cem. */
const stackLines = (error: unknown): string[] =>
    error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 12) : [];

let lastMessage = "";
let lastAt = 0;

/** Reporta um erro não tratado.
 *
 *  Erros iguais em sequência são engolidos por cinco segundos: um laço
 *  de render quebrado dispara o mesmo erro dezenas de vezes por
 *  segundo, e sem esta trava a telemetria vira o próprio incidente. */
export function reportError(error: unknown, context: { rota?: string; data?: unknown } = {}): void {
    if (isExpected(error)) return;

    const message = error instanceof Error ? error.message : String(error);
    const now = Date.now();
    if (message === lastMessage && now - lastAt < 5000) return;
    lastMessage = message;
    lastAt = now;

    const body: ApiTypes.LogBody = {
        Type: "error",
        Log: {
            msg: message || "Erro não tratado no cliente",
            rota: context.rota ?? window.location.pathname,
            methodo: "client",
            stack: stackLines(error),
            data: context.data,
            errorMessage: message,
        },
    };

    // Sem `await` e sem `catch` que faça algo: se o log falhar, não há
    // a quem contar.
    void UtilsConnection.log(body).catch(() => {});
}

/** Liga os dois canais que o React não vê: erro solto e promessa
 *  rejeitada sem `catch`. Chamado uma vez, na entrada do app. */
export function installTelemetry(): void {
    window.addEventListener("error", (event) => {
        reportError(event.error ?? event.message);
    });

    window.addEventListener("unhandledrejection", (event) => {
        reportError(event.reason);
    });
}
