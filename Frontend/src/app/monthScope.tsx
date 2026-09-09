import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from "react";
import { currentMonth } from "@/lib/date";
import type { ApiTypes } from "@/types/api";

/** O mês é a unidade de navegação de quase toda tela, então ele é
 *  estado do chassi — não de cada página.
 *
 *  Quando cada tela guardava o seu próprio `useState(currentMonth)`,
 *  trocar de tela desmontava o componente e o mês voltava para o atual:
 *  olhar março em Gastos e clicar em Renda caía em setembro. Com o
 *  estado aqui, ele sobrevive à navegação porque o `AppShell` não
 *  desmonta.
 *
 *  A persistência é de ABA (`sessionStorage`), de propósito: um F5
 *  mantém o mês que se estava olhando, mas uma aba nova começa no mês de
 *  hoje — que é o que se espera de quem acabou de abrir o sistema. */
type MonthScope = [ApiTypes.ReferenceMonth, Dispatch<SetStateAction<ApiTypes.ReferenceMonth>>];

const MonthContext = createContext<MonthScope | null>(null);

const STORAGE_KEY = "month.scope";

/** O que veio do storage pode ser qualquer coisa (mão humana, versão
 *  antiga). Um mês inválido envenenaria toda query do mês, então o que
 *  não casa com "YYYY-MM" é descartado em silêncio. */
const isReferenceMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

function readStoredMonth(): ApiTypes.ReferenceMonth {
    try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (stored && isReferenceMonth(stored)) return stored;
    } catch {
        /* modo privado e storage bloqueado lançam no acesso — sem
           storage o mês simplesmente não sobrevive ao F5 */
    }
    return currentMonth();
}

export function MonthProvider({ children }: { children: ReactNode }) {
    const [month, setMonth] = useState(readStoredMonth);

    useEffect(() => {
        try {
            window.sessionStorage.setItem(STORAGE_KEY, month);
        } catch {
            /* idem */
        }
    }, [month]);

    const scope = useMemo<MonthScope>(() => [month, setMonth], [month]);

    return <MonthContext.Provider value={scope}>{children}</MonthContext.Provider>;
}

/** Mesma assinatura de `useState`, para as telas trocarem uma linha
 *  pela outra sem mexer no resto. */
export function useMonthScope(): MonthScope {
    const scope = useContext(MonthContext);
    if (!scope) throw new Error("useMonthScope fora de <MonthProvider>");
    return scope;
}
