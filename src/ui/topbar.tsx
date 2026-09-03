import type { ReactNode } from "react";
import styles from "./topbar.module.css";
import { MonthPicker } from "./controls";
import type { ApiTypes } from "@/types/api";

/** A faixa fixa no topo da tela — o `.topbar` do layout.
 *
 *  Ela é o lugar de DUAS coisas, e por isso mora fora da tela e não
 *  dentro de cada uma: a troca de mês (a unidade de navegação de quase
 *  todo o sistema) e a ação principal da tela. Repetir esse par dentro
 *  de cada página é como as três telas de movimento acabaram cada uma
 *  com um cabeçalho diferente.
 *
 *  Os avisos do layout não entram: a tabela existe no banco, a rota não
 *  — ver "Fora do MVP" no plano. */
export function Topbar({
    greeting,
    month,
    onMonthChange,
    actions,
}: {
    greeting: string;
    /** Sem mês, a faixa fica só com a saudação e as ações. */
    month?: ApiTypes.ReferenceMonth;
    onMonthChange?: (month: ApiTypes.ReferenceMonth) => void;
    actions?: ReactNode;
}) {
    return (
        <div className={styles.topbar}>
            <div className={styles.left}>
                <div className={styles.greet}>{greeting}</div>
                {month !== undefined && onMonthChange && (
                    <MonthPicker month={month} onChange={onMonthChange} />
                )}
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
        </div>
    );
}

/** Esconde a ação abaixo de 900px.
 *
 *  É para o "Novo gasto": no mobile o FAB da barra inferior já é esse
 *  botão, e repeti-lo no cabeçalho gasta a largura da tela com o mesmo
 *  toque. NÃO é regra geral do `.actions` — Renda tem "Nova renda",
 *  "Transferir" e "Clonar mês anterior", que não têm outro caminho no
 *  mobile e precisam continuar aparecendo. */
export function HideOnMobile({ children }: { children: ReactNode }) {
    return <span className={styles.hideMobile}>{children}</span>;
}
