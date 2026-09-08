/* ════════════════════════════════════════════════════════════
   Tipos do contrato da API.
   Fonte: Docs/API - Contrato Front-end.md
   ════════════════════════════════════════════════════════════ */

/** Todo o contrato entra por aqui: `ApiTypes.Expense`, não `Expense`.
 *  O prefixo diz de onde o tipo veio — e evita colidir com os tipos
 *  do app que têm nome parecido (`Account` da API x `Account` de tela). */
export namespace ApiTypes {
    /** "YYYY-MM-DD". Data de calendário — NUNCA passe por `new Date()`:
     *  em UTC-3 o dia 05 vira 04. Trate como string. */
    export type CalendarDate = string;

    /** "YYYY-MM" na entrada. A API devolve "YYYY-MM-01". */
    export type ReferenceMonth = string;

    /** ISO 8601. Instante de verdade — aqui `new Date()` é correto. */
    export type DateTime = string;

    /** "#RRGGBB", 7 caracteres. */
    export type Color = string;

    /** Dinheiro: decimal(15,2) que chega como número, nunca string. */
    export type Money = number;

    /** Corpo de toda falha tratada (406). 401 e 500 vêm com corpo vazio. */
    export interface ApiError {
        msg: string;
    }

    /* ── 2. Users ─────────────────────────────────────────────── */

    export interface User {
        IdUser: number;
        Name: string;
        Email: string;
        Phone: number;
        LastLogin: DateTime | null;
        TrialStartAt: DateTime | null;
        TrialEndAt: DateTime | null;
        Active: boolean;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    export interface SignUpBody {
        Name: string;
        Email: string;
        /** Texto puro. NÃO pré-hasheie no cliente — o bcrypt roda no servidor. */
        Password: string;
        Phone: number;
        /** O hash do convite, para quem chegou por um link e ainda não
         *  tem conta. Sem ele, o cadastro cria um workspace novo.
         *
         *  Substituiu o `IdWorkspace`, que entrava direto como matrícula
         *  `owner` sem convite nem conferência — com um id sequencial,
         *  que se adivinhava contando. Mandar `IdWorkspace` agora é 406.
         *
         *  O E-MAIL TEM QUE BATER com o do convite: o link é
         *  compartilhável por desenho, e é o e-mail que fecha a tranca. */
        InviteHash?: string;
    }

    export interface LoginBody {
        login: string;
        password: string;
    }

    /* ── 3. UsersAuth (WebAuthn) ──────────────────────────────── */

    /** Tri-estado: true = há passkey aqui; false = usuário recusou;
     *  null = nunca foi perguntado. */
    export interface CheckDeviceResponse {
        UseAuth: boolean | null;
    }

    export interface WebAuthnChallenge<TOptions = unknown> {
        /** PublicKeyCredential*OptionsJSON — passe direto para @simplewebauthn/browser. */
        options: TOptions;
        ChallengeToken: string;
    }

    export interface UserAuth {
        IdUserAuth: number;
        IdUser: number;
        CredentialId: string;
        DeviceKey: string;
        Active: boolean;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /* ── 4. Workspaces ────────────────────────────────────────── */

    /** Um usuário pode ser membro de vários workspaces, e há TRÊS formas
     *  de isso acontecer: o primeiro nasce no cadastro, um novo se cria
     *  com `POST /Workspaces`, e num que já existe só se entra por
     *  CONVITE. `getSelf` devolve todos, e é o `switch` que escolhe em
     *  qual a sessão está.
     *
     *  ⚠️ A lista NÃO diz qual é o da sessão: o `IdWorkspace` vive dentro
     *  do token e o cookie é `HttpOnly`. Ver `currentWorkspace` em
     *  `src/app/session.tsx` e a pendência 19. */
    export interface Workspace {
        IdWorkspace: number;
        Name: string;
        IdOwnerUser: number;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /** `IdWorkspace` não entra (ele nasce aqui) e `IdOwnerUser` também
     *  não (é o usuário do token) — não há campo por onde apontar a
     *  propriedade para outra pessoa.
     *
     *  O workspace nasce VAZIO: sem contas, sem categorias próprias e sem
     *  lançamentos, só com a matrícula `owner` e com a Person do usuário
     *  criada dentro dele. */
    export interface WorkspaceCreateBody {
        Name: string;
    }

    /* ── 4.1 Convites ─────────────────────────────────────────── */

    /** `owner` NÃO se convida: propriedade não se transfere por convite,
     *  e mandá-lo em `Role` responde 406. */
    export type WorkspaceRole = "editor" | "viewer";

    export type WorkspaceInviteStatus = "pending" | "accepted" | "revoked";

    /** Um convite é UMA LINHA no banco, e o que viaja no link é o `Hash`:
     *  32 bytes aleatórios em base64url (43 caracteres). Nunca o
     *  `IdWorkspace`, que é sequencial e se adivinharia contando.
     *
     *  Uso único, vale 7 dias, revogável a qualquer momento. */
    export interface WorkspaceInvite {
        IdWorkspaceInvite: number;
        IdWorkspace: number;
        IdInviterUser: number;
        Email: string;
        Role: WorkspaceRole;
        /** Volta na listagem para o dono conseguir REENVIAR o link sem
         *  precisar revogar e criar outro. */
        Hash: string;
        Status: WorkspaceInviteStatus;
        ExpiresAt: DateTime;
        AcceptedAt: DateTime | null;
        IdAcceptedUser: number | null;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    export interface WorkspaceInviteCreateBody {
        /** Normalizado para minúsculas pela API. */
        Email: string;
        /** Default `editor`. `owner` é 406. */
        Role?: WorkspaceRole;
    }

    /** A resposta do `POST /Workspaces/invite`. A API NÃO manda e-mail:
     *  ela devolve o hash, e quem entrega o link é o usuário. */
    export interface WorkspaceInviteCreated {
        Hash: string;
        ExpiresAt: DateTime;
    }

    /** O que a tela pública de aceite mostra ANTES de qualquer sessão —
     *  quem recebeu o link ainda pode não ter conta.
     *
     *  NENHUM id na resposta, de propósito: a rota não pode virar sonda
     *  para descobrir workspace por id. */
    export interface WorkspaceInvitePreview {
        WorkspaceName: string;
        InviterName: string;
        /** O e-mail convidado. MOSTRE-O: o aceite compara este e-mail com
         *  o da conta, e diferente é 406. */
        Email: string;
        Role: WorkspaceRole;
        ExpiresAt: DateTime;
    }

    /* ── 5-6. Accounts e PaymentMethods ───────────────────────── */

    /** O tipo decide QUAIS FORMAS DE PAGAMENTO nascem com a conta:
     *
     *  | `Type`     | o que é                       | nasce com                    |
     *  |------------|-------------------------------|------------------------------|
     *  | `checking` | conta bancária                | pix + débito                 |
     *  | `cash`     | dinheiro na carteira          | uma `debit` chamada Dinheiro |
     *  | `card`     | vale-alimentação              | uma `debit` com o NOME DA CONTA |
     *
     *  `card` NÃO é "conta de cartão de crédito" — é o oposto disso. É o
     *  vale: saldo próprio, sem conta bancária atrás e SEM FATURA, e o
     *  gasto sai do saldo no ato. Por isso a forma que nasce com ele é
     *  `debit`, e não um `Kind` novo. */
    export type AccountType = "checking" | "cash" | "card";

    /** Não existe conta de tipo cartão de crédito — cartão de crédito é
     *  forma de pagamento, e só existe em conta `checking`. */
    export interface Account {
        IdAccount: number;
        IdWorkspace: number;
        IdUser: number;
        Name: string;
        Type: AccountType;
        IconPath: string | null;
        Color: Color | null;
        InitialBalance: Money;
        InitialBalanceDate: CalendarDate | null;
        /** Calculado a cada leitura, nunca coluna. Pendente NÃO entra. */
        Balance: Money;
        Position: number | null;
        Active: boolean;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
        PaymentMethods: PaymentMethod[];
    }

    export type PaymentMethodKind = "pix" | "debit" | "credit_card";

    export interface PaymentMethod {
        IdPaymentMethod: number;
        IdWorkspace: number;
        IdAccount: number;
        Name: string;
        Kind: PaymentMethodKind;
        /** O dia do mês em que a fatura vence — o dado que o emissor
         *  pede ao cliente. Só faz sentido em credit_card; null nas
         *  outras. */
        DueDay: number | null;
        /** Quantos dias ANTES do vencimento a fatura fecha (1-28, default
         *  7). Não existe um campo com o dia do fechamento: ele é
         *  `DueDay − ClosingOffsetDays` e MUDA de mês para mês —
         *  vencendo dia 5 com folga de 7, a fatura fecha em 26/02 e em
         *  29/03. Ver `src/lib/card.ts`. */
        ClosingOffsetDays: number | null;
        IconPath: string | null;
        Color: Color | null;
        Position: number | null;
        Active: boolean;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /** O mês recorta o `Balance`, NÃO a lista — as contas são as mesmas
     *  em qualquer mês. Omitido, a API devolve o mês corrente. */
    export interface AccountListQuery {
        ReferenceMonth?: ReferenceMonth;
    }

    export interface AccountCreateBody {
        Name: string;
        /** Default `checking`. Ver `AccountType`: ele decide as formas de
         *  pagamento que nascem junto. */
        Type?: AccountType;
        IconPath?: string | null;
        Color?: Color | null;
        /** Negativo é válido (cheque especial). */
        InitialBalance?: Money;
        InitialBalanceDate?: CalendarDate | null;
        Position?: number | null;
    }

    /** PUT é substituição: `Name` vai sempre. Omitido = mantém.
     *
     *  `InitialBalance` E `Type` congelam após o primeiro lançamento
     *  (406, pela mesma pergunta: "esta conta tem movimento?"). Enquanto
     *  a conta está vazia a troca de tipo passa e NÃO refaz as formas de
     *  pagamento — as que nasceram ficam, e renomeá-las é do usuário. */
    export interface AccountUpdateBody extends Partial<AccountCreateBody> {
        Name: string;
    }

    /** POST só aceita cartão de crédito: pix e débito nascem com a conta.
     *
     *  **E só em conta `checking`.** `IdAccount` apontando para uma conta
     *  `cash` ou `card` responde 406: as duas são contas de SALDO
     *  FECHADO — dinheiro na carteira e vale-alimentação — e uma fatura
     *  nelas não teria de onde sair. Ofereça só as `checking` no seletor.
     *
     *  `Brand` e `LastDigits` NÃO EXISTEM MAIS: mandá-los responde 406.
     *  Nenhum dos dois entrava em saldo, fatura, filtro ou relatório, e
     *  o segundo era dado de cartão guardado sem precisar. Quem
     *  identifica o cartão na tela é o `Name`, que o usuário escreve. */
    export interface PaymentMethodCreateBody {
        IdAccount: number;
        Name: string;
        Kind: "credit_card";
        /** O único obrigatório do par: a folga tem default 7 no
         *  servidor, e omiti-la é o caminho certo quando o formulário
         *  não pergunta por ela. */
        DueDay: number;
        ClosingOffsetDays?: number;
        IconPath?: string | null;
        Color?: Color | null;
        Position?: number | null;
    }

    /** `Kind` e `IdAccount` não são aceitos no PUT. Editar o cartão
     *  também NÃO recalcula as compras já lançadas: `ClosingDate` e
     *  `DueDate` são gravadas na perna no lançamento e ninguém as
     *  revisita. */
    export interface PaymentMethodUpdateBody {
        Name: string;
        DueDay?: number;
        ClosingOffsetDays?: number;
        IconPath?: string | null;
        Color?: Color | null;
        Position?: number | null;
    }

    /* ── 7. Categories ────────────────────────────────────────── */

    /** Lista plana, só de gasto. `IdWorkspace: null` = pré-definida do
     *  sistema: aparece em todo workspace e não pode ser editada nem
     *  arquivada (406). Use isso para desabilitar os botões na tela. */
    export interface Category {
        IdCategory: number;
        IdWorkspace: number | null;
        Description: string;
        /** O NOME DO COMPONENTE do ícone no lucide-react — "ShoppingCart",
         *  não um caminho de arquivo. Quem transforma o nome em desenho é
         *  `src/ui/iconCatalog.tsx`; a API só guarda a string. */
        IconKey: string | null;
        Color: Color | null;
        Position: number | null;
        Active: boolean;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    export interface CategoryCreateBody {
        Description: string;
        IconKey?: string | null;
        Color?: Color | null;
        Position?: number | null;
    }

    export interface CategoryUpdateBody extends Partial<CategoryCreateBody> {
        Description: string;
    }

    /* ── 8. Persons ───────────────────────────────────────────── */

    /** Quem recebeu / de quem é o custo. Não precisa ter login. */
    export interface Person {
        IdPerson: number;
        IdWorkspace: number;
        Name: string;
        /** Vínculo de identidade (essa pessoa é um usuário), não autoria. */
        IdUser: number | null;
        Active: boolean;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /* ── 9. Tags ──────────────────────────────────────────────── */

    /** Nasce do texto digitado no gasto — não há POST nem PUT. */
    export interface Tag {
        IdTag: number;
        IdWorkspace: number;
        /** Aqui é autoria (quem usou primeiro) — sentido oposto ao de Person. */
        IdUser: number | null;
        Name: string;
        Color: Color | null;
        Active: boolean;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /* ── 10. Inflows ──────────────────────────────────────────── */

    export type InflowKind = "inflow" | "transfer";
    export type InflowStatus = "pending" | "received" | "canceled";

    export interface InflowPerson {
        IdInflowPerson: number;
        IdWorkspace: number;
        IdInflow: number;
        IdPerson: number;
        Value: Money;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /** Transferência é neutra para o patrimônio: todo total de "quanto
     *  entrou" tem que filtrar `Kind !== "transfer"`. No saldo da conta,
     *  ao contrário, ela conta nos dois lados. */
    export interface Inflow {
        IdInflow: number;
        IdWorkspace: number;
        IdUser: number;
        Description: string;
        TotalValue: Money;
        Status: InflowStatus;
        Kind: InflowKind;
        /** null em `inflow` (veio de fora); obrigatório em `transfer`. */
        IdFromAccount: number | null;
        IdToAccount: number;
        CompetenceDate: CalendarDate;
        ExpectedDate: CalendarDate | null;
        ReceivedAt: DateTime | null;
        Notes: string | null;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /** Só o GET por id traz o rateio. */
    export interface InflowDetail extends Inflow {
        Persons: InflowPerson[];
    }

    export interface InflowListQuery {
        From?: CalendarDate;
        To?: CalendarDate;
        /** Sem `Status`, as canceladas ficam de fora. */
        Status?: InflowStatus;
        Kind?: InflowKind;
    }

    export interface SplitInput {
        IdPerson: number;
        Value: Money;
    }

    export interface InflowCreateBody {
        Description: string;
        /** > 0. Valor negativo é saída, e saída é gasto. */
        TotalValue: Money;
        Kind?: InflowKind;
        IdFromAccount?: number | null;
        IdToAccount: number;
        CompetenceDate: CalendarDate;
        ExpectedDate?: CalendarDate | null;
        Notes?: string | null;
        /** Proibido em `transfer`. Se vier, a soma fecha com TotalValue. */
        Persons?: SplitInput[];
    }

    /** O corpo do `POST /Inflows/batch`.
     *
     *  Cada item é EXATAMENTE o corpo do `POST /Inflows`: o que é 406
     *  sozinho é 406 no lote. Tudo ou nada numa transaction, que é o que
     *  impede a clonagem de deixar o mês pela metade. */
    export interface InflowBatchCreateBody {
        Inflows: InflowCreateBody[];
    }

    /** Não se edita `Kind`, contas nem `Status`. */
    export interface InflowUpdateBody {
        Description: string;
        TotalValue: Money;
        CompetenceDate: CalendarDate;
        ExpectedDate?: CalendarDate | null;
        Notes?: string | null;
        /** Omitir mantém; enviar substitui a lista inteira. */
        Persons?: SplitInput[];
    }

    /* ── 11-12. Expenses e ExpensePayments ────────────────────── */

    export type ExpenseKind = "single" | "installment" | "fixed";
    export type ExpenseStatus = "pending" | "paid" | "canceled";

    /** Eixo financeiro: com qual forma foi pago. Move saldo. */
    export interface ExpensePayment {
        IdExpensePayment: number;
        IdWorkspace: number;
        IdExpense: number;
        IdPaymentMethod: number;
        Value: Money;
        InstallmentNumber: number | null;
        InstallmentTotal: number | null;
        /** Vivem na perna, não no gasto — cada parcela cai numa fatura. */
        ClosingDate: CalendarDate | null;
        DueDate: CalendarDate | null;
        /** A data em que a perna PESA: `DueDate` quando existe, senão a
         *  data do gasto. Congelada no lançamento, e é por ela que o
         *  saldo da conta, o `Spent` do orçamento e
         *  `GET /ExpensePayments` recortam o mês. Não é aceita em corpo
         *  nenhum — o servidor a escreve. */
        CompetenceDate: CalendarDate;
        /** "A cobrança entrou na fatura" — a conferência de assinatura,
         *  afirmada pelo usuário olhando o app do cartão. NÃO move saldo
         *  e não mexe no `Status` do gasto.
         *
         *  `null` FORA do cartão, e é essa nulidade que diz se a linha
         *  tem botão de conferência. Nunca derive de "a data já passou":
         *  a lista é olhada justamente para achar onde a realidade
         *  discordou da previsão. */
        Charged: boolean | null;
        ChargedAt: DateTime | null;
        /** "O dinheiro saiu da conta". Fora do cartão é o `pay` da
         *  perna; no cartão, só o `payInvoice` escreve aqui — marcar uma
         *  compra isolada como paga não tira dinheiro de conta nenhuma,
         *  e era esse duplo sentido que deixava o saldo errado. */
        Paid: boolean;
        PaidAt: DateTime | null;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /** O corpo de `payInvoice`/`unpayInvoice`.
     *
     *  A fatura NÃO é um cadastro, é uma consulta: não há tabela nem id
     *  de fatura. Todas as pernas de um ciclo compartilham o mesmo
     *  `DueDate` exato, então uma fatura é `(IdPaymentMethod, DueDate)`. */
    export interface InvoicePaymentBody {
        DueDate: CalendarDate;
    }

    /** A perna como `GET /ExpensePayments` a devolve: com o gasto de
     *  origem e o rateio DELE.
     *
     *  ⚠️ `Persons` é o rateio do GASTO, não o da perna. Numa compra de
     *  600 em 6×, as SEIS pernas trazem o mesmo rateio de 600 — somar
     *  pessoa a pessoa, perna a perna, dá 3600, e nada estoura: o número
     *  só fica errado. Quem rateia é `spentByPerson`.
     *
     *  A forma de pagamento vem como id, não inteira: ela já chega
     *  completa em `GET /Accounts`, e repeti-la em cada perna repetiria
     *  a mesma linha dezenas de vezes na resposta de um mês. Idem a
     *  pessoa, que sai de `GET /Persons`. E não há tags: quem as mostra
     *  abre o gasto. */
    export interface ExpensePaymentRow extends ExpensePayment {
        Expense: Expense;
        Persons: ExpensePerson[];
    }

    /** A lista do que CAI no período — filtra por `CompetenceDate`, e não
     *  por `ExpenseDate` como `GET /Expenses`. É o que traz a 6ª parcela
     *  de uma compra de março para o total de agosto. */
    export interface ExpensePaymentListQuery {
        From?: CalendarDate;
        To?: CalendarDate;
        /** Segue a regra de `GET /Expenses`: sem ele, as pernas de gasto
         *  cancelado ficam de fora. */
        IncludeCanceled?: boolean;
    }

    /** Eixo analítico: de quem é o custo. NÃO move saldo. */
    export interface ExpensePerson {
        IdExpensePerson: number;
        IdWorkspace: number;
        IdExpense: number;
        IdPerson: number;
        Value: Money;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    export interface Expense {
        IdExpense: number;
        IdWorkspace: number;
        IdUser: number;
        Description: string;
        /** Em parcelado, o total da COMPRA — nunca o da parcela. */
        TotalValue: Money;
        /** Derivado, recalculado a cada quitação. Só vira `paid` quando
         *  TODAS as pernas estão pagas. Nunca envie. */
        Status: ExpenseStatus;
        IdCategory: number;
        ExpenseDate: CalendarDate;
        Kind: ExpenseKind;
        /** `fixed` não é molde + instâncias: toda linha é um gasto real.
         *  A raiz tem null e carrega a recorrência. */
        IdParentExpense: number | null;
        RecurrenceDay: number | null;
        RecurrenceEndDate: CalendarDate | null;
        Notes: string | null;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
    }

    /** Só o GET por id traz os três filhos. */
    export interface ExpenseDetail extends Expense {
        Payments: ExpensePayment[];
        Persons: ExpensePerson[];
        /** A tag inteira, não a linha de vínculo. */
        Tags: Tag[];
    }

    export interface ExpenseListQuery {
        From?: CalendarDate;
        To?: CalendarDate;
        /** Sem `Status`, os cancelados ficam de fora. */
        Status?: ExpenseStatus;
        /** Traz os cancelados JUNTO com o resto, em vez de trocar um
         *  recorte por outro — é o que permite o filtro de status ser
         *  multi-seleção sobre uma lista só. */
        IncludeCanceled?: boolean;
        Kind?: ExpenseKind;
        IdCategory?: number;
    }

    export interface ExpensePaymentInput {
        IdPaymentMethod: number;
        Value: Money;
        /** true é o caso do débito, que já sai pago no ato. */
        Paid?: boolean;
    }

    export interface ExpenseCreateBody {
        Description: string;
        TotalValue: Money;
        IdCategory: number;
        ExpenseDate: CalendarDate;
        Kind?: ExpenseKind;
        Notes?: string | null;
        /** Obrigatório, mínimo 1, soma fecha com o total. */
        Payments: ExpensePaymentInput[];
        /* `Occurrences` NÃO EXISTE no corpo: mandá-lo responde 406.
           Quantas ocorrências um `fixed` gera é decisão do servidor (uma
           janela de 12, contando a raiz), limitada pelo
           `RecurrenceEndDate` quando ele vier antes. O número que
           nasceu volta na resposta do POST. */
        Persons?: SplitInput[];
        /** TEXTO, não id. É o único lugar onde uma tag nasce. */
        Tags?: string[];
        /** Só em `installment` (2-120): obrigatório lá, proibido nos outros. */
        InstallmentTotal?: number;
        /** Só em `fixed`. */
        RecurrenceDay?: number;
        RecurrenceEndDate?: CalendarDate | null;
    }

    /** Não se edita `Kind`, `Status` nem a recorrência. As parcelas de uma
     *  compra parcelada não se editam: cancele e lance de novo. */
    export interface ExpenseUpdateBody {
        Description: string;
        TotalValue: Money;
        IdCategory: number;
        ExpenseDate: CalendarDate;
        Notes?: string | null;
        Payments?: ExpensePaymentInput[];
        Persons?: SplitInput[];
        Tags?: string[];
    }

    /** "Esta e as seguintes". Sem ExpenseDate e sem Payments de propósito. */
    export interface ExpenseSeriesUpdateBody {
        Description: string;
        TotalValue: Money;
        IdCategory: number;
        Notes?: string | null;
        Persons?: SplitInput[];
    }

    /* ── 13-14. Budgets ───────────────────────────────────────── */

    export type BudgetPeriodStatus = "open" | "closed";

    /** O alvo de um teto é uma CATEGORIA ou uma PESSOA, nunca os dois.
     *
     *  | `Scope`    | o que soma                          | eixo               |
     *  |------------|-------------------------------------|--------------------|
     *  | `category` | tudo que caiu naquela categoria     | o gasto inteiro    |
     *  | `person`   | tudo ATRIBUÍDO àquela pessoa        | o eixo ANALÍTICO   |
     *
     *  Um gasto conta nos dois orçamentos, e isso NÃO é dupla contagem —
     *  são duas perguntas diferentes sobre o mesmo dinheiro. O que não se
     *  pode é somar os dois num total. */
    export type BudgetScope = "category" | "person";

    /** O mês congelado. Nunca leia o limite de um mês passado da definição.
     *
     *  O MÊS NASCE SOZINHO: todo dia 1º uma rotina do servidor
     *  materializa o mês novo a partir de cada definição ativa, com o
     *  teto que valia naquele dia, e nunca sobrescreve um mês que já
     *  existe. `POST /Budgets` continua sendo o caminho de orçar AGORA
     *  em vez de esperar a virada — e orçar de novo um alvo que a rotina
     *  já criou responde 406. */
    export interface BudgetPeriod {
        IdBudgetPeriod: number;
        IdWorkspace: number;
        IdBudget: number;
        /** Volta como "YYYY-MM-01" mesmo sendo enviado como "YYYY-MM". */
        ReferenceMonth: CalendarDate;
        LimitValue: Money;
        AlertPercent: number;
        /** Quem escreve este campo é a ROTINA do servidor, não a tela:
         *  todo dia 1º ela carimba `closed` e `ClosedAt` em cada período
         *  do mês que acabou. Ele muda sozinho entre duas leituras — um
         *  período lido como `open` em 31 de agosto volta `closed` em 1º
         *  de setembro, sem nenhuma chamada nossa.
         *
         *  **Fechado NÃO é travado**, e é por isso que a tela não desenha
         *  nada a partir dele: `PUT /BudgetPeriods` de um mês `closed`
         *  continua funcionando, porque corrigir o teto de um mês passado
         *  é exatamente o que a tabela do mês congelado existe para
         *  permitir. Um carimbo de "fechado" em todo mês passado não
         *  informaria nada e sugeriria uma trava que não existe. */
        Status: BudgetPeriodStatus;
        ClosedAt: DateTime | null;
        CreatedAt: DateTime;
        UpdatedAt: DateTime;
        /** Quem decide qual PAR ler. Não deduza o tipo pelo id que veio
         *  nulo: o `Scope` existe exatamente para isso. */
        Scope: BudgetScope;
        /** Preenchidos em `Scope: "category"`, `null` no outro. */
        IdCategory: number | null;
        Category: Category | null;
        /** Preenchidos em `Scope: "person"`, `null` no outro. */
        IdPerson: number | null;
        Person: Person | null;
        /** Soma PERNAS por `CompetenceDate`, e conta pendente junto com
         *  pago — ao contrário do saldo da conta.
         *
         *  Em `Scope: "person"` vale uma quarta regra: o comprometido é
         *  RATEADO pelas parcelas —
         *  `ExpensePersons.Value × ExpensePayments.Value ÷ Expenses.TotalValue`.
         *
         *  PODE VIR NEGATIVO num mês em que os estornos superam as
         *  compras. Não é bug, e a barra de progresso trata o caso. */
        Spent: Money;
    }

    interface BudgetCreateCommon {
        ReferenceMonth: ReferenceMonth;
        /** > 0. Teto zero é não ter teto: apague o mês. */
        LimitValue: Money;
        /** 1-100, default 80. */
        AlertPercent?: number;
    }

    /** `IdCategory` e `IdPerson` são MUTUAMENTE EXCLUSIVOS: mandar os
     *  dois, ou nenhum, é 406. A união expressa isso no tipo, em vez de
     *  dois opcionais que compilariam nas duas formas erradas. */
    export type BudgetCreateBody =
        | (BudgetCreateCommon & { IdCategory: number; IdPerson?: never })
        | (BudgetCreateCommon & { IdPerson: number; IdCategory?: never });

    export interface BudgetPeriodUpdateBody {
        LimitValue: Money;
        AlertPercent?: number;
    }

    /* ── 15. Reports ──────────────────────────────────────────── */

    /** Os dois indicadores do Início, somados no SERVIDOR.
     *
     *  A feature não guarda nada: ela lê das outras e devolve o número.
     *  Existe porque as quatro regras de agregação **se contradizem de
     *  propósito** — a transferência conta no saldo e não conta no
     *  "quanto entrou", o orçamento conta o pendente e o saldo não, o
     *  gasto se soma por perna e não por compra —, e enquanto elas
     *  viviam replicadas no cliente, duas implementações da mesma
     *  pergunta terminavam mostrando dois totais diferentes na mesma
     *  tela. Se um número daqui divergir do da tela dele, é bug da API,
     *  não duas leituras legítimas: não arredonde nada para "fechar".
     *
     *  **`Available` e `CurrentBalance` não são duas versões do mesmo
     *  fato**, e é por isso que a tela mostra os dois lado a lado:
     *
     *  |                | `Available` ("posso gastar")     | `CurrentBalance` ("tenho em conta") |
     *  |----------------|----------------------------------|-------------------------------------|
     *  | Abertura       | `OpeningBalance`                 | nenhuma — o saldo já é acumulado    |
     *  | Base de data   | competência (`CompetenceDate`)   | caixa (`CashDate`)                  |
     *  | Base de estado | pendente **e** pago              | só o realizado                      |
     *  | Entradas       | as pendentes **entram**          | só as recebidas                     |
     *  | Unidade        | a **perna**, nunca o `TotalValue`| a perna paga                        |
     *
     *  ```
     *  Available = OpeningBalance + Inflows − Expenses
     *            + OverdueReceivable − OverduePayable
     *  ```
     *
     *  Só conta `Active` entra no `OpeningBalance` e no
     *  `CurrentBalance` — o mesmo filtro de `GET /Accounts`, senão a
     *  soma do Início discordaria da lista de contas na mesma tela. */
    export interface MonthReport {
        /** Volta como "YYYY-MM-01" — o mês normalizado que a resposta
         *  afirma ter usado. */
        ReferenceMonth: CalendarDate;
        /** O saldo REALIZADO no fim do mês anterior. É o termo que
         *  faltava no cliente, e a ausência dele era erro de verdade:
         *  quem começa setembro com 1000 e recebe 3000 tem 4000, não
         *  3000. */
        OpeningBalance: Money;
        /** Competência no mês, **pendentes junto com recebidas**, sem
         *  transferência. NÃO é "quanto recebi": é competência, não
         *  caixa — e é por isso que o rótulo da tela não diz
         *  "Recebido". */
        Inflows: Money;
        /** Pernas com competência no mês, pendentes **e** pagas. */
        Expenses: Money;
        /** O atrasado, e ele entra no `Available` dos dois lados: uma
         *  perna com competência em julho e ainda pendente não está no
         *  saldo de julho (não foi paga) nem na janela de agosto (a
         *  competência é de julho) — sem isto ela SOME do indicador, e
         *  some justamente o compromisso que ninguém honrou.
         *
         *  O custo está aceito de olhos abertos: uma previsão que nunca
         *  chega infla o `Available` **para sempre**. É por isso que os
         *  dois vão EXPOSTOS na tela, cada um com o caminho de resolver
         *  o que ficou para trás — e não escondidos dentro do total. */
        OverdueReceivable: Money;
        OverduePayable: Money;
        /** "Quanto ainda posso gastar" — o mês que a pessoa está
         *  vivendo. */
        Available: Money;
        /** "Quanto tenho em conta" — o dinheiro que já saiu. */
        CurrentBalance: Money;
        /** O que LIGA os dois: quanto do saldo já tem dono. A soma das
         *  pernas de cartão que vencem até o fim do mês e ainda não
         *  foram pagas.
         *
         *  E a dupla contagem que não existe: `payInvoice` não cria
         *  lançamento, só vira o `Paid` de pernas que já existem — a
         *  compra de agosto contada em agosto não volta a contar em
         *  setembro. */
        OpenInvoices: Money;
    }

    /** Mês, e não `From`/`To` das listagens de movimento: as duas pontas
     *  do cálculo são POSIÇÕES, não recortes. Omitido, a API devolve o
     *  mês corrente. */
    export interface MonthReportQuery {
        ReferenceMonth?: ReferenceMonth;
    }

    /* ── 16. Utils ────────────────────────────────────────────── */

    export type LogType = "info" | "error" | "userError" | "untracked" | "telemetry";

    export interface LogBody {
        Type: LogType;
        Log: {
            msg: string;
            rota?: string;
            methodo?: string;
            user_id?: number;
            stack?: string[];
            data?: unknown;
            errorMessage?: string;
        };
    }
}
