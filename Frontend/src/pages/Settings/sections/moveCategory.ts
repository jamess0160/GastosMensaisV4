import { errorMessage } from "@/api/client";
import { CategoriesConnection } from "@/api/Categories.connection";
import type { SettingsContext } from "../controller";

/** Grava a ordem nova das categorias ativas.
 *
 *  **Pela alça, e não mais por ↑ ↓.** A decisão anterior era arrastar
 *  NÃO, e o argumento dela não era frouxo: no telefone a lista rola no
 *  mesmo eixo em que o dedo arrastaria a linha, e duas setas resolviam
 *  as duas larguras sem um caminho de código por dispositivo. O que
 *  mudou não foi a opinião, foi o desenho — o arrasto começa na ALÇA, e
 *  `touch-action: none` fica nela, nunca na linha nem na lista. O dedo
 *  em qualquer outro lugar continua rolando, que era a objeção inteira.
 *  E as setas não foram removidas: com foco na alça, ↑ e ↓ movem a linha
 *  uma posição, então quem usa teclado ou leitor de tela não trocou um
 *  gesto acessível por um que exige apontador.
 *
 *  Custava seis cliques e seis requisições pôr "Mercado" no topo vindo
 *  do fim de treze; custa um arrasto e UMA.
 *
 *  A rota recebe a lista COMPLETA de ids na ordem nova, não "mova o id X
 *  para a posição N" — e é por isso que arrastar não custa requisição a
 *  mais que as setas: quem chama já tem a ordem inteira na mão, e é a
 *  lista toda que faz a última escrita ganhar inteira em vez de deixar a
 *  ordem meio aplicada. Quem monta a lista é a tela: o teclado trocando
 *  dois vizinhos, o arrasto movendo um item de índice
 *  (`src/ui/reorder.ts`).
 *
 *  Devolve `true` quando gravou. É o que deixa a tela manter a ordem
 *  local enquanto a escrita corre e voltar para a da API quando ela é
 *  recusada — a única ordem verdadeira é a gravada. */
export async function moveCategory(
    context: SettingsContext,
    idCategories: number[],
): Promise<boolean> {
    /* Menos de duas categorias não têm ordem a mudar, e mandar a lista
       igual gastaria uma requisição para nada. Soltar a linha onde ela
       estava não chega aqui — a tela nem chama —; isto é o cinto. */
    if (idCategories.length < 2) return false;

    context.beginSubmit();

    try {
        await CategoriesConnection.reorder(idCategories);
        context.finishSubmit("Ordem salva.");
        return true;
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
        return false;
    }
}
