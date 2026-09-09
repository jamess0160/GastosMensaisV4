const STORAGE_KEY = "gm.deviceKey";

/** O DeviceKey é gerado pela API e guardado pelo aparelho. Não é
 *  credencial: só responde "quais passkeys oferecer aqui" e "já
 *  perguntei sobre biometria neste aparelho". */
export function readDeviceKey(): string | null {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

export function writeDeviceKey(deviceKey: string): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, deviceKey);
    } catch {
        // Navegador com storage bloqueado: a biometria simplesmente não é
        // oferecida neste aparelho. Não é erro de fluxo.
    }
}
