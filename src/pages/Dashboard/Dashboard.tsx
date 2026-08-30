import { ScreenStub } from "@/ui/ScreenStub";

/** ATENÇÃO na conversão: nenhum número deste dashboard tem endpoint
 *  próprio. Saldo restante, total recebido, total gasto, fixos do mês e
 *  parcelas saem de Expenses + Inflows + Accounts, agregados no cliente.
 *  Duas regras que mudam o resultado: "quanto entrou" filtra
 *  `Kind !== "transfer"`, e o gasto do mês soma PERNAS (Payments), não o
 *  TotalValue da compra. */
export function Dashboard() {
    return (
        <ScreenStub
            title="Início"
            subtitle="Visão do mês"
            source="Layout/Hi-fi Desktop/02 - Dashboard.html"
            frames={["Dashboard · Maio 2026"]}
        />
    );
}
