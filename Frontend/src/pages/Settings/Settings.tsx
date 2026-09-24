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
    useCategoriesWithArchived,
    useInvalidateCatalogs,
    usePersons,
} from "@/data/catalogs";
import { Badge, Button, Card, PageHead, Workspace as Page } from "@/ui/primitives";
import { Tabs } from "@/ui/Tabs";
import { cx, FormError, FormField, Input } from "@/ui/form";
import { CategoryPreview, ColorPicker, IconPicker } from "@/ui/controls";
import { ConfirmDialog } from "@/ui/overlay";
import { CategoryIcon } from "@/ui/iconCatalog";
import { IconArchive, IconEdit, IconGrip, IconUser } from "@/ui/icons";
import { useReorder } from "@/ui/reorder";
import { Cell, CellActions, IconButton, Table, TableHead, TableRow } from "@/ui/table";
import { CardList, ItemCard } from "@/ui/cardList";
import { EmptyState, ErrorState, LoadingRows } from "@/ui/states";
import { useIsMobile } from "@/lib/useMediaQuery";
import { categoryColor } from "@/lib/categoryColor";
import type { ApiTypes } from "@/types/api";

type Tab = "categories" | "persons";

const emptyCategory = (): CategoryDraft => ({
    IdCategory: null,
    Description: "",
    IconKey: null,
    Color: null,
});

const emptyPerson = (): PersonDraft => ({ IdPerson: null, Name: "" });

export function Settings() {
    /* Quem escolhe entre a tabela e os cards é `useIsMobile()`, não o
       CSS — o mesmo critério de Gastos, Renda e Contas. A tabela sem
       essa bifurcação rolava de lado no telefone (o `min-width: 640px`
       de `table.module.css`), que é o que as outras deixaram de
       fazer. */
    const isMobile = useIsMobile();
    const [tab, setTab] = useState<Tab>("categories");
    const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategory);
    const [personDraft, setPersonDraft] = useState<PersonDraft>(emptyPerson);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [archiving, setArchiving] = useState<{ kind: Tab; id: number; name: string } | null>(
        null,
    );

    /* A ÚNICA tela que pede a lista com as arquivadas — e por isso ela
       tem entrada de cache própria (`useCategoriesWithArchived`). Ler
       daqui a mesma chave do seletor de gasto faria abrir esta tela
       devolver a categoria arquivada ao formulário de lançamento e ao
       donut do relatório. */
    const categories = useCategoriesWithArchived();
    const persons = usePersons();
    const invalidateCatalogs = useInvalidateCatalogs();

    /* A API já devolve ordenado por `Position` — o cliente não reordena
       nada por conta própria, só separa os dois grupos. */
    const activeCategories = useMemo(
        () => (categories.data ?? []).filter((category) => category.Active),
        [categories.data],
    );
    const archivedCategories = useMemo(
        () => (categories.data ?? []).filter((category) => !category.Active),
        [categories.data],
    );

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

    /* A ordenação das ativas. O hook é UM para as duas listas — a tabela
       do desktop e os cards do telefone —, e é isso que faz o gesto ser
       o mesmo nas duas larguras em vez de dois caminhos de código.
       As arquivadas ficam FORA: o que move linha entre os grupos é
       arquivar e desarquivar, que é outro gesto. */
    const reorder = useReorder({
        items: activeCategories,
        getId: (category) => category.IdCategory,
        label: (category, position, total) => `${category.Description}, ${position} de ${total}`,
        disabled: pending,
        onCommit: (ids) => SettingsController.moveCategory(context, ids),
    });

    const activePersons = (persons.data ?? []).filter((person) => person.Active);

    /* O ladrilho colorido mais o nome — a mesma marcação na tabela e no
       card, escrita uma vez porque as duas listas agora existem em três
       lugares (ativas na tabela, ativas no card, arquivadas no grupo). */
    const categoryName = (category: ApiTypes.Category) => {
        const color = categoryColor(category);

        return (
            <>
                <span
                    className={styles.tile}
                    style={{ background: `${color}1f`, color, borderColor: `${color}33` }}
                >
                    <CategoryIcon iconKey={category.IconKey} />
                </span>
                <div className={styles.nameText}>
                    <div className={styles.nameTitle}>{category.Description}</div>
                </div>
            </>
        );
    };

    const editCategory = (category: ApiTypes.Category) =>
        setCategoryDraft({
            IdCategory: category.IdCategory,
            Description: category.Description,
            IconKey: category.IconKey,
            Color: category.Color,
        });

    /* A alça: onde o arrasto começa, e o único lugar da linha com
       `touch-action: none` (ver `.grip` na folha). O dedo em qualquer
       outro ponto continua rolando a lista, que era a objeção de 390px
       contra arrastar.

       É um `<button>` de propósito: com foco nele, ↑ e ↓ movem a linha
       uma posição. As setas que existiam em cada linha não sumiram,
       viraram o teclado da alça — e o `aria-label` que o hook monta diz
       a posição ("Mercado, 3 de 13"), que é o que quem não vê a lista
       precisa saber para mover. */
    const dragHandle = (index: number) => (
        <button type="button" className={styles.grip} {...reorder.handleProps(index)}>
            <IconGrip />
        </button>
    );

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
                        ) : (
                            <>
                                {activeCategories.length === 0 ? (
                                    <EmptyState
                                        title="Nenhuma categoria ativa"
                                        description="Crie uma ao lado — categoria é obrigatória em todo gasto. As arquivadas continuam abaixo."
                                    />
                                ) : isMobile ? (
                                    <CardList>
                                        {reorder.items.map((category, index) => (
                                            /* O card não leva classe própria, então
                                               quem carrega o estado de arrasto é este
                                               invólucro da página — a lista é um flex
                                               em coluna, e um `<div>` a mais nela não
                                               muda o desenho. */
                                            <div
                                                key={category.IdCategory}
                                                className={cx(
                                                    reorder.draggingId === category.IdCategory &&
                                                        styles.dragging,
                                                )}
                                            >
                                                <ItemCard
                                                    title={categoryName(category)}
                                                    trailing={
                                                        <span className={styles.cardActions}>
                                                            {dragHandle(index)}
                                                            <IconButton
                                                                label="Editar"
                                                                onClick={() =>
                                                                    editCategory(category)
                                                                }
                                                            >
                                                                <IconEdit />
                                                            </IconButton>
                                                            <IconButton
                                                                label="Arquivar"
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
                                                        </span>
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </CardList>
                                ) : (
                                    <Table columns="minmax(0,1fr) 60px 110px">
                                        <TableHead>
                                            <span>Categoria</span>
                                            <span>Ordem</span>
                                            <span style={{ textAlign: "right" }}>Ações</span>
                                        </TableHead>
                                        {reorder.items.map((category, index) => (
                                            <TableRow
                                                key={category.IdCategory}
                                                className={
                                                    reorder.draggingId === category.IdCategory
                                                        ? styles.dragging
                                                        : undefined
                                                }
                                            >
                                                <div className={styles.name}>
                                                    {categoryName(category)}
                                                </div>

                                                <Cell>
                                                    <span className={styles.cardActions}>
                                                        {dragHandle(index)}
                                                    </span>
                                                </Cell>

                                                <CellActions>
                                                    <IconButton
                                                        label="Editar"
                                                        onClick={() => editCategory(category)}
                                                    >
                                                        <IconEdit />
                                                    </IconButton>
                                                    <IconButton
                                                        label="Arquivar"
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
                                        ))}
                                    </Table>
                                )}

                                {/* O grupo das arquivadas: recolhido, no FIM, e só
                                    existe quando há alguma. É o que faz arquivar ter
                                    volta — sem ele a categoria sumia da tela junto
                                    com o botão que a traria de novo, e "arquivar"
                                    era um delete com outro nome.

                                    `<details>` nativo e não um estado de React: o
                                    navegador já dá o teclado, o foco e o
                                    `aria-expanded` de graça. */}
                                {archivedCategories.length > 0 && (
                                    <details className={styles.archived}>
                                        <summary>
                                            Arquivadas
                                            <Badge>{archivedCategories.length}</Badge>
                                        </summary>
                                        <p className={styles.archivedHint}>
                                            Elas saíram das listas de escolha, mas os lançamentos
                                            antigos continuam apontando para elas — o relatório do
                                            mês passado não muda. Desarquivar devolve a categoria ao
                                            fim da lista.
                                        </p>
                                        <CardList>
                                            {archivedCategories.map((category) => (
                                                <ItemCard
                                                    key={category.IdCategory}
                                                    title={categoryName(category)}
                                                    trailing={
                                                        <Button
                                                            size="sm"
                                                            disabled={pending}
                                                            onClick={() =>
                                                                void SettingsController.restoreCategory(
                                                                    context,
                                                                    category.IdCategory,
                                                                    category.Description,
                                                                )
                                                            }
                                                        >
                                                            Desarquivar
                                                        </Button>
                                                    }
                                                />
                                            ))}
                                        </CardList>
                                    </details>
                                )}
                            </>
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

                                    <FormField label="Ícone">
                                        {() => (
                                            <IconPicker
                                                value={categoryDraft.IconKey}
                                                onChange={(IconKey) =>
                                                    setCategoryDraft((c) => ({ ...c, IconKey }))
                                                }
                                            />
                                        )}
                                    </FormField>

                                    <FormField label="Cor">
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
                        ) : isMobile ? (
                            <CardList>
                                {activePersons.map((person) => {
                                    const linked = isLinkedPerson(person);

                                    return (
                                        <ItemCard
                                            key={person.IdPerson}
                                            title={
                                                <>
                                                    <span className={styles.avatar}>
                                                        {person.Name.charAt(0).toUpperCase()}
                                                    </span>
                                                    {person.Name}
                                                </>
                                            }
                                            badges={
                                                linked ? (
                                                    <Badge tone="pos">Usuário</Badge>
                                                ) : (
                                                    <Badge>Só rateio</Badge>
                                                )
                                            }
                                            trailing={
                                                <span className={styles.cardActions}>
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
                                                </span>
                                            }
                                        />
                                    );
                                })}
                            </CardList>
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
