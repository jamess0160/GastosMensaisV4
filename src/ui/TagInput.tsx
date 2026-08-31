import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./split.module.css";
import { cx } from "./form";
import { IconClose, IconPlus, IconTag } from "./icons";
import { TagsConnection } from "@/api/Tags.connection";

/* ════════════════════════════════════════════════════════════
   Entrada de tags com sugestão.

   A tag não tem cadastro: ela NASCE do texto digitado no gasto, e o
   `POST /Expenses` é o único lugar do sistema em que isso acontece.
   Por isso o que sai daqui é `string[]`, nunca id — e digitar de novo
   um nome arquivado é o único caminho de restauração que existe.
   ════════════════════════════════════════════════════════════ */

const MAX_LENGTH = 100;

export function TagInput({
    value,
    onChange,
    placeholder = "Digite e pressione Enter…",
    disabled = false,
    id,
}: {
    value: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
}) {
    const [draft, setDraft] = useState("");
    const [focused, setFocused] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [highlighted, setHighlighted] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    // A busca é ILIKE no servidor e o resultado vem limitado; o atraso
    // aqui é só para não disparar uma requisição por tecla.
    useEffect(() => {
        const term = draft.trim();
        if (!focused || term.length < 2) {
            setSuggestions([]);
            return;
        }

        let canceled = false;
        const timer = window.setTimeout(async () => {
            try {
                const found = await TagsConnection.search(term);
                if (!canceled) setSuggestions(found.map((tag) => tag.Name));
            } catch {
                // Sugestão é conveniência: sem ela ainda se digita a tag
                // inteira e o gasto salva igual. Falhar aqui não é erro
                // de fluxo e não vira mensagem na tela.
                if (!canceled) setSuggestions([]);
            }
        }, 220);

        return () => {
            canceled = true;
            window.clearTimeout(timer);
        };
    }, [draft, focused]);

    const already = (name: string) =>
        value.some((tag) => tag.toLowerCase() === name.trim().toLowerCase());

    const add = (name: string) => {
        const clean = name.trim().slice(0, MAX_LENGTH);
        // A API reusa a tag existente ignorando maiúsculas, então repetir
        // "Mercado" e "mercado" na mesma lista não faria duas tags — só
        // uma linha duplicada na tela.
        if (!clean || already(clean)) {
            setDraft("");
            return;
        }
        onChange([...value, clean]);
        setDraft("");
        setSuggestions([]);
        setHighlighted(-1);
    };

    const remove = (index: number) => onChange(value.filter((_, at) => at !== index));

    const visible = suggestions.filter((name) => !already(name));

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown" && visible.length > 0) {
            event.preventDefault();
            setHighlighted((at) => (at + 1) % visible.length);
            return;
        }
        if (event.key === "ArrowUp" && visible.length > 0) {
            event.preventDefault();
            setHighlighted((at) => (at <= 0 ? visible.length - 1 : at - 1));
            return;
        }
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(highlighted >= 0 && visible[highlighted] ? visible[highlighted] : draft);
            return;
        }
        if (event.key === "Escape" && visible.length > 0) {
            event.stopPropagation();
            setSuggestions([]);
            return;
        }
        // Backspace no campo vazio apaga a última tag — o gesto que todo
        // campo de etiqueta tem, e cuja falta se sente.
        if (event.key === "Backspace" && !draft && value.length > 0) {
            remove(value.length - 1);
        }
    };

    return (
        <div className={styles.tagField}>
            <div
                className={cx(styles.tagBox, focused && styles.tagBoxFocus)}
                onClick={() => inputRef.current?.focus()}
            >
                {value.map((tag, index) => (
                    <span className={styles.tag} key={`${tag}-${index}`}>
                        {tag}
                        <button
                            type="button"
                            className={styles.tagRemove}
                            onClick={() => remove(index)}
                            aria-label={`Remover ${tag}`}
                            disabled={disabled}
                        >
                            <IconClose />
                        </button>
                    </span>
                ))}
                <input
                    id={id}
                    ref={inputRef}
                    className={styles.tagInput}
                    value={draft}
                    disabled={disabled}
                    maxLength={MAX_LENGTH}
                    placeholder={value.length === 0 ? placeholder : ""}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={visible.length > 0}
                    aria-autocomplete="list"
                    onChange={(event) => {
                        setDraft(event.target.value);
                        setHighlighted(-1);
                    }}
                    onKeyDown={onKeyDown}
                    onFocus={() => setFocused(true)}
                    // O blur espera o clique na sugestão acontecer: fechar
                    // na hora tiraria o item de baixo do cursor.
                    onBlur={() => window.setTimeout(() => setFocused(false), 120)}
                />
            </div>

            {focused && (visible.length > 0 || draft.trim().length >= 2) && (
                <div className={styles.suggestions} role="listbox">
                    {visible.map((name, index) => (
                        <button
                            key={name}
                            type="button"
                            role="option"
                            aria-selected={index === highlighted}
                            className={cx(
                                styles.suggestion,
                                index === highlighted && styles.suggestionOn,
                            )}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => add(name)}
                        >
                            <IconTag />
                            {name}
                        </button>
                    ))}
                    {draft.trim().length >= 2 && !already(draft) && (
                        <button
                            type="button"
                            className={cx(styles.suggestion, styles.suggestionNew)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => add(draft)}
                        >
                            <IconPlus />
                            Criar “{draft.trim()}”
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
