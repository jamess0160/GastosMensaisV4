/* ════════════════════════════════════════════════════════════
   Entregar ao navegador um arquivo que veio da API.

   É a primeira vez que o cliente lida com resposta binária —
   `GET /Reports/Export` é a única rota do projeto que não responde
   JSON. O que este arquivo NÃO faz é gerar planilha: quem monta o
   `.xlsx` é o servidor, porque ele lê os números do mesmo lugar que a
   tela. Montar no navegador replicaria as regras de agregação, que é
   exatamente o que a feature de Reports existe para impedir.
   ════════════════════════════════════════════════════════════ */

/** Salva o blob com o nome dado.
 *
 *  O `revokeObjectURL` não é higiene opcional: sem ele o blob fica
 *  vivo na memória da aba até o reload, e um histórico inteiro não é um
 *  arquivo pequeno. */
export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
}

/** O nome do arquivo que o servidor mandou, no `Content-Disposition`.
 *
 *  Ele já carrega o período exportado, então o nome certo é o dele — e
 *  não um montado aqui a partir dos mesmos filtros, que é como os dois
 *  passam a discordar. `fallback` cobre o cabeçalho ausente, não o
 *  cabeçalho diferente do esperado. */
export function filenameFromDisposition(header: string | undefined, fallback: string): string {
    if (!header) return fallback;

    /* Duas formas no mesmo cabeçalho: `filename*=UTF-8''nome` (com
       acento, percent-encoded) e `filename="nome"`. A primeira vence
       quando existe, que é o que a RFC 6266 manda. */
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (encoded) {
        try {
            return decodeURIComponent(encoded[1].trim());
        } catch {
            return fallback;
        }
    }

    const plain = /filename="?([^";]+)"?/i.exec(header);
    return plain ? plain[1].trim() : fallback;
}
