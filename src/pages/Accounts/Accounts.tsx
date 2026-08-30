import { ScreenStub } from "@/ui/ScreenStub";

/** `Balance` é calculado na leitura e ignora pendentes — não recalcule
 *  no cliente. A conciliação de extrato do frame B não tem API. */
export function Accounts() {
    return (
        <ScreenStub
            title="Contas"
            subtitle="Saldos e formas de pagamento"
            source="Layout/Hi-fi Desktop/08 - Contas e Conciliação.html"
            frames={[
                "A · Visão geral — tabela de contas",
                "B · Conciliar extrato — faixa de saldo + a resolver (sem API)",
            ]}
        />
    );
}
