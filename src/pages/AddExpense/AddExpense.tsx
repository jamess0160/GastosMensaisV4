import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./src/styles.module.css";
import { AddExpenseController, type AddExpenseContext, type ExpenseDraft } from "./controller";
import { validateExpense } from "./sections/submitExpense";
import { useCategories, usePaymentMethods, usePersons } from "@/data/catalogs";
import { useInvalidateMovement } from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import {
    DateInput,
    FormError,
    FormField,
    FormGrid,
    InfoNote,
    Input,
    MoneyInput,
    Select,
    SegmentedControl,
    Stepper,
    Textarea,
    cx,
} from "@/ui/form";
import { SplitEditor, emptyLine, splitIsClosed, usableLines } from "@/ui/SplitEditor";
import { InstallmentTimeline } from "@/ui/InstallmentTimeline";
import { TagInput } from "@/ui/TagInput";
import { IconAlert, IconCheck } from "@/ui/icons";
import { EmptyState } from "@/ui/states";
import { formatMoney } from "@/lib/money";
import { formatDate, today } from "@/lib/date";
import { clearDraft, readDraft, writeDraft } from "@/lib/draftStorage";
import type { ApiTypes } from "@/types/api";

const KIND_LABEL: Record<ApiTypes.ExpenseKind, string> = {
    single: "À vista",
    installment: "Parcelado",
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
    Occurrences: 12,
});

function Check({ done, children }: { done: boolean; children: string }) {
    return (
        <div className={styles.check}>
            <span className={cx(styles.checkMark, done && styles.checkOn)}>
                <IconCheck />
            </span>
            <span>{children}</span>
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

    const categories = useCategories();
    const persons = usePersons();
    const methods = usePaymentMethods();
    const invalidateMovement = useInvalidateMovement();

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
                navigate("/gastos", {
                    replace: true,
                    state: { occurrences },
                });
            },
            finishLoad(loaded) {
                setPending(false);
                setLoading(false);
                setDraft(loaded);
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

    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    const paymentsClose = splitIsClosed(draft.payments, draft.TotalValue);
    const personsUsed = usableLines(draft.persons).length > 0;
    const personsClose = !personsUsed || splitIsClosed(draft.persons, draft.TotalValue);
    const blocking = validateExpense(draft, isEdit);

    if (isEdit && loading) {
        return (
            <Page>
                <PageHead title="Editar gasto" subtitle="Carregando o lançamento…" />
            </Page>
        );
    }

    if (isEdit && draft.Kind === "installment") {
        // A API responde "cancele e lance de novo": mostrar o formulário
        // seria oferecer um caminho que termina em 406.
        return (
            <Page>
                <PageHead title="Editar gasto" subtitle={draft.Description} />
                <EmptyState
                    icon={<IconAlert />}
                    title="Compra parcelada não se edita"
                    description="Cancele o lançamento e faça de novo. Reescrever as parcelas deixaria o dinheiro já quitado sem contrapartida — por isso a API recusa, e a tela não oferece o caminho."
                    action={
                        <Button variant="primary" onClick={() => navigate("/gastos")}>
                            Voltar para os gastos
                        </Button>
                    }
                />
            </Page>
        );
    }

    return (
        <Page>
            <PageHead
                title={isEdit ? "Editar gasto" : "Adicionar gasto"}
                subtitle={
                    isEdit
                        ? "Formato e recorrência não se editam — só o conteúdo do lançamento."
                        : "Um gasto tem dois rateios independentes: com o que foi pago, e de quem é o custo."
                }
                actions={<Button onClick={() => navigate(-1)}>Cancelar</Button>}
            />

            <form
                onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void AddExpenseController.submitExpense(context);
                }}
            >
                <div className={styles.columns}>
                    <div className={styles.form}>
                        {/* ── O que foi ──────────────────────────── */}
                        <Card>
                            <div className={styles.block}>
                                <div className={styles.blockLabel}>O gasto</div>

                                <FormField label="Descrição" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            maxLength={255}
                                            placeholder="Mercado do mês, conta de luz…"
                                            value={draft.Description}
                                            onChange={(event) =>
                                                patch({ Description: event.target.value })
                                            }
                                        />
                                    )}
                                </FormField>

                                <FormGrid columns={3}>
                                    <FormField
                                        label="Valor total"
                                        required
                                        hint={
                                            draft.Kind === "installment" ? "da compra" : undefined
                                        }
                                    >
                                        {(field) => (
                                            <MoneyInput
                                                {...field}
                                                value={draft.TotalValue}
                                                onValueChange={(TotalValue) =>
                                                    patch({ TotalValue })
                                                }
                                            />
                                        )}
                                    </FormField>

                                    <FormField label="Data" required>
                                        {(field) => (
                                            <DateInput
                                                {...field}
                                                value={draft.ExpenseDate}
                                                onValueChange={(ExpenseDate) =>
                                                    patch({ ExpenseDate: ExpenseDate ?? today() })
                                                }
                                            />
                                        )}
                                    </FormField>

                                    <FormField label="Categoria" required>
                                        {(field) => (
                                            <Select
                                                {...field}
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
                                                {activeCategories.map((category) => (
                                                    <option
                                                        key={category.IdCategory}
                                                        value={category.IdCategory}
                                                    >
                                                        {category.Description}
                                                    </option>
                                                ))}
                                            </Select>
                                        )}
                                    </FormField>
                                </FormGrid>
                            </div>
                        </Card>

                        {/* ── Formato ────────────────────────────── */}
                        <Card>
                            <div className={styles.block}>
                                <div className={styles.blockLabel}>Formato</div>

                                <SegmentedControl
                                    value={draft.Kind}
                                    variant="brand"
                                    ariaLabel="Formato do gasto"
                                    onChange={(Kind) => patch({ Kind })}
                                    options={[
                                        { value: "single", label: KIND_LABEL.single },
                                        {
                                            value: "installment",
                                            label: KIND_LABEL.installment,
                                            // O formato não se edita depois de gravado.
                                            disabled: isEdit,
                                        },
                                        {
                                            value: "fixed",
                                            label: KIND_LABEL.fixed,
                                            disabled: isEdit,
                                        },
                                    ]}
                                />

                                {draft.Kind === "installment" && (
                                    <>
                                        <FormGrid columns={2}>
                                            <FormField label="Parcelas" hint="2 a 120">
                                                {(field) => (
                                                    <Stepper
                                                        id={field.id}
                                                        value={draft.InstallmentTotal}
                                                        min={2}
                                                        max={120}
                                                        ariaLabel="Número de parcelas"
                                                        onChange={(InstallmentTotal) =>
                                                            patch({ InstallmentTotal })
                                                        }
                                                    />
                                                )}
                                            </FormField>
                                        </FormGrid>

                                        <InstallmentTimeline
                                            total={draft.TotalValue}
                                            parts={draft.InstallmentTotal}
                                            startDate={draft.ExpenseDate}
                                        />

                                        <InfoNote>
                                            Compra parcelada aceita <b>uma forma de pagamento só</b>{" "}
                                            — é ela que a API divide nas parcelas.
                                        </InfoNote>
                                    </>
                                )}

                                {draft.Kind === "fixed" && (
                                    <>
                                        <FormGrid columns={3}>
                                            <FormField label="Ocorrências" hint="1 a 60">
                                                {(field) => (
                                                    <Stepper
                                                        id={field.id}
                                                        value={draft.Occurrences}
                                                        min={1}
                                                        max={60}
                                                        ariaLabel="Número de ocorrências"
                                                        onChange={(Occurrences) =>
                                                            patch({ Occurrences })
                                                        }
                                                    />
                                                )}
                                            </FormField>

                                            <FormField
                                                label="Dia do mês"
                                                help="Vazio usa o dia da data acima."
                                            >
                                                {(field) => (
                                                    <Input
                                                        {...field}
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
                                                )}
                                            </FormField>

                                            <FormField label="Repetir até">
                                                {(field) => (
                                                    <DateInput
                                                        {...field}
                                                        value={draft.RecurrenceEndDate}
                                                        onValueChange={(RecurrenceEndDate) =>
                                                            patch({ RecurrenceEndDate })
                                                        }
                                                    />
                                                )}
                                            </FormField>
                                        </FormGrid>

                                        <InfoNote>
                                            Fixo não é um molde com instâncias: cada ocorrência
                                            nasce como um gasto de verdade, com valor e data
                                            próprios. Editar uma delas depois vale “desta em
                                            diante”.
                                        </InfoNote>
                                    </>
                                )}
                            </div>
                        </Card>

                        {/* ── Os dois rateios ────────────────────── */}
                        <Card>
                            <div className={styles.block}>
                                <div className={styles.blockLabel}>Rateio</div>
                                <div className={styles.blockHint}>
                                    Os dois eixos são independentes e cada um fecha com o total por
                                    conta própria. Duas formas de pagamento e duas pessoas são 2 + 2
                                    linhas — nunca 4.
                                </div>

                                <div className={styles.axes}>
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

                                    <SplitEditor
                                        label="De quem é o custo"
                                        hint="Não move saldo — é só análise"
                                        optionLabel="Pessoa"
                                        addLabel="Outra pessoa"
                                        options={activePersons.map((person) => ({
                                            id: person.IdPerson,
                                            label: person.Name,
                                        }))}
                                        lines={draft.persons}
                                        onChange={(persons) => patch({ persons })}
                                        total={draft.TotalValue}
                                    />
                                </div>

                                <InfoNote>
                                    Marque <b>já pago</b> na forma que saiu no ato — é o caso do
                                    débito e do pix. No cartão, a parcela fica em aberto e você a
                                    quita quando a fatura vencer.
                                </InfoNote>
                            </div>
                        </Card>

                        {/* ── Extras ─────────────────────────────── */}
                        <Card>
                            <div className={styles.block}>
                                <div className={styles.blockLabel}>Etiquetas e observações</div>

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
                                            onChange={(event) =>
                                                patch({ Notes: event.target.value })
                                            }
                                        />
                                    )}
                                </FormField>
                            </div>
                        </Card>
                    </div>

                    {/* ── Resumo ─────────────────────────────────── */}
                    <aside className={styles.aside}>
                        <Card>
                            <div className={styles.blockLabel}>
                                {draft.Kind === "installment"
                                    ? "Total da compra"
                                    : draft.Kind === "fixed"
                                      ? "Valor de cada ocorrência"
                                      : "Total do gasto"}
                            </div>
                            <div className={styles.summaryValue}>
                                {draft.TotalValue === null
                                    ? "R$ 0,00"
                                    : formatMoney(draft.TotalValue)}
                            </div>

                            <dl className={styles.summaryList}>
                                <div className={styles.summaryRow}>
                                    <dt>Formato</dt>
                                    <dd>{KIND_LABEL[draft.Kind]}</dd>
                                </div>
                                <div className={styles.summaryRow}>
                                    <dt>Data</dt>
                                    <dd>{formatDate(draft.ExpenseDate)}</dd>
                                </div>
                                {draft.Kind === "installment" && (
                                    <div className={styles.summaryRow}>
                                        <dt>Parcelas</dt>
                                        <dd>{draft.InstallmentTotal}×</dd>
                                    </div>
                                )}
                                {draft.Kind === "fixed" && (
                                    <div className={styles.summaryRow}>
                                        <dt>Ocorrências</dt>
                                        <dd>{draft.Occurrences}</dd>
                                    </div>
                                )}
                                <div className={styles.summaryRow}>
                                    <dt>Tags</dt>
                                    <dd>{draft.tags.length || "—"}</dd>
                                </div>
                            </dl>

                            <div className={styles.checks}>
                                <Check done={Boolean(draft.Description.trim())}>Descrição</Check>
                                <Check done={draft.TotalValue !== null && draft.TotalValue > 0}>
                                    Valor maior que zero
                                </Check>
                                <Check done={draft.IdCategory !== null}>Categoria escolhida</Check>
                                <Check done={paymentsClose}>Formas de pagamento fecham</Check>
                                <Check done={personsClose}>
                                    {personsUsed
                                        ? "Rateio entre pessoas fecha"
                                        : "Rateio entre pessoas (opcional)"}
                                </Check>
                            </div>
                        </Card>

                        <FormError>{error}</FormError>

                        <button
                            type="submit"
                            className={styles.submit}
                            /* O botão só acende quando o que a API exige
                               já está no lugar: aceso levando a um 406
                               previsível seria pior do que apagado. */
                            disabled={pending || blocking !== null}
                        >
                            {pending
                                ? "Salvando…"
                                : isEdit
                                  ? "Salvar alterações"
                                  : draft.Kind === "fixed"
                                    ? `Lançar ${draft.Occurrences} ocorrências`
                                    : "Lançar gasto"}
                        </button>

                        {blocking && !error && (
                            <div className={styles.blockHint} style={{ marginTop: 0 }}>
                                {blocking}
                            </div>
                        )}
                    </aside>
                </div>
            </form>
        </Page>
    );
}
