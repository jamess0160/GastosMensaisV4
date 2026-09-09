import { useMemo, useState, type FormEvent } from "react";
import styles from "./src/styles.module.css";
import {
    SettingsController,
    type CategoryDraft,
    type PersonDraft,
    type SettingsContext,
} from "./controller";
import {
    isLinkedPerson,
    isSystemCategory,
    useCategories,
    useInvalidateCatalogs,
    usePersons,
} from "@/data/catalogs";
import { Badge, Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { Tabs } from "@/ui/Tabs";
import { FormError, FormField, Input } from "@/ui/form";
import { CategoryPreview, ColorPicker, IconPicker } from "@/ui/controls";
import { ConfirmDialog } from "@/ui/overlay";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconArchive, IconEdit, IconUser } from "@/ui/icons";
import { Cell, CellActions, IconButton, Table, TableHead, TableRow } from "@/ui/table";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import { categoryColor } from "@/lib/categoryColor";

type Tab = "categories" | "persons";

const emptyCategory = (): CategoryDraft => ({
    IdCategory: null,
    Description: "",
    IconKey: null,
    Color: null,
});

const emptyPerson = (): PersonDraft => ({ IdPerson: null, Name: "" });

export function Settings() {
    const [tab, setTab] = useState<Tab>("categories");
    const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategory);
    const [personDraft, setPersonDraft] = useState<PersonDraft>(emptyPerson);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [archiving, setArchiving] = useState<{ kind: Tab; id: number; name: string } | null>(
        null,
    );

    const categories = useCategories();
    const persons = usePersons();
    const invalidateCatalogs = useInvalidateCatalogs();

    const context = useMemo<SettingsContext>(
        () => ({
            categoryDraft,
            personDraft,
            beginSubmit() {
                setPending(true);
                setError(null);
                setDone(null);
            },
            failSubmit(message) {
                setPending(false);
                setError(message);
            },
            finishSubmit(message) {
                setPending(false);
                setDone(message);
                invalidateCatalogs();
            },
            resetCategoryDraft: () => setCategoryDraft(emptyCategory()),
            resetPersonDraft: () => setPersonDraft(emptyPerson()),
        }),
        [categoryDraft, personDraft, invalidateCatalogs],
    );

    const activeCategories = (categories.data ?? []).filter((category) => category.Active);
    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    return (
        <Page>
            <div>
                <PageHead
                    title="Personalização"
                    subtitle="Categorias e pessoas usadas em todos os lançamentos."
                />
                <Tabs
                    value={tab}
                    onChange={(next) => {
                        setTab(next);
                        setError(null);
                        setDone(null);
                    }}
                    ariaLabel="Seções da personalização"
                    tabs={[
                        {
                            value: "categories",
                            label: "Categorias de gasto",
                            count: activeCategories.length,
                        },
                        { value: "persons", label: "Pessoas", count: activePersons.length },
                    ]}
                />
            </div>

            {tab === "categories" ? (
                <div className={styles.twocol}>
                    <div>
                        {categories.isPending ? (
                            <Card padded={false}>
                                <LoadingRows />
                            </Card>
                        ) : categories.isError ? (
                            <ErrorState
                                error={categories.error}
                                onRetry={() => void categories.refetch()}
                            />
                        ) : activeCategories.length === 0 ? (
                            <EmptyState
                                title="Nenhuma categoria ainda"
                                description="Crie a primeira ao lado — categoria é obrigatória em todo gasto."
                            />
                        ) : (
                            <Table columns="minmax(0,1fr) 120px 110px">
                                <TableHead>
                                    <span>Categoria</span>
                                    <span>Origem</span>
                                    <span style={{ textAlign: "right" }}>Ações</span>
                                </TableHead>
                                {activeCategories.map((category) => {
                                    const system = isSystemCategory(category);
                                    const color = categoryColor(category);

                                    return (
                                        <TableRow key={category.IdCategory}>
                                            <div className={styles.name}>
                                                <span
                                                    className={styles.tile}
                                                    style={{
                                                        background: `${color}1f`,
                                                        color,
                                                        borderColor: `${color}33`,
                                                    }}
                                                >
                                                    <CategoryIcon iconKey={category.IconKey} />
                                                </span>
                                                <div className={styles.nameText}>
                                                    <div className={styles.nameTitle}>
                                                        {category.Description}
                                                    </div>
                                                    {system && (
                                                        <div className={styles.nameSub}>
                                                            Vem pronta com o sistema
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <Cell>
                                                {system ? (
                                                    <Badge>Do sistema</Badge>
                                                ) : (
                                                    <Badge tone="brand">Sua</Badge>
                                                )}
                                            </Cell>

                                            <CellActions>
                                                {/* Categoria do sistema responde 406 em
                                                    editar e arquivar: o botão desabilitado
                                                    diz por quê, em vez de falhar depois. */}
                                                <IconButton
                                                    label={
                                                        system
                                                            ? "Categoria do sistema não pode ser editada"
                                                            : "Editar"
                                                    }
                                                    disabled={system}
                                                    onClick={() =>
                                                        setCategoryDraft({
                                                            IdCategory: category.IdCategory,
                                                            Description: category.Description,
                                                            IconKey: category.IconKey,
                                                            Color: category.Color,
                                                        })
                                                    }
                                                >
                                                    <IconEdit />
                                                </IconButton>
                                                <IconButton
                                                    label={
                                                        system
                                                            ? "Categoria do sistema não pode ser arquivada"
                                                            : "Arquivar"
                                                    }
                                                    disabled={system}
                                                    onClick={() =>
                                                        setArchiving({
                                                            kind: "categories",
                                                            id: category.IdCategory,
                                                            name: category.Description,
                                                        })
                                                    }
                                                >
                                                    <IconArchive />
                                                </IconButton>
                                            </CellActions>
                                        </TableRow>
                                    );
                                })}
                            </Table>
                        )}
                    </div>

                    <div className={styles.panel}>
                        <Card>
                            <form
                                onSubmit={(event: FormEvent) => {
                                    event.preventDefault();
                                    void SettingsController.saveCategory(context);
                                }}
                            >
                                <div className={styles.panelTitle}>
                                    {categoryDraft.IdCategory === null
                                        ? "Nova categoria"
                                        : "Editar categoria"}
                                </div>
                                <div className={styles.panelSub}>
                                    Categoria é obrigatória em todo gasto e é como o relatório
                                    agrupa os números.
                                </div>

                                <div className={styles.panelForm}>
                                    <CategoryPreview
                                        description={categoryDraft.Description}
                                        iconKey={categoryDraft.IconKey}
                                        color={
                                            categoryDraft.Color ??
                                            categoryColor({
                                                IdCategory: categoryDraft.IdCategory ?? 0,
                                                Color: null,
                                            })
                                        }
                                    />

                                    <FormError>{error}</FormError>

                                    <FormField label="Nome" required>
                                        {(field) => (
                                            <Input
                                                {...field}
                                                maxLength={255}
                                                placeholder="Mercado, Transporte…"
                                                value={categoryDraft.Description}
                                                onChange={(event) =>
                                                    setCategoryDraft((c) => ({
                                                        ...c,
                                                        Description: event.target.value,
                                                    }))
                                                }
                                            />
                                        )}
                                    </FormField>

                                    <FormField label="Ícone" hint="Do catálogo">
                                        {() => (
                                            <IconPicker
                                                value={categoryDraft.IconKey}
                                                onChange={(IconKey) =>
                                                    setCategoryDraft((c) => ({ ...c, IconKey }))
                                                }
                                            />
                                        )}
                                    </FormField>

                                    <FormField
                                        label="Cor"
                                        help="Sem cor própria, a categoria usa a paleta do sistema — e o relatório continua coerente."
                                    >
                                        {() => (
                                            <ColorPicker
                                                value={categoryDraft.Color}
                                                onChange={(Color) =>
                                                    setCategoryDraft((c) => ({ ...c, Color }))
                                                }
                                            />
                                        )}
                                    </FormField>

                                    <div className={styles.panelActions}>
                                        <button
                                            type="submit"
                                            className={styles.panelCta}
                                            disabled={pending}
                                        >
                                            {pending
                                                ? "Salvando…"
                                                : categoryDraft.IdCategory === null
                                                  ? "Cadastrar categoria"
                                                  : "Salvar alterações"}
                                        </button>
                                        {categoryDraft.IdCategory !== null && (
                                            <Button
                                                onClick={() => setCategoryDraft(emptyCategory())}
                                            >
                                                Cancelar edição
                                            </Button>
                                        )}
                                        {done && <span className={styles.ok}>{done}</span>}
                                    </div>
                                </div>
                            </form>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className={styles.twocol}>
                    <div>
                        {persons.isPending ? (
                            <Card padded={false}>
                                <LoadingRows />
                            </Card>
                        ) : persons.isError ? (
                            <ErrorState
                                error={persons.error}
                                onRetry={() => void persons.refetch()}
                            />
                        ) : activePersons.length === 0 ? (
                            <EmptyState
                                icon={<IconUser />}
                                title="Nenhuma pessoa ainda"
                                description="Pessoas são quem recebe e de quem é o custo — elas não precisam ter login."
                            />
                        ) : (
                            <Table columns="minmax(0,1fr) 150px 110px">
                                <TableHead>
                                    <span>Pessoa</span>
                                    <span>Vínculo</span>
                                    <span style={{ textAlign: "right" }}>Ações</span>
                                </TableHead>
                                {activePersons.map((person) => {
                                    const linked = isLinkedPerson(person);

                                    return (
                                        <TableRow key={person.IdPerson}>
                                            <div className={styles.name}>
                                                <span className={styles.avatar}>
                                                    {person.Name.charAt(0).toUpperCase()}
                                                </span>
                                                <div className={styles.nameText}>
                                                    <div className={styles.nameTitle}>
                                                        {person.Name}
                                                    </div>
                                                    {linked && (
                                                        <div className={styles.nameSub}>
                                                            Tem login no sistema
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <Cell>
                                                {linked ? (
                                                    <Badge tone="pos">Usuário</Badge>
                                                ) : (
                                                    <Badge>Só rateio</Badge>
                                                )}
                                            </Cell>

                                            <CellActions>
                                                <IconButton
                                                    label="Renomear"
                                                    onClick={() =>
                                                        setPersonDraft({
                                                            IdPerson: person.IdPerson,
                                                            Name: person.Name,
                                                        })
                                                    }
                                                >
                                                    <IconEdit />
                                                </IconButton>
                                                {/* Pessoa com login responde 406 ao
                                                    arquivar: o vínculo não é
                                                    reconstruível por rota nenhuma. */}
                                                <IconButton
                                                    label={
                                                        linked
                                                            ? "Pessoa com login não pode ser arquivada"
                                                            : "Arquivar"
                                                    }
                                                    disabled={linked}
                                                    onClick={() =>
                                                        setArchiving({
                                                            kind: "persons",
                                                            id: person.IdPerson,
                                                            name: person.Name,
                                                        })
                                                    }
                                                >
                                                    <IconArchive />
                                                </IconButton>
                                            </CellActions>
                                        </TableRow>
                                    );
                                })}
                            </Table>
                        )}
                    </div>

                    <div className={styles.panel}>
                        <Card>
                            <form
                                onSubmit={(event: FormEvent) => {
                                    event.preventDefault();
                                    void SettingsController.savePerson(context);
                                }}
                            >
                                <div className={styles.panelTitle}>
                                    {personDraft.IdPerson === null
                                        ? "Nova pessoa"
                                        : "Renomear pessoa"}
                                </div>
                                <div className={styles.panelSub}>
                                    Quem recebeu ou de quem é o custo. Não precisa ter login.
                                </div>

                                <div className={styles.panelForm}>
                                    <FormError>{error}</FormError>

                                    <FormField label="Nome" required>
                                        {(field) => (
                                            <Input
                                                {...field}
                                                maxLength={255}
                                                placeholder="Luana, Filho, Casa…"
                                                value={personDraft.Name}
                                                onChange={(event) =>
                                                    setPersonDraft((c) => ({
                                                        ...c,
                                                        Name: event.target.value,
                                                    }))
                                                }
                                            />
                                        )}
                                    </FormField>

                                    <div className={styles.panelActions}>
                                        <button
                                            type="submit"
                                            className={styles.panelCta}
                                            disabled={pending}
                                        >
                                            {pending
                                                ? "Salvando…"
                                                : personDraft.IdPerson === null
                                                  ? "Cadastrar pessoa"
                                                  : "Salvar nome"}
                                        </button>
                                        {personDraft.IdPerson !== null && (
                                            <Button onClick={() => setPersonDraft(emptyPerson())}>
                                                Cancelar edição
                                            </Button>
                                        )}
                                        {done && <span className={styles.ok}>{done}</span>}
                                    </div>
                                </div>
                            </form>
                        </Card>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={archiving !== null}
                onClose={() => setArchiving(null)}
                onConfirm={() => {
                    const target = archiving;
                    setArchiving(null);
                    if (!target) return;
                    if (target.kind === "categories") {
                        void SettingsController.archiveCategory(context, target.id);
                    } else {
                        void SettingsController.archivePerson(context, target.id);
                    }
                }}
                title={`Arquivar ${archiving?.name ?? ""}?`}
                description="Ela sai das listas de escolha, mas os lançamentos antigos continuam apontando para ela — nada do histórico se perde."
                confirmLabel="Arquivar"
                danger
                pending={pending}
            />
        </Page>
    );
}
