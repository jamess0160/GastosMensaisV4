//  **O chrome compartilhado dos e-mails**: cabeçalho, corpo, botão, rodapé e assinatura.
//
//  Os templates ficam centralizados aqui, e não com a feature dona — o contrário do que o
//  projeto faz com os schemas Joi. A razão é a diferença entre os dois: um schema Joi não tem
//  nada em comum com outro, e três e-mails têm um layout em comum. É ele que decide onde os
//  três moram.
//
//  **Template é módulo TypeScript, não arquivo `.html`.** Um `.html` lido do disco em runtime
//  não entra no bundle: o `build:app` empacota `index.ts` em `build/bundle.js`, e um
//  `readFile("templates/reset.html")` procuraria um arquivo que ninguém copiou — a mesma
//  armadilha que fez as migrations serem compiladas à parte. Ou se acrescenta um passo de
//  cópia no webpack, ou o template é código.
//
//  E é código pelo motivo que sobrevive ao build: `renderResetPassword({ Name, Link })` faz o
//  compilador reclamar quando falta um parâmetro. Um `{{Link}}` que ninguém substituiu chega
//  ao usuário como `{{Link}}`.

export namespace MailLayout {

    export interface Content {
        /** Vira o `<h1>` e a primeira linha da versão em texto. */
        Title: string
        /** "Olá, Tiago" — opcional porque nem todo e-mail sabe o nome de quem lê. */
        Greeting?: string
        /** Um parágrafo por item, na ordem. */
        Paragraphs: string[]
        /** O botão. O `Url` aparece **também em texto**, porque cliente de e-mail engole link. */
        Action?: { Label: string, Url: string }
        /** O recado do rodapé — "se não foi você, ignore este e-mail". */
        Note?: string
    }

    /** O e-mail montado: as duas versões saem juntas e do mesmo conteúdo, sempre. */
    export function render(content: Content) {
        return {
            text: renderText(content),
            html: renderHtml(content),
        }
    }

    const signature = "Gastos Mensais"

    //  A alternativa em texto puro não é enfeite: cliente que bloqueia HTML, leitor de tela e
    //  o preview da caixa de entrada leem daqui. E o link vai **escrito**, porque um botão que
    //  não renderiza deixa o usuário sem caminho nenhum.
    function renderText(content: Content) {
        let lines: string[] = []

        if (content.Greeting) lines.push(`${content.Greeting},`, "")

        lines.push(content.Title, "")
        lines.push(...content.Paragraphs.flatMap((paragraph) => [paragraph, ""]))

        if (content.Action) lines.push(`${content.Action.Label}: ${content.Action.Url}`, "")
        if (content.Note) lines.push(content.Note, "")

        lines.push(`— ${signature}`)

        return lines.join("\n")
    }

    //  Tudo inline e em tabela nenhuma além do necessário: cliente de e-mail não tem `<style>`
    //  confiável nem flexbox. O objetivo aqui é legibilidade, não layout.
    function renderHtml(content: Content) {
        let body = [
            content.Greeting ? `<p style="margin:0 0 16px">${escapeHtml(content.Greeting)},</p>` : "",
            `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827">${escapeHtml(content.Title)}</h1>`,
            ...content.Paragraphs.map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`),
            content.Action ? renderAction(content.Action) : "",
            content.Note ? `<p style="margin:24px 0 0;font-size:13px;color:#6b7280">${escapeHtml(content.Note)}</p>` : "",
            `<p style="margin:24px 0 0;font-size:13px;color:#6b7280">— ${signature}</p>`,
        ].filter(Boolean).join("\n")

        return `<div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#374151">
<div style="max-width:520px;margin:0 auto;padding:32px;background:#ffffff;border-radius:8px">
${body}
</div>
</div>`
    }

    function renderAction(action: NonNullable<Content["Action"]>) {
        //  O endereço aparece de novo abaixo do botão, em texto: parte dos clientes reescreve
        //  ou bloqueia o `<a>`, e sem esta linha o usuário fica sem para onde ir.
        return `<p style="margin:24px 0"><a href="${escapeAttribute(action.Url)}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(action.Label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all">${escapeHtml(action.Url)}</p>`
    }

    //  O nome do usuário entra no corpo do e-mail, e ele é digitado por quem se cadastrou: sem
    //  escape, um `<script>` no cadastro viraria HTML na caixa de entrada de quem recebe.
    function escapeHtml(value: string) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
    }

    function escapeAttribute(value: string) {
        return escapeHtml(value)
    }
}
