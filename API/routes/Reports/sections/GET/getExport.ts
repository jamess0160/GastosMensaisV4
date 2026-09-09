import ExcelJS from "exceljs"
import { Response } from "express"
import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Utils } from "root/Utils/Utils"
import { ExportRows } from "../ExportRows.section"
import { ReportsNamespace } from "../types"

//  **A primeira rota do projeto que não responde JSON.**
//
//  O `AsyncHandler` continua o mesmo — auth, erro, log —, mas não há `validateResponse` a
//  aplicar: a resposta é um arquivo com `Content-Type` e `Content-Disposition`, e o Joi não
//  descreve bytes. É por isso que esta section recebe o `res`, ao contrário de todas as outras,
//  que devolvem objeto e deixam o controller responder.
//
//  **O servidor é que gera o arquivo**, e não o cliente. A planilha sai com os mesmos números
//  da tela porque lê do mesmo lugar; a alternativa (o cliente montar a partir do JSON) replica
//  as regras de agregação e cai exatamente no risco que criou a feature de Reports.
//
//  **A biblioteca é o `exceljs`.** O V3 usava `json-as-xlsx`, que é um invólucro de navegador
//  sobre o SheetJS: a API dele é "monta e baixa o arquivo", o `xlsx` do npm está parado numa
//  versão com CVE conhecido, e as fórmulas do resumo só saíam de lá com um pós-processamento à
//  mão sobre o workbook. Aqui o arquivo é escrito **direto no `res`**, sem passar inteiro pela
//  memória do processo, e a fórmula é um valor de célula.
export class GetExport {

    //  Formato de dinheiro do arquivo. O que a planilha guarda é número — o R$ é máscara, e é
    //  isso que deixa o usuário somar a coluna dentro do Excel.
    private readonly money = 'R$ #,##0.00'

    public async run(SelectedIdWorkspace: number, IdUser: number, res: Response, filters: { From?: string, To?: string }) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let [inflows, payments] = await Promise.all([
            ExportRows.getInflows(IdWorkspace, filters.From, filters.To),
            ExportRows.getPayments(IdWorkspace, filters.From, filters.To),
        ])

        let workbook = new ExcelJS.Workbook()

        workbook.creator = "Gastos Mensais"
        workbook.created = new Date()

        //  As três abas nascem nesta ordem porque é a ordem em que o Excel as mostra, e o
        //  resumo é a primeira coisa que se quer ver. Ele só é **preenchido** no fim: as
        //  fórmulas dele precisam saber quantas linhas as outras duas tiveram.
        let summary = workbook.addWorksheet("Resumo")
        let inflowSheet = workbook.addWorksheet("Entradas")
        let expenseSheet = workbook.addWorksheet("Gastos")

        this.fillInflows(inflowSheet, inflows)
        this.fillPayments(expenseSheet, payments)
        this.fillSummary(summary, inflows.length, payments.length)

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", `attachment; filename="${this.fileName(filters)}"`)

        await workbook.xlsx.write(res)

        res.end()
    }

    /**
     * **O resumo é fórmula, não número congelado.**
     *
     * Se ele viesse somado do servidor, apagar uma linha da aba de gastos dentro do Excel
     * deixaria o total mentindo — e a planilha existe justamente para ser mexida. Com
     * `SUM(Gastos!K:K)` o arquivo continua certo depois de o usuário filtrar, apagar ou colar
     * linha, que é o que qualquer um faz com uma exportação.
     */
    private fillSummary(sheet: ExcelJS.Worksheet, inflowRows: number, paymentRows: number) {
        //  Largura direto na coluna, e **não** via `sheet.columns` com `header`: o exceljs
        //  materializa uma linha de cabeçalho quando as colunas têm header, e um cabeçalho
        //  vazio aqui empurraria tudo uma linha para baixo — junto com as referências das
        //  fórmulas, que apontariam para células em branco.
        sheet.getColumn(1).width = 24
        sheet.getColumn(2).width = 18

        //  +1 porque a linha 1 de cada aba é o cabeçalho. Com zero linhas o range fica vazio
        //  (2:1) e o SUM devolve 0, que é a resposta certa para um período sem lançamento.
        let rows: Array<[string, ExcelJS.CellValue]> = [
            ["Total de entradas", { formula: `SUM(Entradas!G2:G${inflowRows + 1})`, date1904: false }],
            ["Total de gastos", { formula: `SUM(Gastos!K2:K${paymentRows + 1})`, date1904: false }],
            ["Resultado", { formula: "B1-B2", date1904: false }],
        ]

        for (let [label, value] of rows) {
            let row = sheet.addRow([label, value])

            row.getCell(1).font = { bold: true }
            row.getCell(2).numFmt = this.money
        }
    }

    private fillInflows(sheet: ExcelJS.Worksheet, inflows: ReportsNamespace.ExportInflowRow[]) {
        sheet.columns = [
            { header: "Competência", key: "CompetenceDate", width: 14 },
            { header: "Descrição", key: "Description", width: 40 },
            { header: "Tipo", key: "Kind", width: 16 },
            { header: "Conta de origem", key: "FromAccountName", width: 22 },
            { header: "Conta de destino", key: "ToAccountName", width: 22 },
            { header: "Situação", key: "Status", width: 14 },
            { header: "Valor", key: "TotalValue", width: 14 },
        ]

        this.header(sheet)

        for (let inflow of inflows) {
            let row = sheet.addRow({
                CompetenceDate: this.date(inflow.CompetenceDate),
                Description: inflow.Description,
                Kind: inflow.Kind === "transfer" ? "Transferência" : "Entrada",
                FromAccountName: inflow.FromAccountName ?? "",
                ToAccountName: inflow.ToAccountName ?? "",
                Status: inflow.Status === "received" ? "Recebida" : "Pendente",
                TotalValue: Number(inflow.TotalValue),
            })

            row.getCell("TotalValue").numFmt = this.money
        }
    }

    private fillPayments(sheet: ExcelJS.Worksheet, payments: ReportsNamespace.ExportPaymentRow[]) {
        sheet.columns = [
            { header: "Competência", key: "CompetenceDate", width: 14 },
            { header: "Data da compra", key: "ExpenseDate", width: 16 },
            { header: "Saída do caixa", key: "CashDate", width: 16 },
            { header: "Descrição", key: "Description", width: 40 },
            { header: "Categoria", key: "CategoryName", width: 22 },
            { header: "Conta", key: "AccountName", width: 22 },
            { header: "Forma de pagamento", key: "PaymentMethodName", width: 22 },
            { header: "Parcela", key: "Installment", width: 10 },
            { header: "Situação do gasto", key: "ExpenseStatus", width: 18 },
            { header: "Pago", key: "Paid", width: 10 },
            { header: "Valor", key: "Value", width: 14 },
        ]

        this.header(sheet)

        for (let payment of payments) {
            let row = sheet.addRow({
                //  As três datas da perna saem juntas de propósito: elas divergem, e é aqui
                //  que a divergência fica visível para quem conferir a planilha à mão.
                CompetenceDate: this.date(payment.CompetenceDate),
                ExpenseDate: this.date(payment.ExpenseDate),
                CashDate: this.date(payment.CashDate),
                Description: payment.Description,
                CategoryName: payment.CategoryName ?? "",
                AccountName: payment.AccountName,
                PaymentMethodName: payment.PaymentMethodName,
                Installment: payment.InstallmentTotal ? `${payment.InstallmentNumber}/${payment.InstallmentTotal}` : "",
                ExpenseStatus: payment.ExpenseStatus === "paid" ? "Pago" : "Pendente",
                Paid: payment.Paid ? "Sim" : "Não",
                Value: Number(payment.Value),
            })

            row.getCell("Value").numFmt = this.money
        }
    }

    private header(sheet: ExcelJS.Worksheet) {
        sheet.getRow(1).font = { bold: true }
        sheet.views = [{ state: "frozen", ySplit: 1 }]
    }

    /**
     * **A data vai como texto dd/MM/yyyy, e não como data do Excel.**
     *
     * As colunas `date` do Postgres são dias de calendário, não instantes — o projeto inteiro
     * as trata como string por isso (ver `Utils/joiSchemas.ts`). Virar `Date` para o exceljs
     * serializar reintroduziria exatamente o fuso que os `pgTypeParsers` existem para tirar: em
     * UTC-3, meia-noite do dia 01 é o dia 31 do mês anterior, e a planilha sairia com todo
     * lançamento um dia atrás.
     *
     * O custo é que o Excel não ordena a coluna como data. É o lado certo do erro: uma data
     * errada é pior do que uma ordenação manual.
     */
    private date(value: string) {
        return Utils.toBrazilianDate(value)
    }

    //  O nome do arquivo carrega o período, porque a segunda exportação vai para a mesma pasta
    //  da primeira. Sem acento e sem barra: `Content-Disposition` é cabeçalho HTTP.
    private fileName(filters: { From?: string, To?: string }) {
        let period = [filters.From, filters.To].filter(Boolean).join(" a ") || "completo"

        return `Gastos Mensais - ${period}.xlsx`
    }
}
