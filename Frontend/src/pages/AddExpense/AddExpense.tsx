import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styles from "./src/styles.module.css";
import { AddExpenseController, type AddExpenseContext, type ExpenseDraft } from "./controller";
import { validateExpense } from "./sections/submitExpense";
import { useCategoriesWithArchived, usePaymentMethods, usePersons } from "@/data/catalogs";
import { useInvalidateMovement } from "@/data/month";
import { Button, Card } from "@/ui/primitives";
import { FooterSpacer, SlideOver } from "@/ui/overlay";
import {
    Checkbox,
    DateInput,
    FormError,
    FormField,
    FormNotice,
    Input,
    SegmentedControl,
    Stepper,
    Textarea,
    cx,
    useMoneyField,
} from "@/ui/form";
import { SplitEditor, emptyLine, usableLines, type SplitLine } from "@/ui/SplitEditor";
import { Select } from "@/ui/select";
import { InstallmentTimeline } from "@/ui/InstallmentTimeline";
import { TagInput } from "@/ui/TagInput";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconAlert, METHOD_ICON } from "@/ui/icons";
import { EmptyState, LoadingRows } from "@/ui/states";
import { accentColor, categoryColor } from "@/lib/categoryColor";
import { withReferencedOptions } from "@/lib/catalogOptions";
import { formatMoney, splitEvenly, withSignOf } from "@/lib/money";
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
            {/* O conteúdo se centraliza no que sobra DEPOIS do rótulo:
                numa fileira de caixas de alturas diferentes ("Dia do
                mês" ao lado de "Repetir até"), sem isto o controle
                fica grudado no topo de umas e no meio de outras. */}
            <div className={styles.boxContent}>{children}</div>
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
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [loading, setLoading] = useState(isEdit);
    /* O layout desenha UMA forma de pagamento. O contrato aceita várias,
       e o rateio financeiro é o que faz o saldo de duas contas bater —
       então ele continua existindo, atrás de um clique, em vez de ocupar
       o painel inteiro no caso comum de uma forma só. */
    const [splitPayments, setSplitPayments] = useState(false);

    /* **A lista COM as arquivadas, e não a de escolha.** Quem oferece o
       que escolher é o `withReferencedOptions` lá embaixo, que filtra o
       ativo daqui — a arquivada só chega à tela se este gasto já apontar
       para ela. Isso não contraria o aviso de `catalogs.ts` (abrir a
       Personalização não pode devolver a arquivada ao seletor e ao donut):
       o que este formulário não pode é OFERECÊ-LA, e ele não oferece.
       Custa a entrada de cache própria — a mesma da Personalização, com
       `staleTime` de catálogo —, e é o único jeito de saber o NOME de uma
       categoria arquivada: o `GET /Expenses/:id` traz só `IdCategory`. */
    const categories = useCategoriesWithArchived();
    /* `usePersons` já devolve as arquivadas junto: quem filtra `Active` é
       cada tela. Aqui o dado já estava carregado, e era só parar de
       descartá-lo. */
    const persons = usePersons();
    const methods = usePaymentMethods();
    const invalidateMovement = useInvalidateMovement();

    /* De onde o painel foi aberto — ver `modalRoute.tsx`. Fechar
       devolve para lá; quem chegou por link direto cai na lista. */
    const location = useLocation();
    const cameFrom = (location.state as { background?: string } | null)?.background ?? null;
    const close = () => (cameFrom ? navigate(-1) : navigate("/gastos"));

    /* Quais formas são cartão de crédito — a pergunta que o ESTORNO faz.
       Valor negativo só é aceito ali: fora do cartão, dinheiro que volta
       entra na conta de verdade, e para isso existe `POST /Inflows`. */
    const creditCardMethods = useMemo(
        () =>
            new Set(
                methods
                    .filter(({ method }) => method.Kind === "credit_card")
                    .map(({ method }) => method.IdPaymentMethod),
            ),
        [methods],
    );

    const context = useMemo<AddExpenseContext>(
        () => ({
            draft,
            idExpense,
            creditCardMethods,
            beginSubmit() {
                setPending(true);
                setError(null);
            },
            failSubmit(message) {
                setPending(false);
                setLoading(false);
                setNotice(null);
                setError(message);
            },
            /* LANÇAR NÃO FECHA O PAINEL. Quem abre o formulário de gasto
               quase nunca tem um só para lançar — fechar a cada gravação
               obrigava a reabrir, reescolher a forma de pagamento e
               reencontrar o lugar. O painel se esvazia, avisa o que
               gravou e espera o próximo; fechar é do usuário.

               Na EDIÇÃO não: ali existe um gasto sendo alterado, não uma
               fila para digitar, e salvar significa terminar. */
            finishSubmit(occurrences) {
                setPending(false);
                if (draftKey) clearDraft(draftKey);
                invalidateMovement();

                if (isEdit) {
                    close();
                    return;
                }

                setDraft(emptyDraft());
                setSplitPayments(false);
                setError(null);
                setNotice(
                    occurrences > 1
                        ? `Gasto lançado em ${occurrences} ocorrências — o próximo já pode ser digitado.`
                        : "Gasto lançado — o próximo já pode ser digitado.",
                );
                // O valor é o primeiro campo do painel e o começo de todo
                // lançamento: é para lá que o cursor volta.
                document.getElementById("expense-total")?.focus();
            },
            finishLoad(loaded) {
                setPending(false);
                setLoading(false);
                setDraft(loaded);
                setSplitPayments(usableLines(loaded.payments).length > 1);
            },
        }),
        [draft, idExpense, creditCardMethods, draftKey, navigate, invalidateMovement],
    );

    useEffect(() => {
        void AddExpenseController.loadExpenseForEdit(context);
        // Só quando muda o gasto editado: recarregar a cada tecla
        // digitada apagaria o que o usuário está escrevendo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idExpense]);

    /** O rascunho aceita o sinal negativo?
     *
     *  Só quando TODA forma escolhida é cartão de crédito e o formato é
     *  avulso — as duas regras que a API cobra no estorno. Fora disso o
     *  gasto é positivo, e o `-` nem chega a ser digitado. */
    const acceptsRefund = (candidate: ExpenseDraft): boolean => {
        const lines = usableLines(candidate.payments);
        return (
            candidate.Kind === "single" &&
            lines.length > 0 &&
            lines.every((line) => creditCardMethods.has(line.id))
        );
    };

    /** Repõe o sinal quando o rascunho deixa de aceitar o negativo.
     *
     *  Trocar a forma para pix com −150 na tela deixaria um corpo que a
     *  API recusa, e o usuário só descobriria ao salvar. A reposição
     *  mora aqui, num lugar só, porque são três caminhos que levam ao
     *  mesmo estado: trocar a forma, trocar o formato e mexer no rateio.
     *
     *  Enquanto as formas não chegaram do servidor não há o que decidir:
     *  mexer no sinal ali apagaria o rascunho resgatado do storage. */
    const normalizeSign = (candidate: ExpenseDraft): ExpenseDraft => {
        const negative = (candidate.TotalValue ?? 0) < 0;
        if (!negative || methods.length === 0 || acceptsRefund(candidate)) return candidate;

        const positive = (line: SplitLine) => ({ ...line, value: withSignOf(line.value, 1) });

        return {
            ...candidate,
            TotalValue: Math.abs(candidate.TotalValue as number),
            payments: candidate.payments.map(positive),
            persons: candidate.persons.map(positive),
        };
    };

    const patch = (change: Partial<ExpenseDraft>) => {
        // O aviso é do que ACABOU de ser gravado: à primeira tecla do
        // próximo lançamento ele já não fala do que está na tela.
        setNotice(null);
        setDraft((current) => {
            const next = normalizeSign({ ...current, ...change });
            if (draftKey) writeDraft(draftKey, next);
            return next;
        });
    };

    const singlePayment = draft.payments[0] ?? emptyLine();

    /** Com uma forma só, ela carrega o total inteiro: pedir o mesmo
     *  número duas vezes é o jeito mais fácil de o rateio não fechar.
     *
     *  O SINAL do total é reposto nas linhas dos dois eixos: um gasto é
     *  inteiro positivo ou inteiro negativo, e a API recusa a mistura. */
    const setTotal = (TotalValue: ApiTypes.Money | null) =>
        patch({
            TotalValue,
            payments: splitPayments
                ? draft.payments.map((line) => ({
                      ...line,
                      value: withSignOf(line.value, TotalValue),
                  }))
                : [{ ...singlePayment, value: TotalValue }],
            persons: draft.persons.map((line) => ({
                ...line,
                value: withSignOf(line.value, TotalValue),
            })),
        });

    /* O campo grande de valor é um `<input>` cru, para caber o tipo do
       layout — mas o cuidado do texto cru enquanto se digita é o mesmo
       do `MoneyInput`, e vem do mesmo hook. O sinal só é liberado no
       cartão: ver `acceptsRefund`. */
    const amountField = useMoneyField(draft.TotalValue, setTotal, acceptsRefund(draft));

    /* Os dois seletores oferecem o CADASTRO ATIVO, e mostram além dele o
       arquivado que este gasto já aponta — ver `withReferencedOptions`.
       Sem isso a linha do arquivado aparece em branco com o valor
       preenchido, e salvar a descrição leva 406 por uma escolha que quem
       está editando nem enxerga. */
    const allCategories = categories.data ?? [];
    const allPersons = persons.data ?? [];

    const categoryOptions = withReferencedOptions(
        allCategories.filter((item) => item.Active),
        allCategories,
        [draft.IdCategory],
        { id: (item) => item.IdCategory, label: (item) => item.Description },
    );

    const personOptions = withReferencedOptions(
        allPersons.filter((person) => person.Active),
        allPersons,
        draft.persons.map((line) => line.id),
        { id: (person) => person.IdPerson, label: (person) => person.Name },
    );

    const category = categoryOptions.find((option) => option.id === draft.IdCategory);
    const chosenMethod = methods.find(({ method }) => method.IdPaymentMethod === singlePayment.id);
    /* `Paid: true` com forma `credit_card` é 406: no cartão, marcar a
       compra como paga não tira dinheiro de conta nenhuma — quem tira é
       o pagamento da fatura, semanas depois. O checkbox some em vez de
       levar a uma recusa previsível. */
    const acceptsPaid = chosenMethod?.method.Kind !== "credit_card";

    const personsUsed = usableLines(draft.persons).length;
    const blocking = validateExpense(draft, isEdit, creditCardMethods);
    const isRefund = (draft.TotalValue ?? 0) < 0;

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
                <FormNotice>{notice}</FormNotice>

                {/* ── Valor e descrição ──────────────────────── */}
                {/* `autoComplete="off"` nos dois: o valor é um campo
                    mascarado, e o histórico do navegador devolve texto que a
                    máscara rejeita; na descrição a lista cobre o formulário no
                    telefone. E-mail, nome, telefone e senha continuam
                    autocompletando — desligar por atacado seria pior. */}
                <div className={styles.rowValue}>
                    <Box
                        label="Valor"
                        hint={acceptsRefund(draft) ? "negativo = estorno" : undefined}
                        htmlFor="expense-total"
                    >
                        <div className={styles.amountField}>
                            <span className={styles.amountPrefix}>R$</span>
                            <input
                                id="expense-total"
                                className={styles.amountInput}
                                autoComplete="off"
                                {...amountField}
                            />
                        </div>
                        {/* O erro previsível: juros, anuidade e IOF NÃO são
                            estorno — são gastos positivos numa categoria de
                            tarifas. Só o estorno tem sinal invertido, porque
                            só ele REDUZ o que se vai pagar. */}
                        {isRefund && (
                            <div className={styles.refundNote}>
                                Estorno: a fatura encolhe, e nenhum dinheiro entra na conta. Juros,
                                anuidade e IOF não são estorno — são gastos positivos numa categoria
                                de tarifas.
                            </div>
                        )}
                    </Box>
                    <Box label="Descrição" htmlFor="expense-description">
                        <input
                            id="expense-description"
                            className={styles.plainInput}
                            autoComplete="off"
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
                                {/* Este é o único campo do painel que
                                    pede uma caixa de verdade: sem
                                    moldura, um número de dois dígitos
                                    solto ao lado de uma data com moldura
                                    não se lê como campo. E com largura
                                    própria, para não esticar junto com o
                                    "Repetir até". */}
                                <Input
                                    id="rec-day"
                                    className={styles.dayInput}
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
                        <span className={styles.groupLabelText}>Pessoa</span>
                        <span className={styles.groupLabelHint}>
                            {personsUsed === 0
                                ? "opcional"
                                : `${personsUsed} selecionado${personsUsed === 1 ? "" : "s"} · dividindo ${
                                      draft.TotalValue === null
                                          ? "o total"
                                          : formatMoney(draft.TotalValue)
                                  }`}
                        </span>
                    </div>
                    <SplitEditor
                        label="De quem é o custo"
                        optionLabel="Pessoa"
                        addLabel="Adicionar pessoa"
                        options={personOptions}
                        lines={draft.persons}
                        onChange={(next) => patch({ persons: next })}
                        total={draft.TotalValue}
                        /* O caso comum é o gasto de uma pessoa só, ou
                           rachado meio a meio: escolher a pessoa já
                           preenche o valor. Só aqui — o eixo financeiro,
                           abaixo, não nasce dividido. */
                        autoSplit
                    />
                </div>

                {/* ── Categoria e forma de pagamento ─────────── */}
                <div className={styles.rowPair}>
                    <Box label="Categoria" htmlFor="expense-category">
                        <Select
                            variant="plain"
                            id="expense-category"
                            value={draft.IdCategory}
                            onChange={(IdCategory) => patch({ IdCategory })}
                            options={categoryOptions.map((option) => ({
                                value: option.id,
                                label: option.label,
                                icon: <CategoryIcon iconKey={option.item.IconKey} />,
                                color: categoryColor(option.item),
                            }))}
                            emptyLabel="Nenhuma categoria ativa"
                        />
                    </Box>

                    {!splitPayments && (
                        <Box label="Forma de pagamento" htmlFor="expense-method">
                            <Select
                                variant="plain"
                                id="expense-method"
                                value={singlePayment.id}
                                onChange={(id) =>
                                    patch({
                                        payments: [
                                            {
                                                ...singlePayment,
                                                id,
                                                value: draft.TotalValue,
                                                // Ver `acceptsPaid`: no cartão,
                                                // `Paid` é 406.
                                                paid:
                                                    methods.find(
                                                        ({ method }) =>
                                                            method.IdPaymentMethod === id,
                                                    )?.method.Kind === "credit_card"
                                                        ? false
                                                        : singlePayment.paid,
                                            },
                                        ],
                                    })
                                }
                                options={methods.map(({ method, account }) => ({
                                    value: method.IdPaymentMethod,
                                    label: `${account.Name} · ${method.Name}`,
                                    icon: METHOD_ICON[method.Kind],
                                    color: accentColor(method.Color ?? account.Color),
                                }))}
                                emptyLabel="Nenhuma forma cadastrada"
                            />
                            {acceptsPaid && (
                                <div className={styles.paidRow}>
                                    {/* `Paid: true` é o caso do débito e do
                                        pix, que saem pagos no ato. */}
                                    <Checkbox
                                        label="Já foi pago"
                                        checked={singlePayment.paid ?? false}
                                        onChange={(event) =>
                                            patch({
                                                payments: [
                                                    {
                                                        ...singlePayment,
                                                        paid: event.target.checked,
                                                    },
                                                ],
                                            })
                                        }
                                    />
                                </div>
                            )}
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
                                optionLabel="Forma de pagamento"
                                addLabel="Outra forma"
                                options={methods.map(({ method, account }) => ({
                                    id: method.IdPaymentMethod,
                                    label: method.Name,
                                    group: account.Name,
                                    icon: METHOD_ICON[method.Kind],
                                    color: accentColor(method.Color ?? account.Color),
                                    acceptsPaid: method.Kind !== "credit_card",
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
                    <FormField label="Tags">
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
                                {personOptions.find((option) => option.id === line.id)?.label ??
                                    "Pessoa"}{" "}
                                {formatMoney(line.value)}
                            </span>
                        ))}
                        {category && <span className={styles.chip}>{category.label}</span>}
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
