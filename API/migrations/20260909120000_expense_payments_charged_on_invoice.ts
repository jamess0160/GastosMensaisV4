import type { Knex } from "knex";


// O Charged inverte de sentido: de "ja conferi" para "esta na fatura".
//
// O DIAGNOSTICO. Charged nascia false em toda perna de cartao, e o campo queria
// dizer "conferi que esta compra apareceu na fatura do banco". Na pratica isso
// inverte o esforco: a compra NORMAL, que vai aparecer na fatura, exigia um
// clique para dizer que apareceu. Uma fatura de cartao concentrador tem dezenas
// de linhas e ninguem marca dezenas - entao o campo ficava false para sempre e
// parava de significar qualquer coisa. E a mesma falha que o payInvoice corrigiu
// no Paid, um campo ao lado.
//
// O CASO COMUM E O CONTRARIO. Lancar num cartao QUER DIZER que a compra vai para
// a fatura daquele cartao. O caso raro e a compra que o emissor ainda nao
// registrou, ou registrou com outro valor - e e o caso raro que merece o clique.
// Desmarcar passa a ser o gesto de "isto ainda nao caiu na fatura de verdade".
//
//     antes  ->  false = ninguem conferiu    true = eu conferi
//     agora  ->  true  = esta na fatura      false = previsto, ainda nao caiu
//
// O BACKFILL VIRA TODOS OS false SEM PRESERVAR O ESTADO ANTIGO, e isso e a
// decisao: nenhum false de hoje foi escolha de usuario nenhum - todos sao o
// padrao que ninguem mexeu. Manter esses false faria a tela nova abrir com todas
// as faturas inteiras no bloco de "previsto", que e exatamente o defeito que a
// inversao existe para corrigir.
//
// ChargedAt fica como esta: ele e o instante do clique, e a perna que nasce na
// fatura nao teve clique nenhum. Nulo com Charged true quer dizer "entrou pelo
// lancamento", que e a verdade.
export async function up(knex: Knex): Promise<void> {
    await knex("ExpensePayments").where("Charged", false).update({ Charged: true })
}


// A volta desfaz a inversao inteira, e nao linha a linha: sob o sentido antigo o
// unico valor honesto e "ninguem conferiu", porque o que a subida apagou foi
// justamente a distincao entre o padrao e a marcacao deliberada. Reconstruir por
// perna nao e possivel - "o usuario conferiu esta cobranca" e afirmacao dele e de
// mais ninguem, e ela nao esta em lugar nenhum depois da subida.
export async function down(knex: Knex): Promise<void> {
    await knex("ExpensePayments").where("Charged", true).update({ Charged: false })
}
