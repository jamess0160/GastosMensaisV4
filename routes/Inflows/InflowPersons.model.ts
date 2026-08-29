import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  O rateio da entrada: quem recebeu, por valor absoluto. Segundo model dentro da pasta da
//  entrada, sem rota própria — é montado junto com o pai e só se chega nele por ele, como
//  WorkspaceMembers e TrustedDevices.
//
//  Só existe em Kind='inflow': ratear entre contas próprias uma transferência não significa
//  nada. A soma dos Value tem que fechar com Inflows.TotalValue, e **isso o banco não valida** —
//  quem valida é a section (InflowSplit).
export class class_InflowPersons_model extends BaseModel {

    getByInflow(IdInflow: number) {
        return this.KnexConnection.select("*").from<Database.InflowPersons>("InflowPersons").where("IdInflow", IdInflow).orderBy("IdInflowPerson")
    }

    create(records: MaybeArray<Partial<Database.InflowPersons>>) {
        return this.KnexConnection.insert(records).into("InflowPersons")
    }

    //  O rateio é substituído inteiro a cada edição, nunca remendado linha a linha: é a forma
    //  mais simples de garantir que a soma continua fechando com o TotalValue depois do PUT.
    deleteByInflow(IdInflow: number) {
        return this.KnexConnection.from("InflowPersons").where("IdInflow", IdInflow).delete()
    }
}

export const InflowPersons_model = new class_InflowPersons_model()
