import { useState, type ReactNode } from "react";
import styles from "./split.module.css";
import { cx } from "./form";
import { Button } from "./primitives";
import { IconCheck, IconClose, IconPlus } from "./icons";
import { Select } from "./select";
import {
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
   ════════════════════════════════════════════════════════════ */

export interface SplitLine {
    /** `IdPaymentMethod` ou `IdPerson`, conforme o eixo. */
    id: number | null;
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

/** O rateio fecha? É a pergunta que habilita o botão de salvar. */
export function splitIsClosed(lines: readonly SplitLine[], total: ApiTypes.Money | null): boolean {
    if (total === null || total <= 0) return false;
    const usable = usableLines(lines);
    if (usable.length === 0) return false;
    return splitClosesTotal(
        usable.map((line) => line.value),
        total,
    );
}

export function SplitEditor({
    label,
    hint,
    options,
    lines,
    onChange,
    total,
    optionLabel = "Destino",
    addLabel = "Adicionar linha",
    withPaid = false,
    required = false,
    disabled = false,
}: {
    label: string;
    hint?: string;
    options: readonly SplitOption[];
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
}) {
    // O texto digitado fica cru enquanto o campo está em foco: formatar
    // a cada tecla faria o cursor pular no meio do número.
    const [drafts, setDrafts] = useState<Record<number, string>>({});

    const usable = usableLines(lines);
    const values = usable.map((line) => line.value);
    const closes = splitIsClosed(lines, total);
    const remainder = total === null ? 0 : splitRemainder(values, total);
    const empty = usable.length === 0;

    const patch = (index: number, change: Partial<SplitLine>) =>
        onChange(lines.map((line, at) => (at === index ? { ...line, ...change } : line)));

    const optionOf = (id: number | null) => options.find((option) => option.id === id);

    const distribute = () => {
        if (total === null || lines.length === 0) return;
        // O centavo que sobra vai na PRIMEIRA linha — a mesma regra que
        // a API usa no parcelamento.
        const parts = splitEvenly(total, lines.length);
        setDrafts({});
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
                    disabled={disabled || total === null || lines.length === 0}
                    onClick={distribute}
                >
                    Dividir igualmente
                </Button>
            </div>

            {/* Sem linha nenhuma o eixo opcional simplesmente não existe:
                mostrar "faltam R$ x" ali seria cobrar um rateio que a API
                não exige. */}
            {!(empty && !required) && (
                <div className={cx(styles.status, closes ? styles.closed : styles.open)}>
                    <span className={styles.statusLeft}>
                        {closes ? (
                            <>
                                <span className={styles.check}>
                                    <IconCheck />
                                </span>
                                Rateio fecha com o total
                            </>
                        ) : total === null ? (
                            "Informe o valor total primeiro"
                        ) : remainder > 0 ? (
                            "Ainda falta distribuir"
                        ) : (
                            "Passou do total"
                        )}
                    </span>
                    {total !== null && !closes && (
                        <span className={styles.statusValue}>
                            {remainder > 0 ? formatMoney(remainder) : `+${formatMoney(-remainder)}`}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
