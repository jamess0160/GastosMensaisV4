import { useEffect, useState, type ReactNode } from "react";
import styles from "./split.module.css";
import { cx } from "./form";
import { Button } from "./primitives";
import { IconCheck, IconClose, IconPlus } from "./icons";
import { Select } from "./select";
import {
    distributeRemainder,
    formatAmount,
    formatMoney,
    parseMoneyInput,
    splitClosesTotal,
    splitEvenly,
    splitRemainder,
} from "@/lib/money";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Editor de rateio.

   Serve aos DOIS eixos do gasto, que nunca se cruzam: `Payments`
   (financeiro — com qual forma foi pago, move saldo) e `Persons`
   (analítico — de quem é o custo, não move saldo). Duas formas de
   pagamento + duas pessoas são 2 + 2 linhas, nunca 4, e é por isso
   que são duas instâncias deste componente lado a lado, e não uma
   matriz.

   Todo rateio é por VALOR ABSOLUTO, nunca porcentagem, e a soma tem
   que bater em centavos: quem não fecha aqui leva 406 na certa. Por
   isso `closes` sai daqui para o botão de salvar.

   ⚠️ SÓ QUE ISSO VALE PARA O GASTO, E NÃO PARA TODO RATEIO. O terceiro
   consumidor deste componente é o ORÇAMENTO, em que o rateio reparte a
   RENDA do mês — e lá sobrar é legítimo e comum: o que não foi alocado
   é, literalmente, o que ainda não foi orçado. A API do orçamento nem
   lê a renda para responder, e o que a tela sinaliza é o ESTOURO,
   quando a soma passa do que entrou.

   As duas regras não podem ser a mesma, então o que as separa é o
   parâmetro `closure`, explícito e com o padrão no lado do gasto:

       "strict" (padrão)  falta é erro, e o botão de salvar espera o
                          rateio fechar — 406 na certa se não fechar
       "loose"            falta é informação ("sobra R$ X a
                          distribuir"), e só o estouro vira alerta

   Ele muda mais uma coisa, e pelo mesmo motivo: o botão de repartir.
   No gasto é "dividir igualmente", que joga fora o que estava escrito
   e reparte o total, porque o rateio nasce vazio; no orçamento é
   "distribuir o que sobra igualmente", que PRESERVA as fatias já
   decididas e fecha a diferença. Um parâmetro só para as duas
   diferenças porque elas são a mesma diferença.

   ── E uma terceira diferença: nascer dividido ──

   No eixo de PESSOAS do gasto o rateio se reparte sozinho enquanto
   ninguém digitou valor nenhum. É o parâmetro `autoSplit`, e o porquê de
   ele não valer para os outros dois consumidores está lá.
   ════════════════════════════════════════════════════════════ */

/** Quem tem que fechar com o total e quem não tem. Ver o cabeçalho. */
export type SplitClosure = "strict" | "loose";

export interface SplitLine {
    /** `IdPaymentMethod` ou `IdPerson`, conforme o eixo. */
    id: number | null;
    /** **O SEGUNDO alvo da linha, e só o orçamento tem um.** Lá a fatia é
     *  "Luana", "Mercado" ou "Luana em Mercado": um PAR de alvos, com pelo
     *  menos um preenchido. Nos dois eixos do gasto ele não existe — a linha
     *  aponta para uma forma de pagamento OU para uma pessoa, nunca para as
     *  duas —, e é por isso que ele é opcional e ninguém mais o escreve. */
    secondaryId?: number | null;
    value: ApiTypes.Money | null;
    /** Só no eixo financeiro: o débito já sai pago no ato. */
    paid?: boolean;
}

export interface SplitOption {
    id: number;
    label: string;
    /** A conta dona da forma de pagamento — entra na frente do nome,
     *  porque "Crédito" sozinho não diz de qual conta o dinheiro sai. */
    group?: string;
    icon?: ReactNode;
    color?: string;
    /** A linha pode nascer paga? `false` no CARTÃO DE CRÉDITO: `Paid`
     *  ali é 406, porque no cartão quem tira o dinheiro da conta é o
     *  pagamento da FATURA, e não a compra. Default `true`. */
    acceptsPaid?: boolean;
}

/** Uma linha em branco — o estado inicial de qualquer rateio. */
export const emptyLine = (): SplitLine => ({ id: null, value: null });

/** As linhas prontas para virar corpo de requisição. Descarta as
 *  incompletas: uma linha sem forma escolhida não é meio rateio, é
 *  rascunho. */
export const usableLines = (lines: readonly SplitLine[]) =>
    lines.filter(
        (line): line is SplitLine & { id: number; value: ApiTypes.Money } =>
            line.id !== null && line.value !== null,
    );

/** O rateio fecha? É a pergunta que habilita o botão de salvar.
 *
 *  O total NEGATIVO é válido: é o estorno de fatura (só no cartão, e só
 *  em gasto avulso). O que continua proibido é o zero. */
export function splitIsClosed(lines: readonly SplitLine[], total: ApiTypes.Money | null): boolean {
    if (total === null || total === 0) return false;
    const usable = usableLines(lines);
    if (usable.length === 0) return false;
    return splitClosesTotal(
        usable.map((line) => line.value),
        total,
    );
}

/** **O rateio recém-nascido: o total repartido entre quem já foi
 *  escolhido.** Uma pessoa leva o total inteiro; duas levam metade cada;
 *  três levam 33,34 / 33,33 / 33,33 — o centavo da sobra na PRIMEIRA
 *  linha, porque quem reparte é o `splitEvenly`, o mesmo do botão de
 *  dividir igualmente e a mesma regra que a API usa no parcelamento.
 *
 *  Só as linhas que JÁ TÊM alvo entram na conta, e as outras voltam a
 *  ficar vazias: uma linha recém-adicionada, ainda sem pessoa escolhida,
 *  não é uma fatia — dar valor a ela deixaria o rateio sem fechar, já que
 *  linha sem alvo não conta para o total (ver `usable`, abaixo).
 *
 *  Sem total não há o que repartir, e o rateio fica como está: a divisão
 *  acontece quando o valor do gasto for digitado.
 *
 *  **A divisão PARA no primeiro valor digitado à mão** — é o que o
 *  `pristine` diz. Dali em diante acrescentar uma pessoa só acrescenta uma
 *  linha vazia: sobrescrever um valor deliberado é pior do que não
 *  preencher nada.
 *
 *  Devolve **as mesmas linhas, por referência**, quando não há o que
 *  mudar. É isso que deixa o efeito que a chama comparar com `!==` e não
 *  entrar em laço chamando `onChange` com o que já está na tela.
 *
 *  ⚠️ **O alvo aqui é só o `id`, e é de propósito.** Quem tem um segundo
 *  eixo é o orçamento, e ele não liga a divisão automática — ver o
 *  parâmetro `autoSplit`. */
export function autoSplitLines(
    lines: SplitLine[],
    total: ApiTypes.Money | null,
    pristine: boolean,
): SplitLine[] {
    if (!pristine) return lines;

    const targets = lines.filter((line) => line.id !== null).length;
    if (total === null || total === 0 || targets === 0) return lines;

    const parts = splitEvenly(total, targets);
    let next = 0;

    const divided = lines.map((line) =>
        line.id === null ? { ...line, value: null } : { ...line, value: parts[next++] },
    );

    // Só o VALOR muda aqui, então é só ele que precisa ser comparado.
    const same = divided.every((line, index) => line.value === lines[index].value);

    return same ? lines : divided;
}

/** **O rateio ainda está intocado?** Nascer com valor já é ser tocado: um
 *  rateio que chega preenchido é a EDIÇÃO de um gasto gravado, e
 *  redistribuí-lo apagaria a decisão de quem o lançou. */
export const splitIsPristine = (lines: readonly SplitLine[]) =>
    lines.every((line) => line.value === null);

export function SplitEditor({
    label,
    hint,
    options,
    secondaryOptions,
    secondaryLabel = "Categoria",
    lines,
    onChange,
    total,
    optionLabel = "Destino",
    addLabel = "Adicionar linha",
    withPaid = false,
    required = false,
    disabled = false,
    closure = "strict",
    autoSplit = false,
    rowExtra,
}: {
    label: string;
    hint?: string;
    options: readonly SplitOption[];
    /** **O segundo seletor da linha — só o orçamento passa um.** Com ele a
     *  linha vira um PAR de alvos, dos quais basta UM estar preenchido para
     *  a linha existir; sem ele nada muda, e o alvo continua sendo o único
     *  `id`. Ver `SplitLine.secondaryId`. */
    secondaryOptions?: readonly SplitOption[];
    secondaryLabel?: string;
    lines: SplitLine[];
    onChange: (lines: SplitLine[]) => void;
    total: ApiTypes.Money | null;
    optionLabel?: string;
    addLabel?: string;
    /** O eixo financeiro tem o "já pago"; o analítico não. */
    withPaid?: boolean;
    /** `Payments` é obrigatório (mín. 1); `Persons` é opcional. */
    required?: boolean;
    disabled?: boolean;
    /** **A soma precisa bater com o total?** Ver o cabeçalho: nos dois
     *  eixos do gasto sim, e não bater é 406; no orçamento não, porque
     *  o que sobra é o que ainda não foi orçado. Padrão `"strict"` —
     *  quem chama para o gasto não passa nada e nada muda. */
    closure?: SplitClosure;
    /** **O rateio nasce dividido?** Ligado, escolher, acrescentar ou tirar
     *  uma pessoa reparte o total entre as linhas que já têm alvo — ver
     *  `autoSplitLines`. A redistribuição PARA no primeiro valor digitado à
     *  mão: dali em diante acrescentar uma linha não mexe no que já foi
     *  escrito, porque sobrescrever um valor deliberado é pior do que não
     *  preencher nada.
     *
     *  **Só o eixo de PESSOAS do gasto liga isto, e o padrão é desligado.**
     *  O eixo financeiro não nasce dividido: pagar um gasto com duas formas
     *  é raro, e repartir sozinho tiraria dinheiro de uma conta que ninguém
     *  escolheu. O orçamento também não: lá as fatias são decisões, e o que
     *  sobra é o que ainda não foi orçado. Os eixos são diferentes
     *  justamente nisto — um é de quem é o custo, o outro mexe saldo. */
    autoSplit?: boolean;
    /** O que desenhar DEPOIS do valor, na mesma linha: no orçamento é o
     *  comprometido da fatia com a régua. Uma função do índice porque só
     *  quem chama sabe o que aquela linha é. */
    rowExtra?: (index: number, line: SplitLine) => ReactNode;
}) {
    // O texto digitado fica cru enquanto o campo está em foco: formatar
    // a cada tecla faria o cursor pular no meio do número.
    const [drafts, setDrafts] = useState<Record<number, string>>({});

    /* O "intocado" da divisão automática, medido no PRIMEIRO render de
       propósito: a tela de gasto só monta o formulário depois de carregar
       o que vai editar, então as linhas que chegam aqui já são as do
       banco — e um rateio gravado não se redistribui sozinho. */
    const [pristine, setPristine] = useState(() => splitIsPristine(lines));

    /* A divisão automática roda no EFEITO, e não no handler de cada
       botão, porque nem tudo que a dispara é um clique daqui: o total do
       gasto é um campo da TELA, e digitá-lo depois de escolher as pessoas
       tem que dividir naquele momento. Acrescentar, tirar e escolher
       pessoa passam pelo mesmo caminho de graça.

       Quem impede o laço é o `autoSplitLines`, que devolve as mesmas
       linhas quando não há o que mudar. */
    useEffect(() => {
        if (!autoSplit) return;
        const next = autoSplitLines(lines, total, pristine);
        if (next !== lines) onChange(next);
    }, [autoSplit, pristine, lines, total, onChange]);

    /* **A linha existe quando tem ALVO e valor** — e com o segundo eixo
       ligado, "ter alvo" é ter QUALQUER um dos dois. É a única conta que
       não passa pelo `usableLines` exportado, e de propósito: aquele é
       lido pelas sections do gasto, que tipam `line.id` como número
       depois de filtrar. Sem o segundo eixo as duas respostas são
       idênticas — nenhuma linha de gasto escreve `secondaryId`. */
    const hasTarget = (line: SplitLine) =>
        line.id !== null || (secondaryOptions !== undefined && (line.secondaryId ?? null) !== null);

    const usable = lines.filter((line) => hasTarget(line) && line.value !== null);
    const values = usable.map((line) => line.value as ApiTypes.Money);
    const closes =
        total !== null && total !== 0 && usable.length > 0 && splitClosesTotal(values, total);
    const remainder = total === null ? 0 : splitRemainder(values, total);
    /* "Falta" e "passou" trocam de lado quando o total é negativo: num
       estorno de −150, faltar é o que sobra do lado de baixo de zero. É
       o sinal do TOTAL que decide, não o do resto. */
    const missing = total === null ? 0 : remainder * Math.sign(total);
    const empty = usable.length === 0;

    const patch = (index: number, change: Partial<SplitLine>) =>
        onChange(lines.map((line, at) => (at === index ? { ...line, ...change } : line)));

    const optionOf = (id: number | null) => options.find((option) => option.id === id);

    const distribute = () => {
        if (total === null || lines.length === 0) return;
        setDrafts({});

        // O centavo que sobra vai na PRIMEIRA linha — a mesma regra que
        // a API usa no parcelamento, nos dois casos.
        //
        // O que muda entre eles é o que acontece com o que já estava
        // escrito: no gasto o rateio nasce vazio e repartir o total é o
        // gesto certo; no orçamento as fatias são decisões que alguém
        // tomou, e o botão só fecha a diferença. Ver o cabeçalho.
        //
        // Onde a divisão automática está ligada o botão é ela mesma, e
        // volta a armá-la: o que ele desfaz é justamente o valor digitado
        // à mão que a tinha parado, e é para isso que ele continua ali.
        if (autoSplit) {
            setPristine(true);
            onChange(autoSplitLines(lines, total, true));
            return;
        }

        const parts =
            closure === "loose"
                ? distributeRemainder(
                      lines.map((line) => line.value),
                      total,
                  )
                : splitEvenly(total, lines.length);
        onChange(lines.map((line, index) => ({ ...line, value: parts[index] })));
    };

    return (
        <div className={styles.card}>
            <div className={styles.label}>
                <span className={styles.labelText}>{label}</span>
                {hint && <span className={styles.labelHint}>{hint}</span>}
            </div>

            <div className={styles.rows}>
                {lines.map((line, index) => (
                    <div className={styles.row} key={index}>
                        <span className={styles.selectWrap}>
                            <Select
                                variant="compact"
                                value={line.id}
                                disabled={disabled}
                                ariaLabel={optionLabel}
                                placeholder={`${optionLabel}…`}
                                options={options.map((option) => ({
                                    value: option.id,
                                    label: option.group
                                        ? `${option.group} · ${option.label}`
                                        : option.label,
                                    icon: option.icon,
                                    color: option.color,
                                }))}
                                /* Trocar para uma forma que não aceita
                                   "já pago" precisa LIMPAR a marca: um
                                   `Paid: true` esquecido numa linha de
                                   cartão é 406 na gravação. */
                                onChange={(id) =>
                                    patch(index, {
                                        id,
                                        ...(optionOf(id)?.acceptsPaid === false
                                            ? { paid: false }
                                            : {}),
                                    })
                                }
                            />
                        </span>

                        {/* O segundo alvo, quando existe: a fatia do
                            orçamento é "Luana", "Mercado" ou "Luana em
                            Mercado", e os dois seletores aceitam ficar
                            vazios — o que não pode é os dois. Quem barra a
                            linha sem alvo nenhum é a section antes de
                            salvar, e a API depois dela. */}
                        {secondaryOptions && (
                            <span className={styles.selectWrap}>
                                <Select
                                    variant="compact"
                                    value={line.secondaryId ?? null}
                                    disabled={disabled}
                                    ariaLabel={secondaryLabel}
                                    placeholder={`${secondaryLabel}…`}
                                    options={secondaryOptions.map((option) => ({
                                        value: option.id,
                                        label: option.group
                                            ? `${option.group} · ${option.label}`
                                            : option.label,
                                        icon: option.icon,
                                        color: option.color,
                                    }))}
                                    onChange={(secondaryId) => patch(index, { secondaryId })}
                                />
                            </span>
                        )}

                        <span className={styles.amount}>
                            <span className={styles.amountPrefix}>R$</span>
                            <input
                                className={styles.amountInput}
                                inputMode="decimal"
                                placeholder="0,00"
                                disabled={disabled}
                                aria-label="Valor da linha"
                                value={
                                    drafts[index] ??
                                    (line.value === null ? "" : formatAmount(line.value))
                                }
                                onChange={(event) => {
                                    setDrafts((current) => ({
                                        ...current,
                                        [index]: event.target.value,
                                    }));
                                    // O valor digitado à mão é o que para a
                                    // divisão automática — daqui em diante
                                    // ninguém reescreve o que foi decidido.
                                    setPristine(false);
                                    patch(index, { value: parseMoneyInput(event.target.value) });
                                }}
                                onBlur={() =>
                                    setDrafts((current) => {
                                        const next = { ...current };
                                        delete next[index];
                                        return next;
                                    })
                                }
                            />
                        </span>

                        {rowExtra?.(index, line)}

                        {withPaid && optionOf(line.id)?.acceptsPaid !== false && (
                            <label className={styles.paidToggle}>
                                <input
                                    type="checkbox"
                                    checked={line.paid ?? false}
                                    disabled={disabled}
                                    onChange={(event) =>
                                        patch(index, { paid: event.target.checked })
                                    }
                                />
                                Já pago
                            </label>
                        )}

                        <button
                            type="button"
                            className={styles.remove}
                            aria-label="Remover linha"
                            disabled={disabled || (required && lines.length === 1)}
                            onClick={() => {
                                setDrafts({});
                                onChange(lines.filter((_, at) => at !== index));
                            }}
                        >
                            <IconClose />
                        </button>
                    </div>
                ))}
            </div>

            <div className={styles.tools}>
                <Button
                    size="sm"
                    disabled={disabled}
                    onClick={() => onChange([...lines, emptyLine()])}
                >
                    <IconPlus />
                    {addLabel}
                </Button>
                <Button
                    size="sm"
                    disabled={
                        disabled ||
                        total === null ||
                        lines.length === 0 ||
                        // No orçamento o botão fecha a diferença: sem
                        // diferença ele não tem o que fazer, e um botão
                        // que não muda nada é pior do que um desligado.
                        (closure === "loose" && remainder <= 0)
                    }
                    onClick={distribute}
                >
                    {closure === "loose"
                        ? "Distribuir o que sobra igualmente"
                        : "Dividir igualmente"}
                </Button>
            </div>

            {/* Sem linha nenhuma o eixo opcional simplesmente não existe:
                mostrar "faltam R$ x" ali seria cobrar um rateio que a API
                não exige. */}
            {!(empty && !required) && (
                <div
                    className={cx(
                        styles.status,
                        /* No rateio frouxo o que pinta de alerta é SÓ o
                           estouro: sobrar não é um erro a consertar, é o
                           que ainda não foi orçado. */
                        closes || (closure === "loose" && missing > 0)
                            ? styles.closed
                            : styles.open,
                    )}
                >
                    <span className={styles.statusLeft}>
                        {closes ? (
                            <>
                                <span className={styles.check}>
                                    <IconCheck />
                                </span>
                                {closure === "loose"
                                    ? "Tudo distribuído"
                                    : "Rateio fecha com o total"}
                            </>
                        ) : total === null ? (
                            "Informe o valor total primeiro"
                        ) : missing > 0 ? (
                            closure === "loose" ? (
                                "Ainda sobra para distribuir"
                            ) : (
                                "Ainda falta distribuir"
                            )
                        ) : (
                            "Passou do total"
                        )}
                    </span>
                    {total !== null && !closes && (
                        <span className={styles.statusValue}>
                            {missing > 0 ? formatMoney(remainder) : `+${formatMoney(-remainder)}`}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
