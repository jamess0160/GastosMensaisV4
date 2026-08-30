import { ScreenStub } from "@/ui/ScreenStub";

/** A lista vem de `ExpensesConnection.list()` (sem pernas, rateio nem
 *  tags); o slide-over de detalhe precisa de `.get(id)`. */
export function Expenses() {
    return (
        <ScreenStub
            title="Gastos"
            subtitle="Lançamentos do mês"
            source="Layout/Hi-fi Desktop/04 - Visualização de Gasto.html"
            frames={[
                "A · Lista principal — agrupada por tipo",
                "B · Slide-over de detalhe — série de parcelas + histórico",
            ]}
        />
    );
}
