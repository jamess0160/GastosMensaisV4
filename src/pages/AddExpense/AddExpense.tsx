import { ScreenStub } from "@/ui/ScreenStub";

/** Os dois rateios do formulário NÃO se cruzam: `Payments` (financeiro,
 *  move saldo) e `Persons` (analítico). Duas formas + duas pessoas são
 *  2 + 2 linhas, nunca 4, e cada eixo fecha com o TotalValue por conta
 *  própria — a API confere em centavos. */
export function AddExpense() {
    return (
        <ScreenStub
            title="Adicionar gasto"
            subtitle="Novo lançamento"
            source="Layout/Hi-fi Desktop/03 - Adicionar Gasto.html"
            frames={[
                "A · Gasto padrão — divisão entre destinos",
                "B · Parcela — gasto parcelado com timeline",
            ]}
        />
    );
}
