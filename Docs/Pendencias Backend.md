# Pendências do backend

Levantadas ao converter o layout do Claude Design contra o contrato em
[API - Contrato Front-end.md](API%20-%20Contrato%20Front-end.md).

Cada item aqui é algo que **o frontend não consegue resolver sozinho** —
ou porque a informação não existe no cliente, ou porque resolver no
cliente seria contornar uma decisão de segurança do servidor. Onde faz
sentido, proponho a forma do endpoint para poupar uma rodada de conversa.

O que é só decisão de produto (tela X ou Y) não está aqui: está no
[Plano de Desenvolvimento](Plano%20de%20Desenvolvimento.md).

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

Os itens 1 e 2 são de segurança e valem ser tratados antes do MVP ir ao
ar. Do 3 ao 9 são cortes conscientes do MVP — o frontend já está
desenhado para viver sem eles.

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
