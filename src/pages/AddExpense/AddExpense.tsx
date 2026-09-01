import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./src/styles.module.css";
import { AddExpenseController, type AddExpenseContext, type ExpenseDraft } from "./controller";
import { validateExpense } from "./sections/submitExpense";
import { useCategories, usePaymentMethods, usePersons } from "@/data/catalogs";
import { useInvalidateMovement } from "@/data/month";
import { Button, Card } from "@/ui/primitives";
import { FooterSpacer, SlideOver } from "@/ui/overlay";
import {
    Checkbox,
    DateInput,
    FormError,
    FormField,
    SegmentedControl,
    Stepper,
    Textarea,
    cx,
    useMoneyField,
} from "@/ui/form";
import { SplitEditor, emptyLine, usableLines } from "@/ui/SplitEditor";
import { InstallmentTimeline } from "@/ui/InstallmentTimeline";
import { TagInput } from "@/ui/TagInput";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconAlert, IconChevronDown } from "@/ui/icons";
import { EmptyState, LoadingRows } from "@/ui/states";
import { categoryColor } from "@/lib/categoryColor";
import { formatMoney, splitEvenly } from "@/lib/money";
import { addMonths, formatDate, formatMonthLabel, today, toReferenceMonth } from "@/lib/date";
import { clearDraft, readDraft, writeDraft } from "@/lib/draftStorage";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O formulário de gasto é o SLIDE-OVER do frame 03 do layout, não uma
   tela própria: ele abre por cima da lista, que é onde o gasto
   recém-lançado aparece.

   A ordem dos blocos é a do layout — valor e descrição no topo, depois
   formato, parcelamento, destino, categoria e forma, resumo — e é ela
   que faz o painel ser lido de cima para baixo sem voltar.
   ════════════════════════════════════════════════════════════ */

const KIND_LABEL: Record<ApiTypes.ExpenseKind, string> = {
    single: "Padrão",
    installment: "Parcela",
    fixed: "Fixo",
};

const emptyDraft = (): ExpenseDraft => ({
    Description: "",
    TotalValue: null,
    IdCategory: null,
    ExpenseDate: today(),
    Kind: "single",
    Notes: "",
    payments: [emptyLine()],
    persons: [],
    tags: [],
    InstallmentTotal: 2,
    RecurrenceDay: null,
    RecurrenceEndDate: null,
});

/** A caixa de campo do layout (`.inbox`): rótulo pequeno em cima, o
 *  controle sem moldura própria embaixo. */
function Box({
    label,
    hint,
    htmlFor,
    children,
}: {
    label: string;
    hint?: string;
    htmlFor?: string;
    children: ReactNode;
}) {
    return (
        <div className={styles.box}>
            <label className={styles.boxLabel} htmlFor={htmlFor}>
                <span>{label}</span>
                {hint && <span className={styles.boxHint}>{hint}</span>}
            </label>
            {children}
        </div>
    );
}

export function AddExpense() {
    const navigate = useNavigate();
    const params = useParams();
    const idExpense = params.idExpense ? Number(params.idExpense) : null;
    const isEdit = idExpense !== null;

    /* O rascunho sobrevive a um recarregamento e à sessão que expira no
       meio do preenchimento: o rateio é a parte cara de montar, e
       perdê-lo por causa de um 401 é o pior momento possível.
       Edição não resgata — lá a verdade está no servidor. */
    const draftKey = isEdit ? null : "expense.new";
    const [draft, setDraft] = useState<ExpenseDraft>(
        () => (draftKey ? readDraft<ExpenseDraft>(draftKey) : null) ?? emptyDraft(),
    );
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [loading, setLoading] = useState(isEdit);
    /* O layout desenha UMA forma de pagamento. O contrato aceita várias,
       e o rateio financeiro é o que faz o saldo de duas contas bater —
       então ele continua existindo, atrás de um clique, em vez de ocupar
       o painel inteiro no caso comum de uma forma só. */
    const [splitPayments, setSplitPayments] = useState(false);

    const categories = useCategories();
    const persons = usePersons();
    const methods = usePaymentMethods();
    const invalidateMovement = useInvalidateMovement();

    const close = () => navigate("/gastos");

    const context = useMemo<AddExpenseContext>(
        () => ({
            draft,
            idExpense,
            beginSubmit() {
                setPending(true);
                setError(null);
            },
            failSubmit(message) {
                setPending(false);
                setLoading(false);
                setError(message);
            },
            finishSubmit(occurrences) {
                setPending(false);
                if (draftKey) clearDraft(draftKey);
                invalidateMovement();
                navigate("/gastos", { replace: true, state: { occurrences } });
            },
            finishLoad(loaded) {
                setPending(false);
                setLoading(false);
                setDraft(loaded);
                setSplitPayments(usableLines(loaded.payments).length > 1);
            },
        }),
        [draft, idExpense, draftKey, navigate, invalidateMovement],
    );

    useEffect(() => {
        void AddExpenseController.loadExpenseForEdit(context);
        // Só quando muda o gasto editado: recarregar a cada tecla
        // digitada apagaria o que o usuário está escrevendo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idExpense]);

    const patch = (change: Partial<ExpenseDraft>) =>
        setDraft((current) => {
            const next = { ...current, ...change };
            if (draftKey) writeDraft(draftKey, next);
            return next;
        });

    const singlePayment = draft.payments[0] ?? emptyLine();

    /** Com uma forma só, ela carrega o total inteiro: pedir o mesmo
     *  número duas vezes é o jeito mais fácil de o rateio não fechar. */
    const setTotal = (TotalValue: ApiTypes.Money | null) =>
        patch({
            TotalValue,
            payments: splitPayments ? draft.payments : [{ ...singlePayment, value: TotalValue }],
        });

    /* O campo grande de valor é um `<input>` cru, para caber o tipo do
       layout — mas o cuidado do texto cru enquanto se digita é o mesmo
       do `MoneyInput`, e vem do mesmo hook. */
    const amountField = useMoneyField(draft.TotalValue, setTotal);

    const activeCategories = (categories.data ?? []).filter((item) => item.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    const category = activeCategories.find((item) => item.IdCategory === draft.IdCategory);
    const chosenMethod = methods.find(({ method }) => method.IdPaymentMethod === singlePayment.id);

    const personsUsed = usableLines(draft.persons).length;
    const blocking = validateExpense(draft, isEdit);

    const installmentValues =
        draft.Kind === "installment" && draft.TotalValue !== null && draft.TotalValue > 0
            ? splitEvenly(draft.TotalValue, draft.InstallmentTotal)
            : null;
    const lastInstallmentMonth =
        draft.Kind === "installment"
            ? addMonths(toReferenceMonth(draft.ExpenseDate), draft.InstallmentTotal - 1)
            : null;

    let body: ReactNode;

    if (isEdit && loading) {
        body = <LoadingRows rows={4} />;
    } else if (isEdit && draft.Kind === "installment") {
        // A API responde "cancele e lance de novo": mostrar o formulário
        // seria oferecer um caminho que termina em 406.
        body = (
            <EmptyState
                icon={<IconAlert />}
                title="Compra parcelada não se edita"
                description="Cancele o lançamento e faça de novo. Reescrever as parcelas deixaria o dinheiro já quitado sem contrapartida — por isso a API recusa, e a tela não oferece o caminho."
                action={
                    <Button variant="primary" onClick={close}>
                        Voltar para os gastos
                    </Button>
                }
            />
        );
    } else {
        body = (
            <form
                id="expense-form"
                className={styles.body}
                onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void AddExpenseController.submitExpense(context);
                }}
            >
                <FormError>{error}</FormError>

                {/* ── Valor e descrição ──────────────────────── */}
                <div className={styles.rowValue}>
                    <Box label="Valor" htmlFor="expense-total">
                        <div className={styles.amountField}>
                            <span className={styles.amountPrefix}>R$</span>
                            <input
                                id="expense-total"
                                className={styles.amountInput}
                                {...amountField}
                            />
                        </div>
                    </Box>
                    <Box label="Descrição" htmlFor="expense-description">
                        <input
                            id="expense-description"
                            className={styles.plainInput}
                            maxLength={255}
                            placeholder="Mercado · compras do mês"
                            value={draft.Description}
                            onChange={(event) => patch({ Description: event.target.value })}
                        />
                    </Box>
                </div>

                {/* ── Formato e data ─────────────────────────── */}
                <div className={styles.rowKind}>
                    <Box label="Tipo do gasto">
                        <SegmentedControl
                            value={draft.Kind}
                            ariaLabel="Tipo do gasto"
                            onChange={(Kind) => patch({ Kind })}
                            options={[
                                { value: "single", label: KIND_LABEL.single },
                                {
                                    value: "installment",
                                    label: KIND_LABEL.installment,
                                    // O formato não se edita depois de gravado.
                                    disabled: isEdit,
                                },
                                { value: "fixed", label: KIND_LABEL.fixed, disabled: isEdit },
                            ]}
                        />
                    </Box>
                    <Box label="Quando aconteceu" htmlFor="expense-date">
                        <DateInput
                            id="expense-date"
                            className={styles.plainInput}
                            value={draft.ExpenseDate}
                            onValueChange={(ExpenseDate) =>
                                patch({ ExpenseDate: ExpenseDate ?? today() })
                            }
                        />
                    </Box>
                </div>

                {/* ── Parcelamento ───────────────────────────── */}
                {draft.Kind === "installment" && (
                    <div>
                        <div className={styles.groupLabel}>
                            <span className={styles.groupLabelText}>Parcelamento</span>
                            {installmentValues && lastInstallmentMonth && (
                                <span className={styles.groupLabelHint}>
                                    {draft.InstallmentTotal}× de{" "}
                                    {formatMoney(installmentValues[1] ?? installmentValues[0])} ·
                                    termina em {formatMonthLabel(lastInstallmentMonth)}
                                </span>
                            )}
                        </div>

                        <div className={styles.rowThree}>
                            <Box label="Parcelas" hint="2 a 120">
                                <Stepper
                                    value={draft.InstallmentTotal}
                                    min={2}
                                    max={120}
                                    ariaLabel="Número de parcelas"
                                    onChange={(InstallmentTotal) => patch({ InstallmentTotal })}
                                />
                            </Box>
                            <Box label="Iniciando em">
                                <span className={styles.plainInput}>
                                    1/{draft.InstallmentTotal}
                                </span>
                            </Box>
                            <Box label="Primeira parcela">
                                <span className={styles.plainInput}>
                                    {formatMonthLabel(draft.ExpenseDate)}
                                </span>
                            </Box>
                        </div>

                        <div className={styles.stack}>
                            <InstallmentTimeline
                                total={draft.TotalValue}
                                parts={draft.InstallmentTotal}
                                startDate={draft.ExpenseDate}
                            />
                        </div>
                    </div>
                )}

                {/* ── Recorrência ────────────────────────────── */}
                {draft.Kind === "fixed" && (
                    <div>
                        <div className={styles.groupLabel}>
                            <span className={styles.groupLabelText}>Recorrência</span>
                            <span className={styles.groupLabelHint}>
                                cada ocorrência nasce como um gasto de verdade
                            </span>
                        </div>

                        <div className={styles.rowPair}>
                            <Box
                                label="Dia do mês"
                                hint="vazio usa o dia da data"
                                htmlFor="rec-day"
                            >
                                <input
                                    id="rec-day"
                                    className={styles.plainInput}
                                    type="number"
                                    min={1}
                                    max={31}
                                    placeholder="—"
                                    value={draft.RecurrenceDay ?? ""}
                                    onChange={(event) =>
                                        patch({
                                            RecurrenceDay: event.target.value
                                                ? Number(event.target.value)
                                                : null,
                                        })
                                    }
                                />
                            </Box>
                            <Box label="Repetir até" htmlFor="rec-end">
                                <DateInput
                                    id="rec-end"
                                    className={styles.plainInput}
                                    value={draft.RecurrenceEndDate}
                                    onValueChange={(RecurrenceEndDate) =>
                                        patch({ RecurrenceEndDate })
                                    }
                                />
                            </Box>
                        </div>
                    </div>
                )}

                {/* ── Destino: de quem é o custo ─────────────── */}
                <div>
                    <div className={styles.groupLabel}>
                        <span className={styles.groupLabelText}>Destino</span>
                        <span className={styles.groupLabelHint}>
                            {personsUsed === 0
                                ? "opcional — não move saldo, é só análise"
                                : `${personsUsed} selecionado${personsUsed === 1 ? "" : "s"} · dividindo ${
                                      draft.TotalValue === null
                                          ? "o total"
                                          : formatMoney(draft.TotalValue)
                                  }`}
                        </span>
                    </div>
                    <SplitEditor
                        label="De quem é o custo"
                        hint="Não move saldo"
                        optionLabel="Pessoa"
                        addLabel="Adicionar destino"
                        options={activePersons.map((person) => ({
                            id: person.IdPerson,
                            label: person.Name,
                        }))}
                        lines={draft.persons}
                        onChange={(next) => patch({ persons: next })}
                        total={draft.TotalValue}
                    />
                </div>

                {/* ── Categoria e forma de pagamento ─────────── */}
                <div className={styles.rowPair}>
                    <Box label="Categoria" htmlFor="expense-category">
                        <div className={styles.selectRow}>
                            {category && (
                                <span
                                    className={styles.categoryMark}
                                    style={{ color: categoryColor(category) }}
                                >
                                    <CategoryIcon iconKey={category.IconKey} />
                                </span>
                            )}
                            <select
                                id="expense-category"
                                className={styles.plainSelect}
                                value={draft.IdCategory ?? ""}
                                onChange={(event) =>
                                    patch({
                                        IdCategory: event.target.value
                                            ? Number(event.target.value)
                                            : null,
                                    })
                                }
                            >
                                <option value="">Escolha…</option>
                                {activeCategories.map((item) => (
                                    <option key={item.IdCategory} value={item.IdCategory}>
                                        {item.Description}
                                    </option>
                                ))}
                            </select>
                            <span className={styles.caret}>
                                <IconChevronDown />
                            </span>
                        </div>
                    </Box>

                    {!splitPayments && (
                        <Box label="Forma de pagamento" htmlFor="expense-method">
                            <div className={styles.selectRow}>
                                <select
                                    id="expense-method"
                                    className={styles.plainSelect}
                                    value={singlePayment.id ?? ""}
                                    onChange={(event) =>
                                        patch({
                                            payments: [
                                                {
                                                    ...singlePayment,
                                                    id: event.target.value
                                                        ? Number(event.target.value)
                                                        : null,
                                                    value: draft.TotalValue,
                                                },
                                            ],
                                        })
                                    }
                                >
                                    <option value="">Escolha…</option>
                                    {methods.map(({ method, account }) => (
                                        <option
                                            key={method.IdPaymentMethod}
                                            value={method.IdPaymentMethod}
                                        >
                                            {account.Name} · {method.Name}
                                        </option>
                                    ))}
                                </select>
                                <span className={styles.caret}>
                                    <IconChevronDown />
                                </span>
                            </div>
                            <div className={styles.paidRow}>
                                {/* `Paid: true` é o caso do débito e do pix,
                                    que saem pagos no ato; no cartão a perna
                                    fica em aberto até a fatura vencer. */}
                                <Checkbox
                                    label="Já foi pago"
                                    checked={singlePayment.paid ?? false}
                                    onChange={(event) =>
                                        patch({
                                            payments: [
                                                { ...singlePayment, paid: event.target.checked },
                                            ],
                                        })
                                    }
                                />
                            </div>
                        </Box>
                    )}
                </div>

                {/* Parcelado aceita uma perna só — dividir ali é 406. */}
                {draft.Kind !== "installment" && (
                    <div>
                        <div className={styles.groupLabel}>
                            <span className={styles.groupLabelText}>Rateio financeiro</span>
                            <span className={styles.groupLabelHint}>
                                quando a compra saiu de mais de uma conta
                            </span>
                            <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => {
                                    const next = !splitPayments;
                                    setSplitPayments(next);
                                    if (!next) {
                                        // Voltando para uma forma só, ela
                                        // recebe o total inteiro de novo.
                                        patch({
                                            payments: [
                                                { ...singlePayment, value: draft.TotalValue },
                                            ],
                                        });
                                    }
                                }}
                            >
                                {splitPayments
                                    ? "Usar uma forma só"
                                    : "Dividir em mais de uma forma"}
                            </button>
                        </div>

                        {splitPayments && (
                            <SplitEditor
                                label="Com o que foi pago"
                                hint="Move o saldo da conta"
                                optionLabel="Forma de pagamento"
                                addLabel="Outra forma"
                                options={methods.map(({ method, account }) => ({
                                    id: method.IdPaymentMethod,
                                    label: method.Name,
                                    group: account.Name,
                                }))}
                                lines={draft.payments}
                                onChange={(payments) => patch({ payments })}
                                total={draft.TotalValue}
                                withPaid
                                required
                            />
                        )}
                    </div>
                )}

                {/* ── Etiquetas e observações ────────────────── */}
                <div className={styles.extras}>
                    <FormField
                        label="Tags"
                        help="A tag nasce aqui: digite o nome e ela passa a existir. Não há cadastro separado."
                    >
                        {(field) => (
                            <TagInput
                                id={field.id}
                                value={draft.tags}
                                onChange={(tags) => patch({ tags })}
                            />
                        )}
                    </FormField>

                    <FormField label="Observações">
                        {(field) => (
                            <Textarea
                                {...field}
                                placeholder="O que você vai querer lembrar em seis meses."
                                value={draft.Notes}
                                onChange={(event) => patch({ Notes: event.target.value })}
                            />
                        )}
                    </FormField>
                </div>

                {/* ── Resumo ─────────────────────────────────── */}
                <Card>
                    <div className={styles.blockLabel}>Resumo</div>
                    <div className={styles.summary}>
                        <span className={cx(styles.chip, styles.chipMoney)}>
                            {draft.TotalValue === null ? "R$ 0,00" : formatMoney(draft.TotalValue)}
                        </span>
                        {draft.Description.trim() && (
                            <span className={styles.chip}>{draft.Description.trim()}</span>
                        )}
                        <span className={styles.chip}>{formatDate(draft.ExpenseDate)}</span>
                        <span className={styles.chip}>{KIND_LABEL[draft.Kind]}</span>
                        {draft.Kind === "installment" && installmentValues && (
                            <span className={styles.chip}>
                                {draft.InstallmentTotal}× de{" "}
                                {formatMoney(installmentValues[1] ?? installmentValues[0])}
                            </span>
                        )}
                        {usableLines(draft.persons).map((line) => (
                            <span className={styles.chip} key={line.id}>
                                {activePersons.find((person) => person.IdPerson === line.id)
                                    ?.Name ?? "Pessoa"}{" "}
                                {formatMoney(line.value)}
                            </span>
                        ))}
                        {category && <span className={styles.chip}>{category.Description}</span>}
                        {chosenMethod && (
                            <span className={styles.chip}>
                                {chosenMethod.account.Name} · {chosenMethod.method.Name}
                            </span>
                        )}
                        {draft.tags.map((tag) => (
                            <span className={styles.chip} key={tag}>
                                #{tag}
                            </span>
                        ))}
                    </div>
                </Card>

                {blocking && !error && <div className={styles.blockHint}>{blocking}</div>}
            </form>
        );
    }

    return (
        <SlideOver
            open
            onClose={close}
            wide
            title={isEdit ? "Editar gasto" : "Novo gasto"}
            subtitle={
                isEdit
                    ? "Formato e recorrência não se editam — só o conteúdo do lançamento."
                    : "Esc para cancelar. Os dois rateios são independentes: com o que foi pago, e de quem é o custo."
            }
            footer={
                <>
                    <FooterSpacer />
                    <Button onClick={close} disabled={pending}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        form="expense-form"
                        /* O botão só acende quando o que a API exige já
                           está no lugar: aceso levando a um 406 previsível
                           seria pior do que apagado. */
                        disabled={pending || blocking !== null}
                    >
                        {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Salvar gasto"}
                    </Button>
                </>
            }
        >
            {body}
        </SlideOver>
    );
}
