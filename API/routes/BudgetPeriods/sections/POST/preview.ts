import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Utils } from "root/Utils/Utils"
import { BudgetSpent, SpentTarget } from "../BudgetSpent.section"
import { BudgetPeriodsNamespace } from "../types"

//  **Quanto de avulso já foi gasto nos alvos que a tela está montando — antes de gravar.**
//
//  O defeito que ela existe para fechar: `GET /BudgetPeriods` devolve o `Spent` por
//  `IdBudgetPeriod`, e uma fatia só tem id depois de gravada. Então **nenhum alvo recém-escolhido
//  mostrava gasto** — e é exatamente no momento de escolher o alvo que a pessoa precisa do número
//  para decidir o valor. "Quanto dar para a Luana em Mercado" se responde olhando quanto ela já
//  gastou em Mercado, e a tela mostrava zero na hora em que a pergunta é feita.
//
//  **E o cliente não pode responder isso sozinho.** O casamento porção → fatia é a regra de
//  dinheiro mais delicada do orçamento: precedência `(pessoa, categoria)` → `(pessoa, —)`, porção
//  com dono que nunca escorrega para a linha de categoria, porção anônima que só casa com linha
//  sem pessoa, e o resto virando `Unbudgeted`. Ela mora em TypeScript num lugar só
//  (BudgetSpent.section.ts) justamente por isso. Recalculá-la no navegador para "só mostrar uma
//  prévia" seria a segunda cópia da regra, e a primeira divergência entre as duas seria uma
//  prévia plausível e errada.
//
//  **E é por isso que a troca de modelo da leva 11 não encostou nesta rota.** O orçamento passou a
//  repartir o que sobra da renda, e o que a mudança exigiu foi o filtro de `Kind = 'single'` dentro
//  do `getPortions` — a prévia herdou-o sem uma linha aqui. A conta de fechamento que o usuário
//  confere ganhou um termo e continua fechando, com cada centavo em exatamente um balde:
//
//      Σ Spent  +  Unbudgeted  +  ExpensesFixed  +  ExpensesInstallments  =  o gasto do mês
//
//  Os dois últimos são de `GET /Reports/Month`, não desta resposta: aqui só há avulso, e o
//  `Unbudgeted` da prévia voltou a significar algo afiado — **avulso gasto sem fatia que o cubra**.
//
//  **Não há regra nova nenhuma aqui, e é o ponto.** A section é a chamada do `getPortions` do mês
//  mais o `match` contra os alvos do corpo — o mesmo par que o `GET` usa —, com **o índice da
//  lista fazendo o papel de `IdBudgetPeriod`**: ids sintéticos, que não são gravados e não saem na
//  resposta. Por isso a prévia é, ao centavo, o que o `GET` do mês devolveria depois de salvar.
//
//  **O corpo é o do `allocate` sem os valores**, e a simetria é deliberada: *a prévia pergunta o
//  que o allocate faria*. Mesmo `or` por item, mesma recusa de alvo repetido dentro da lista — e a
//  conferência é aqui, pelo mesmo motivo de lá: o Joi valida item a item e não enxerga o conjunto.
//  **Lista vazia é aceita**, também como no allocate, e a resposta dela importa: um mês sem fatia
//  nenhuma tem `Unbudgeted` igual ao gasto inteiro dele, e essa é a resposta certa, não zero.
//
//  Três decisões da rota:
//
//  - **É `POST` e é uma LEITURA.** Não muda nada; o método é o que é porque a pergunta tem uma
//    lista no corpo, e uma query string com trinta pares `(categoria, pessoa)` seria a mesma coisa
//    pior. A guarda é o `assertMember`, como a de todo `GET` com escopo de tenant — não o
//    `assertRole`: ninguém precisa poder escrever para poder olhar;
//  - **mês fechado RESPONDE.** As quatro escritas da feature recusam mês fechado com 403; esta
//    não, e por isso não chama a `ClosedMonth.section` — ler agosto em novembro é legítimo, e é o
//    que a tela já faz em modo de leitura;
//  - **a rota não valida se o alvo existe**, ao contrário do `allocate`, que grava. Um
//    `IdCategory` de outro tenant simplesmente não casa com porção nenhuma — as porções saem de
//    `Expenses.IdWorkspace` — e devolve `Spent: 0`. Nada vaza, e não há escrita para proteger.
export class Preview {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: BudgetPeriodsNamespace.PreviewBudgetMonthPayload): Promise<BudgetPeriodsNamespace.PreviewPayload> {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        //  O dia 1, como em toda leitura da feature: é o que o `getPortions` recorta.
        let month = Utils.monthStart(body.ReferenceMonth)

        //  **O `IdBudgetPeriod` aqui é o índice da lista**, e nada mais: ele existe para o `match`
        //  ter uma chave por alvo e para a resposta voltar na ordem do corpo. Não é gravado, não
        //  sai na resposta, e o alvo resolvido — `null` onde o corpo omitiu — é o que o casamento
        //  compara, exatamente como a coluna anulável do banco.
        let targets: SpentTarget[] = []
        let seen = new Set<string>()

        for (let [index, target] of body.Targets.entries()) {
            let resolved = {
                IdCategory: target.IdCategory ?? null,
                IdPerson: target.IdPerson ?? null,
            }

            let key = targetKey(resolved.IdCategory, resolved.IdPerson)

            //  **Alvo repetido é 406, como no `allocate`.** Aqui ele não estouraria índice
            //  nenhum, mas o dano é o mesmo e pior de ver: o segundo alvo igual sobrescreveria a
            //  chave do primeiro no índice do `match`, e a tela mostraria o comprometido numa
            //  linha e zero na outra — para duas linhas que somam o mesmo dinheiro.
            if (seen.has(key)) {
                throw new APIError({
                    msg: "Há duas linhas para o mesmo alvo neste mês. Some os valores numa linha só.",
                    status: 406,
                    data: { IdWorkspace, ReferenceMonth: month, ...resolved },
                })
            }

            seen.add(key)
            targets.push({ IdBudgetPeriod: index, ...resolved })
        }

        let portions = await BudgetSpent.getPortions(IdWorkspace, month)

        let { ByPeriod, Unbudgeted } = BudgetSpent.match(targets, portions)

        return {
            Targets: targets.map<BudgetPeriodsNamespace.PreviewTargetSpent>((target) => ({
                IdCategory: target.IdCategory,
                IdPerson: target.IdPerson,
                Spent: ByPeriod.get(target.IdBudgetPeriod) ?? 0,
            })),
            Unbudgeted,
        }
    }
}

//  O alvo como string, para caber num Set: `NULL` não é comparável por igualdade em lugar nenhum,
//  e é justamente o alvo ausente que distingue "Mercado" de "Luana em Mercado". É a mesma função
//  do `allocate` e do `clone`, repetida de propósito: são duas linhas privadas de uma section, e
//  compartilhá-las amarraria rotas que não se conhecem.
function targetKey(IdCategory: number | null, IdPerson: number | null) {
    return `${IdCategory ?? ""}|${IdPerson ?? ""}`
}
