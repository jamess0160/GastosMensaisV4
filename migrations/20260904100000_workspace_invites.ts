import type { Knex } from "knex";


// Convite para entrar num workspace.
//
// Existe para fechar o buraco do cadastro: ate aqui o POST /Users aceitava um
// IdWorkspace no corpo e entrava direto como matricula 'owner' do workspace
// alheio. IdWorkspace e inteiro sequencial - adivinha-se contando. O que entra no
// lugar e o Hash desta linha: 32 bytes aleatorios, que nao.
//
// Por que uma linha e nao um JWT de convite:
//
// 1. Convite em JWT nao se revoga. Ele vale ate expirar, e quem recebeu o link
//    continua entrando depois de o dono mudar de ideia. Uma linha tem Status.
// 2. O convite precisa guardar e-mail e papel de qualquer jeito, para o servidor
//    conferir na hora do aceite. Guardados em linha, tambem podem ser listados
//    ("quem eu convidei e ainda nao entrou"), o que um token opaco nao permite.
//
// Email: gravado em minusculas, como o de Users. E ele que impede o link
// repassado - o link e compartilhavel por desenho (o usuario manda por WhatsApp),
// entao o segredo do hash sozinho nao basta. No aceite a API compara o e-mail do
// convite com o da conta que esta aceitando.
//
// Role: nunca 'owner'. Transferir propriedade e operacao propria, nao convite.
//
// Sem Active: o ciclo de vida e o Status, como em Inflows e Expenses. A convencao
// do projeto e Active so em tabela de cadastro.
export async function up(knex: Knex): Promise<void> {

    await knex.schema.createTable("WorkspaceInvites", (table) => {
        table.increments("IdWorkspaceInvite").primary()
        table.integer("IdWorkspace").unsigned().notNullable()
        table.integer("IdInviterUser").unsigned().notNullable()
        table.string("Email", 255).notNullable()
        table.enu("Role", ["editor", "viewer"]).notNullable().defaultTo("viewer")
        // 32 bytes em base64url dao 43 caracteres; 64 deixa folga para o gerador
        // mudar de tamanho sem migration. base64url e nao base64 porque o hash
        // viaja como parametro de URL - o mesmo motivo escrito no DeviceKey.
        table.string("Hash", 64).notNullable()
        table.enu("Status", ["pending", "accepted", "revoked"]).notNullable().defaultTo("pending")
        table.datetime("ExpiresAt").notNullable()
        table.datetime("AcceptedAt").nullable()
        table.integer("IdAcceptedUser").unsigned().nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdInviterUser").references("IdUser").inTable("Users").onDelete("CASCADE")
        table.foreign("IdAcceptedUser").references("IdUser").inTable("Users").onDelete("SET NULL")

        // O hash e a chave de leitura publica: e por ele que a tela de aceite
        // busca o convite, sem token nenhum.
        table.unique(["Hash"])
        // "quem eu convidei e ainda nao entrou"
        table.index(["IdWorkspace", "Status"])
        // "este e-mail tem convite pendente?" - usado na renovacao e no cadastro
        table.index(["Email", "Status"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("WorkspaceInvites")
}
