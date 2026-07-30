import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.insert([
        { Name: "Root" },
        { Name: "Admin" },
        { Name: "Gestor" },
        { Name: "Operador" },
    ]).into("UserGroupNames")

    await knex.insert([
        {
            Name: "Root",
            Login: "root",
            Pass: "202cb962ac59075b964b07152d234b70",
        },
        {
            Name: "Admin",
            Login: "admin",
            Pass: "202cb962ac59075b964b07152d234b70",
        },
        {
            Name: "Operador",
            Login: "operador",
            Pass: "202cb962ac59075b964b07152d234b70",
        },
    ]).into("Users")

    await knex.insert([
        { Name: "Empresa 1" },
    ]).into("Companys")

    await knex.insert([
        { IdUser: 1, IdUserGroupName: 1 },
        { IdUser: 2, IdUserGroupName: 2 },
        { IdUser: 3, IdUserGroupName: 4 },
    ]).into("UserInGroups")

    await knex.insert([
        { Name: "Máquina" },
    ]).into("ResourceTypes")

    await knex.insert([
        { IdCompany: 1, Name: "Planta 1" },
    ]).into("Plants")
}


export async function down(knex: Knex): Promise<void> {
    let tables = [
        "UserGroupNames",
        "Users",
        "Companys",
        "UserInGroups",
        "ResourceTypes",
        "Plants",
    ]

    for (const table of tables) {
        await knex(table).truncate();
    }
}