import {
    forwardRef,
    useId,
    useState,
    type ChangeEvent,
    type InputHTMLAttributes,
    type ReactNode,
    type SelectHTMLAttributes,
    type TextareaHTMLAttributes,
} from "react";
import styles from "./form.module.css";
import { IconChevronDown, IconEye, IconEyeOff } from "./icons";
import { formatAmount, parseMoneyInput } from "@/lib/money";
import type { ApiTypes } from "@/types/api";

export const cx = (...parts: (string | false | undefined | null)[]) =>
    parts.filter(Boolean).join(" ");

/* ── FormField ────────────────────────────────────────────── */

/** Rótulo, dica e erro em volta de um controle.
 *
 *  Ele gera o `id` e o entrega pela render prop, para que o `<label>`
 *  aponte de verdade para o controle — sem isso, clicar no rótulo não
 *  foca o campo e o leitor de tela anuncia um campo sem nome. */
export function FormField({
    label,
    hint,
    help,
    error,
    required,
    children,
    className,
}: {
    label: string;
    hint?: ReactNode;
    help?: ReactNode;
    error?: string | null;
    required?: boolean;
    children: (props: {
        id: string;
        "aria-invalid"?: true;
        "aria-describedby"?: string;
    }) => ReactNode;
    className?: string;
}) {
    const id = useId();
    const messageId = `${id}-msg`;
    const described = error || help ? messageId : undefined;

    return (
        <div className={cx(styles.field, className)}>
            <label className={cx(styles.label, required && styles.required)} htmlFor={id}>
                {label}
                {hint && <span className={styles.hint}>{hint}</span>}
            </label>
            {children({
                id,
                ...(error ? { "aria-invalid": true as const } : {}),
                ...(described ? { "aria-describedby": described } : {}),
            })}
            {error ? (
                <div className={styles.error} id={messageId} role="alert">
                    {error}
                </div>
            ) : (
                help && (
                    <div className={styles.help} id={messageId}>
                        {help}
                    </div>
                )
            )}
        </div>
    );
}

/* ── Controles de texto ───────────────────────────────────── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { className, invalid, ...rest },
    ref,
) {
    return (
        <input
            ref={ref}
            className={cx(styles.input, invalid && styles.invalid, className)}
            {...rest}
        />
    );
});

export const Textarea = forwardRef<
    HTMLTextAreaElement,
    TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
    return (
        <textarea
            ref={ref}
            className={cx(styles.textarea, invalid && styles.invalid, className)}
            {...rest}
        />
    );
});

export const Select = forwardRef<
    HTMLSelectElement,
    SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...rest }, ref) {
    return (
        <span className={styles.selectWrap}>
            <select
                ref={ref}
                className={cx(styles.select, invalid && styles.invalid, className)}
                {...rest}
            >
                {children}
            </select>
            <span className={styles.caret}>
                <IconChevronDown />
            </span>
        </span>
    );
});

/** Senha com o olho de revelar.
 *
 *  O botão fica dentro do campo e nunca envia o formulário
 *  (`type="button"`): num formulário de login, um clique no olho que
 *  submetesse seria o pior lugar possível para esse acidente. */
export function PasswordInput({ className, ...rest }: InputProps) {
    const [visible, setVisible] = useState(false);

    return (
        <span className={styles.adorned}>
            <Input
                type={visible ? "text" : "password"}
                className={className}
                autoComplete="current-password"
                {...rest}
            />
            <button
                type="button"
                className={styles.suffixButton}
                onClick={() => setVisible((on) => !on)}
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
            >
                {visible ? <IconEyeOff /> : <IconEye />}
            </button>
        </span>
    );
}

/* ── Dinheiro ─────────────────────────────────────────────── */

/** As props de um `<input>` de dinheiro, sem opinião nenhuma de visual.
 *
 *  O TEXTO DIGITADO FICA CRU ENQUANTO O CAMPO ESTÁ FOCADO, e só se
 *  normaliza ao sair. Formatar a cada tecla parece inofensivo e não é:
 *  digitar "1" viraria "1,00" na hora, o cursor pularia para o fim, e a
 *  próxima tecla montaria "1,002" — que `parseMoneyInput` recusa por ter
 *  três casas e devolve `null`, apagando o campo. O usuário digita 123 e
 *  fica com 3.
 *
 *  Quem converte é `parseMoneyInput`, que aceita "1.234,56"; texto que
 *  não é número vira `null`, e não zero — zero é um valor legítimo e não
 *  pode significar "não entendi".
 *
 *  Está como hook, e não escondido dentro de `MoneyInput`, porque há
 *  mais de um visual de campo de dinheiro no sistema (o do formulário e
 *  o campo grande do painel de gasto) e o cuidado acima é o mesmo nos
 *  dois. */
export function useMoneyField(
    value: ApiTypes.Money | null,
    onValueChange: (value: ApiTypes.Money | null) => void,
): {
    value: string;
    inputMode: "decimal";
    placeholder: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
} {
    const [draft, setDraft] = useState<string | null>(null);

    return {
        value: draft ?? (value === null ? "" : formatAmount(value)),
        inputMode: "decimal",
        placeholder: "0,00",
        onChange: (event) => {
            setDraft(event.target.value);
            onValueChange(parseMoneyInput(event.target.value));
        },
        onBlur: () => setDraft(null),
    };
}

/** Campo de dinheiro com o "R$" na moldura, do kit de formulário. */
export function MoneyInput({
    value,
    onValueChange,
    invalid,
    className,
    ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    value: ApiTypes.Money | null;
    onValueChange: (value: ApiTypes.Money | null) => void;
    invalid?: boolean;
}) {
    const field = useMoneyField(value, onValueChange);

    return (
        <span className={styles.adorned}>
            <span className={styles.prefix}>R$</span>
            <Input
                className={cx(styles.money, className)}
                invalid={invalid}
                /* `placeholder` antes do resto para o chamador poder
                   trocá-lo; `value` e `onChange` depois, porque quem
                   manda no texto é o hook. */
                placeholder={field.placeholder}
                {...rest}
                value={field.value}
                inputMode={field.inputMode}
                onChange={field.onChange}
                onBlur={(event) => {
                    field.onBlur();
                    rest.onBlur?.(event);
                }}
            />
        </span>
    );
}

/* ── Data de calendário ───────────────────────────────────── */

/** `<input type="date">` fala exatamente "YYYY-MM-DD" — o mesmo formato
 *  do `CalendarDate` do contrato. É por isso que aqui não há conversão
 *  nenhuma: passar por `new Date()` no meio do caminho é justamente o
 *  bug que `src/lib/date.ts` existe para evitar. */
export function DateInput({
    value,
    onValueChange,
    ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: ApiTypes.CalendarDate | null;
    onValueChange: (value: ApiTypes.CalendarDate | null) => void;
}) {
    return (
        <Input
            type="date"
            value={value ?? ""}
            onChange={(event) => onValueChange(event.target.value || null)}
            {...rest}
        />
    );
}

/* ── Checkbox e toggle ────────────────────────────────────── */

export function Checkbox({
    label,
    className,
    ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
    return (
        <label className={cx(styles.checkbox, className)}>
            <input type="checkbox" {...rest} />
            <span className={styles.checkboxText}>{label}</span>
        </label>
    );
}

export function Toggle({
    checked,
    onCheckedChange,
    label,
    help,
    disabled,
}: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label?: ReactNode;
    help?: ReactNode;
    disabled?: boolean;
}) {
    const control = (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={typeof label === "string" ? label : undefined}
            disabled={disabled}
            className={cx(styles.toggle, checked && styles.toggleOn)}
            onClick={() => onCheckedChange(!checked)}
        >
            <i />
        </button>
    );

    if (!label) return control;

    return (
        <div className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
                {label}
                {help && <div className={styles.toggleHelp}>{help}</div>}
            </div>
            {control}
        </div>
    );
}

/* ── Segmented control ────────────────────────────────────── */

export function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
    variant = "default",
    ariaLabel,
}: {
    value: T;
    onChange: (value: T) => void;
    options: readonly { value: T; label: ReactNode; disabled?: boolean }[];
    variant?: "default" | "brand";
    ariaLabel?: string;
}) {
    return (
        <div
            className={cx(styles.seg, variant === "brand" && styles.segBrand)}
            role="radiogroup"
            aria-label={ariaLabel}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={option.value === value}
                    disabled={option.disabled}
                    className={cx(option.value === value && styles.segOn)}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/* ── Stepper ──────────────────────────────────────────────── */

/** Contador com os limites do contrato embutidos (2–120 parcelas, 1–60
 *  ocorrências): o botão apaga no limite em vez de deixar a API recusar. */
export function Stepper({
    value,
    onChange,
    min = 1,
    max = 999,
    ariaLabel,
    id,
}: {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    ariaLabel?: string;
    id?: string;
}) {
    const clamp = (next: number) => Math.min(max, Math.max(min, next));

    return (
        <div className={styles.stepper}>
            <button
                type="button"
                onClick={() => onChange(clamp(value - 1))}
                disabled={value <= min}
                aria-label="Diminuir"
            >
                −
            </button>
            <input
                id={id}
                className={styles.value}
                inputMode="numeric"
                aria-label={ariaLabel}
                value={value}
                onChange={(event) => {
                    const next = Number(event.target.value.replace(/\D/g, ""));
                    if (Number.isFinite(next) && next > 0) onChange(clamp(next));
                }}
            />
            <button
                type="button"
                onClick={() => onChange(clamp(value + 1))}
                disabled={value >= max}
                aria-label="Aumentar"
            >
                +
            </button>
        </div>
    );
}

/** A mensagem que veio do 406, no topo do formulário. O `role="alert"`
 *  é o que faz o leitor de tela anunciar a recusa sem que o foco mude. */
export function FormError({ children }: { children: ReactNode }) {
    if (!children) return null;
    return (
        <div className={styles.formError} role="alert">
            {children}
        </div>
    );
}

/* ── Grades ───────────────────────────────────────────────── */

export function FormGrid({
    columns = 1,
    children,
    className,
}: {
    columns?: 1 | 2 | 3;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cx(
                styles.grid,
                columns === 2 && styles.cols2,
                columns === 3 && styles.cols3,
                className,
            )}
        >
            {children}
        </div>
    );
}
