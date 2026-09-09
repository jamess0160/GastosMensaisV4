import { archiveCategory } from "./sections/archiveCategory";
import { archivePerson } from "./sections/archivePerson";
import { saveCategory } from "./sections/saveCategory";
import { savePerson } from "./sections/savePerson";
import type { ApiTypes } from "@/types/api";

/** O rascunho de categoria que o formulário edita. `IdCategory` nulo é
 *  criação; preenchido é edição. */
export interface CategoryDraft {
    IdCategory: number | null;
    Description: string;
    IconKey: string | null;
    Color: ApiTypes.Color | null;
}

export interface PersonDraft {
    IdPerson: number | null;
    Name: string;
}

/** O que a tela entrega aos eventos. */
export interface SettingsContext {
    categoryDraft: CategoryDraft;
    personDraft: PersonDraft;
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** Gravou: relê os cadastros e fecha o formulário. */
    finishSubmit(message: string): void;
    resetCategoryDraft(): void;
    resetPersonDraft(): void;
}

class Controller {
    readonly saveCategory = saveCategory;
    readonly archiveCategory = archiveCategory;
    readonly savePerson = savePerson;
    readonly archivePerson = archivePerson;
}

export const SettingsController = new Controller();
