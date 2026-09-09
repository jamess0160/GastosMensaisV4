import { describe, expect, it } from "vitest";
import { firstFocusTarget } from "@/ui/overlay";

/** Monta a marcação de um painel do jeito que SlideOver e Modal a
 *  produzem: cabeçalho com o botão de fechar ANTES do corpo. É essa
 *  ordem que fazia o foco inicial cair no lugar errado. */
function buildPanel(body: string, footer = ""): HTMLElement {
    const panel = document.createElement("div");
    panel.tabIndex = -1;
    panel.innerHTML = `
        <header>
            <div>Título</div>
            <button type="button" aria-label="Fechar" data-id="fechar"></button>
        </header>
        <div data-dialog-body>${body}</div>
        ${footer ? `<footer>${footer}</footer>` : ""}
    `;
    document.body.appendChild(panel);
    return panel;
}

describe("firstFocusTarget", () => {
    it("foca o primeiro campo do corpo, NÃO o botão de fechar", () => {
        const panel = buildPanel(`
            <input data-id="nome" />
            <input data-id="tipo" />
        `);

        // O botão de fechar vem antes no DOM: pegar o primeiro focável do
        // painel inteiro entregaria ele, e quem abre um formulário quer
        // digitar.
        expect(firstFocusTarget(panel)?.dataset.id).toBe("nome");
    });

    it("ignora campo desabilitado", () => {
        const panel = buildPanel(`
            <input disabled data-id="congelado" />
            <input data-id="nome" />
        `);

        // O saldo inicial de uma conta com lançamentos chega desabilitado:
        // focá-lo deixaria o cursor num campo que não aceita digitação.
        expect(firstFocusTarget(panel)?.dataset.id).toBe("nome");
    });

    it("pega select e textarea, não só input", () => {
        const panel = buildPanel(`<select data-id="categoria"></select>`);

        expect(firstFocusTarget(panel)?.dataset.id).toBe("categoria");
    });

    it("cai no primeiro focável do painel quando o corpo não tem nenhum", () => {
        const panel = buildPanel(
            "<p>Tem certeza?</p>",
            '<button data-id="cancelar"></button><button data-id="confirmar"></button>',
        );

        // Sem campo no corpo, o botão de fechar do cabeçalho é o alvo —
        // e é o comportamento certo: numa confirmação o foco não pode
        // nascer sobre o botão que confirma a ação destrutiva.
        expect(firstFocusTarget(panel)?.dataset.id).toBe("fechar");
    });

    it("numa confirmação sem cabeçalho, o foco vai para cancelar", () => {
        // O ConfirmDialog não tem botão de fechar: o rodapé é
        // cancelar-e-depois-confirmar, nessa ordem.
        const panel = document.createElement("div");
        panel.innerHTML = `
            <div><p>Cancelar este gasto?</p></div>
            <footer>
                <button data-id="cancelar"></button>
                <button data-id="confirmar"></button>
            </footer>
        `;
        document.body.appendChild(panel);

        expect(firstFocusTarget(panel)?.dataset.id).toBe("cancelar");
    });

    it("devolve null quando não há nada focável", () => {
        const panel = buildPanel("<p>Só texto.</p>");
        panel.querySelector("header")?.remove();

        expect(firstFocusTarget(panel)).toBeNull();
    });
});
