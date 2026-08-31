import { useMemo } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { AccountsConnection } from "@/api/Accounts.connection";
import { CategoriesConnection } from "@/api/Categories.connection";
import { PersonsConnection } from "@/api/Persons.connection";
import type { ApiTypes } from "@/types/api";

/* Os cadastros base. São lidos por quase toda tela e mudam pouco, então
   ficam vivos por mais tempo que o movimento do mês. */

const CATALOG_STALE_TIME = 5 * 60 * 1000;

export function useCategories(): UseQueryResult<ApiTypes.Category[]> {
    return useQuery({
        queryKey: queryKeys.categories,
        queryFn: () => CategoriesConnection.list(),
        staleTime: CATALOG_STALE_TIME,
    });
}

export function usePersons(): UseQueryResult<ApiTypes.Person[]> {
    return useQuery({
        queryKey: queryKeys.persons,
        queryFn: () => PersonsConnection.list(),
        staleTime: CATALOG_STALE_TIME,
    });
}

/** As contas trazem as formas de pagamento embutidas — não existe `GET`
 *  de PaymentMethods, e é daqui que sai o seletor de forma dos
 *  formulários. */
export function useAccounts(): UseQueryResult<ApiTypes.Account[]> {
    return useQuery({
        queryKey: queryKeys.accounts,
        queryFn: () => AccountsConnection.list(),
        staleTime: CATALOG_STALE_TIME,
    });
}

/** Categoria pré-definida do sistema: `IdWorkspace: null`.
 *
 *  Ela aparece em todo workspace e a API recusa editar ou arquivar com
 *  406 — a tela usa isto para desabilitar os botões em vez de oferecer
 *  uma ação que sempre falha. */
export const isSystemCategory = (category: ApiTypes.Category): boolean =>
    category.IdWorkspace === null;

/** Pessoa vinculada a um login não pode ser arquivada (406): o vínculo
 *  não é reconstruível por rota nenhuma. */
export const isLinkedPerson = (person: ApiTypes.Person): boolean => person.IdUser !== null;

/* ── Índices e listas derivadas ───────────────────────────── */

export function useCategoryIndex(): Map<number, ApiTypes.Category> {
    const { data } = useCategories();
    return useMemo(
        () => new Map((data ?? []).map((category) => [category.IdCategory, category])),
        [data],
    );
}

export function usePersonIndex(): Map<number, ApiTypes.Person> {
    const { data } = usePersons();
    return useMemo(() => new Map((data ?? []).map((person) => [person.IdPerson, person])), [data]);
}

/** Toda forma de pagamento do workspace, achatada e já sabendo de que
 *  conta veio — é o formato que o rateio financeiro consome. */
export interface PaymentMethodOption {
    method: ApiTypes.PaymentMethod;
    account: ApiTypes.Account;
}

export function usePaymentMethods(): PaymentMethodOption[] {
    const { data } = useAccounts();
    return useMemo(
        () =>
            (data ?? [])
                .filter((account) => account.Active)
                .flatMap((account) =>
                    account.PaymentMethods.filter((method) => method.Active).map((method) => ({
                        method,
                        account,
                    })),
                ),
        [data],
    );
}

export function usePaymentMethodIndex(): Map<number, PaymentMethodOption> {
    const methods = usePaymentMethods();
    return useMemo(
        () => new Map(methods.map((option) => [option.method.IdPaymentMethod, option])),
        [methods],
    );
}

/** Invalida os cadastros depois de uma escrita neles.
 *
 *  As contas entram junto porque criar um cartão muda a lista de formas
 *  de pagamento, que vive dentro de `GET /Accounts`. */
export function useInvalidateCatalogs() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
        void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
        void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    };
}
