# Pendências do backend

Levantadas ao converter o layout do Claude Design contra o contrato em
[API - Contrato Front-end.md](API%20-%20Contrato%20Front-end.md).

Cada item aqui é algo que **o frontend não consegue resolver sozinho** —
ou porque a informação não existe no cliente, ou porque resolver no
cliente seria contornar uma decisão de segurança do servidor. Onde faz
sentido, proponho a forma do endpoint para poupar uma rodada de conversa.

O que é só decisão de produto (tela X ou Y) não está aqui: está no
[Plano de Desenvolvimento](levas/1.%20Plano%20de%20Desenvolvimento.md).

## Prioridade

| # | Pendência | Tipo | Bloqueia |
|---|---|---|---|
| 1 | [Logout](#1-logout) | Segurança | Uso em computador compartilhado |
| 2 | [`IdWorkspace` no cadastro](#2-idworkspace-no-cadastro-aceito-sem-convite) | Segurança | Convite / workspace compartilhado |
| 3 | [Agregados do mês](#3-agregados-do-mês-para-o-dashboard) | Performance | Escala do Dashboard |
| 4 | [Rotina mensal de orçamento](#4-rotina-mensal-de-orçamento) | Produto | Orçamento sem trabalho manual |
| 5 | [Duração de sessão configurável](#5-duração-de-sessão-configurável) | Produto | "Lembrar deste navegador" |
| 6 | [Recuperação de senha](#6-recuperação-de-senha) | Produto | Usuário que esqueceu a senha |
| 7 | [Conciliação de extrato](#7-conciliação-de-extrato) | Produto | Tela 08, frame B |
| 8 | [Exportar para Excel](#8-exportar-para-excel) | Produto | Item fixo da sidebar |
| 9 | [Notificações](#9-notificações) | Produto | "Avisos" do Dashboard |
| 10 | [`Occurrences` fora do `POST /Expenses`](#10-occurrences-fora-do-post-expenses) | Contrato | Gasto fixo — **já aplicado no cliente** |
| 11 | [Clonar o mês anterior de Renda](#11-clonar-o-mês-anterior-de-renda) | Produto | Botão "Clonar mês anterior" |
| 12 | [Lista de gastos com os filhos](#12-lista-de-gastos-com-os-filhos) | Performance | Colunas de destino e forma de pagamento |
| 13 | [`IncludeCanceled` em `GET /Expenses`](#13-includecanceled-em-get-expenses) | Contrato | Filtro de status multi-seleção |
| 14 | [Desfazer recebimento de entrada](#14-desfazer-recebimento-de-entrada) | Produto | Botão de status na linha de Renda |
| 15 | [Criação de entradas em lote](#15-criação-de-entradas-em-lote) | Produto | Clonagem do mês anterior |
| 16 | [Bandeira e final do cartão saem do cadastro](#16-bandeira-e-final-do-cartão-saem-do-cadastro) | Contrato | — (limpeza) |

Os itens 1 e 2 são de segurança e valem ser tratados antes do MVP ir ao
ar. O **10 é o mais urgente depois deles**, e por um motivo diferente: o
cliente já parou de mandar o campo, então contrato e implementação estão
divergindo agora. Os itens 11 e 12 seguram funcionalidade que já está
desenhada na tela. Do 3 ao 9 são cortes conscientes do MVP — o frontend
já está desenhado para viver sem eles.

Os itens **13 a 16 nasceram da leva 3 de ajustes** (ver
[3. Plano de Ajustes 2](levas/3.%20Plano%20de%20Ajustes%202.md)) e cada um
tem tela do lado do cliente esperando por ele. O 15 **substitui a forma**
proposta no 11 — a escolha do que clonar passou a ser do usuário, e o que
falta no servidor mudou junto.

---

## 1. Logout

**O problema.** Não existe rota de logout. O cookie `token` é `HttpOnly`,
então o JavaScript não consegue apagá-lo — é justamente o ponto de ser
`HttpOnly`, e está correto assim.

Hoje o botão "Sair" limpa o cache do cliente e volta para o login, mas a
**sessão no servidor continua viva** até o `Max-Age` de 24h expirar.
Quem clicar em "voltar" no navegador, ou digitar a URL da home, entra de
novo sem credencial nenhuma.

**Por que importa.** Em computador compartilhado — trabalho, casa de
família, lan house — sair não sai. É o item desta lista com consequência
real para o usuário final.

**Por que o frontend não resolve.** Só quem pode invalidar o cookie é
quem o emitiu. Não há caminho no cliente.

**Proposta:**

```
POST /Users/logout        🔒
```

Sem body. Responde `200` e um `Set-Cookie` que sobrescreve o `token` com
`Max-Age=0` (mesmo `Path`, `SameSite` e `Secure` da emissão, senão o
navegador cria um segundo cookie em vez de apagar o primeiro).

```json
{ "msg": "Sessão encerrada com sucesso" }
```

Idempotente: chamar sem sessão também responde `200`, para o botão nunca
travar a saída do usuário.

> Se houver lista de revogação no futuro, é aqui que o `jti` do token
> entraria. Para o MVP, sobrescrever o cookie basta.

---

## 2. `IdWorkspace` no cadastro, aceito sem convite

**O problema.** `POST /Users` aceita um `IdWorkspace` opcional e,
segundo o próprio contrato, "entra direto como matrícula `owner`, sem
convite nem conferência".

Ou seja: quem souber (ou adivinhar) o id de um workspace existente cria
uma conta e entra nele como dono, com acesso a todos os gastos, contas e
saldos da família.

**Estado no frontend.** O campo **não é usado** em lugar nenhum, e o tipo
`SignUpBody` em `src/types/api.ts` carrega um aviso para não usá-lo.
Mas isso não protege ninguém: a rota é pública e qualquer cliente HTTP
chega nela.

**Proposta.** Duas opções, em ordem de preferência:

1. **Remover o campo do schema** enquanto não houver convite. É uma
   linha, e fecha o buraco hoje.
2. Trocar por um **convite assinado**: o dono gera um token curto
   (`POST /Workspaces/invite`), o convidado o apresenta no cadastro,
   e a API valida assinatura e validade antes de criar a matrícula.

Se a opção 2 entrar, o frontend precisa saber: quem pode convidar, qual a
validade do convite, e se a matrícula criada é `owner` ou um papel menor.
Hoje o contrato não descreve papéis.

---

## 3. Agregados do mês para o Dashboard

**O problema.** Nenhum número do Dashboard tem endpoint próprio. Saldo
restante, total recebido, total gasto, fixos do mês e parcelas saem de
`Expenses` + `Inflows` + `Accounts` + `Budgets` somados no cliente.

**Funciona** — está planejado assim para o MVP e não bloqueia nada. O
custo aparece com volume: cada visita ao Dashboard puxa **o mês inteiro**
de gastos e entradas para somar meia dúzia de números. Um casal com 47
lançamentos no mês não sente; um usuário com anos de histórico e várias
telas abertas, sim.

**Risco silencioso.** As regras de contagem se contradizem entre si de
propósito, e hoje elas vivem replicadas no cliente:

| Número | Regra |
|---|---|
| Quanto entrou | filtra `Kind <> 'transfer'` |
| Quanto gastou | soma **pernas**, não `TotalValue` de compra |
| Saldo da conta | **ignora** pendente |
| `Spent` do orçamento | **conta** pendente junto com pago |

Se o mesmo cálculo existir no servidor e no cliente e eles divergirem, o
usuário vê dois totais diferentes para a mesma pergunta.

**Proposta** (quando o volume justificar, não agora):

```
GET /Reports/Month?ReferenceMonth=YYYY-MM        🔒
```

```json
{
    "ReferenceMonth": "2026-05-01",
    "TotalReceived": 8623.10,
    "TotalSpent": 6592.66,
    "FixedSpent": 2213.42,
    "InstallmentSpent": 1349.88,
    "AvailableBalance": 2030.44,
    "ReceivedCount": 5,
    "SpentCount": 47
}
```

Com esse endpoint, as regras acima passam a existir **num lugar só** — o
mesmo lugar que já calcula `Balance` e `Spent`.

---

## 4. Rotina mensal de orçamento

**O problema.** O contrato diz explicitamente que a entrega é reduzida de
propósito: `Budgets` é a definição vigente e `BudgetPeriods` é o mês
congelado, mas **a rotina que materializaria o mês a partir da definição
não existe**. Hoje é o usuário que informa o mês, na mão, todo mês.

**Consequência na tela.** O orçamento de junho simplesmente não existe
até alguém cadastrá-lo. A tela precisa explicar isso, o que é um recado
estranho de dar ao usuário: *"seu teto de alimentação existe, mas não
para este mês"*.

**Por que o frontend não resolve.** Poderia materializar o mês na
primeira visita, mas isso significa o cliente gravando dado por conta
própria a partir de uma visita de leitura — e dois dispositivos abrindo
a tela ao mesmo tempo disputariam a criação.

**Proposta.** Job mensal no servidor que, na virada, cria os
`BudgetPeriods` do mês novo a partir das definições ativas. Alternativa
mais barata: `GET /Budgets` materializar o mês pedido caso ele ainda
não exista, dentro de uma transaction.

---

## 5. Duração de sessão configurável

**O problema.** O layout do login oferece *"Lembrar deste navegador ·
sessão por 30 dias"*. O `Max-Age` do cookie é fixo em 24h.

**Estado no frontend.** O controle não foi implementado — prometer 30
dias e deslogar em 24h é pior que não oferecer.

**Proposta.** `POST /Users/login` aceitar um booleano opcional
(`RememberDevice`) que escolhe entre dois `Max-Age`. A decisão de quais
durações oferecer é de vocês; o frontend só precisa saber o número para
não mentir na tela.

---

## 6. Recuperação de senha

**O problema.** Existe `updatePassword`, que exige a senha antiga. Não
existe caminho para quem esqueceu a senha.

**Estado no frontend.** O link "Esqueci minha senha" está na tela,
desabilitado — faz parte da composição do layout.

**Proposta.** O par usual:

```
POST /Users/forgotPassword     público   { Email }
POST /Users/resetPassword      público   { Token, NewPassword }
```

`forgotPassword` responde `200` mesmo para e-mail inexistente — senão a
rota vira um verificador de quais e-mails têm conta. Depende de envio de
e-mail, que hoje o projeto não tem.

---

## 7. Conciliação de extrato

**O problema.** A tela `08 - Contas` desenha um frame B inteiro de
conciliação: faixa de saldo, itens "a resolver", comparação com extrato.
Não há rota nenhuma para isso.

**O que falta definir antes de qualquer código:** de onde vem o extrato
(upload de arquivo? Open Finance?), o que é um item "a resolver", e se a
conciliação gera lançamento novo ou só marca os existentes. É a maior
das pendências em tamanho, e a menos especificada.

**Estado no frontend.** Fora do MVP. A tela de Contas entrega só o
frame A (visão geral com saldos).

---

## 8. Exportar para Excel

**O problema.** Item fixo da sidebar em todas as telas do layout, sem
rota correspondente.

**Proposta.** Duas formas, e a escolha muda o frontend:

1. **Servidor gera o arquivo** — `GET /Reports/Export?From=&To=`
   devolvendo o `.xlsx`. Prefiro esta: a planilha sai com os mesmos
   números do sistema, e o cliente não reimplementa as regras de
   contagem.
2. **Cliente gera** a partir dos dados que já tem. Mais rápido de
   entregar, mas replica as regras de agregação — o mesmo risco do item 3.

**Estado no frontend.** Botão presente e desabilitado.

---

## 9. Notificações

**O problema.** O Dashboard tem "Avisos" na topbar. O contrato registra
que a tabela `Notifications` existe no banco **sem rota**.

**Proposta.** `GET /Notifications` e um verbo de marcar como lida.
Antes disso, é preciso definir o que gera aviso — parcela vencendo,
orçamento estourado, entrada prevista não recebida.

**Estado no frontend.** Fora do MVP.

---

## 10. `Occurrences` fora do `POST /Expenses`

**O que mudou.** O campo `Occurrences` sai do corpo de criação de gasto.
O contrato ainda o documenta (`só em fixed, 1-60, default 12`), mas ele
**não vai mais ser enviado**.

**Estado no frontend.** Já aplicado, e é por isso que este item está no
topo da lista depois dos dois de segurança: o cliente e o documento estão
divergindo *agora*.

- O campo saiu do formulário de gasto e do rascunho (`ExpenseDraft`).
- Saiu de `ExpenseCreateBody` em `src/types/api.ts`.
- Saiu do corpo do `POST` em
  `src/pages/AddExpense/sections/submitExpense.ts`, com teste que prova
  que a chave não é enviada.
- A validação "de 1 a 60" foi removida junto — não havia mais o que
  validar.

**O que o backend precisa decidir e responder:**

1. **Remover `Occurrences` do schema do `POST`.** Enquanto ele for
   opcional e ignorado, nada quebra; se virar `forbidden` no Joi, também
   não — o cliente não o manda. O que **não** pode acontecer é ele virar
   obrigatório.
2. **O que limita a série agora.** A leitura do frontend é que
   `RecurrenceEndDate` passa a ser o único freio: sem ela, a recorrência
   é aberta. Se a regra for outra (um teto fixo no servidor, por
   exemplo), a tela precisa saber o número para dizê-lo ao usuário antes
   de salvar.
3. **`Occurrences` na resposta.** Hoje o `POST` devolve
   `{ IdExpense, Occurrences }`, e a tela usa esse número para dizer
   quantas ocorrências nasceram. O cliente já trata a **ausência** dele
   (assume 1), então mantê-lo ou removê-lo é decisão de vocês — só não
   deixe de ser número quando vier.

> Enquanto o documento de contrato não for atualizado, ele e o cliente
> discordam neste ponto. A fonte da verdade é este item.

---

## 11. Clonar o mês anterior de Renda

**O problema.** Não existe entrada recorrente no contrato: salário,
aluguel recebido e benefício são lançamentos avulsos que se repetem todo
mês. Sem um caminho de repetição, o usuário redigita os mesmos cinco
lançamentos toda virada de mês — e o layout de Renda desenha exatamente
esse atalho ("Clonar mês anterior", e a sugestão "Trazer 3 entradas
recorrentes de abril").

> **Esta pendência mudou de forma na leva 3.** A decisão de produto
> passou a ser que **o usuário escolhe o que clonar** — o layout de Renda
> desenha essa lista com caixinhas, e clonar o mês inteiro às cegas
> deixava de fora justamente o caso comum (o salário mudou de valor, o
> freela de abril não se repete). Com a escolha no cliente, o servidor
> não tem como montar a cópia sozinho: o que falta dele é gravar as
> entradas escolhidas **de uma vez só**, que é o item
> [15](#15-criação-de-entradas-em-lote).
>
> O `POST /Inflows/clone` descrito abaixo **não é mais o pedido**. O
> texto fica como registro da necessidade de produto e das regras de
> cópia (que o cliente agora aplica), não como especificação de rota.

**Por que o cliente não faz sozinho até o fim.** Listar o mês anterior,
pedir um `get(id)` por linha (o rateio só existe lá) e montar as cópias:
tudo isso o cliente faz. O que ele não resolve é a **gravação**:

- **Não é atômico.** Cinco entradas, a terceira recusada: o mês fica pela
  metade e não há como voltar atrás. É o que o item 15 resolve.
- **Não é idempotente.** Dois cliques, ou duas abas, duplicam o mês
  inteiro. Com a escolha explícita do usuário isso vira risco de duplo
  clique, e não de repetição silenciosa — o cliente desabilita o botão
  enquanto grava.
- **É N+1 requisições** na gravação. Com o lote, é uma.

**Proposta original (superada pelo item 15):**

```
POST /Inflows/clone        🔒
```

```json
{ "FromMonth": "2026-07", "ToMonth": "2026-08" }
```

Regras que o frontend assume (confirmem ou corrijam):

- Copia só `Kind = 'inflow'` e `Status <> 'canceled'`. **Transferência
  fica de fora**: ela é movimento entre contas, não renda que se repete,
  e clonar uma criaria uma mudança de bolso que nunca aconteceu.
- `CompetenceDate` e `ExpectedDate` avançam um mês, **aparando o dia no
  mês curto** — 31/01 vira 28/02, nunca 03/03.
- O rateio (`Persons`) vai junto, com os mesmos valores.
- As cópias nascem `pending`. Nenhum saldo se move até o `receive` de
  cada uma — é isso que faz a operação ser segura de repetir.
- **Idempotente por mês de destino:** uma entrada já clonada não é
  clonada de novo. Se o vínculo exigir coluna nova
  (`IdSourceInflow`), ela resolve o problema de vez; sem ela, casar por
  (descrição, valor, conta) já evita o pior.

**Resposta:**

```json
{ "msg": "3 entradas trazidas de julho", "Created": 3, "Skipped": 0 }
```

`Created` é o que a tela mostra ao usuário; `Skipped` é o que explica
"cliquei e não aconteceu nada" quando o mês já tinha sido clonado.

**Estado no frontend.** O fluxo de escolha é implementado por inteiro
(lista do mês anterior, seleção, avanço das datas, montagem das cópias);
o que espera rota é só o `POST` final — ver item 15.

---

## 12. Lista de gastos com os filhos

**O problema.** `GET /Expenses` não traz `Payments`, `Persons` nem
`Tags` — só o `get(id)` traz. Mas a tela de Gastos mostra **destino
(pessoa)** e **forma de pagamento** em cada linha, e o Início desenha os
dois breakdowns correspondentes. Os dois dados só existem no detalhe.

**Consequência hoje.** Abrir a lista do mês dispara **uma requisição por
gasto** (`useMonthExpenseDetails` em `src/data/month.ts`). Num mês com 47
lançamentos, são 47 chamadas para preencher duas colunas. O frontend as
guarda sob a mesma chave de cache que o slide-over de detalhe usa, então
abrir um gasto depois é instantâneo e trocar de tela reaproveita tudo —
mas o primeiro carregamento paga o preço inteiro.

**Um segundo furo, do mesmo tronco.** A lista filtra por `ExpenseDate`,
então uma compra de 6× feita em março **não aparece** na lista de agosto
— e a 6ª parcela dela pesa em agosto. O cliente compensa varrendo 24
meses para trás atrás de parcelados
(`INSTALLMENT_LOOKBACK_MONTHS` em `src/data/month.ts`), com um `get(id)`
por compra encontrada. O contrato permite 120 parcelas: **acima da
janela, a parcela some do total do mês.** É a única lacuna do MVP em que
o número na tela fica *errado*, e não só ausente.

**Proposta.** Qualquer uma das duas resolve; a segunda resolve as duas
coisas de uma vez.

1. **Filhos sob demanda na lista:**

   ```
   GET /Expenses?Include=Payments,Persons,Tags        🔒
   ```

   Mesma resposta de hoje, com os filhos embutidos quando pedidos. Mata
   o N+1 das colunas. **Não** resolve a janela de parcelados.

2. **Pernas de um período** (preferida):

   ```
   GET /ExpensePayments?From=YYYY-MM-DD&To=YYYY-MM-DD        🔒
   ```

   Devolve as pernas cuja `coalesce(DueDate, ExpenseDate)` cai no
   intervalo, cada uma com o gasto de origem, o rateio e a forma. É
   exatamente a unidade que todo total do sistema já usa — "600 em 6×
   custa 100 ao mês" —, mata o N+1 **e** dispensa a janela de 24 meses.

Relacionado ao item [3](#3-agregados-do-mês-para-o-dashboard): se os
agregados do mês vierem do servidor, esta rota é a que sobra para as
telas de lista, que precisam da linha e não só do total.

---

## 13. `IncludeCanceled` em `GET /Expenses`

**O problema.** Hoje a **ausência** do `Status` carrega significado: sem
ele a resposta vem sem os cancelados, e `Status=canceled` traz *só* os
cancelados. Não existe forma de pedir "em aberto **e** cancelados" numa
requisição — e a tela de Gastos passou a ter filtro de status de
**multi-seleção**, onde essa combinação é um clique normal do usuário.

**Por que o frontend não resolve.** Resolveria, e mal: disparando as
duas consultas e fundindo por id. Isso dobra a requisição do mês, cria
uma segunda chave de cache por mês e coloca no cliente uma regra de
"o que a lista contém" que é do servidor.

**Proposta.** Um booleano que **tira o significado especial da
ausência**:

```
GET /Expenses?From=&To=&IncludeCanceled=true        🔒
```

- `IncludeCanceled` ausente ou `false` → **exatamente a resposta de
  hoje** (cancelados fora). Nada que já existe quebra.
- `IncludeCanceled=true` → a lista vem completa, cancelados incluídos, e
  o cliente separa por `Status` no próprio cliente.

**Por que um booleano e não `Status` aceitando lista.** As duas formas
resolvem o filtro. A diferença é o que sobra no cliente: com o booleano,
o app pede **o mês uma vez** e aplica os cinco filtros (status, formato,
categoria, pessoa, forma) sobre a lista que já está em cache — uma chave
de cache por mês, reaproveitada entre Início, Gastos e Relatório, que é
como `src/data/month.ts` já está desenhado. Com `Status` em lista, cada
combinação de filtro vira uma consulta e uma chave nova, e o
reaproveitamento entre telas morre.

> Se um dia `Status` passar a aceitar lista por outro motivo, tudo bem —
> mas então **defina o formato na query** (`Status=pending&Status=paid`,
> sem colchetes) para o cliente e o servidor não discordarem em silêncio.

**Estado no frontend.** O filtro multi-seleção é implementado assumindo
esta rota: o cliente para de mandar `Status` e passa a mandar
`IncludeCanceled=true`. Até subir, marcar "Cancelados" simplesmente não
traz nada — a lista continua vindo sem eles.

---

## 14. Desfazer recebimento de entrada

**O problema.** Existe `POST /Inflows/IdInflow=:IdInflow/receive`, que é
o que põe o dinheiro no saldo. **Não existe o inverso.** Um clique errado
em "Recebido" credita a conta e não há caminho de volta pela tela.

Isso já era desconfortável quando receber era uma ação dentro do painel
de detalhe. Na leva 3 a tela de Renda ganhou **botão de status direto na
linha** — o mesmo gesto que a lista de Gastos tem para quitar parcela —,
e lá o par existe: `pay` e `unpay`. Aqui falta a metade de trás.

**Por que o frontend não resolve.** É a rota que move saldo. O cliente
não tem como estornar.

**Proposta.** O espelho exato do `receive`, e o irmão do `unpay` que já
existe em `/ExpensePayments`:

```
POST /Inflows/IdInflow=:IdInflow/unreceive        🔒
```

Sem body. Volta o `Status` para `pending` e **retira do saldo da conta**
o que o `receive` creditou, na mesma transaction. `406` quando a entrada
já está `pending`, quando está cancelada, ou quando o id não existe no
workspace — com `msg` pronta, como o resto do contrato.

**Estado no frontend.** O botão está implementado **e habilitado nos dois
sentidos**. Enquanto a rota não subir, desfazer mostra a mensagem de erro
da API, como qualquer 406 — decisão consciente: esconder o caminho
ensinaria o usuário que ele não existe.

---

## 15. Criação de entradas em lote

**O problema.** A clonagem do mês (item 11) passou a ser assim: o cliente
lista o mês anterior, o usuário marca o que quer trazer, o cliente avança
as datas e monta as cópias. Falta gravar — e gravar uma por uma significa
mês pela metade quando a terceira das cinco é recusada.

**Por que o frontend não resolve.** Atomicidade é do banco. Não há como
desfazer as duas primeiras do cliente depois que a terceira falhou.

**Proposta.**

```
POST /Inflows/batch        🔒
```

```json
{
  "Inflows": [
    { "Description": "Salário", "TotalValue": 6200, "Kind": "inflow",
      "IdToAccount": 3, "CompetenceDate": "2026-09-05",
      "ExpectedDate": "2026-09-05",
      "Persons": [{ "IdPerson": 1, "Value": 6200 }] }
  ]
}
```

Regras que o frontend assume (confirmem ou corrijam):

- Cada item é **o mesmo corpo do `POST /Inflows`**, validado igual. Nada
  de schema paralelo: o que é 406 sozinho é 406 no lote.
- **Tudo ou nada**, numa transaction. Um item recusado derruba o lote
  inteiro, e a `msg` diz **qual** item e por quê (índice na lista já
  basta).
- Todas nascem `pending`, como no `POST` avulso. Nenhum saldo se move até
  o `receive` de cada uma — é isso que faz a operação ser segura de
  repetir.
- Um **teto de itens** (sugestão: 100) para a rota não virar vetor de
  carga. Um mês de renda tem cinco a dez entradas.

**Resposta:**

```json
{ "msg": "3 entradas criadas", "IdInflows": [41, 42, 43] }
```

Os ids voltam para o cliente invalidar o cache do mês certo sem
readivinhar.

**Sobre idempotência.** Ela deixou de ser problema do servidor: quem
escolhe o que copiar é o usuário, item a item, então não há repetição
silenciosa a evitar — só duplo clique, e o cliente desabilita o botão
enquanto grava. Se um dia quiserem a trava no servidor, ela é a mesma do
item 11 (casar por descrição, valor, conta e mês de competência).

**Estado no frontend.** `InflowsConnection.createBatch` implementado, o
fluxo de escolha inteiro de pé, esperando a rota.

---

## 16. Bandeira e final do cartão saem do cadastro

**O problema.** `PaymentMethod` tem `Brand` e `LastDigits`, e o
formulário de cartão os pedia. Nenhum dos dois é usado em regra nenhuma
do sistema — não entram em saldo, fatura, filtro ou relatório. São
decoração num formulário que o usuário preenche uma vez por cartão, e
`LastDigits` ainda é dado de cartão guardado sem precisar ser.

**Decisão.** Saem do MVP. **Sem compatibilidade com legado**: o cliente
para de enviar e de exibir, e o banco é ajustado junto — sem leitura
defensiva e sem mapa de campo antigo.

**O que o backend precisa fazer:**

1. **Remover `Brand` e `LastDigits`** do schema de `POST /PaymentMethods`
   e `PUT /PaymentMethods/IdPaymentMethod=:id`, e as colunas da tabela.
2. **Tirar os dois da resposta** de `GET /Accounts` (onde a forma vem
   embutida). Enquanto vierem, o cliente ignora — o que **não** pode
   acontecer é virarem obrigatórios.

**Estado no frontend.** Removidos do formulário, da linha que os exibia e
dos tipos em `src/types/api.ts` — dos dois corpos
(`PaymentMethodCreateBody` / `PaymentMethodUpdateBody`) **e também de
`PaymentMethod`**, o tipo de leitura: enquanto a resposta ainda os
trouxer, eles são campo extra que o cliente nem declara. Como no item 10, cliente e contrato divergem até o
documento ser atualizado — a fonte da verdade é este item.

---

## Coisas que estão certas e não são pendência

Para o backend não "corrigir" o que foi decidido de propósito:

- **`406` em vez de `404`** para linha inexistente em rota de tenant. Um
  `404` confirmaria que a linha existe em outro workspace. Mantenham.
- **Mesma `msg` para e-mail inexistente e senha errada** no login.
  Mantenham.
- **`Status` derivado** em `Expenses`, nunca aceito do cliente. O
  frontend não envia.
- **Tag sem `POST` e sem `PUT`.** Nasce do texto do gasto; renomear
  mudaria a etiqueta de todos os gastos já marcados.
- **`InitialBalance` que congela** após o primeiro lançamento. O frontend
  desabilita o campo nesse caso.
- **Ausência de `GET` em `PaymentMethods`.** Vem embutido em `Accounts` e
  isso é suficiente.
