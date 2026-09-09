import { Utils } from "root/Utils/Utils"

//  A divisão de uma compra parcelada em pernas.
//
//  600 em 6x são 6 linhas de 100 — o TotalValue continua sendo o total da compra, nunca o valor
//  da parcela. O CHECK do banco garante 1 <= InstallmentNumber <= InstallmentTotal; o que ele
//  não garante, e é o que importa aqui, é que **a soma das parcelas bata exatamente com o
//  total**, que é invariante do modelo.
//
//  100 em 3x não fecha: 33,33 x 3 = 99,99. **A sobra de centavos vai na primeira parcela**
//  (33,34 + 33,33 + 33,33), que é o que a operadora de cartão faz e é a parcela que fecha
//  primeiro — deixar a sobra na última seria mexer no valor que só vence daqui a meses.
class Controller {

    public split(TotalValue: number, InstallmentTotal: number) {
        let totalCents = Utils.toCents(TotalValue)

        let base = Math.floor(totalCents / InstallmentTotal)
        let remainder = totalCents - (base * InstallmentTotal)

        return Array.from({ length: InstallmentTotal }, (_, index) => {
            let cents = index === 0 ? base + remainder : base

            return cents / 100
        })
    }
}

export const Installments = new Controller()
