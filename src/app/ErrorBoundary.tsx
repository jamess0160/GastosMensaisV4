import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./AppShell.module.css";
import { Button } from "@/ui/primitives";
import { reportError } from "./telemetry";

interface State {
    error: Error | null;
}

/** A última rede.
 *
 *  Um erro em render derruba a árvore inteira do React e o usuário fica
 *  com a tela branca — sem mensagem, sem botão, sem saber se o dinheiro
 *  foi salvo. Isto troca a tela branca por um recado e um caminho de
 *  volta, e manda o erro para `POST /Utils/Logs` no caminho.
 *
 *  É classe porque `componentDidCatch` não tem equivalente em hook: é a
 *  única parte do app que precisa de um componente de classe. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        reportError(error, { data: { componentStack: info.componentStack?.slice(0, 1200) } });
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className={styles.center}>
                <div style={{ textAlign: "center", maxWidth: 380 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                        Alguma coisa quebrou nesta tela
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
                        Seus lançamentos estão salvos — o problema é só na exibição. Recarregar
                        costuma resolver.
                    </p>
                    <div style={{ marginTop: 16 }}>
                        <Button variant="primary" onClick={() => window.location.reload()}>
                            Recarregar
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}
