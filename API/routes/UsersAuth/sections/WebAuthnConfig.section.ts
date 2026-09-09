import { enviromentManager } from "root/Utils/enviromentManager"

//  Identidade da Relying Party. rpID e origin são exatamente o que o autenticador confere
//  antes de assinar: se estiverem errados, ou nenhuma assinatura passa, ou — pior — a API
//  aceita uma assinatura feita para outro site. Por isso nenhum dos dois tem default.
class Controller {

    /** O domínio, sem esquema e sem porta ("gastos.com.br", "localhost"). */
    get rpID() {
        return enviromentManager.getEnv("WEBAUTHN_RP_ID")
    }

    /** Nome que o SO mostra no diálogo da digital. Só cosmético, por isso tem default. */
    get rpName() {
        return enviromentManager.getEnv("WEBAUTHN_RP_NAME", true) || "Gastos Mensais"
    }

    /** Lista separada por vírgula: o app web e o app nativo têm origins diferentes. */
    get origins() {
        return enviromentManager.getEnv("WEBAUTHN_ORIGIN")
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean)
    }
}

export const WebAuthnConfig = new Controller()
