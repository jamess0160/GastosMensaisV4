export namespace Database {

    //#region Identidade e acesso

    export interface Users {
        IdUser: number
        Name: string
        Email: string
        Password: string
        Phone: number
        LastLogin: Datetime
        TrialStartAt: Datetime
        TrialEndAt: Datetime | null
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    export interface Workspaces {
        IdWorkspace: number
        Name: string
        IdOwnerUser: number
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    export interface WorkspaceMembers {
        IdWorkspaceMember: number
        IdWorkspace: number
        IdUser: number
        Role: "owner" | "editor" | "viewer"
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /**
     * Convite para entrar num workspace. O que viaja na URL e o Hash - 32 bytes
     * aleatorios -, nunca o IdWorkspace, que e sequencial e se adivinha contando.
     *
     * O Email e o que impede o link repassado: o link e compartilhavel por
     * desenho, entao o segredo do hash sozinho nao basta. No aceite a API compara
     * este e-mail com o da conta que esta aceitando.
     *
     * Sem Active: o ciclo de vida e o Status, como em Inflows e Expenses.
     */
    export interface WorkspaceInvites {
        IdWorkspaceInvite: number
        IdWorkspace: number
        IdInviterUser: number
        /** Sempre em minusculas, como o Email de Users */
        Email: string
        /** Nunca 'owner': transferir propriedade e operacao propria, nao convite. */
        Role: "editor" | "viewer"
        /** 32 bytes aleatorios em base64url - viaja como parametro de URL */
        Hash: string
        Status: "pending" | "accepted" | "revoked"
        ExpiresAt: Datetime
        AcceptedAt: Datetime | null
        IdAcceptedUser: number | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    export interface UsersAuth {
        IdUserAuth: number
        IdUser: number
        CredentialId: string
        PublicKey: Buffer
        Counter: number
        DeviceKey: string | null
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    export interface TrustedDevices {
        IdTrustedDevice: number
        IdUser: number
        DeviceKey: string
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    //#endregion

    //#region Contas e formas de pagamento

    export interface Accounts {
        IdAccount: number
        IdWorkspace: number
        IdUser: number | null
        Name: string
        /**
         * 'checking' -> conta bancaria: nasce com pix + debito, e a UNICA que aceita cartao
         *               de credito, porque a fatura vence contra ela
         * 'cash'     -> dinheiro na carteira: nasce com uma forma "Dinheiro"
         * 'card'     -> saldo fechado sem conta atras (o vale-alimentacao): nasce com uma
         *               forma unica, Kind='debit', com o NOME DA CONTA
         */
        Type: "checking" | "cash" | "card"
        IconPath: string | null
        /** RGB em hexadecimal (#RRGGBB). */
        Color: string | null
        /** Saldo de abertura: dado de origem, nao derivavel de nenhum lancamento. */
        InitialBalance: number
        InitialBalanceDate: CalendarDate | null
        //  Nao existe coluna de saldo atual: o saldo e sempre calculado dos lancamentos.
        //  Ver a migration 20260827022816 e a decisao 1 do ROADMAP.md.
        Position: number | null
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /** Filha de Accounts. 'pix' e 'debit' nascem junto com a conta; cartao e manual. */
    export interface PaymentMethods {
        IdPaymentMethod: number
        IdWorkspace: number
        IdAccount: number
        Name: string
        Kind: "pix" | "debit" | "credit_card"
        /** So em Kind='credit_card'. O dia do mes em que a fatura vence. */
        DueDay: number | null
        /**
         * So em Kind='credit_card'. Quantos dias antes do vencimento a fatura fecha.
         *
         * E a folga do emissor, nao um dia do mes: o cliente escolhe o vencimento e o
         * fechamento sai dele por subtracao. Ver InvoiceDates.section.ts.
         */
        ClosingOffsetDays: number | null
        IconPath: string | null
        Color: string | null
        Position: number | null
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    //#endregion

    //#region Categorias e orcamento

    /**
     * Categoria de gasto. IdWorkspace nulo = pre-definida global do sistema.
     *
     * Lista plana: nao ha categoria filha de outra (ver a migration
     * 20260829010000_drop_categories_parent).
     */
    export interface Categories {
        IdCategory: number
        IdWorkspace: number | null
        Description: string
        /** Chave do catalogo de icones do app cliente. */
        IconKey: string | null
        /** RGB em hexadecimal (#RRGGBB). */
        Color: string | null
        Position: number | null
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /** A definicao vigente do teto da categoria. Uma linha por categoria, sem mes. */
    export interface Budgets {
        IdBudget: number
        IdWorkspace: number
        IdUser: number | null
        /**
         * O alvo do teto: IdCategory OU IdPerson, nunca os dois e nunca nenhum - um CHECK
         * garante o xor, e dois indices parciais garantem a unicidade dentro de cada tipo.
         *
         * Sao duas perguntas diferentes sobre o mesmo dinheiro ("quanto foi de mercado" e
         * "quanto foi da Maria"), entao um gasto conta nos dois. O que nao se pode e somar
         * os dois num total.
         */
        IdCategory: number | null
        /** O outro alvo possivel: o eixo ANALITICO (ExpensePersons), nao o financeiro. */
        IdPerson: number | null
        LimitValue: number
        AlertPercent: number
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /**
     * O historico: o teto que valeu em cada mes, congelado. Materializado por
     * rotina a partir de Budgets, e editavel mes a mes sem mexer na definicao.
     */
    export interface BudgetPeriods {
        IdBudgetPeriod: number
        IdWorkspace: number
        IdBudget: number
        /** Sempre o dia 1 do mes. Vem do Postgres como "YYYY-MM-DD". */
        ReferenceMonth: CalendarDate
        LimitValue: number
        AlertPercent: number
        Status: "open" | "closed"
        ClosedAt: Datetime | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /**
     * Quem recebeu e quem gastou o dinheiro. Substitui a destinys do V3.
     * IdUser e vinculo opcional: pessoa nao precisa ter login para receber rateio.
     */
    export interface Persons {
        IdPerson: number
        IdWorkspace: number
        Name: string
        /** Nulo = pessoa que so existe para rateio, sem conta no sistema. */
        IdUser: number | null
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    //#endregion

    //#region Entradas

    /**
     * Entrada de dinheiro e, tambem, transferencia entre contas.
     *
     * Kind='inflow'   -> IdFromAccount nulo (vem de fora), IdToAccount obrigatorio
     * Kind='transfer' -> as duas contas obrigatorias e diferentes
     *
     * Transferencia e soma zero para o patrimonio: filtre Kind <> 'transfer'
     * em qualquer total de "quanto entrou".
     */
    export interface Inflows {
        IdInflow: number
        IdWorkspace: number
        IdUser: number | null
        Description: string
        TotalValue: number
        /** Recebimento e tudo ou nada: nao ha estado parcial. */
        Status: "pending" | "received" | "canceled"
        Kind: "inflow" | "transfer"
        IdFromAccount: number | null
        IdToAccount: number | null
        CompetenceDate: CalendarDate
        ExpectedDate: CalendarDate | null
        ReceivedAt: Datetime | null
        Notes: string | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /**
     * Quem recebeu: rateio da entrada entre Persons, por valor absoluto.
     * Soma dos Value tem que fechar com Inflows.TotalValue.
     * So existe para Kind='inflow'.
     */
    export interface InflowPersons {
        IdInflowPerson: number
        IdWorkspace: number
        IdInflow: number
        IdPerson: number
        Value: number
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    //#endregion

    //#region Gastos

    /**
     * O gasto. Status e DERIVADO das pernas de ExpensePayments: 'paid' so quando
     * todas estao pagas. Nao ha estado parcial no gasto.
     *
     * Gasto fixo e uma corrente de ocorrencias, nao molde + instancias: toda
     * linha aqui e um gasto real. A raiz da serie tem IdParentExpense nulo e
     * carrega RecurrenceDay/RecurrenceEndDate.
     */
    export interface Expenses {
        IdExpense: number
        IdWorkspace: number
        /** Quem registrou o lancamento. */
        IdUser: number | null
        Description: string
        TotalValue: number
        Status: "pending" | "paid" | "canceled"
        IdCategory: number | null
        ExpenseDate: CalendarDate
        Kind: "single" | "installment" | "fixed"
        IdParentExpense: number | null
        /** Dia do mes da recorrencia. So na raiz de uma serie 'fixed'. */
        RecurrenceDay: number | null
        /** Nulo = serie sem fim. So na raiz. */
        RecurrenceEndDate: CalendarDate | null
        Notes: string | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /** Eixo financeiro: move saldo. Uma linha por forma de pagamento e por parcela. */
    export interface ExpensePayments {
        IdExpensePayment: number
        IdWorkspace: number
        IdExpense: number
        IdPaymentMethod: number
        Value: number
        InstallmentNumber: number | null
        InstallmentTotal: number | null
        /** Fechamento da fatura em que esta perna caiu. Nulo fora de cartao. */
        ClosingDate: CalendarDate | null
        DueDate: CalendarDate | null
        Paid: boolean
        PaidAt: Datetime | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /** Quem gastou: rateio por valor absoluto entre Persons. Nao move saldo. */
    export interface ExpensePersons {
        IdExpensePerson: number
        IdWorkspace: number
        IdExpense: number
        IdPerson: number
        Value: number
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    /** Categoria temporaria por evento. Um gasto tem uma Category e N Tags. */
    export interface Tags {
        IdTag: number
        IdWorkspace: number
        IdUser: number | null
        Name: string
        Color: string | null
        Active: boolean
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    export interface ExpenseTags {
        IdExpenseTag: number
        IdWorkspace: number
        IdExpense: number
        IdTag: number
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    //#endregion

    //#region Plataforma

    export interface UserDevices {
        IdUserDevice: number
        IdUser: number
        DeviceKey: string
        Platform: "ios" | "android" | "web"
        PushToken: string | null
        LastSeenAt: Datetime | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    export interface Notifications {
        IdNotification: number
        IdWorkspace: number
        IdUser: number
        Type: "system" | "security"
        Title: string
        Body: string | null
        /** Aponta para o registro de origem sem FK, porque a origem varia. */
        EntityType: string | null
        EntityId: number | null
        ScheduledFor: Datetime | null
        SentAt: Datetime | null
        ReadAt: Datetime | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    export interface Plans {
        IdPlan: number
        Code: string
        Name: string
        PriceMonthly: number
        PriceYearly: number
        Features: unknown | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    export interface Subscriptions {
        IdSubscription: number
        IdWorkspace: number
        IdUser: number | null
        IdPlan: number
        Status: "trialing" | "active" | "past_due" | "canceled" | "expired"
        StartedAt: Datetime
        CurrentPeriodStart: Datetime | null
        CurrentPeriodEnd: Datetime | null
        CanceledAt: Datetime | null
        Provider: string | null
        ExternalId: string | null
        CreatedAt: Datetime
        UpdatedAt: Datetime
    }

    //#endregion
}

type Datetime = string | Date

/**
 * Coluna `date` do Postgres: **dia do calendário**, não instante.
 *
 * É string e não Date de propósito. Os pgTypeParsers devolvem essas colunas como "YYYY-MM-DD"
 * justamente para o dia não passar por fuso — em UTC-3 um Date de meia-noite vira o dia
 * anterior. Tipar como string faz o `new Date(...)` acidental virar erro de compilação, e é o
 * que permite comparar e somar datas como texto (Utils.addMonthsToDate).
 */
type CalendarDate = string
