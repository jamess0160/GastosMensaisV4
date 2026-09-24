import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { BudgetPeriods_controller } from "./BudgetPeriods.controller"
import { BudgetPeriods_schema } from "./BudgetPeriods.schema"

export const BudgetPeriods_route = express()

//  **O orçamento é uma repartição da renda de um mês**, e cada linha aqui é uma fatia dela.
//
//  O exemplo que definiu o modelo, com 1.000 recebidos: `Luana 250`, `Tiago em Alimentação
//  250`, `Mercado 500`. Três formatos de alvo — só pessoa, só categoria, e os dois juntos — e
//  as fatias **somam lado a lado**: "Luana 250" mais "Luana em Mercado 100" dão 350 para a
//  Luana. Não há aninhamento nem teto dentro de teto, e a soma de todas as linhas é o quanto do
//  mês foi alocado.
//
//  **A feature `Budgets` foi absorvida por esta na leva 9.** O teto perene por alvo — "mercado:
//  800/mês, para sempre" — e a rotina que o congelava no dia 1º acabaram juntos: o mês não
//  nasce mais sozinho, ele é montado. Com isso **qualquer mês é legível e editável**, passado,
//  corrente ou futuro, e outubro pode ser montado em setembro — que é o que o modelo anterior
//  não tinha como oferecer.
//
//  **O que sobrou da máquina do mês é o `ClosedAt`.** `CloseBudgetMonth` continua sendo a única
//  coisa que sabe que um mês acabou, e o carimbo dela ganhou um segundo uso: mês fechado recusa
//  escrita em toda rota de escrita abaixo. É a trava que impede reescrever a história de agosto
//  em novembro.
//
//  Orçamento é **só de gasto**: entrada não tem categoria.

//  O mês inteiro, com quanto já foi comprometido em cada fatia: ?ReferenceMonth=YYYY-MM
//
//  **Responde um envelope `{ Periods, Unbudgeted }`, não uma lista**: cada porção de gasto
//  consome uma fatia ou nenhuma (ver sections/BudgetSpent.section.ts), e o que não consumiu
//  nada é do mês, não de linha nenhuma. Sem esse número a regra estrita seria um sumiço
//  silencioso de dinheiro.
BudgetPeriods_route.get("/BudgetPeriods", BudgetPeriods_schema.getByMonth, AsyncHandler(BudgetPeriods_controller.getByMonth))

//  Uma fatia nova no mês. Uma escrita só — não há mais definição para resolver antes.
BudgetPeriods_route.post("/BudgetPeriods", BudgetPeriods_schema.create, AsyncHandler(BudgetPeriods_controller.create))

//  **O rateio do mês inteiro numa escrita só**: `{ ReferenceMonth, Lines }`.
//
//  É o gesto da tela do orçamento — repartir o que entrou, mexendo em várias linhas e salvando
//  UMA vez. O corpo é o mês **depois** da escrita, não um lote de criações: o que está no banco
//  e não está na lista é apagado (fisicamente, como o DELETE de uma linha só), o que está nos
//  dois é atualizado no lugar, e o que só está na lista é inserido — tudo numa transaction.
//
//  Nenhuma linha carrega `IdBudgetPeriod`, porque a identidade de uma fatia é o **alvo**; é a
//  mesma regra que faz o PUT recusar alvo no corpo. E o rateio **não precisa fechar** contra a
//  renda: sobrar é o normal, estourar é decisão de quem orça, e quem avisa é a tela. Ver
//  sections/POST/allocate.ts, inclusive para o que acontece com a fatia de alvo arquivado.
BudgetPeriods_route.post("/BudgetPeriods/allocate", BudgetPeriods_schema.allocate, AsyncHandler(BudgetPeriods_controller.allocate))

//  **O comprometido dos alvos que a tela está MONTANDO**: `{ ReferenceMonth, Targets }` →
//  `{ Targets: [{ IdCategory, IdPerson, Spent }], Unbudgeted }`.
//
//  O `GET` acima devolve o `Spent` por `IdBudgetPeriod`, e uma fatia só tem id depois de gravada —
//  então nenhum alvo recém-escolhido mostrava gasto, que é justamente o número de que a pessoa
//  precisa para decidir o valor. Esta rota responde a mesma pergunta para um alvo que ainda não
//  existe, **com o mesmo código**: `BudgetSpent` inteiro, com o índice da lista no papel de
//  `IdBudgetPeriod`. Replicar o casamento no navegador seria a segunda cópia da regra de dinheiro
//  mais delicada do orçamento.
//
//  Três coisas a separam das quatro escritas acima, e as três estão em sections/POST/preview.ts:
//  ela é um **POST que não escreve nada** (a pergunta tem uma lista no corpo), a guarda é
//  `assertMember` e não `assertRole`, e **mês fechado responde** em vez de 403.
BudgetPeriods_route.post("/BudgetPeriods/preview", BudgetPeriods_schema.preview, AsyncHandler(BudgetPeriods_controller.preview))

//  **Repete a repartição de um mês no outro**: `{ From, To }`, os dois "YYYY-MM".
//
//  É o desconto do preço que a leva 9 cobrou ao matar a rotina do dia 1º: nada nasce sozinho,
//  então um mês novo nasce vazio, e remontar as mesmas oito linhas à mão todo mês é o trabalho
//  repetido que faz a funcionalidade parar de ser usada no terceiro mês.
//
//  Pula o alvo que já existe no destino (clonar duas vezes não duplica nem sobrescreve) e o
//  alvo arquivado; recusa o destino **fechado** com 403, como as outras três escritas. Ver
//  sections/POST/clone.ts, inclusive para por que o corpo aqui NÃO é o lote que a Renda usa
//  para o mesmo gesto.
BudgetPeriods_route.post("/BudgetPeriods/clone", BudgetPeriods_schema.clone, AsyncHandler(BudgetPeriods_controller.clone))

BudgetPeriods_route.put("/BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", BudgetPeriods_schema.update, AsyncHandler(BudgetPeriods_controller.update))

//  Delete físico: a fatia é plano, não lançamento. Ver sections/DELETE/remove.ts.
BudgetPeriods_route.delete("/BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", BudgetPeriods_schema.remove, AsyncHandler(BudgetPeriods_controller.remove))
