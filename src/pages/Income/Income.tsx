import { useMemo, useState, type FormEvent } from "react";
import styles from "./src/styles.module.css";
import { IncomeController, type IncomeContext, type InflowDraft } from "./controller";
import { validateInflow } from "./sections/submitInflow";
import { useSession } from "@/app/session";
import { useAccounts, usePersonIndex, usePersons } from "@/data/catalogs";
import {
    useInflowDetail,
    useInvalidateMovement,
    useMonthInflowDetails,
    useMonthInflows,
} from "@/data/month";
import { Avatar, Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { Topbar } from "@/ui/topbar";
import {
    ClearFilters,
    FilterBar,
    FilterChip,
    FilterGroup,
    FilterSelect,
    SearchInput,
} from "@/ui/controls";
import {
    DateInput,
    FormError,
    FormField,
    FormGrid,
    Input,
    MoneyInput,
    SegmentedControl,
    Select,
    Textarea,
} from "@/ui/form";
import { SplitEditor } from "@/ui/SplitEditor";
import { ConfirmDialog, FooterSpacer, SlideOver } from "@/ui/overlay";
import { IconArrowUp, IconCopy, IconEdit, IconPlus, IconTransfer } from "@/ui/icons";
import {
    Cell,
    CellAmount,
    DueDate,
    RowTrigger,
    Table,
    TableFoot,
    TableHead,
    TableRow,
    TypeTile,
} from "@/ui/table";
import { EmptyState, ErrorState, LoadingRows, StatusBadge } from "@/ui/states";
import { sumMoney, totalExpectedInflow, totalReceived } from "@/lib/aggregate";
import { formatMoney } from "@/lib/money";
import { currentMonth, formatDate, formatDateTime, formatMonthLabel, today } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

const newDraft = (kind: ApiTypes.InflowKind): InflowDraft => ({
    IdInflow: null,
    Description: "",
    TotalValue: null,
    Kind: kind,
    IdFromAccount: null,
    IdToAccount: null,
    CompetenceDate: today(),
    ExpectedDate: null,
    Notes: "",
    persons: [],
    received: false,
});

export function Income() {
    const [month, setMonth] = useState(currentMonth);
    const [status, setStatus] = useState<ApiTypes.InflowStatus | null>(null);
    const [kindFilter, setKindFilter] = useState<ApiTypes.InflowKind | null>(null);
    const [idPerson, setIdPerson] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [openInflow, setOpenInflow] = useState<number | null>(null);
    const [draft, setDraft] = useState<InflowDraft | null>(null);
    const [confirming, setConfirming] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const { user } = useSession();
    const inflows = useMonthInflows(month);
    const monthDetails = useMonthInflowDetails(month);
    const detail = useInflowDetail(openInflow);
    const accounts = useAccounts();
    const persons = usePersons();
    const personIndex = usePersonIndex();
    const invalidateMovement = useInvalidateMovement();

    const context = useMemo<IncomeContext>(
        () => ({
            draft,
            beginSubmit() {
                setPending(true);
                setError(null);
                setNotice(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishSubmit(message) {
                setPending(false);
                if (message) setNotice(message);
                invalidateMovement();
            },
            closeForm: () => setDraft(null),
            closeDetail: () => setOpenInflow(null),
            setDraft,
        }),
        [draft, invalidateMovement],
    );

    const accountIndex = useMemo(
        () => new Map((accounts.data ?? []).map((account) => [account.IdAccount, account])),
        [accounts.data],
    );
    const activeAccounts = (accounts.data ?? []).filter((account) => account.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    /* O destino vive no DETALHE — a lista não traz `Persons`. Enquanto
       ele não chega, a linha não passa no filtro de destino; sem filtro
       de destino, o detalhe não interfere em nada. */
    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (inflows.data ?? []).filter((inflow) => {
            if (status !== null && inflow.Status !== status) return false;
            if (kindFilter !== null && inflow.Kind !== kindFilter) return false;
            if (term && !inflow.Description.toLowerCase().includes(term)) return false;
            if (idPerson !== null) {
                const found = monthDetails.byId.get(inflow.IdInflow);
                if (!found?.Persons.some((person) => person.IdPerson === idPerson)) return false;
            }
            return true;
        });
    }, [inflows.data, status, kindFilter, search, idPerson, monthDetails.byId]);

    const all = inflows.data ?? [];
    const received = totalReceived(all);
    const expected = totalExpectedInflow(all);
    const transferred = sumMoney(
        all
            .filter((inflow) => inflow.Kind === "transfer" && inflow.Status !== "canceled")
            .map((inflow) => inflow.TotalValue),
    );

    const hasFilters =
        status !== null || kindFilter !== null || idPerson !== null || search.trim() !== "";

    const clearAll = () => {
        setStatus(null);
        setKindFilter(null);
        setIdPerson(null);
        setSearch("");
    };

    const inflow = detail.data;
    const blocking = draft ? validateInflow(draft) : null;

    return (
        <>
            <Topbar
                greeting={`Olá, ${user.Name.split(/\s+/)[0]}`}
                month={month}
                onMonthChange={setMonth}
                actions={
                    <>
                        {/* Clonar o mês é operação de SERVIDOR: no
                            cliente seriam N+1 requisições sem transaction
                            e sem idempotência, e dois cliques duplicariam
                            o mês inteiro. Ver a pendência 11 do backend.
                            O botão fica desabilitado e rotulado, como os
                            outros que o layout desenha e a API ainda não
                            atende. */}
                        <Button disabled title="Ainda sem API">
                            <IconCopy />
                            Clonar mês anterior
                        </Button>
                        <Button onClick={() => setDraft(newDraft("transfer"))}>
                            <IconTransfer />
                            Transferir
                        </Button>
                        <Button variant="primary" onClick={() => setDraft(newDraft("inflow"))}>
                            <IconPlus />
                            Nova renda
                        </Button>
                    </>
                }
            />

            <Page>
                <PageHead
                    title="Renda"
                    subtitle={`${formatMonthLabel(month)} · ${rows.length} entrada${rows.length === 1 ? "" : "s"} · transferência entre contas não conta como renda`}
                />

                {notice && <div className={styles.notice}>{notice}</div>}
                <FormError>{error}</FormError>

                <div className={styles.strip}>
                    <div className={styles.cell}>
                        <div className={styles.cellLabel}>Total recebido</div>
                        <div className={`${styles.cellValue} ${styles.positive}`}>
                            {formatMoney(received)}
                        </div>
                        <div className={styles.cellCaption}>
                            já no saldo · transferência não conta
                        </div>
                    </div>
                    <div className={`${styles.cell} ${expected > 0 ? styles.attn : ""}`}>
                        <div className={styles.cellLabel}>Pendente</div>
                        <div className={styles.cellValue}>{formatMoney(expected)}</div>
                        <div className={styles.cellCaption}>previsto, ainda fora do saldo</div>
                    </div>
                    <div className={styles.cell}>
                        <div className={styles.cellLabel}>Transferências</div>
                        <div className={styles.cellValue}>{formatMoney(transferred)}</div>
                        <div className={styles.cellCaption}>o mesmo dinheiro trocando de bolso</div>
                    </div>
                </div>

                {/* Os filtros ficam ABAIXO dos indicadores: primeiro o
                    número do mês, depois o recorte que o muda. */}
                <div className={styles.toolbar}>
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar descrição…"
                    />

                    <FilterBar>
                        <FilterGroup label="Status">
                            <FilterChip active={status === null} onClick={() => setStatus(null)}>
                                Todas
                            </FilterChip>
                            <FilterChip
                                active={status === "pending"}
                                onClick={() => setStatus("pending")}
                            >
                                A receber
                            </FilterChip>
                            <FilterChip
                                active={status === "received"}
                                onClick={() => setStatus("received")}
                            >
                                Recebidas
                            </FilterChip>
                        </FilterGroup>

                        <FilterSelect
                            value={kindFilter}
                            onChange={setKindFilter}
                            ariaLabel="Tipo"
                            allLabel="Todos os tipos"
                            options={[
                                { value: "inflow" as const, label: "Entradas" },
                                { value: "transfer" as const, label: "Transferências" },
                            ]}
                        />

                        {/* Entrada NÃO tem categoria no contrato ("categoria
                            é só de gasto"), então o filtro de categoria que
                            o layout desenha aqui não existe — em vez de um
                            seletor que não filtra nada, ele simplesmente não
                            entra. */}
                        <FilterSelect
                            value={idPerson}
                            onChange={setIdPerson}
                            ariaLabel="Destino"
                            allLabel="Todos os destinos"
                            options={activePersons.map((person) => ({
                                value: person.IdPerson,
                                label: person.Name,
                            }))}
                        />

                        {hasFilters && <ClearFilters onClick={clearAll} />}
                    </FilterBar>
                </div>

                {inflows.isPending ? (
                    <Card padded={false}>
                        <LoadingRows rows={5} />
                    </Card>
                ) : inflows.isError ? (
                    <ErrorState error={inflows.error} onRetry={() => void inflows.refetch()} />
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={<IconArrowUp />}
                        title={hasFilters ? "Nada com esses filtros" : "Nenhuma entrada neste mês"}
                        description={
                            hasFilters
                                ? "Limpe os filtros para ver o mês inteiro."
                                : "Lance o salário, um freela ou uma transferência entre suas contas."
                        }
                        action={
                            hasFilters ? (
                                <Button onClick={clearAll}>Limpar filtros</Button>
                            ) : (
                                <Button
                                    variant="primary"
                                    onClick={() => setDraft(newDraft("inflow"))}
                                >
                                    <IconPlus />
                                    Nova renda
                                </Button>
                            )
                        }
                    />
                ) : (
                    <Table columns="minmax(0,1.6fr) minmax(0,1fr) 120px 140px 140px">
                        <TableHead>
                            <span>Descrição</span>
                            <span>Destino</span>
                            <span>Data</span>
                            <span style={{ textAlign: "right" }}>Valor</span>
                            <span>Status</span>
                        </TableHead>

                        {rows.map((row) => {
                            const to = accountIndex.get(row.IdToAccount);
                            const from =
                                row.IdFromAccount !== null
                                    ? accountIndex.get(row.IdFromAccount)
                                    : null;
                            const isTransfer = row.Kind === "transfer";

                            /* O destino é o RATEIO da entrada, e ele só existe
                           no `get(id)`. A conta, que saiu da tabela para
                           dar lugar a ele, desceu para a linha de apoio da
                           descrição — nenhuma informação se perdeu. */
                            const found = monthDetails.byId.get(row.IdInflow);
                            const split = found?.Persons ?? [];
                            const firstPerson =
                                split.length > 0 ? personIndex.get(split[0].IdPerson) : undefined;

                            return (
                                <TableRow
                                    key={row.IdInflow}
                                    onClick={() => setOpenInflow(row.IdInflow)}
                                    selected={openInflow === row.IdInflow}
                                    faded={row.Status === "canceled"}
                                >
                                    <RowTrigger label={`Abrir ${row.Description}`}>
                                        <TypeTile color={isTransfer ? undefined : "#00dc8c"}>
                                            {isTransfer ? <IconTransfer /> : <IconArrowUp />}
                                        </TypeTile>
                                        <div style={{ minWidth: 0 }}>
                                            <div className={styles.description}>
                                                {row.Description}
                                            </div>
                                            <div className={styles.meta}>
                                                {from ? `${from.Name} → ` : ""}
                                                {to?.Name ?? "conta arquivada"}
                                                {isTransfer && " · transferência"}
                                            </div>
                                        </div>
                                    </RowTrigger>

                                    <Cell>
                                        {isTransfer ? (
                                            <span className={styles.meta}>não tem rateio</span>
                                        ) : split.length === 0 ? (
                                            <span className={styles.meta}>{found ? "—" : ""}</span>
                                        ) : (
                                            <span className={styles.who}>
                                                <Avatar name={firstPerson?.Name ?? "?"} size={22} />
                                                <span className={styles.whoName}>
                                                    {firstPerson?.Name ?? "Pessoa arquivada"}
                                                    {split.length > 1 && ` +${split.length - 1}`}
                                                </span>
                                            </span>
                                        )}
                                    </Cell>

                                    <Cell>
                                        <DueDate
                                            warn={
                                                row.Status === "pending" &&
                                                (row.ExpectedDate ?? row.CompetenceDate) < today()
                                            }
                                        >
                                            {formatDate(row.CompetenceDate)}
                                        </DueDate>
                                    </Cell>

                                    <CellAmount
                                        className={isTransfer ? styles.transferValue : undefined}
                                    >
                                        {formatMoney(row.TotalValue)}
                                    </CellAmount>

                                    <Cell>
                                        <StatusBadge status={row.Status} kind="inflow" />
                                    </Cell>
                                </TableRow>
                            );
                        })}

                        <TableFoot>
                            <span>
                                {rows.length} lançamento{rows.length === 1 ? "" : "s"} em{" "}
                                {formatMonthLabel(month)}
                            </span>
                            <span>
                                Entrou de verdade <b>{formatMoney(received)}</b>
                            </span>
                        </TableFoot>
                    </Table>
                )}

                {/* ── Detalhe ──────────────────────────────────────── */}
                <SlideOver
                    open={openInflow !== null}
                    onClose={() => setOpenInflow(null)}
                    title={inflow?.Description ?? "Carregando…"}
                    subtitle={
                        inflow
                            ? `${inflow.Kind === "transfer" ? "Transferência" : "Entrada"} · competência ${formatDate(inflow.CompetenceDate)}`
                            : undefined
                    }
                    footer={
                        inflow &&
                        inflow.Status !== "canceled" && (
                            <>
                                <Button
                                    onClick={() =>
                                        void IncomeController.loadInflowForEdit(
                                            context,
                                            inflow.IdInflow,
                                        )
                                    }
                                    disabled={pending}
                                >
                                    <IconEdit />
                                    Editar
                                </Button>
                                <FooterSpacer />
                                <Button
                                    onClick={() => setConfirming(inflow.IdInflow)}
                                    disabled={pending}
                                >
                                    Cancelar entrada
                                </Button>
                                {inflow.Status === "pending" && (
                                    <Button
                                        variant="primary"
                                        disabled={pending}
                                        onClick={() =>
                                            void IncomeController.receiveInflow(
                                                context,
                                                inflow.IdInflow,
                                            )
                                        }
                                    >
                                        Confirmar recebimento
                                    </Button>
                                )}
                            </>
                        )
                    }
                >
                    {detail.isPending ? (
                        <LoadingRows rows={3} />
                    ) : detail.isError ? (
                        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
                    ) : (
                        inflow && (
                            <>
                                <FormError>{error}</FormError>

                                <div className={styles.detailHero}>
                                    <div>
                                        <div className={styles.detailValue}>
                                            {formatMoney(inflow.TotalValue)}
                                        </div>
                                        <div className={styles.detailMeta}>
                                            {inflow.IdFromAccount !== null
                                                ? `${accountIndex.get(inflow.IdFromAccount)?.Name ?? "conta"} → ${accountIndex.get(inflow.IdToAccount)?.Name ?? "conta"}`
                                                : `Entra em ${accountIndex.get(inflow.IdToAccount)?.Name ?? "conta"}`}
                                            {inflow.ReceivedAt &&
                                                ` · recebido ${formatDateTime(inflow.ReceivedAt)}`}
                                        </div>
                                    </div>
                                    <StatusBadge status={inflow.Status} kind="inflow" />
                                </div>

                                {inflow.Kind !== "transfer" && inflow.Persons.length > 0 && (
                                    <>
                                        <div className={styles.sectionLabel}>
                                            <span>De quem é a entrada</span>
                                        </div>
                                        <div className={styles.splitRows}>
                                            {inflow.Persons.map((person) => (
                                                <div
                                                    className={styles.splitRow}
                                                    key={person.IdInflowPerson}
                                                >
                                                    <span>
                                                        {personIndex.get(person.IdPerson)?.Name ??
                                                            "Pessoa arquivada"}
                                                    </span>
                                                    <span className={styles.splitValue}>
                                                        {formatMoney(person.Value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {inflow.ExpectedDate && (
                                    <div className={styles.detailMeta}>
                                        Previsto para {formatDate(inflow.ExpectedDate)}
                                    </div>
                                )}

                                {inflow.Notes && (
                                    <>
                                        <div className={styles.sectionLabel}>
                                            <span>Observações</span>
                                        </div>
                                        <div className={styles.notes}>{inflow.Notes}</div>
                                    </>
                                )}
                            </>
                        )
                    )}
                </SlideOver>

                {/* ── Formulário ───────────────────────────────────── */}
                <SlideOver
                    open={draft !== null}
                    onClose={() => setDraft(null)}
                    title={
                        draft?.IdInflow !== null && draft
                            ? "Editar entrada"
                            : draft?.Kind === "transfer"
                              ? "Transferir entre contas"
                              : "Nova entrada"
                    }
                    subtitle={
                        draft?.Kind === "transfer"
                            ? "Ela move as duas pontas do saldo e não conta como renda."
                            : "Ela nasce pendente: o dinheiro entra no saldo quando você confirmar."
                    }
                    footer={
                        <>
                            <FooterSpacer />
                            <Button onClick={() => setDraft(null)} disabled={pending}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                type="submit"
                                form="inflow-form"
                                disabled={pending || blocking !== null}
                            >
                                {pending ? "Salvando…" : "Salvar"}
                            </Button>
                        </>
                    }
                >
                    {draft && (
                        <form
                            id="inflow-form"
                            onSubmit={(event: FormEvent) => {
                                event.preventDefault();
                                void IncomeController.submitInflow(context);
                            }}
                            style={{ display: "flex", flexDirection: "column", gap: 16 }}
                        >
                            <FormError>{error}</FormError>

                            {draft.IdInflow === null && (
                                <FormField label="Tipo">
                                    {() => (
                                        <SegmentedControl
                                            value={draft.Kind}
                                            variant="brand"
                                            ariaLabel="Tipo do lançamento"
                                            onChange={(Kind) =>
                                                setDraft((c) =>
                                                    c
                                                        ? {
                                                              ...c,
                                                              Kind,
                                                              // Rateio é proibido em
                                                              // transferência; a origem só
                                                              // existe nela.
                                                              persons:
                                                                  Kind === "transfer"
                                                                      ? []
                                                                      : c.persons,
                                                              IdFromAccount:
                                                                  Kind === "transfer"
                                                                      ? c.IdFromAccount
                                                                      : null,
                                                          }
                                                        : c,
                                                )
                                            }
                                            options={[
                                                { value: "inflow", label: "Entrada" },
                                                { value: "transfer", label: "Transferência" },
                                            ]}
                                        />
                                    )}
                                </FormField>
                            )}

                            <FormField label="Descrição" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        maxLength={255}
                                        placeholder={
                                            draft.Kind === "transfer"
                                                ? "Reserva para a viagem"
                                                : "Salário, freela…"
                                        }
                                        value={draft.Description}
                                        onChange={(event) =>
                                            setDraft((c) =>
                                                c ? { ...c, Description: event.target.value } : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>

                            <FormGrid columns={2}>
                                <FormField label="Valor" required>
                                    {(field) => (
                                        <MoneyInput
                                            {...field}
                                            value={draft.TotalValue}
                                            onValueChange={(TotalValue) =>
                                                setDraft((c) => (c ? { ...c, TotalValue } : c))
                                            }
                                        />
                                    )}
                                </FormField>
                                <FormField label="Competência" required>
                                    {(field) => (
                                        <DateInput
                                            {...field}
                                            value={draft.CompetenceDate}
                                            onValueChange={(CompetenceDate) =>
                                                setDraft((c) =>
                                                    c
                                                        ? {
                                                              ...c,
                                                              CompetenceDate:
                                                                  CompetenceDate ?? today(),
                                                          }
                                                        : c,
                                                )
                                            }
                                        />
                                    )}
                                </FormField>
                            </FormGrid>

                            <FormGrid columns={draft.Kind === "transfer" ? 2 : 1}>
                                {draft.Kind === "transfer" && (
                                    <FormField label="Sai de" required>
                                        {(field) => (
                                            <Select
                                                {...field}
                                                disabled={draft.IdInflow !== null}
                                                value={draft.IdFromAccount ?? ""}
                                                onChange={(event) =>
                                                    setDraft((c) =>
                                                        c
                                                            ? {
                                                                  ...c,
                                                                  IdFromAccount: event.target.value
                                                                      ? Number(event.target.value)
                                                                      : null,
                                                              }
                                                            : c,
                                                    )
                                                }
                                            >
                                                <option value="">Escolha…</option>
                                                {activeAccounts.map((account) => (
                                                    <option
                                                        key={account.IdAccount}
                                                        value={account.IdAccount}
                                                    >
                                                        {account.Name}
                                                    </option>
                                                ))}
                                            </Select>
                                        )}
                                    </FormField>
                                )}

                                <FormField label="Entra em" required>
                                    {(field) => (
                                        <Select
                                            {...field}
                                            disabled={draft.IdInflow !== null}
                                            value={draft.IdToAccount ?? ""}
                                            onChange={(event) =>
                                                setDraft((c) =>
                                                    c
                                                        ? {
                                                              ...c,
                                                              IdToAccount: event.target.value
                                                                  ? Number(event.target.value)
                                                                  : null,
                                                          }
                                                        : c,
                                                )
                                            }
                                        >
                                            <option value="">Escolha…</option>
                                            {activeAccounts.map((account) => (
                                                <option
                                                    key={account.IdAccount}
                                                    value={account.IdAccount}
                                                >
                                                    {account.Name}
                                                </option>
                                            ))}
                                        </Select>
                                    )}
                                </FormField>
                            </FormGrid>

                            <FormField
                                label="Previsto para"
                                help="Quando você espera o dinheiro cair. Opcional."
                            >
                                {(field) => (
                                    <DateInput
                                        {...field}
                                        value={draft.ExpectedDate}
                                        onValueChange={(ExpectedDate) =>
                                            setDraft((c) => (c ? { ...c, ExpectedDate } : c))
                                        }
                                    />
                                )}
                            </FormField>

                            {draft.Kind === "inflow" && (
                                <SplitEditor
                                    label="De quem é a entrada"
                                    hint="Opcional — não muda o saldo, só a análise"
                                    optionLabel="Pessoa"
                                    addLabel="Outra pessoa"
                                    options={activePersons.map((person) => ({
                                        id: person.IdPerson,
                                        label: person.Name,
                                    }))}
                                    lines={draft.persons}
                                    onChange={(persons) =>
                                        setDraft((c) => (c ? { ...c, persons } : c))
                                    }
                                    total={draft.TotalValue}
                                />
                            )}

                            <FormField label="Observações">
                                {(field) => (
                                    <Textarea
                                        {...field}
                                        value={draft.Notes}
                                        onChange={(event) =>
                                            setDraft((c) =>
                                                c ? { ...c, Notes: event.target.value } : c,
                                            )
                                        }
                                    />
                                )}
                            </FormField>

                            {blocking && <div className={styles.cellCaption}>{blocking}</div>}
                        </form>
                    )}
                </SlideOver>

                <ConfirmDialog
                    open={confirming !== null}
                    onClose={() => setConfirming(null)}
                    onConfirm={() => {
                        const id = confirming;
                        setConfirming(null);
                        if (id !== null) void IncomeController.cancelInflow(context, id);
                    }}
                    title="Cancelar esta entrada?"
                    description={
                        inflow?.Status === "received" ? (
                            <>
                                Ela já foi recebida: cancelar <b>tira o dinheiro do saldo</b> da
                                conta. O lançamento continua no histórico, marcado como cancelado.
                            </>
                        ) : (
                            "Ela continua no histórico, marcada como cancelada. O saldo não muda, porque o dinheiro ainda não tinha entrado."
                        )
                    }
                    confirmLabel="Cancelar entrada"
                    cancelLabel="Voltar"
                    danger
                    pending={pending}
                />
            </Page>
        </>
    );
}
