import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./src/styles.module.css";
import {
    LAST_STEP,
    WelcomeController,
    type AccountStepDraft,
    type CardStepDraft,
    type InflowStepDraft,
    type PersonsStepDraft,
    type WelcomeContext,
    type WelcomeStep,
} from "./controller";
import { useSession } from "@/app/session";
import { useAccounts, useInvalidateCatalogs } from "@/data/catalogs";
import { useInvalidateMovement } from "@/data/month";
import { Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { DateInput, FormError, FormField, FormGrid, Input, MoneyInput, cx } from "@/ui/form";
import { Select } from "@/ui/select";
import { ColorPicker } from "@/ui/controls";
import { IconCheck, IconClose, IconPlus } from "@/ui/icons";
import { formatMonthLabel, today } from "@/lib/date";

/* ════════════════════════════════════════════════════════════
   `/bem-vindo` — o assistente dos primeiros passos.

   O PORQUÊ da tela e da ORDEM dos passos está em `controller.tsx`, que é
   onde moram os tipos que os quatro passos preenchem. O que vale
   registrar aqui é o que é decisão DESTA tela:

   - **Ela é tela do chassi, e não modal.** Quatro passos com formulário
     cada não cabem num painel de 390px sem rolagem dentro de rolagem, e
     a sidebar em volta faz parte do que o assistente ensina: no fim dele
     a pessoa sabe onde as cinco áreas ficam. Ela NÃO entra no menu da
     sidebar nem na tab bar — a porta dela é o cadastro
     (`pages/SignUp/SignUp.tsx`), e a retomada é o botão do Início.
   - **Não há "voltar".** Cada passo grava ao avançar, e voltar ao passo
     1 depois de ele ter passado criaria uma segunda conta — um botão
     que desfaz o que a pessoa acabou de fazer, sem dizer isso. Corrigir
     o que foi gravado é em Contas, em Personalização e em Renda, que é
     onde se corrige para sempre.
   - **Pular não escreve nada.** Só o passo 1 é obrigatório, porque é o
     único de que os outros dependem.
   ════════════════════════════════════════════════════════════ */

/** O nome de cada passo na trilha. O quinto não é passo: é o painel que
 *  fecha o assistente, e por isso não aparece na contagem. */
const STEP_NAMES: Record<Exclude<WelcomeStep, 5>, string> = {
    1: "Onde seu dinheiro fica",
    2: "Um cartão de crédito",
    3: "Quem divide o custo",
    4: "A renda do mês",
};

const STEP_NUMBERS = [1, 2, 3, 4] as const;

const newAccountDraft = (): AccountStepDraft => ({
    Name: "",
    Color: null,
    InitialBalance: 0,
    InitialBalanceDate: today(),
});

const newCardDraft = (): CardStepDraft => ({
    Name: "",
    ClosingDay: null,
    DueDay: null,
});

const newPersonsDraft = (): PersonsStepDraft => ({ names: [""] });

const newInflowDraft = (): InflowStepDraft => ({
    Description: "",
    TotalValue: null,
    IdToAccount: null,
});

/** Os dois dias do mês do cartão: o que se digita é o que a API guarda,
 *  sem conversão no meio. */
const dayOrNull = (typed: string): number | null => {
    const digits = typed.replace(/\D/g, "").slice(0, 2);
    return digits === "" ? null : Number(digits);
};

/** O que ficou pronto — é só isto que o painel final tem para dizer, e
 *  nada dele é gravado em lugar nenhum. */
interface Summary {
    accountName: string;
    card: boolean;
    persons: number;
    inflow: boolean;
}

export function Welcome() {
    const { user } = useSession();
    const navigate = useNavigate();
    const invalidateCatalogs = useInvalidateCatalogs();
    const invalidateMovement = useInvalidateMovement();

    const [step, setStep] = useState<WelcomeStep>(1);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [accountDraft, setAccountDraft] = useState<AccountStepDraft>(newAccountDraft);
    const [cardDraft, setCardDraft] = useState<CardStepDraft>(newCardDraft);
    const [personsDraft, setPersonsDraft] = useState<PersonsStepDraft>(newPersonsDraft);
    const [inflowDraft, setInflowDraft] = useState<InflowStepDraft>(newInflowDraft);

    const [idAccount, setIdAccount] = useState<number | null>(null);
    const [summary, setSummary] = useState<Summary>({
        accountName: "",
        card: false,
        persons: 0,
        inflow: false,
    });

    /* As contas do espaço, para o seletor de destino da renda. É a mesma
       entrada de cache que o resto do app lê — a conta do passo 1
       aparece aqui porque `finishStep` invalidou os cadastros, e não
       porque a tela guardou uma cópia dela. */
    const accounts = useAccounts();
    const accountOptions = useMemo(
        () =>
            (accounts.data ?? [])
                .filter((account) => account.Active)
                .map((account) => ({ value: account.IdAccount, label: account.Name })),
        [accounts.data],
    );

    const context = useMemo<WelcomeContext>(
        () => ({
            accountDraft,
            cardDraft,
            personsDraft,
            inflowDraft,
            idAccount,
            beginSubmit() {
                setPending(true);
                setError(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishStep() {
                setPending(false);
                setError(null);

                /* O cache é invalidado como as telas de cadastro já
                   fazem: o passo 4 escreve MOVIMENTO (a entrada mexe o
                   mês e o saldo), os outros três escrevem CADASTRO. */
                if (step === 4) invalidateMovement();
                else invalidateCatalogs();

                if (step === 1) {
                    setSummary((s) => ({ ...s, accountName: accountDraft.Name.trim() }));
                } else if (step === 2) {
                    setSummary((s) => ({ ...s, card: true }));
                } else if (step === 3) {
                    setSummary((s) => ({
                        ...s,
                        persons: personsDraft.names.filter((name) => name.trim()).length,
                    }));
                } else if (step === 4) {
                    setSummary((s) => ({ ...s, inflow: true }));
                }

                setStep((current) => Math.min(LAST_STEP, current + 1) as WelcomeStep);
            },
            setIdAccount(created) {
                setIdAccount(created);
                /* A conta de destino da renda JÁ VEM ESCOLHIDA: é a do
                   passo 1, e é isso que amarra os quatro passos num
                   espaço só em vez de quatro cadastros soltos. */
                setInflowDraft((draft) => ({ ...draft, IdToAccount: created }));
            },
            setPersonNames(names) {
                setPersonsDraft({ names });
            },
        }),
        [
            accountDraft,
            cardDraft,
            personsDraft,
            inflowDraft,
            idAccount,
            step,
            invalidateCatalogs,
            invalidateMovement,
        ],
    );

    /** Pular NÃO escreve nada — é só o passo seguinte. */
    const skip = () => {
        setError(null);
        setStep((current) => Math.min(LAST_STEP, current + 1) as WelcomeStep);
    };

    const submit = (run: (context: WelcomeContext) => Promise<void>) => (event: FormEvent) => {
        event.preventDefault();
        void run(context);
    };

    const firstName = user.Name.split(/\s+/)[0];

    return (
        <Page>
            <div className={styles.head}>
                <PageHead
                    title={`Bem-vindo, ${firstName}`}
                    subtitle={
                        step === LAST_STEP
                            ? "Seu espaço está montado."
                            : "Quatro passos para o espaço ficar pronto para o primeiro lançamento."
                    }
                />
            </div>

            <div className={styles.shell}>
                {/* A TRILHA. Ela não é navegação: os passos não são
                    clicáveis, porque cada um grava ao avançar e não há
                    para onde voltar. Ela existe para dizer quantos
                    faltam — a pergunta que um assistente sem fim à vista
                    deixa sem resposta. */}
                {step !== LAST_STEP && (
                    <ol className={styles.trail}>
                        {STEP_NUMBERS.map((number) => (
                            <li
                                key={number}
                                className={cx(
                                    styles.trailItem,
                                    number < step && styles.trailDone,
                                    number === step && styles.trailNow,
                                )}
                                aria-current={number === step ? "step" : undefined}
                            >
                                <span className={styles.trailMark}>
                                    {number < step ? <IconCheck /> : number}
                                </span>
                                <span className={styles.trailName}>{STEP_NAMES[number]}</span>
                            </li>
                        ))}
                    </ol>
                )}

                {step === 1 && (
                    <StepCard
                        title="Onde seu dinheiro fica"
                        description="Comece pela conta em que o salário cai. Ela já nasce com pix e débito — e é por isso que ela vem primeiro: sem conta não existe forma de pagamento, e sem forma de pagamento não há onde lançar nada."
                    >
                        <form
                            className={styles.form}
                            onSubmit={submit(WelcomeController.saveFirstAccount)}
                            noValidate
                        >
                            <FormError>{error}</FormError>

                            <FormField label="Nome da conta" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={255}
                                        placeholder="Nubank, Itaú, Banco do Brasil…"
                                        value={accountDraft.Name}
                                        onChange={(event) =>
                                            setAccountDraft((draft) => ({
                                                ...draft,
                                                Name: event.target.value,
                                            }))
                                        }
                                    />
                                )}
                            </FormField>

                            <FormGrid columns={2}>
                                <FormField
                                    label="Saldo de hoje"
                                    help="Quanto há na conta agora. Pode ser negativo — é o cheque especial."
                                >
                                    {(field) => (
                                        <MoneyInput
                                            {...field}
                                            value={accountDraft.InitialBalance}
                                            onValueChange={(InitialBalance) =>
                                                setAccountDraft((draft) => ({
                                                    ...draft,
                                                    InitialBalance,
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>

                                <FormField
                                    label="Data desse saldo"
                                    help="É daqui que a conta começa a somar."
                                >
                                    {(field) => (
                                        <DateInput
                                            {...field}
                                            value={accountDraft.InitialBalanceDate}
                                            onValueChange={(InitialBalanceDate) =>
                                                setAccountDraft((draft) => ({
                                                    ...draft,
                                                    InitialBalanceDate,
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            <FormField label="Cor">
                                {() => (
                                    <ColorPicker
                                        value={accountDraft.Color}
                                        onChange={(Color) =>
                                            setAccountDraft((draft) => ({ ...draft, Color }))
                                        }
                                    />
                                )}
                            </FormField>

                            {/* O único passo SEM "pular": os outros três
                                dependem desta conta. */}
                            <div className={styles.actions}>
                                <Button variant="primary" type="submit" disabled={pending}>
                                    {pending ? "Criando…" : "Criar conta e continuar"}
                                </Button>
                            </div>
                        </form>
                    </StepCard>
                )}

                {step === 2 && (
                    <StepCard
                        title="Um cartão de crédito"
                        description="O cartão é a única forma de pagamento que não nasce com a conta. Os dois dias abaixo estão escritos na sua fatura — e é por isso que perguntamos os dois: um dia do mês não se deduz do outro."
                    >
                        <form
                            className={styles.form}
                            onSubmit={submit(WelcomeController.saveFirstCard)}
                            noValidate
                        >
                            <FormError>{error}</FormError>

                            <FormField label="Nome do cartão" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={255}
                                        placeholder="Cartão Roxo"
                                        value={cardDraft.Name}
                                        onChange={(event) =>
                                            setCardDraft((draft) => ({
                                                ...draft,
                                                Name: event.target.value,
                                            }))
                                        }
                                    />
                                )}
                            </FormField>

                            <FormGrid columns={2}>
                                <FormField label="Dia em que a fatura fecha" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            inputMode="numeric"
                                            maxLength={2}
                                            placeholder="27"
                                            value={cardDraft.ClosingDay ?? ""}
                                            onChange={(event) =>
                                                setCardDraft((draft) => ({
                                                    ...draft,
                                                    ClosingDay: dayOrNull(event.target.value),
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>

                                <FormField label="Dia em que ela vence" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            inputMode="numeric"
                                            maxLength={2}
                                            placeholder="04"
                                            value={cardDraft.DueDay ?? ""}
                                            onChange={(event) =>
                                                setCardDraft((draft) => ({
                                                    ...draft,
                                                    DueDay: dayOrNull(event.target.value),
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            <div className={styles.actions}>
                                <Button onClick={skip} disabled={pending}>
                                    Não tenho cartão
                                </Button>
                                <Button variant="primary" type="submit" disabled={pending}>
                                    {pending ? "Criando…" : "Criar cartão e continuar"}
                                </Button>
                            </div>
                        </form>
                    </StepCard>
                )}

                {step === 3 && (
                    <StepCard
                        title="Quem divide o custo"
                        description="Quem mais aparece nos seus gastos — e depois no orçamento. Uma pessoa por linha; ninguém precisa ter login para estar aqui."
                    >
                        <form
                            className={styles.form}
                            onSubmit={submit(WelcomeController.saveFirstPersons)}
                            noValidate
                        >
                            <FormError>{error}</FormError>

                            <div className={styles.lines}>
                                {personsDraft.names.map((name, index) => (
                                    <div className={styles.line} key={index}>
                                        <Input
                                            maxLength={255}
                                            aria-label={`Pessoa ${index + 1}`}
                                            placeholder="Luana"
                                            value={name}
                                            onChange={(event) =>
                                                setPersonsDraft((draft) => ({
                                                    names: draft.names.map((current, at) =>
                                                        at === index ? event.target.value : current,
                                                    ),
                                                }))
                                            }
                                        />
                                        {/* A última linha não se remove:
                                            sem nenhuma, o passo não teria
                                            onde escrever. */}
                                        {personsDraft.names.length > 1 && (
                                            <button
                                                type="button"
                                                className={styles.lineDrop}
                                                aria-label={`Remover a pessoa ${index + 1}`}
                                                onClick={() =>
                                                    setPersonsDraft((draft) => ({
                                                        names: draft.names.filter(
                                                            (_, at) => at !== index,
                                                        ),
                                                    }))
                                                }
                                            >
                                                <IconClose />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div>
                                <Button
                                    size="sm"
                                    onClick={() =>
                                        setPersonsDraft((draft) => ({
                                            names: [...draft.names, ""],
                                        }))
                                    }
                                >
                                    <IconPlus />
                                    Mais uma pessoa
                                </Button>
                            </div>

                            <div className={styles.actions}>
                                <Button onClick={skip} disabled={pending}>
                                    Gasto sozinho
                                </Button>
                                <Button variant="primary" type="submit" disabled={pending}>
                                    {pending ? "Criando…" : "Criar e continuar"}
                                </Button>
                            </div>
                        </form>
                    </StepCard>
                )}

                {step === 4 && (
                    <StepCard
                        title="A renda do mês"
                        description={`O que entra em ${formatMonthLabel(today())}. Ela vem antes do orçamento porque orçar é repartir a renda do mês — repartir antes de lançá-la é repartir zero.`}
                    >
                        <form
                            className={styles.form}
                            onSubmit={submit(WelcomeController.saveFirstInflow)}
                            noValidate
                        >
                            <FormError>{error}</FormError>

                            <FormField label="Descrição" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={255}
                                        placeholder="Salário"
                                        value={inflowDraft.Description}
                                        onChange={(event) =>
                                            setInflowDraft((draft) => ({
                                                ...draft,
                                                Description: event.target.value,
                                            }))
                                        }
                                    />
                                )}
                            </FormField>

                            <FormGrid columns={2}>
                                <FormField label="Valor" required>
                                    {(field) => (
                                        <MoneyInput
                                            {...field}
                                            value={inflowDraft.TotalValue}
                                            onValueChange={(TotalValue) =>
                                                setInflowDraft((draft) => ({
                                                    ...draft,
                                                    TotalValue,
                                                }))
                                            }
                                        />
                                    )}
                                </FormField>

                                <FormField label="Cai em qual conta" required>
                                    {(field) => (
                                        <Select
                                            {...field}
                                            value={inflowDraft.IdToAccount}
                                            onChange={(IdToAccount) =>
                                                setInflowDraft((draft) => ({
                                                    ...draft,
                                                    IdToAccount,
                                                }))
                                            }
                                            options={accountOptions}
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            {/* Ela NASCE PENDENTE — é o "confirmar
                                recebimento", na tela de Renda, que põe o
                                dinheiro no saldo. Dito aqui para o saldo
                                da conta não parecer errado daqui a
                                pouco. */}
                            <p className={styles.note}>
                                A renda nasce pendente: o dinheiro entra no saldo quando você
                                confirmar o recebimento, na tela de Renda.
                            </p>

                            <div className={styles.actions}>
                                <Button onClick={skip} disabled={pending}>
                                    Lanço depois
                                </Button>
                                <Button variant="primary" type="submit" disabled={pending}>
                                    {pending ? "Lançando…" : "Lançar e concluir"}
                                </Button>
                            </div>
                        </form>
                    </StepCard>
                )}

                {step === LAST_STEP && (
                    /* O PAINEL FINAL NÃO ESCREVE NADA: ele diz o que
                       ficou pronto e oferece o gesto seguinte. */
                    <StepCard
                        title="Pronto para o primeiro lançamento"
                        description="Isto é o que o seu espaço já tem. O que faltar você cadastra a qualquer momento — em Contas, em Personalização e em Renda."
                    >
                        <ul className={styles.summary}>
                            <SummaryLine done>
                                A conta <b>{summary.accountName}</b>, com pix e débito
                            </SummaryLine>
                            <SummaryLine done={summary.card}>
                                {summary.card
                                    ? "Um cartão de crédito, com o ciclo da fatura"
                                    : "Nenhum cartão de crédito — cadastre em Contas quando quiser"}
                            </SummaryLine>
                            <SummaryLine done={summary.persons > 0}>
                                {summary.persons > 0
                                    ? `${summary.persons} pessoa${summary.persons === 1 ? "" : "s"} para dividir o custo`
                                    : "Nenhuma pessoa — cadastre em Personalização quando quiser"}
                            </SummaryLine>
                            <SummaryLine done={summary.inflow}>
                                {summary.inflow
                                    ? `A renda de ${formatMonthLabel(today())}, pendente de recebimento`
                                    : "Nenhuma renda lançada — lance em Renda quando quiser"}
                            </SummaryLine>
                            <SummaryLine done>
                                As treze categorias, que o espaço já trouxe
                            </SummaryLine>
                        </ul>

                        {/* O GESTO SEGUINTE é o Orçamento: é lá que a
                            renda do passo 4 vira a repartição do mês. Ele
                            é o botão principal quando há renda lançada —
                            sem ela não há o que repartir, e aí quem vem
                            primeiro é o Início. Os dois caminhos ficam
                            oferecidos de qualquer jeito. */}
                        <div className={styles.actions}>
                            <Button
                                variant={summary.inflow ? "default" : "primary"}
                                onClick={() => navigate("/", { replace: true })}
                            >
                                Ir para o Início
                            </Button>
                            <Button
                                variant={summary.inflow ? "primary" : "default"}
                                onClick={() => navigate("/orcamento", { replace: true })}
                            >
                                Repartir o mês no Orçamento
                            </Button>
                        </div>
                    </StepCard>
                )}
            </div>
        </Page>
    );
}

function StepCard({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <Card className={styles.step}>
            <div>
                <h2 className={styles.stepTitle}>{title}</h2>
                <p className={styles.stepText}>{description}</p>
            </div>
            {children}
        </Card>
    );
}

function SummaryLine({ done, children }: { done: boolean; children: ReactNode }) {
    return (
        <li className={cx(styles.summaryLine, !done && styles.summaryOff)}>
            <span className={styles.summaryMark}>{done ? <IconCheck /> : "—"}</span>
            <span>{children}</span>
        </li>
    );
}
