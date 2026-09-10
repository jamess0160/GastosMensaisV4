import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./authLayout.module.css";

/** O suporte do rodapé é o MESMO endereço do canal do titular escrito
 *  nos dois documentos legais (`src/pages/Legal/LegalLayout.tsx`).
 *
 *  A string está repetida aqui, e não importada de lá, para não puxar o
 *  pedaço `lazy` das telas legais para dentro do bundle que carrega o
 *  login. Trocar o endereço é mudar o documento — logo é versão nova —,
 *  e os dois lugares mudam juntos. */
const SUPPORT_EMAIL = "tiagoribeiro12@hotmail.com.br";

/** O chassi das duas telas públicas — entrar e criar conta.
 *
 *  É o frame A do layout ("Split — painel de marca + formulário"): o
 *  painel laranja à esquerda e o formulário centrado à direita. As duas
 *  telas são o mesmo chassi com outro formulário dentro, então ele mora
 *  aqui e não dentro de uma delas. */
export function AuthLayout({
    heading,
    subheading,
    topRight,
    children,
}: {
    heading: string;
    subheading: ReactNode;
    /** O "Ainda não tem conta? Criar conta" do canto superior. */
    topRight?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className={styles.split}>
            <aside className={styles.brandpane}>
                <div className={styles.grid} />
                <div className={styles.glow} />

                <div className={styles.bpBrand}>
                    <img className={styles.bpMark} src="/logo.png" alt="" />
                    <div className={styles.bpName}>Gastos mensais</div>
                </div>

                <div className={styles.bpTagline}>
                    Todo dinheiro do mês, sem briga e sem planilha.
                </div>
                <p className={styles.bpDesc}>
                    Cadastre gastos do casal, divida entre destinos, acompanhe parcelas e feche o
                    mês sabendo exatamente quem pagou o quê.
                </p>

                <div className={styles.bpFoot}>Gastos mensais · seu mês fechado sem planilha.</div>
            </aside>

            <main className={styles.formpane}>
                <div className={styles.fpTop}>{topRight}</div>

                <div className={styles.fpMid}>
                    <h1 className={styles.fpHeading}>{heading}</h1>
                    <p className={styles.fpSub}>{subheading}</p>
                    {children}
                </div>

                <div className={styles.fpBot}>
                    <span>© {new Date().getFullYear()} Gastos mensais</span>
                    <div className={styles.links}>
                        <Link to="/termos">Termos</Link>
                        <Link to="/privacidade">Privacidade</Link>
                        <a href={`mailto:${SUPPORT_EMAIL}`}>Suporte</a>
                    </div>
                </div>
            </main>
        </div>
    );
}

/** As classes do formulário do chassi, para a tela montar os campos com
 *  a mesma medida sem reimportar a folha. */
export const authStyles = styles;
