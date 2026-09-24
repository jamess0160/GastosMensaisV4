/* ════════════════════════════════════════════════════════════
   AS OPÇÕES DE UM CATÁLOGO QUE TEM ARQUIVADOS.

   Um cadastro arquivado sai dos formulários — é para isso que
   arquivar existe. Só que a LINHA JÁ GRAVADA continua apontando
   para ele: um gasto rateado para a Luana não deixa de apontar
   para a Luana porque ela foi arquivada depois.

   E aí o formulário monta o seletor com o catálogo ativo, o `Select`
   desenha o PLACEHOLDER quando o `value` não está entre as opções, e
   a linha aparece em branco com o valor preenchido — parecendo um
   rascunho que não faz nada. Ela não está vazia: o id continua lá, e
   salvar manda o arquivado de volta para uma API que responde 406.

   Este helper devolve as opções ativas MAIS as arquivadas que estão
   EM USO, rotuladas "(arquivada)" e habilitadas. Três coisas passam a
   funcionar de uma vez, e é por isso que o conserto é este e não uma
   mensagem de erro melhor: a linha diz o que é, dá para trocar o
   arquivado por um ativo, e dá para remover a linha sabendo o que se
   está removendo.

   ⚠️ SÓ QUANDO ESTÁ EM USO. Oferecer a arquivada sempre desfaria a
   arquivação. Aqui ela não está sendo oferecida — ela JÁ ESTÁ
   ESCOLHIDA, e o que a tela ganha é poder mostrar uma escolha que o
   banco tem.

   Genérico porque são dois catálogos com a mesma doença e rótulos em
   campos diferentes (`Name` na pessoa, `Description` na categoria):
   o que muda vem por parâmetro, e não por uma abstração de catálogo.
   ════════════════════════════════════════════════════════════ */

/** Uma opção pronta para o seletor, com a linha do catálogo junto —
 *  é dela que a tela tira o ícone e a cor, que este arquivo não
 *  conhece. */
export interface CatalogOption<T> {
    id: number;
    label: string;
    item: T;
}

/** Os dois campos que mudam de catálogo para catálogo. */
export interface CatalogReader<T> {
    id: (item: T) => number;
    label: (item: T) => string;
}

/** As opções ativas, na ordem em que vieram, mais as arquivadas que
 *  alguma linha já aponta.
 *
 *  - `active` é o catálogo de ESCOLHA (o que já vem filtrado por
 *    `Active`), e a ordem dele é preservada — ele é quem manda;
 *  - `all` é o catálogo inteiro, e só serve para achar o nome de quem
 *    foi arquivado. Um id que não está nem aqui não vira opção
 *    nenhuma: pode ser de outro espaço, pode ter sido apagado, e
 *    inventar uma linha "(desconhecida)" seria afirmar algo que este
 *    arquivo não sabe;
 *  - `referenced` são os ids que as linhas apontam hoje. `null` e
 *    repetido entram sem estragar nada — linha em branco é o estado
 *    normal de um rateio sendo montado. */
export function withReferencedOptions<T>(
    active: readonly T[],
    all: readonly T[],
    referenced: readonly (number | null)[],
    read: CatalogReader<T>,
): CatalogOption<T>[] {
    const options: CatalogOption<T>[] = active.map((item) => ({
        id: read.id(item),
        label: read.label(item),
        item,
    }));

    const shown = new Set(options.map((option) => option.id));
    const missing = new Set(referenced.filter((id): id is number => id !== null && !shown.has(id)));

    if (missing.size === 0) return options;

    for (const item of all) {
        const id = read.id(item);
        if (!missing.has(id)) continue;

        options.push({ id, label: `${read.label(item)} (arquivada)`, item });
        // Tirar da conta faz duas coisas: não repete a opção se o
        // catálogo vier com a linha duplicada, e deixa o laço parar de
        // procurar o que já achou.
        missing.delete(id);
        if (missing.size === 0) break;
    }

    return options;
}
