import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"
import { TERMS_VERSION } from "./sections/TermsVersion"

export class class_Users_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Users>("Users").where("Active", true).orderBy("IdUser")

    getByLoginAndPassword(login: string, password: string) {
        return this.baseQuery.clone().where("Login", login).where("Pass", password).first()
    }

    getAllActive() {
        return this.baseQuery.clone()
    }

    getUnique(IdUser: number) {
        return this.baseQuery.clone().where("IdUser", IdUser).first()
    }

    getByLogin(login: string) {
        return this.baseQuery.clone().where("Email", login).first()
    }

    //  Fora do baseQuery de propósito: o índice único de Email não conhece o Active, então a
    //  checagem de e-mail livre no cadastro precisa enxergar também os usuários desativados.
    getByEmailIncludingInactive(Email: string) {
        return this.KnexConnection.select("*").from<Database.Users>("Users").where("Email", Email).first()
    }

    create(records: MaybeArray<Partial<Database.Users>>) {
        return this.KnexConnection.insert(records).into("Users")
    }

    //  O carimbo da confirmacao de e-mail, com metodo proprio como o `receive` de Inflows:
    //  quem confirma nao escolhe a data - ela e o instante do banco, e nao o do processo.
    confirmEmail(IdUser: number) {
        return this.update(IdUser, { EmailConfirmedAt: this.KnexConnection.fn.now() as unknown as Database.Users["EmailConfirmedAt"] })
    }

    //  O carimbo do re-aceite, e quem aceita não escolhe NENHUM dos dois valores: a data é o
    //  instante do banco, como no `confirmEmail`, e a versão é a constante da API — o corpo da
    //  rota é vazio justamente para não haver por onde mandar uma versão antiga.
    acceptTerms(IdUser: number) {
        return this.update(IdUser, {
            TermsAcceptedAt: this.KnexConnection.fn.now() as unknown as Database.Users["TermsAcceptedAt"],
            TermsVersion: TERMS_VERSION,
        })
    }

    update(IdUser: number, record: Partial<Database.Users>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Users").where("IdUser", IdUser)
    }

    //  A LINHA É APAGADA DE VERDADE, e este é o único delete físico de tabela de cadastro do
    //  projeto. A coluna Active existe e seria o caminho mais curto, mas soft delete mantém o
    //  e-mail, o telefone e o hash da senha no banco — o oposto do que a rota existe para
    //  fazer — e ainda travaria o endereço contra um cadastro futuro, porque o unique(Email)
    //  não conhece o Active (é por isso que o cadastro tem o getByEmailIncludingInactive).
    //
    //  O que vai junto quem decide são as foreign keys, e elas discordam de propósito: os
    //  workspaces de que o usuário é dono CASCATEIAM inteiros, as matrículas também, e os
    //  lançamentos em espaço de terceiros ficam com o IdUser em SET NULL. O comentário de
    //  sections/DELETE/remove.ts tem a lista, e a guarda que impede a cascata de levar o
    //  espaço de outra pessoa.
    delete(IdUser: number) {
        return this.KnexConnection.delete().from("Users").where("IdUser", IdUser)
    }
}

export const Users_model = new class_Users_model()