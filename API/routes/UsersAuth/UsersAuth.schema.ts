import Joi from "joi"
import { joiController } from "root/Utils/joiController"

//  O objeto devolvido pelo autenticador muda de navegador para navegador e de versão para
//  versão do WebAuthn. Validar campo a campo aqui só criaria um segundo lugar para dar
//  manutenção — e um mais frágil, porque recusaria antes de a lib olhar. O Joi confere o
//  envelope; quem valida o conteúdo é o verify do @simplewebauthn, que é onde tem que ser.
const authenticatorResponse = Joi.object({
    id: Joi.string().required(),
}).unknown(true).required()

//  base64url: gerado pelo DeviceKey.section e devolvido pelo cliente como veio.
const deviceKey = Joi.string().trim().max(255).pattern(/^[A-Za-z0-9_-]+$/)

class Schema {

    public readonly checkDevice = [
        joiController.validateParams(Joi.object({
            DeviceKey: deviceKey.required(),
        })),
        joiController.validateResponse(Joi.object({
            UseAuth: Joi.boolean().allow(null).required(),
        })),
    ]

    public readonly getSelf = [
        joiController.validateResponse(Joi.array().items(Joi.object({
            IdUserAuth: Joi.number().required(),
            IdUser: Joi.number().required(),
            CredentialId: Joi.string().required(),
            DeviceKey: Joi.string().allow(null).required(),
            Active: Joi.boolean().required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
        }))),
    ]

    //  Sem validateResponse nas options: o formato é o PublicKeyCredential*OptionsJSON da
    //  spec, montado pela lib. Espelhar isso em Joi só quebraria a cada upgrade dela.
    public readonly getRegisterOptions = []

    public readonly getLoginOptions = [
        joiController.validateParams(Joi.object({
            DeviceKey: deviceKey.required(),
        })),
    ]

    public readonly register = [
        joiController.validateBody(Joi.object({
            ChallengeToken: Joi.string().trim().required(),
            Response: authenticatorResponse,
            DeviceKey: deviceKey.optional(),
        })),
        joiController.validateResponse(Joi.object({
            verified: Joi.boolean().required(),
            DeviceKey: Joi.string().required(),
        })),
    ]

    public readonly authenticate = [
        joiController.validateBody(Joi.object({
            ChallengeToken: Joi.string().trim().required(),
            Response: authenticatorResponse,
            //  O mesmo campo do POST /Users/login: os dois caminhos de login escolhem a
            //  mesma duração, com o mesmo nome e o mesmo default.
            RememberDevice: Joi.boolean().optional().default(false),
        })),
    ]

    public readonly skipDevice = [
        joiController.validateBody(Joi.object({
            DeviceKey: deviceKey.optional(),
        })),
        joiController.validateResponse(Joi.object({
            DeviceKey: Joi.string().required(),
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdUserAuth: Joi.number().required(),
        })),
    ]
}

export const UsersAuth_schema = new Schema()
