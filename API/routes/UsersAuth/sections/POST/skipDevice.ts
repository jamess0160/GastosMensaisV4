import { TrustedDevices_model } from "../../TrustedDevices.model"
import { DeviceKey } from "../DeviceKey.section"
import { UsersAuthNamespace } from "../types"

//  "Não quero biometria neste aparelho." É o que faz o checkDevice responder false em vez de
//  null e o cliente parar de oferecer o cadastro a cada abertura.
export class SkipDevice {
    public async run(IdUser: number, body: UsersAuthNamespace.SkipDevicePayload) {
        let deviceKey = body.DeviceKey || DeviceKey.generate()

        await TrustedDevices_model.upsert(IdUser, deviceKey)

        return { DeviceKey: deviceKey }
    }
}
