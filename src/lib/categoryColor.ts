import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   A paleta de categorias, na ORDEM DE ATRIBUIÇÃO.

   Os oito valores são os `--cat-*` de src/styles/tokens.css, que vêm
   do layout — nenhum foi inventado nem ajustado. O que mudou foi a
   ORDEM, e por um motivo verificável: na ordem em que o layout os
   lista, `--cat-verde` (#36da0d) e `--cat-amarelo` (#f4d800) caem lado
   a lado, e para quem tem protanopia esse par tem ΔE 4.2 — abaixo do
   piso de 6 em que duas fatias vizinhas do donut ainda se distinguem.
   Reordenados, o pior par adjacente sobe para ΔE 18.1.

   Duas ressalvas que a reordenação NÃO resolve, porque são dos valores
   e não da sequência:

   - `--cat-amarelo` e `--cat-verde` têm contraste abaixo de 3:1 contra
     o branco da superfície, e `--cat-grafite` tem croma quase zero (lê
     como cinza). A resposta é estrutural, não cromática: todo gráfico
     deste projeto sai com RÓTULO DIRETO e legenda com valor, e nunca
     identifica uma fatia só pela cor. Ver `ChartLegend` em
     src/ui/charts.tsx.
   - Trocar os hexadecimais resolveria os dois de uma vez, mas o
     relatório passaria a usar cor que não existe no resto do sistema.
     Isso é conversa com o layout, não decisão do cliente.
   ════════════════════════════════════════════════════════════ */
const PALETTE = [
    "#0084ff", // azul
    "#f40092", // magenta
    "#36da0d", // verde
    "#6e6a66", // grafite
    "#f4d800", // amarelo
    "#7238d7", // roxo
    "#ff5247", // coral
    "#00b4d8", // ciano
] as const;

/** A cor de uma categoria vem do campo `Color` quando preenchido; a
 *  paleta dos tokens é o fallback.
 *
 *  O fallback é indexado pelo `IdCategory`, não pela posição na lista:
 *  assim a mesma categoria guarda a mesma cor no donut, na linha e na
 *  tabela, independente da ordem em que cada tela a leu — e um filtro
 *  que muda a quantidade de categorias não repinta as que sobraram. */
export function categoryColor(category: Pick<ApiTypes.Category, "IdCategory" | "Color">): string {
    return category.Color ?? PALETTE[category.IdCategory % PALETTE.length];
}

/** Para quando só se tem o id em mãos (o gasto guarda `IdCategory`, e a
 *  categoria pode não ter sido carregada ainda). */
export const paletteColor = (idCategory: number): string => PALETTE[idCategory % PALETTE.length];

/** Cor de acento de uma conta ou forma de pagamento. Aqui o fallback é a
 *  tinta neutra: conta sem cor não vira uma categoria colorida por
 *  acidente. */
export const accentColor = (color: ApiTypes.Color | null): string => color ?? "#2a2826";
