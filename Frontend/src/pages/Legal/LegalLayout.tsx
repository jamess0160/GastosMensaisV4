import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./legal.module.css";
import { IconChevronLeft } from "@/ui/icons";

/* ════════════════════════════════════════════════════════════
   O chassi dos dois documentos legais — `/termos` e `/privacidade`.

   Elas rodam FORA do `AppShell`, e é o ponto: quem lê os termos antes
   de criar a conta não tem sessão, e uma rota dentro do chassi cairia
   no guard e voltaria para o login. É o mesmo motivo de `/convite/:hash`
   e das duas telas de recuperação de senha.

   Também não usam o `AuthLayout`: aquele é o frame do FORMULÁRIO, com o
   painel de marca ocupando metade da tela. Um documento de dez seções
   pede coluna de leitura, não meia tela.

   Esta pasta foge da forma de `src/pages/[Pagina]/` de propósito — não
   há controller nem sections porque não há evento nenhum: as duas telas
   são texto. O que elas compartilham (a marca, o "voltar" e a data de
   versão) mora aqui.
   ════════════════════════════════════════════════════════════ */

/** A data de versão dos dois documentos.
 *
 *  É a versão: não há numeração paralela a manter em sincronia. Mudou o
 *  texto de qualquer um dos dois, muda esta data — e é ela que o aceite
 *  do cadastro grava. */
export const LEGAL_VERSION = "10/09/2026";

/** O canal do titular e o suporte do produto, no mesmo endereço.
 *
 *  Precisa ser uma caixa que alguém LÊ, e por isso não é o
 *  `nao-responda@` do `MAIL_FROM` da API. Trocá-lo é MUDAR o documento,
 *  logo é versão nova — e a mesma string aparece no rodapé do
 *  `AuthLayout`, que é a outra ponta a acertar junto. */
export const LEGAL_CONTACT_EMAIL = "tiagoribeiro12@hotmail.com.br";

export function LegalLayout({
    title,
    intro,
    children,
}: {
    title: string;
    /** A frase de abertura, antes da primeira seção. */
    intro: ReactNode;
    children: ReactNode;
}) {
    const navigate = useNavigate();

    /* Estas duas telas abrem em ABA NOVA a partir do checkbox do
       cadastro, e numa aba nova não há para onde voltar: `navigate(-1)`
       não faria nada e o botão pareceria quebrado. Sem histórico, o
       destino é o login. */
    const goBack = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate("/login");
    };

    return (
        <div className={styles.page}>
            <header className={styles.top}>
                <Link className={styles.brand} to="/login">
                    <img className={styles.mark} src="/logo.png" alt="" />
                    <span className={styles.brandName}>Gastos mensais</span>
                </Link>

                <button type="button" className={styles.back} onClick={goBack}>
                    <IconChevronLeft />
                    Voltar
                </button>
            </header>

            <main className={styles.doc}>
                <p className={styles.version}>Última atualização: {LEGAL_VERSION}</p>
                <h1 className={styles.title}>{title}</h1>
                <div className={styles.intro}>{intro}</div>

                <div className={styles.body}>{children}</div>

                <footer className={styles.foot}>
                    <Link to="/termos">Termos de uso</Link>
                    <Link to="/privacidade">Política de privacidade</Link>
                    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>Falar com a gente</a>
                    <span>© {new Date().getFullYear()} Gastos mensais</span>
                </footer>
            </main>
        </div>
    );
}

/** Uma seção numerada do documento.
 *
 *  O `id` é a âncora: `/privacidade#direitos` é um link que se manda por
 *  e-mail para quem perguntou como pedir a exclusão dos dados. */
export function LegalSection({
    id,
    number,
    title,
    children,
}: {
    id: string;
    number: number;
    title: string;
    children: ReactNode;
}) {
    return (
        <section id={id} className={styles.section}>
            <h2 className={styles.heading}>
                <span className={styles.headingNumber} aria-hidden>
                    {number}.
                </span>
                {title}
            </h2>
            {children}
        </section>
    );
}

/** O bloco destacado — o que não pode passar batido na leitura em
 *  diagonal. */
export function LegalCallout({ children }: { children: ReactNode }) {
    return <div className={styles.callout}>{children}</div>;
}
