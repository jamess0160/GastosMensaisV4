import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/UsersAuth` — biometria / WebAuthn.
 *
 *  Dois fluxos de dois passos costurados por um `ChallengeToken` (JWT de
 *  5 min) que a API assina no passo 1 e o cliente devolve no passo 2. A
 *  API não guarda estado entre os passos. */
class Connection {
    private readonly route = "/UsersAuth";

    /** Público. Tri-estado: `true` há passkey aqui, `false` o usuário já
     *  recusou, `null` nunca foi perguntado. */
    async checkDevice(deviceKey: string): Promise<ApiTypes.CheckDeviceResponse> {
        const { data } = await http.get<ApiTypes.CheckDeviceResponse>(
            `${this.route}/checkDevice/DeviceKey=${encodeURIComponent(deviceKey)}`,
        );
        return data;
    }

    /** Público. `options` é o PublicKeyCredentialRequestOptionsJSON da
     *  spec — passe direto para `startAuthentication()`. O desafio não
     *  fixa usuário: quem escolhe é o autenticador. */
    async loginOptions(deviceKey: string): Promise<ApiTypes.WebAuthnChallenge> {
        const { data } = await http.get<ApiTypes.WebAuthnChallenge>(
            `${this.route}/options/login/DeviceKey=${encodeURIComponent(deviceKey)}`,
        );
        return data;
    }

    /** Público. O usuário é resolvido pela credencial assinada, não pelo
     *  DeviceKey. Responde igual ao login por senha, com o `Set-Cookie`. */
    async authenticate(body: {
        ChallengeToken: string;
        Response: unknown;
    }): Promise<{ msg: string }> {
        const { data } = await http.post<{ msg: string }>(`${this.route}/authenticate`, body);
        return data;
    }

    /** As passkeys da conta. */
    async getSelf(): Promise<ApiTypes.UserAuth[]> {
        const { data } = await http.get<ApiTypes.UserAuth[]>(`${this.route}/getSelf`);
        return data;
    }

    /** `options` é o PublicKeyCredentialCreationOptionsJSON, para
     *  `startRegistration()`. */
    async registerOptions(): Promise<ApiTypes.WebAuthnChallenge> {
        const { data } = await http.get<ApiTypes.WebAuthnChallenge>(
            `${this.route}/options/register`,
        );
        return data;
    }

    /** Guarde o `DeviceKey` da resposta no aparelho. Registrar limpa uma
     *  recusa anterior. */
    async register(body: {
        ChallengeToken: string;
        Response: unknown;
        DeviceKey?: string;
    }): Promise<{ verified: boolean; DeviceKey: string }> {
        const { data } = await http.post<{ verified: boolean; DeviceKey: string }>(
            `${this.route}/register`,
            body,
        );
        return data;
    }

    /** "Não quero biometria neste aparelho" — é o que faz `checkDevice`
     *  passar a responder `false`. */
    async skipDevice(body: { DeviceKey?: string }): Promise<{ DeviceKey: string }> {
        const { data } = await http.post<{ DeviceKey: string }>(`${this.route}/skipDevice`, body);
        return data;
    }

    /** Soft delete: a linha fica, para o CredentialId seguir ocupando o
     *  índice único. */
    async remove(idUserAuth: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/IdUserAuth=${idUserAuth}`,
        );
        return data;
    }
}

export const UsersAuthConnection = new Connection();
