import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

/* ════════════════════════════════════════════════════════════
   Arrastar para ordenar uma lista vertical — à mão, sobre Pointer
   Events.

   POR QUE NÃO UMA BIBLIOTECA. É este arquivo — que tem mais comentário
   do que código — contra uma dependência nova num projeto que tem nove
   em produção e que já desenhou o próprio combobox pelo mesmo critério.
   O que uma biblioteca de arrasto entrega além disto — listas
   aninhadas, arrasto entre listas, dois eixos, sensores de tecla
   configuráveis — é exatamente o que nenhuma tela daqui pede.

   POR QUE O GESTO COMEÇA NA ALÇA, e não na linha. No telefone a lista
   rola no MESMO eixo em que o dedo arrastaria a linha, e foi essa
   colisão que barrou o arrasto antes. A alça é o que desfaz o empate:
   `touch-action: none` fica nela, nunca na linha nem na lista, então o
   dedo em qualquer outro lugar continua rolando — e quem escolhe
   arrastar diz isso pegando na alça.

   POR QUE A ALÇA É UM `<button>`. Com foco nela, ↑ e ↓ movem a linha
   uma posição: as setas não foram removidas, viraram o teclado da alça.
   Sem isso a troca seria de um gesto acessível por um que exige
   apontador.

   A ARITMÉTICA MORA EM FUNÇÕES PURAS, exportadas e testadas. É a parte
   que erra em silêncio — um índice trocado reordena a lista errada e
   grava —, e ela não precisa de um `pointermove` de mentira para ser
   provada.
   ════════════════════════════════════════════════════════════ */

/* ── A aritmética ─────────────────────────────────────────── */

/** Prende um índice à lista. Um destino fora dela é o caso comum, não a
 *  exceção: o dedo continua descendo depois da última linha. */
export function clampIndex(index: number, count: number): number {
    if (count <= 0) return 0;
    return Math.min(Math.max(index, 0), count - 1);
}

/** Tira o item de `from` e o insere em `to`, devolvendo uma lista nova.
 *
 *  É a conta dos DOIS caminhos. O arrasto move um item de um índice para
 *  outro qualquer; o teclado move uma posição, e mover uma posição É
 *  trocar com o vizinho — não existe uma segunda conta para ele. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    const next = [...list];
    if (from < 0 || from >= next.length) return next;

    const target = clampIndex(to, next.length);
    if (target === from) return next;

    const [item] = next.splice(from, 1);
    next.splice(target, 0, item);
    return next;
}

/** O índice de destino de um arrasto: quantas linhas o ponteiro andou
 *  desde que pegou na alça, arredondado, somado ao índice de origem.
 *
 *  Arredondar (e não truncar) é o que faz a linha trocar de lugar na
 *  METADE do caminho, que é onde o olho espera — truncando, ela só
 *  trocaria depois de o dedo cobrir a linha inteira. `rowHeight` zero ou
 *  inválido devolve a origem: uma lista de um item, ou medida antes de a
 *  lista existir, não tem para onde mover. */
export function dropIndex(from: number, offset: number, rowHeight: number, count: number): number {
    if (!Number.isFinite(rowHeight) || rowHeight <= 0) return clampIndex(from, count);
    return clampIndex(from + Math.round(offset / rowHeight), count);
}

/** A altura de uma linha, medida pela distância entre os CENTROS das
 *  alças.
 *
 *  Medir pelo centro da alça, e não pela caixa da linha, é o que faz a
 *  mesma conta servir à tabela do desktop e ao card do telefone, que têm
 *  alturas diferentes e margens diferentes — o espaçamento entre alças
 *  já contém o `gap` da lista.
 *
 *  A MEDIANA, e não a média: o primeiro e o último card podem ter
 *  margens próprias, e uma linha fora do padrão puxaria a média para um
 *  valor que não é a altura de nenhuma linha. */
export function rowHeightFromCenters(centers: readonly number[]): number {
    const gaps: number[] = [];
    for (let i = 1; i < centers.length; i += 1) {
        const gap = centers[i] - centers[i - 1];
        if (Number.isFinite(gap) && gap > 0) gaps.push(gap);
    }

    if (gaps.length === 0) return 0;

    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
}

/** Duas ordens são a mesma? É o que diz se soltar a linha no lugar de
 *  onde ela saiu precisa gravar — não precisa. */
export function sameOrder(a: readonly number[], b: readonly number[]): boolean {
    return a.length === b.length && a.every((id, index) => id === b[index]);
}

/* ── O hook ───────────────────────────────────────────────── */

/** O que vai espalhado na alça. `ref` registra o botão para a medida das
 *  alturas; `data-dragging` é o que a folha pinta.
 *
 *  `aria-disabled`, e NÃO o `disabled` do HTML: um botão que desabilita
 *  enquanto a escrita corre perde o foco para o `<body>`, e a segunda
 *  seta seguida cairia no vazio. Quem recusa o gesto são as guardas
 *  daqui; a alça só fica apagada. */
export interface ReorderHandleProps {
    ref: (node: HTMLButtonElement | null) => void;
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
    "aria-label": string;
    "aria-disabled"?: true;
    "data-dragging"?: "true";
}

export interface Reorder<T> {
    /** A ordem a DESENHAR — a local enquanto o dedo arrasta e enquanto a
     *  escrita corre, a da API no resto do tempo. */
    items: T[];
    /** Quem o dedo carrega agora. A lista já se reordenou em estado
     *  local, então a folha realça a linha NO destino: é ela que diz o
     *  que vai ser gravado se o dedo soltar aqui. */
    draggingId: number | null;
    handleProps: (index: number) => ReorderHandleProps;
}

export function useReorder<T>({
    items,
    getId,
    label,
    onCommit,
    disabled = false,
}: {
    /** A lista como a API a devolve — a ordem verdadeira. */
    items: readonly T[];
    getId: (item: T) => number;
    /** O nome acessível da alça. Ele diz a POSIÇÃO ("Mercado, 3 de 13"):
     *  sem ela, quem ouve a tela não sabe para onde está movendo. */
    label: (item: T, position: number, total: number) => string;
    /** Grava a ordem nova INTEIRA, uma vez. `false` devolve a lista para
     *  a ordem da API — a única ordem verdadeira é a gravada. */
    onCommit: (ids: number[]) => Promise<boolean>;
    disabled?: boolean;
}): Reorder<T> {
    /* A ordem local. Ela existe do `pointerdown` até a escrita voltar:
       enquanto isso a lista precisa mostrar onde a linha foi solta, e a
       resposta da API ainda não chegou. */
    const [draft, setDraft] = useState<number[] | null>(null);
    const [draggingId, setDraggingId] = useState<number | null>(null);

    /* A ordem da API no instante em que o gesto começou. Quando ela muda
       — a escrita voltou, ou outra pessoa reordenou —, o rascunho perdeu
       a validade e sai de cena. */
    const sourceAtStart = useRef<number[] | null>(null);
    const drag = useRef<{
        pointerId: number;
        from: number;
        to: number;
        startY: number;
        rowHeight: number;
        base: number[];
    } | null>(null);
    const handles = useRef(new Map<number, HTMLButtonElement>());

    const sourceIds = items.map(getId);
    const latestSource = useRef(sourceIds);
    latestSource.current = sourceIds;

    /* O efeito depende da ordem por VALOR, não pela identidade do array:
       `items` sai de um `filter` a cada render, e comparar por
       referência limparia o rascunho no primeiro render seguinte ao
       arrasto — antes de a escrita voltar. */
    useEffect(() => {
        const started = sourceAtStart.current;
        if (started === null || sameOrder(latestSource.current, started)) return;

        /* A verdade chegou. Se ela é o que o rascunho mostrava, largá-lo
           não muda um pixel; se não é, o que vale é a dela. */
        sourceAtStart.current = null;
        setDraft(null);
    }, [sourceIds.join(",")]);

    const order = draft ?? sourceIds;

    const byId = new Map(items.map((item) => [getId(item), item]));
    const picked = order.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);

    /* Rascunho que não cobre a lista inteira (arquivaram uma categoria
       no meio do caminho) não desenha nada: a lista da API é o piso. */
    const view = picked.length === items.length ? picked : [...items];

    const commit = useCallback(
        async (next: number[]) => {
            setDraft(next);
            const saved = await onCommit(next);
            if (!saved) {
                sourceAtStart.current = null;
                setDraft(null);
            }
        },
        [onCommit],
    );

    const handleProps = (index: number): ReorderHandleProps => {
        const item = view[index];
        const id = getId(item);

        const begin = (event: PointerEvent<HTMLButtonElement>) => {
            if (disabled || view.length < 2 || drag.current !== null) return;
            /* Só o botão principal: o direito abre menu de contexto, e
               arrastar com ele solta a linha sem o usuário ter pedido. */
            if (event.button !== 0) return;

            const node = event.currentTarget;

            /* `preventDefault` mata a seleção de texto que o mouse
               começaria ao arrastar — e, com ela, o foco que o clique
               daria à alça. Por isso o foco vem à mão logo abaixo: é
               dele que o ↑ ↓ depende. */
            event.preventDefault();
            node.focus();
            node.setPointerCapture?.(event.pointerId);

            const centers = order.map((rowId) => {
                const rect = handles.current.get(rowId)?.getBoundingClientRect();
                return rect ? rect.top + rect.height / 2 : Number.NaN;
            });

            sourceAtStart.current = sourceIds.slice();
            drag.current = {
                pointerId: event.pointerId,
                from: index,
                to: index,
                startY: event.clientY,
                rowHeight: rowHeightFromCenters(centers),
                base: order.slice(),
            };
            setDraggingId(id);
        };

        const move = (event: PointerEvent<HTMLButtonElement>) => {
            const info = drag.current;
            if (info === null || info.pointerId !== event.pointerId) return;

            const to = dropIndex(
                info.from,
                event.clientY - info.startY,
                info.rowHeight,
                info.base.length,
            );
            if (to === info.to) return;

            /* A lista se reordena AQUI, em estado local, e nenhuma
               requisição sai: atravessar seis posições custaria seis
               escritas se cada uma gravasse. */
            info.to = to;
            setDraft(moveItem(info.base, info.from, to));
        };

        const drop = (event: PointerEvent<HTMLButtonElement>) => {
            const info = drag.current;
            if (info === null || info.pointerId !== event.pointerId) return;

            drag.current = null;
            setDraggingId(null);
            if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }

            /* Soltou onde pegou: uma requisição para gravar a ordem que
               já está gravada. */
            if (info.to === info.from) {
                sourceAtStart.current = null;
                setDraft(null);
                return;
            }

            void commit(moveItem(info.base, info.from, info.to));
        };

        const cancel = (event: PointerEvent<HTMLButtonElement>) => {
            const info = drag.current;
            if (info === null || info.pointerId !== event.pointerId) return;

            /* Cancelou (o sistema roubou o ponteiro, uma chamada
               entrou): desfaz. Gravar um arrasto que o usuário não
               terminou é escrever o que ele não pediu. */
            drag.current = null;
            setDraggingId(null);
            sourceAtStart.current = null;
            setDraft(null);
        };

        const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
            if (disabled || drag.current !== null) return;

            const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
            if (step === 0) return;

            /* A página rola com ↑ ↓; com a alça em foco, elas são dela. */
            event.preventDefault();

            const to = index + step;
            if (to < 0 || to >= order.length) return;

            sourceAtStart.current = sourceIds.slice();
            void commit(moveItem(order, index, to));
        };

        return {
            ref: (node) => {
                if (node) handles.current.set(id, node);
                else handles.current.delete(id);
            },
            onPointerDown: begin,
            onPointerMove: move,
            onPointerUp: drop,
            onPointerCancel: cancel,
            onKeyDown: keys,
            "aria-label": label(item, index + 1, view.length),
            "aria-disabled": disabled ? true : undefined,
            "data-dragging": draggingId === id ? "true" : undefined,
        };
    };

    return { items: view, draggingId, handleProps };
}
