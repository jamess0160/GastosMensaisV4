import type { Knex } from "knex";


// A confirmacao de e-mail: UMA COLUNA, e nenhuma tabela.
//
// Hoje ninguem prova que o endereco cadastrado e seu, e isso custa dos dois lados:
// uma conta nasce sobre um e-mail com erro de digitacao e o dono nunca recebe a
// recuperacao de senha - fica trancado para fora sem ter feito nada errado -, e o
// endereco de outra pessoa pode ser usado no cadastro.
//
// **Nulavel, e o usuario nao confirmado entra e usa o app normalmente.** Bloquear
// o login seria mais simples de raciocinar, e e o que custa cadastro: quem nao
// recebe o e-mail - spam, typo, provedor lento - fica do lado de fora dependendo
// de o reenvio funcionar. A faixa na tela e o que cobra a confirmacao; com a
// coluna gravada, bloquear ALGUMA COISA especifica depois (convidar alguem para o
// workspace, por exemplo) nao precisa de migration nenhuma.
//
// **Sem tabela de token**, pelo mesmo motivo da recuperacao de senha: o token e um
// JWT curto que carrega o proprio e-mail dentro, e trocar o endereco o mata. Nao
// ha o que guardar entre as duas requisicoes.
//
// **Sem backfill.** Todo usuario que ja existe nasce com o campo nulo, porque e a
// verdade: ninguem provou endereco nenhum ate agora. Como nada e bloqueado pelo
// nulo, o preco disso e uma faixa na tela - e carimbar de confirmado quem nunca
// confirmou seria escrever no banco uma coisa que nao aconteceu.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Users", (table) => {
        table.datetime("EmailConfirmedAt").nullable()
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Users", (table) => {
        table.dropColumn("EmailConfirmedAt")
    })
}
