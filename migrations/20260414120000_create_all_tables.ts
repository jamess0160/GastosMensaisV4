import { Knex } from "knex";

/**
 * Migration gerada automaticamente a partir do schema do banco "framework".
 *
 * Estratégia: Criar todas as tabelas SEM foreign keys primeiro,
 * depois adicionar todas as FKs em uma segunda etapa.
 * Isso evita problemas com dependências circulares (ex: users <-> companys).
 */
export async function up(knex: Knex): Promise<void> {

    // =====================================================
    // FASE 1 - Criar todas as tabelas (sem foreign keys)
    // =====================================================

    // 1. users
    await knex.schema.createTable("Users", (table) => {
        table.increments("IdUser").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdAddress").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("Login", 255).nullable();
        table.string("TagNumber", 255).nullable();
        table.string("Mail", 255).nullable();
        table.string("Pass", 255).nullable();
        table.string("Token", 255).nullable();
        table.string("JobDescription", 255).nullable();
        table.string("Phone", 255).nullable();
        table.string("ProjectEnrolment", 255).nullable();
        table.boolean("DecisionAccount").nullable();
        table.timestamp("LastLogin").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 2. companys
    await knex.schema.createTable("Companys", (table) => {
        table.increments("IdCompany").primary();
        table.string("Name", 255).nullable();
        table.string("Alias", 255).nullable();
        table.string("CNPJ", 255).nullable();
        table.string("URL", 255).nullable();
        table.integer("IdAddress").unsigned().nullable();
        table.integer("TotalUser").nullable();
        table.integer("TotalResource").nullable();
        table.date("DueDate").nullable();
        table.string("GatewayUser", 255).nullable();
        table.string("GatewayPass", 255).nullable();
        table.integer("IdOwnerCompany").unsigned().nullable();
        table.boolean("Partner").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 3. addresses
    await knex.schema.createTable("Addresses", (table) => {
        table.increments("IdAddress").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Street", 255).nullable();
        table.integer("Number").nullable();
        table.string("Comp", 255).nullable();
        table.string("Disctric", 255).nullable();
        table.string("City", 255).nullable();
        table.string("State", 255).nullable();
        table.string("Country", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 4. batches
    await knex.schema.createTable("Batches", (table) => {
        table.increments("IdBatch").primary();
        table.string("ErpCode", 255).nullable();
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 5. batchrelationships
    await knex.schema.createTable("BatchRelationships", (table) => {
        table.increments("IdBatchRelationship").primary();
        table.integer("IdParentBatch").unsigned().nullable();
        table.integer("IdChildBatch").unsigned().nullable();
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 6. usergrouptypes
    // await knex.schema.createTable("UserGroupTypes", (table) => {
    //     table.increments("IdUserGroupType").primary();
    //     table.integer("IdCompany").unsigned().nullable();
    //     table.string("Name", 255).nullable();
    //     table.boolean("Active").nullable().defaultTo(true);
    //     table.integer("IdUserChange").unsigned().nullable();
    //     table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    // });

    // 7. usergroupnames
    await knex.schema.createTable("UserGroupNames", (table) => {
        table.increments("IdUserGroupName").primary();
        table.integer("IdCompany").unsigned().nullable();
        // table.integer("IdUserGroupType").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.boolean("FullAccess").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 8. useringroups
    await knex.schema.createTable("UserInGroups", (table) => {
        table.increments("IdUserInGroup").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdUser").unsigned().nullable();
        table.integer("IdUserGroupName").unsigned().nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 9. permissions
    await knex.schema.createTable("Permissions", (table) => {
        table.increments("IdPermission").primary();
        table.string("Key", 255).nullable();
        table.integer("IdUserGroupName").unsigned().nullable();
        table.datetime("LastChange").defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.integer("IdUserChange").unsigned().nullable();
        table.tinyint("Active").defaultTo(1);
    });

    // 10. passwordrecoverys
    await knex.schema.createTable("PasswordRecoverys", (table) => {
        table.increments("IdPasswordRecovery").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdUserAsk").unsigned().nullable();
        table.timestamp("DateEventAsk").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Approved").nullable();
        table.integer("IdUserApproved").unsigned().nullable();
        table.timestamp("DateEventApproved").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 11. systemparams
    await knex.schema.createTable("SystemParams", (table) => {
        table.increments("IdSystemParam").primary();
        table.integer("IdSystemParamParent").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("Description", 255).nullable();
        table.string("Value", 255).nullable();
        table.string("Placeholder", 255).nullable();
        table.string("RegexValidation", 255).nullable();
        table.text("CustomField").nullable();
        table.integer("IdUser").unsigned().nullable();
        table.datetime("LastChange").defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.specificType("Active", "bit(1)").defaultTo(knex.raw("b'1'"));
    });

    // 12. modules
    await knex.schema.createTable("Modules", (table) => {
        table.increments("IdModule").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.boolean("InUse").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 13. paths
    await knex.schema.createTable("Paths", (table) => {
        table.increments("IdPath").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdModule").unsigned().nullable();
        table.integer("PathType").nullable();
        table.string("Name", 255).nullable();
        table.string("URL", 255).nullable();
        table.integer("InternalCode").nullable();
        table.string("Icon", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 14. accesses
    await knex.schema.createTable("Accesses", (table) => {
        table.increments("idAccess").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdUserGroupName").unsigned().nullable();
        table.integer("IdUser").unsigned().nullable();
        table.integer("IdPath").unsigned().nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 15. plants
    await knex.schema.createTable("Plants", (table) => {
        table.increments("IdPlant").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdAddress").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("ERPCode", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 16. warehouses
    await knex.schema.createTable("Warehouses", (table) => {
        table.increments("IdWarehouse").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdPlant").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("ERPCode", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 17. shifts
    await knex.schema.createTable("Shifts", (table) => {
        table.increments("IdShift").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Description", 255).nullable();
        table.time("Shiftbegin").nullable();
        table.time("ShiftEnd").nullable();
        table.string("Color", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 18. calendars
    await knex.schema.createTable("Calendars", (table) => {
        table.increments("IdCalendar").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdShift").unsigned().nullable();
        table.timestamp("DateStart").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("DateEnd").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 19. communicationtypes
    await knex.schema.createTable("CommunicationTypes", (table) => {
        table.increments("IdCommunicationType").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("DeviceIdPosition", 255).nullable();
        table.string("TimeStamp DEFAULT (NOW())Position", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 20. devices
    await knex.schema.createTable("Devices", (table) => {
        table.increments("IdDevice").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdCommunicationType").unsigned().nullable();
        table.string("DeviceID", 255).nullable();
        table.string("DeviceIP", 255).nullable();
        table.integer("DevicePort").nullable();
        table.timestamp("LastDataReceived").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 21. resourcetypes
    await knex.schema.createTable("ResourceTypes", (table) => {
        table.increments("IdResourceType").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 22. resourceproductionordertypes
    await knex.schema.createTable("ResourceProductionOrderTypes", (table) => {
        table.increments("IdResourceProductionOrderType").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 23. resourcegroups
    await knex.schema.createTable("ResourceGroups", (table) => {
        table.increments("IdResourceGroup").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdResourceGroupFather").unsigned().nullable();
        table.integer("IdPlant").unsigned().nullable();
        table.integer("IdWarehouse").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("ERPCode", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 24. resources
    await knex.schema.createTable("Resources", (table) => {
        table.increments("IdResource").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdDevice").unsigned().nullable();
        table.integer("IdResourceGroup").unsigned().nullable();
        table.integer("IdResourceProductionOrderType").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("ERPCode", 255).nullable();
        table.integer("IdResourceType").unsigned().nullable();
        table.double("HourlyCost").nullable();
        table.integer("DataImputType").nullable();
        table.integer("ProductionOrderImput").nullable();
        table.integer("MultipleProductionOrder").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 25. resourceindicators
    await knex.schema.createTable("ResourceIndicators", (table) => {
        table.increments("idResourceIndicator").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdResource").unsigned().nullable();
        table.integer("OEE").nullable();
        table.integer("Disponibility").nullable();
        table.integer("Performance").nullable();
        table.integer("Quality").nullable();
        table.double("OEEGoal").nullable();
        table.double("DisponibilityGoal").nullable();
        table.double("PerformanceGoal").nullable();
        table.double("QualityGoal").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 26. paramtypes
    await knex.schema.createTable("ParamTypes", (table) => {
        table.increments("IdParamType").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 27. deviceparams
    await knex.schema.createTable("DeviceParams", (table) => {
        table.increments("IdParam").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdResource").unsigned().nullable();
        table.integer("IdDevice").unsigned().nullable();
        table.integer("IdParamType").unsigned().nullable();
        table.string("JSONName", 255).nullable();
        table.string("BusinessName", 255).nullable();
        table.integer("DataType").nullable();
        table.string("Color", 255).nullable();
        table.string("Icon", 255).nullable();
        table.boolean("CollectData").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 28. paramformats
    await knex.schema.createTable("ParamFormats", (table) => {
        table.increments("IdParamFormat").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdParam").unsigned().nullable();
        table.integer("ValueType").nullable();
        table.string("ValueBegin", 255).nullable();
        table.string("ValueEnd", 255).nullable();
        table.string("Color", 255).nullable();
        table.string("Icon", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 29. paramsdictionary
    await knex.schema.createTable("ParamsDictionary", (table) => {
        table.increments("IdParamDictionary").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdParam").unsigned().nullable();
        table.integer("CollectData").nullable();
        table.string("Presentation", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 30. items
    await knex.schema.createTable("Items", (table) => {
        table.increments("IdItem").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("ERPCode", 255).nullable();
        table.string("Name", 255).nullable();
        table.double("Weight").nullable();
        table.double("ValidTime").nullable();
        table.double("StandardCicleTime").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 31. itemroutes
    await knex.schema.createTable("ItemRoutes", (table) => {
        table.increments("IdItemRoute").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdItem").unsigned().nullable();
        table.integer("IdResource").unsigned().nullable();
        table.string("OperationCode", 255).nullable();
        table.string("RouteCode", 255).nullable();
        table.double("ValidTime").nullable();
        table.double("CicleTime").nullable();
        table.double("Multiplier").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 32. productionorderstatustypes
    await knex.schema.createTable("ProductionOrderStatusTypes", (table) => {
        table.increments("IdProductionOrderStatusType").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.boolean("RegisterTrace").nullable();
        table.boolean("DiscountValidTime").nullable();
        table.boolean("UsedInOrders").nullable();
        table.string("Color", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 33. productionorders
    await knex.schema.createTable("ProductionOrders", (table) => {
        table.increments("IdProductionOrder").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdCalendar").unsigned().nullable();
        table.integer("IdUserStart").unsigned().nullable();
        table.integer("IdUserEnd").unsigned().nullable();
        table.integer("IdResourceExec").unsigned().nullable();
        table.integer("IdResourcePlanning").unsigned().nullable();
        table.integer("IdResourceGroupPlanning").unsigned().nullable();
        table.integer("IdProductionOrderStatusType").unsigned().nullable();
        table.string("ERPCode", 250).nullable();
        table.integer("Sequence").nullable();
        table.timestamp("ExecDateStart").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("ExecDateEnd").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.double("TotalExecTime").nullable();
        table.double("ValidExecTime").nullable();
        table.integer("ResourceCountStart").nullable();
        table.integer("ResourceCountend").nullable();
        table.timestamp("PlanningDateBegin").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("PlanningDateEnd").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.double("TotalPlanningTime").nullable();
        table.timestamp("CreateDate").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.integer("CreateIdUser").unsigned().nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 34. productionordersitems
    await knex.schema.createTable("ProductionOrdersItems", (table) => {
        table.increments("IdProductionOrderItem").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdProductionOrder").unsigned().nullable();
        table.integer("IdItem").unsigned().nullable();
        table.integer("IdResourceExec").unsigned().nullable();
        table.integer("IdResourcePlanning").unsigned().nullable();
        table.integer("IdResourceGroupPlanning").unsigned().nullable();
        table.integer("IdCalendar").unsigned().nullable();
        table.integer("IdUserStart").unsigned().nullable();
        table.integer("IdUserEnd").unsigned().nullable();
        table.integer("IdProductionOrderStatusType").unsigned().nullable();
        table.string("ERPCode", 255).nullable();
        table.string("ERPIdRoute", 255).nullable();
        table.integer("Sequence").nullable();
        table.string("Unit", 255).nullable();
        table.double("Quantity").nullable();
        table.double("QuantityScrap").nullable();
        table.integer("CicleQuantity").nullable();
        table.integer("BaseResourceCount").nullable();
        table.double("AskQuantity").nullable();
        table.timestamp("ExecDateStart").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("ExecDateEnd").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.double("TotalExecTime").nullable();
        table.double("ValidExecTime").nullable();
        table.timestamp("CreateDate").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("InProduction").nullable();
        table.double("TotalPlanningTime").nullable();
        table.timestamp("PlanningDateBegin").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("PlanningDateEnd").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.double("CicleTime").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 35. productionordersitemstatus
    await knex.schema.createTable("ProductionOrdersItemStatus", (table) => {
        table.increments("IdProductionOrdersItemStatus").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdProductionOrder").unsigned().nullable();
        table.integer("IdProductionOrderItem").unsigned().nullable();
        table.integer("IdProductionOrderStatusType").unsigned().nullable();
        table.timestamp("EventDateStart").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("EventDateEnd").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 36. stopreasons
    await knex.schema.createTable("StopReasons", (table) => {
        table.increments("IdStopReason").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 250).nullable();
        table.integer("HaveDetailReason").nullable();
        table.integer("Scheduled").nullable();
        table.integer("DiscountValidTime").nullable();
        table.string("Color", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 37. stopreasondetails
    await knex.schema.createTable("StopReasonDetails", (table) => {
        table.increments("IdStopReasonDetail").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdStopReason").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 38. resourcestops
    await knex.schema.createTable("ResourceStops", (table) => {
        table.increments("IdResourceStop").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdResourceStopFather").unsigned().nullable();
        table.integer("IdResource").unsigned().nullable();
        table.integer("IdStopReason").unsigned().nullable();
        table.integer("IdStopReasonDetail").unsigned().nullable();
        table.integer("IdProductionOrder").unsigned().nullable();
        table.integer("IdProductionOrderItem").unsigned().nullable();
        table.integer("IdCalendar").unsigned().nullable();
        table.integer("IdUserRegister").unsigned().nullable();
        table.timestamp("EventBeginDate").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("EventEndDate").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.double("TotalEventTime").nullable();
        table.double("ValidEventTime").nullable();
        table.timestamp("DateRegister").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.string("Description", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 39. logs
    await knex.schema.createTable("Logs", (table) => {
        table.increments("IdLog").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdUser").unsigned().nullable();
        table.timestamp("EventDate").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.string("Table", 255).nullable();
        table.string("Key", 255).nullable();
        table.string("Field", 255).nullable();
        table.string("Description", 255).nullable();
    });

    // 40. printerlanguages
    await knex.schema.createTable("PrinterLanguages", (table) => {
        table.increments("IdPrinterLanguage").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 41. printers
    await knex.schema.createTable("Printers", (table) => {
        table.increments("IdPrinter").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.integer("IdPrinterLanguage").unsigned().nullable();
        table.string("IP", 255).nullable();
        table.string("ERPCode", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 42. stockaddressgroups
    await knex.schema.createTable("StockAddressGroups", (table) => {
        table.increments("IdStockAddressGroup").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdWarehouse").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("ERPCode", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 43. stockaddresses
    await knex.schema.createTable("StockAddresses", (table) => {
        table.increments("IdStockAddress").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdStockAddressGroup").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("ERPCode", 255).nullable();
        table.boolean("Full").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 44. handlingunits
    await knex.schema.createTable("HandlingUnits", (table) => {
        table.increments("IdHandlingUnit").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdStockAddress").unsigned().nullable();
        table.string("ERPCode", 255).nullable();
        table.timestamp("DateCreate").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.double("Weight").nullable();
        table.integer("Status").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 45. transportpartners
    await knex.schema.createTable("TransportPartners", (table) => {
        table.increments("IdTransportPartner").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.string("ERPCode", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 46. transports
    await knex.schema.createTable("Transports", (table) => {
        table.increments("IdTranport").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdTransportPartner").unsigned().nullable();
        table.integer("IdAddress").unsigned().nullable();
        table.string("Plate", 255).nullable();
        table.timestamp("DateEvent").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.double("LoadWheigt").nullable();
        table.integer("Status").nullable();
        table.integer("DestinationType").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 47. transportloads
    await knex.schema.createTable("TransportLoads", (table) => {
        table.increments("IdTranportLoad").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdTransport").unsigned().nullable();
        table.integer("IdHandlingUnit").unsigned().nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 48. tagregisters
    await knex.schema.createTable("TagRegisters", (table) => {
        table.increments("IdTagRegister").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdUserGroupName").unsigned().nullable();
        table.integer("IdUser").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.integer("Type").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 49. tagrelations
    await knex.schema.createTable("TagRelations", (table) => {
        table.increments("IdTagRelations").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdTagRegister").unsigned().nullable();
        table.integer("IdDevice").unsigned().nullable();
        table.integer("IdResource").unsigned().nullable();
        table.integer("IdTile").unsigned().nullable();
        table.integer("IdParam").unsigned().nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 50. tileconfigtypes
    await knex.schema.createTable("TileConfigTypes", (table) => {
        table.increments("IdTileConfigType").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.string("Name", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 51. tileconfiglabels
    await knex.schema.createTable("TileConfigLabels", (table) => {
        table.increments("IdTileConfigLabel").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdTileConfigType").unsigned().nullable();
        table.string("Description", 255).nullable();
        table.integer("Position").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 52. tileconfigparams
    await knex.schema.createTable("TileConfigParams", (table) => {
        table.increments("IdTileConfigParam").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdTileConfigType").unsigned().nullable();
        table.string("Description", 255).nullable();
        table.integer("Position").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 53. tiles
    await knex.schema.createTable("Tiles", (table) => {
        table.increments("IdTile").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdResource").unsigned().nullable();
        table.integer("IdTileConfigType").unsigned().nullable();
        table.integer("Position").nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 54. tilelabels
    await knex.schema.createTable("TileLabels", (table) => {
        table.increments("IdTileLabel").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdTile").unsigned().nullable();
        table.integer("IdTileConfigLabel").unsigned().nullable();
        table.string("Value", 255).nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // 55. tileparams
    await knex.schema.createTable("TileParams", (table) => {
        table.increments("IdTileParam").primary();
        table.integer("IdCompany").unsigned().nullable();
        table.integer("IdTile").unsigned().nullable();
        table.integer("IdTileConfigParam").unsigned().nullable();
        table.integer("IdParam").unsigned().nullable();
        table.integer("IdUserChange").unsigned().nullable();
        table.timestamp("LastChange").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.boolean("Active").nullable().defaultTo(true);
    });

    // =====================================================
    // FASE 2 - Adicionar todas as Foreign Keys
    // =====================================================

    // users FKs
    await knex.schema.alterTable("Users", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdAddress").references("IdAddress").inTable("Addresses");
    });

    // companys FKs
    await knex.schema.alterTable("Companys", (table) => {
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdOwnerCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdAddress").references("IdAddress").inTable("Addresses");
    });

    // addresses FKs
    await knex.schema.alterTable("Addresses", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // batchrelationships FKs
    await knex.schema.alterTable("BatchRelationships", (table) => {
        table.foreign("IdParentBatch").references("IdBatch").inTable("Batches");
        table.foreign("IdChildBatch").references("IdBatch").inTable("Batches");
    });

    // usergrouptypes FKs
    // await knex.schema.alterTable("UserGroupTypes", (table) => {
    //     table.foreign("IdCompany").references("IdCompany").inTable("Companys");
    //     table.foreign("IdUserChange").references("IdUser").inTable("Users");
    // });

    // usergroupnames FKs
    await knex.schema.alterTable("UserGroupNames", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        // table.foreign("IdUserGroupType").references("IdUserGroupType").inTable("UserGroupTypes");
    });

    // useringroups FKs
    await knex.schema.alterTable("UserInGroups", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUser").references("IdUser").inTable("Users");
        table.foreign("IdUserGroupName").references("IdUserGroupName").inTable("UserGroupNames");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // permissions FKs
    await knex.schema.alterTable("Permissions", (table) => {
        table.foreign("IdUserGroupName", "fk_permissions_usergroupnames").references("IdUserGroupName").inTable("UserGroupNames");
        table.foreign("IdUserChange", "fk_permissions_userchange").references("IdUser").inTable("Users");
    });

    // passwordrecoverys FKs
    await knex.schema.alterTable("PasswordRecoverys", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdUserAsk").references("IdUser").inTable("Users");
        table.foreign("IdUserApproved").references("IdUser").inTable("Users");
    });

    // modules FKs
    await knex.schema.alterTable("Modules", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // paths FKs
    await knex.schema.alterTable("Paths", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdModule").references("IdModule").inTable("Modules");
    });

    // accesses FKs
    await knex.schema.alterTable("Accesses", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUser").references("IdUser").inTable("Users");
        table.foreign("IdUserGroupName").references("IdUserGroupName").inTable("UserGroupNames");
        table.foreign("IdPath").references("IdPath").inTable("Paths");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // plants FKs
    await knex.schema.alterTable("Plants", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdAddress").references("IdAddress").inTable("Addresses");
    });

    // warehouses FKs
    await knex.schema.alterTable("Warehouses", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdPlant").references("IdPlant").inTable("Plants");
    });

    // shifts FKs
    await knex.schema.alterTable("Shifts", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // calendars FKs
    await knex.schema.alterTable("Calendars", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdShift").references("IdShift").inTable("Shifts");
    });

    // communicationtypes FKs
    await knex.schema.alterTable("CommunicationTypes", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // devices FKs
    await knex.schema.alterTable("Devices", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdCommunicationType").references("IdCommunicationType").inTable("CommunicationTypes");
    });

    // resourcetypes FKs
    await knex.schema.alterTable("ResourceTypes", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // resourceproductionordertypes FKs
    await knex.schema.alterTable("ResourceProductionOrderTypes", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // resourcegroups FKs
    await knex.schema.alterTable("ResourceGroups", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdResourceGroupFather").references("IdResourceGroup").inTable("ResourceGroups");
        table.foreign("IdPlant").references("IdPlant").inTable("Plants");
        table.foreign("IdWarehouse").references("IdWarehouse").inTable("Warehouses");
    });

    // resources FKs
    await knex.schema.alterTable("Resources", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdResourceType").references("IdResourceType").inTable("ResourceTypes");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdDevice").references("IdDevice").inTable("Devices");
        table.foreign("IdResourceGroup").references("IdResourceGroup").inTable("ResourceGroups");
        table.foreign("IdResourceProductionOrderType").references("IdResourceProductionOrderType").inTable("ResourceProductionOrderTypes");
    });

    // resourceindicators FKs
    await knex.schema.alterTable("ResourceIndicators", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdResource").references("IdResource").inTable("Resources");
    });

    // paramtypes FKs
    await knex.schema.alterTable("ParamTypes", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // deviceparams FKs
    await knex.schema.alterTable("DeviceParams", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdResource").references("IdResource").inTable("Resources");
        table.foreign("IdDevice").references("IdDevice").inTable("Devices");
        table.foreign("IdParamType").references("IdParamType").inTable("ParamTypes");
    });

    // paramformats FKs
    await knex.schema.alterTable("ParamFormats", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdParam").references("IdParam").inTable("DeviceParams");
    });

    // paramsdictionary FKs
    await knex.schema.alterTable("ParamsDictionary", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdParam").references("IdParam").inTable("DeviceParams");
    });

    // items FKs
    await knex.schema.alterTable("Items", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // itemroutes FKs
    await knex.schema.alterTable("ItemRoutes", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdItem").references("IdItem").inTable("Items");
        table.foreign("IdResource").references("IdResource").inTable("Resources");
    });

    // productionorderstatustypes FKs
    await knex.schema.alterTable("ProductionOrderStatusTypes", (table) => {
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
    });

    // productionorders FKs
    await knex.schema.alterTable("ProductionOrders", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdCalendar").references("IdCalendar").inTable("Calendars");
        table.foreign("IdUserStart").references("IdUser").inTable("Users");
        table.foreign("IdUserEnd").references("IdUser").inTable("Users");
        table.foreign("IdResourceExec").references("IdResource").inTable("Resources");
        table.foreign("IdResourcePlanning").references("IdResource").inTable("Resources");
        table.foreign("IdResourceGroupPlanning").references("IdResourceGroup").inTable("ResourceGroups");
        table.foreign("IdProductionOrderStatusType").references("IdProductionOrderStatusType").inTable("ProductionOrderStatusTypes");
    });

    // productionordersitems FKs
    await knex.schema.alterTable("ProductionOrdersItems", (table) => {
        table.foreign("IdProductionOrder").references("IdProductionOrder").inTable("ProductionOrders");
        table.foreign("IdItem").references("IdItem").inTable("Items");
        table.foreign("IdResourceExec").references("IdResource").inTable("Resources");
        table.foreign("IdResourcePlanning").references("IdResource").inTable("Resources");
        table.foreign("IdUserStart").references("IdUser").inTable("Users");
        table.foreign("IdUserEnd").references("IdUser").inTable("Users");
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdResourceGroupPlanning").references("IdResourceGroup").inTable("ResourceGroups");
        table.foreign("IdProductionOrderStatusType").references("IdProductionOrderStatusType").inTable("ProductionOrderStatusTypes");
        table.foreign("IdCalendar").references("IdCalendar").inTable("Calendars");
    });

    // productionordersitemstatus FKs
    await knex.schema.alterTable("ProductionOrdersItemStatus", (table) => {
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdProductionOrder").references("IdProductionOrder").inTable("ProductionOrders");
        table.foreign("IdProductionOrderItem").references("IdProductionOrderItem").inTable("ProductionOrdersItems");
        table.foreign("IdProductionOrderStatusType").references("IdProductionOrderStatusType").inTable("ProductionOrderStatusTypes");
    });

    // stopreasons FKs
    await knex.schema.alterTable("StopReasons", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // stopreasondetails FKs
    await knex.schema.alterTable("StopReasonDetails", (table) => {
        table.foreign("IdStopReason").references("IdStopReason").inTable("StopReasons");
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // resourcestops FKs
    await knex.schema.alterTable("ResourceStops", (table) => {
        table.foreign("IdResource").references("IdResource").inTable("Resources");
        table.foreign("IdStopReason").references("IdStopReason").inTable("StopReasons");
        table.foreign("IdStopReasonDetail").references("IdStopReasonDetail").inTable("StopReasonDetails");
        table.foreign("IdProductionOrder").references("IdProductionOrder").inTable("ProductionOrders");
        table.foreign("IdProductionOrderItem").references("IdProductionOrderItem").inTable("ProductionOrdersItems");
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdResourceStopFather").references("IdResourceStop").inTable("ResourceStops");
        table.foreign("IdCalendar").references("IdCalendar").inTable("Calendars");
    });

    // logs FKs
    await knex.schema.alterTable("Logs", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUser").references("IdUser").inTable("Users");
    });

    // printerlanguages FKs
    await knex.schema.alterTable("PrinterLanguages", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // printers FKs
    await knex.schema.alterTable("Printers", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdPrinterLanguage").references("IdPrinterLanguage").inTable("PrinterLanguages");
    });

    // stockaddressgroups FKs
    await knex.schema.alterTable("StockAddressGroups", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdWarehouse").references("IdWarehouse").inTable("Warehouses");
    });

    // stockaddresses FKs
    await knex.schema.alterTable("StockAddresses", (table) => {
        table.foreign("IdStockAddressGroup").references("IdStockAddressGroup").inTable("StockAddressGroups");
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // handlingunits FKs
    await knex.schema.alterTable("HandlingUnits", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdStockAddress").references("IdStockAddress").inTable("StockAddresses");
    });

    // transportpartners FKs
    await knex.schema.alterTable("TransportPartners", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // transports FKs
    await knex.schema.alterTable("Transports", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdTransportPartner").references("IdTransportPartner").inTable("TransportPartners");
        table.foreign("IdAddress").references("IdAddress").inTable("Addresses");
    });

    // transportloads FKs
    await knex.schema.alterTable("TransportLoads", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdHandlingUnit").references("IdHandlingUnit").inTable("HandlingUnits");
        table.foreign("IdTransport").references("IdTranport").inTable("Transports");
    });

    // tagregisters FKs
    await knex.schema.alterTable("TagRegisters", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdUser").references("IdUser").inTable("Users");
        table.foreign("IdUserGroupName").references("IdUserGroupName").inTable("UserGroupNames");
    });

    // tagrelations FKs
    await knex.schema.alterTable("TagRelations", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdTagRegister").references("IdTagRegister").inTable("TagRegisters");
        table.foreign("IdDevice").references("IdDevice").inTable("Devices");
        table.foreign("IdResource").references("IdResource").inTable("Resources");
        table.foreign("IdTile").references("IdTile").inTable("Tiles");
        table.foreign("IdParam").references("IdParam").inTable("DeviceParams");
    });

    // tileconfigtypes FKs
    await knex.schema.alterTable("TileConfigTypes", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
    });

    // tileconfiglabels FKs
    await knex.schema.alterTable("TileConfigLabels", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdTileConfigType").references("IdTileConfigType").inTable("TileConfigTypes");
    });

    // tileconfigparams FKs
    await knex.schema.alterTable("TileConfigParams", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdTileConfigType").references("IdTileConfigType").inTable("TileConfigTypes");
    });

    // tiles FKs
    await knex.schema.alterTable("Tiles", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdTileConfigType").references("IdTileConfigType").inTable("TileConfigTypes");
        table.foreign("IdResource").references("IdResource").inTable("Resources");
    });

    // tilelabels FKs
    await knex.schema.alterTable("TileLabels", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdTile").references("IdTile").inTable("Tiles");
        table.foreign("IdTileConfigLabel").references("IdTileConfigLabel").inTable("TileConfigLabels");
    });

    // tileparams FKs
    await knex.schema.alterTable("TileParams", (table) => {
        table.foreign("IdCompany").references("IdCompany").inTable("Companys");
        table.foreign("IdUserChange").references("IdUser").inTable("Users");
        table.foreign("IdTile").references("IdTile").inTable("Tiles");
        table.foreign("IdParam").references("IdParam").inTable("DeviceParams");
        table.foreign("IdTileConfigParam").references("IdTileConfigParam").inTable("TileConfigParams");
    });
}

export async function down(knex: Knex): Promise<void> {
    console.log("Down")
    // Desabilitar checagem de FK para poder dropar em qualquer ordem
    await knex.raw("SET FOREIGN_KEY_CHECKS = 0");

    const tables = [
        "TileParams",
        "TileLabels",
        "Tiles",
        "TileConfigParams",
        "TileConfigLabels",
        "TileConfigTypes",
        "TagRelations",
        "TagRegisters",
        "TransportLoads",
        "Transports",
        "TransportPartners",
        "HandlingUnits",
        "StockAddresses",
        "StockAddressGroups",
        "Printers",
        "PrinterLanguages",
        "Logs",
        "ResourceStops",
        "StopReasonDetails",
        "StopReasons",
        "ProductionOrdersItemStatus",
        "ProductionOrdersItems",
        "ProductionOrders",
        "ProductionOrderStatusTypes",
        "ItemRoutes",
        "Items",
        "ParamsDictionary",
        "ParamFormats",
        "DeviceParams",
        "ParamTypes",
        "ResourceIndicators",
        "Resources",
        "ResourceGroups",
        "ResourceProductionOrderTypes",
        "ResourceTypes",
        "Devices",
        "CommunicationTypes",
        "Calendars",
        "Shifts",
        "Warehouses",
        "Plants",
        "Accesses",
        "Paths",
        "Modules",
        "SystemParams",
        "PasswordRecoverys",
        "Permissions",
        "UserInGroups",
        "UserGroupNames",
        "UserGroupTypes",
        "BatchRelationships",
        "Batches",
        "Addresses",
        "Companys",
        "Users",
    ];

    for (const table of tables) {
        console.log("Droping", table)
        await knex.schema.dropTableIfExists(table);
    }

    await knex.raw("SET FOREIGN_KEY_CHECKS = 1");
}
