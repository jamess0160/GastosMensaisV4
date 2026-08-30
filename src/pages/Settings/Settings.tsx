import { ScreenStub } from "@/ui/ScreenStub";

/** Categoria com `IdWorkspace: null` é pré-definida do sistema: os
 *  botões de editar e arquivar têm que ficar desabilitados nela. */
export function Settings() {
    return (
        <ScreenStub
            title="Personalização"
            subtitle="Categorias, contas e cartões"
            source="Layout/Hi-fi Desktop/06 - Personalização.html"
            frames={[
                "A · Tipos de gasto — seletor de ícone",
                "B · Editar conta — slide-over com upload e cartões",
            ]}
        />
    );
}
