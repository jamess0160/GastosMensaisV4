import { ScreenStub } from "@/ui/ScreenStub";

/** `Kind: "transfer"` proíbe rateio e é neutro no patrimônio. Só
 *  `.receive(id)` põe o dinheiro no saldo — não há estado parcial. */
export function Income() {
    return (
        <ScreenStub
            title="Renda"
            subtitle="Entradas e transferências"
            source="Layout/Hi-fi Desktop/05 - Renda.html"
            frames={["A · Lista principal", "B · Nova renda — slide-over com recorrência"]}
        />
    );
}
