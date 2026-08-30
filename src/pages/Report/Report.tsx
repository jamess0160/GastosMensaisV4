import { ScreenStub } from "@/ui/ScreenStub";

/** Não há endpoint de relatório: a linha por dia e o donut por categoria
 *  são agregações de `ExpensesConnection.list()` feitas no cliente. Os
 *  gráficos do layout são SVG desenhado à mão, não uma lib. */
export function Report() {
    return (
        <ScreenStub
            title="Relatório"
            subtitle="Gasto por dia e por categoria"
            source="Layout/Hi-fi Desktop/07 - Relatório.html"
            frames={[
                "A · Linha por dia — mês de maio",
                "B · Donut por categoria — com drill em Geral",
            ]}
        />
    );
}
