import { useMemo } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { useMonthScope } from "@/app/monthScope";
import { AccountsConnection } from "@/api/Accounts.connection";
import { CategoriesConnection } from "@/api/Categories.connection";
import { PersonsConnection } from "@/api/Persons.connection";
import type { ApiTypes } from "@/types/api";

/* Os cadastros base. São lidos por quase toda tela e mudam pouco, então
   ficam vivos por mais tempo que o movimento do mês. */

const CATALOG_STALE_TIME = 5 * 60 * 1000;

/** As categorias ATIVAS — a lista de escolha.
 *
 *  Sem `IncludeArchived`, e isso é decisão e não omissão: é esta função
 *  que alimenta o seletor de gasto, o filtro da lista e o relatório, e
 *  nenhum dos três pode passar a oferecer uma categoria arquivada. */
export function useCategories(): UseQueryResult<ApiTypes.Category[]> {
    return useQuery({
        queryKey: queryKeys.categories,
        queryFn: () => CategoriesConnection.list(),
        staleTime: CATALOG_STALE_TIME,
    });
}

/** As ativas **e as arquivadas** — a leitura da Personalização, que é a
 *  única tela que mostra o grupo das arquivadas e o botão que as traz de
 *  volta.
 *
 *  **Entrada de cache própria** (`queryKeys.categoriesWithArchived`).
 *  Reaproveitar a chave de `useCategories` faria abrir a Personalização
 *  mudar o que toda tela enxerga — a arquivada voltaria ao seletor de
 *  gasto e ao donut. O prefixo é o mesmo, então uma invalidação continua
 *  alcançando as duas. */
export function useCategoriesWithArchived(): UseQueryResult<ApiTypes.Category[]> {
    return useQuery({
        queryKey: queryKeys.categoriesWithArchived,
        queryFn: () => CategoriesConnection.list({ IncludeArchived: true }),
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
 *  formulários.
 *
 *  O MÊS não recorta a lista, e sim o `Balance`: as contas são as mesmas
 *  em qualquer mês, mas o saldo é somado até o último dia do mês pedido.
 *  Sem argumento, o mês é o do chassi — é o que faz Início e Contas
 *  lerem a MESMA entrada de cache em vez de pedirem duas vezes. Passar
 *  um mês explícito é para quem precisa de outro que não o exibido. */
export function useAccounts(month?: ApiTypes.ReferenceMonth): UseQueryResult<ApiTypes.Account[]> {
    const [scopeMonth] = useMonthScope();
    const referenceMonth = month ?? scopeMonth;

    return useQuery({
        queryKey: queryKeys.accounts(referenceMonth),
        queryFn: () => AccountsConnection.list({ ReferenceMonth: referenceMonth }),
        staleTime: CATALOG_STALE_TIME,
    });
}

/* Não há mais `isSystemCategory`: a pré-definida do sistema
   (`IdWorkspace: null`), que a tela desabilitava porque a API recusava
   editá-la, acabou na leva 9. Toda categoria é do espaço, e toda
   categoria é editável, arquivável e reordenável por quem a vê. */

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

/** NÃO recebe mês, de propósito: a forma de pagamento é a mesma em
 *  qualquer mês, e herdando o mês do chassi ela lê a entrada de cache
 *  que as telas de saldo já buscaram — sem requisição extra. */
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
 *  `queryKeys.categories` é `["categories"]`, e a invalidação casa por
 *  PREFIXO: uma chamada só alcança a lista de escolha e a lista com as
 *  arquivadas. É por isso que a segunda entrada nasceu debaixo da
 *  primeira — arquivar mexe nas duas ao mesmo tempo, e duas raízes
 *  separadas seriam duas chances de esquecer uma.
 *
 *  As contas entram junto porque criar um cartão muda a lista de formas
 *  de pagamento, que vive dentro de `GET /Accounts`. Invalida a RAIZ:
 *  há uma entrada por mês em cache, e o cartão novo aparece em todas
 *  elas — a mesma razão já escrita em `useInvalidateMovement`. */
export function useInvalidateCatalogs() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
        void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
        void queryClient.invalidateQueries({ queryKey: queryKeys.allAccounts });
    };
}
