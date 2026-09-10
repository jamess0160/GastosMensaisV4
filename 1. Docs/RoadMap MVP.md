# Roadmap — Gastos Mensais V4

**Este é o documento único do projeto.** Ele responde três perguntas, e só elas:

1. **o que existe em código hoje**, dos dois lados;
2. **o que falta para o MVP entrar em produção**, na ordem em que deve ser feito;
3. **o que foi deliberadamente deixado de fora**, e por quê — para nada ser procurado numa
   leva onde não está.

O **desenho** de cada trabalho não mora aqui: mora em [Levas/](Levas/), um arquivo por leva. E
tudo que descrevia o projeto quando ele era **dois repositórios** está congelado em
[Old/](Old/), que continua versionado pelo porquê das decisões, não pelo estado que descreve.

> **09/09/2026 — os dois repositórios viraram um.** `API/` e `Frontend/` são agora duas pastas
> do mesmo repositório, com um histórico só. Isso matou dois documentos de uma vez: o
> **contrato Front-end**, que existia para o front enxergar uma API que ele não podia ler, e o
> **Pendencias Backend**, que era a fila de pedidos de um repositório para o outro. Os dois
> estão em [Old/](Old/). Daqui pra frente, uma pendência do front contra a API é **uma etapa
> de leva**, escrita no mesmo plano que a etapa do front que a consome.

---

## Onde estamos

### API — três levas, todas fechadas

O esquema está **completo**: as 23 tabelas existem em `API/migrations/` (as 22 de domínio mais
`RotineRuns`), e todas as de domínio têm código em cima.

| Leva | O que entregou | Estado |
| --- | --- | --- |
| **1 — MVP** | Contas e formas de pagamento, categorias, pessoas e tags, entradas e transferências, gasto simples, parcelamento, gasto fixo, orçamento | **fechada**, 8 de 10 etapas — a rotina mensal foi para a leva 3, e a gestão de membros continua aberta |
| **2 — o que sobe junto** | Logout, convite de workspace, pernas do período, conta "só cartão", orçamento por pessoa, `CompetenceDate`, estorno | **fechada**, 11 de 11 |
| **3 — infra e decisão** | Motor de rotinas, rotina mensal do orçamento, infra de e-mail, recuperação de senha, confirmação de e-mail, sessão configurável, `CompetenceMode`, agregados do mês, extrato, exportação `.xlsx` | **fechada**, 10 de 10 |

Etapa por etapa, com commit e data: [Old/API/Levas executadas.md](Old/API/Levas%20executadas.md).

**Fora de leva, depois disso:** dois fixes do `Available` em 08/09 (`6cdf0e6`, `037890b`) e, em
09/09, o `GET /Workspaces/self` passando a dizer **qual** espaço está selecionado (`7c0f11b`) —
que fecha a última pendência que o front tinha contra a API.

**16 suítes de integração**, sem um único teste unitário e sem nada mockado. A última contagem
registrada é **654 testes**, no fim da leva 3.

### Front — cinco levas, todas fechadas

**16 telas**, todas respondendo em 390px, todas ligadas na API de verdade.

| Leva | O que entregou | Estado |
| --- | --- | --- |
| **1 — Plano de desenvolvimento** | Do zero ao MVP do cliente: chassi, sessão, cadastros, lançamento, listas, dashboard, relatório | **fechada** |
| **2 — Ajustes** | A lista crua de correções de layout e de conteúdo das telas | **fechada** |
| **3 — Ajustes** | Mês compartilhado entre telas, navegação mobile, e a reescrita de Gastos, Renda e Contas | **fechada** |
| **4 — As mudanças de contrato de setembro** | Cartão por vencimento + folga, saldo do mês, fatura, estorno, orçamento por pessoa, logout, seletor de espaço e convites | **fechada**, 10 de 10 |
| **5 — Os números saem do cliente, e as telas que faltavam** | Orçamento que nasce sozinho, `GET /Reports/Month`, `CompetenceMode`, extrato, exportação `.xlsx`, sessão de 30 dias, recuperação de senha, confirmação de e-mail | **fechada**, 8 de 8 |

Plano da leva 5: [Old/Front/levas/5. Plano de Ajustes 5.md](Old/Front/levas/5.%20Plano%20de%20Ajustes%205.md).

### Leva 6 — a primeira unificada, fechada em 09/09

**18 de 18 etapas**, num plano só com os dois lados na mesma fila:
[Levas/6. O cartão, o uso real e a gestão de membros](Levas/6.%20O%20cartão,%20o%20uso%20real%20e%20a%20gestão%20de%20membros.md).
Ela entregou os três blocos que abriam a fila abaixo — o cartão em modo `purchase` (a fatura
que não montava, a compra no dia do fechamento, o `Charged`, o ciclo no extrato), as treze
anotações do uso real, e a gestão de membros inteira: listar, trocar papel, remover, sair e
transferir a propriedade.

As cinco etapas que faltavam foram fechadas em 09/09, em cinco commits: `Fase #5 | Etapa 4` a
`Etapa 8`. Com elas saíram do produto os **três botões rotulados "ainda sem API"** — o de
conciliar extrato virou **"Extrato"** (a rota não concilia nada, e o nome tinha que dizer
isso), o de exportar passou a baixar o `.xlsx` do servidor, e "Esqueci minha senha" virou
navegação de verdade. Nasceram quatro telas: `contas/extrato`, `/esqueci-senha`,
`/recuperar-senha` e `/confirmar-email`.

---

## A fila até o MVP

**A lacuna do cliente acabou.** Toda rota que a leva 5 consumia já existia com teste desde
07/09, e foi a junção dos repositórios ter pegado a leva no meio que a deixou aberta. O que
sobra na fila não é dívida de um lado contra o outro: é trabalho que nunca entrou em leva
nenhuma, dos dois.

> **Esta fila diz o que falta, não o que cada leva faz.** Quem decide o recorte de uma leva é o
> plano dela, em [Levas/](Levas/) — um item daqui pode virar uma etapa, várias, ou atravessar
> duas levas. Amarrar item e leva neste documento foi o que fez uma leva ser definida por fora
> antes de existir.

### 1. O fechamento do cartão guardado como dia do mês

**Leva própria.** A etapa 2 da leva 6
reproduziu "a compra no dia do fechamento" e o defeito não é a comparação, que está certa: quem
erra é o modelo que descreve o cartão. Hoje o fechamento é o vencimento menos uma folga em
**dias corridos**, e o emissor brasileiro fecha num **dia fixo do mês** — as duas descrições não
são a mesma coisa. Com o cartão real que motivou a etapa (fecha 27, vence 04), quem cadastra
lendo a fatura de agosto grava `ClosingOffsetDays = 8`, porque 27/08 a 04/09 são 8 dias; em
setembro são 7, o fechamento derivado cai no dia **26**, e a compra de **27/09 é cobrada na
fatura de 04/11** em vez da de 04/10. Um dia de erro na descrição é um mês de erro no caixa, e
isso vale para todo cartão cuja folga atravessa a virada do mês. Trocar o modelo é migration,
recálculo de perna já gravada e reescrita do `InvoiceDates` — por isso é leva, não etapa. Até
lá, a tela do cartão mostra as duas datas do ciclo do mês corrente e avisa quando o fechamento
derivado anda de mês para mês, em vez de aceitar a folga em silêncio — o que a leva 6 entregou.

### 2. Compliance: o cadastro promete o que não entrega

A tela de criar conta exige o aceite de **dois documentos que não existem**, e o rodapé das
telas públicas tem "Termos" e "Privacidade" como texto solto, sem link. O aceite morre no
navegador: `POST /Users` não recebe campo nenhum sobre isso e não há coluna onde gravar, então
**não existe registro de que alguém aceitou alguma coisa** — e um `curl` cria conta sem aceitar
nada, porque o Joi não exige o que não existe.

Falta a outra metade também: **não há como apagar a conta**. `DELETE /Users` não existe, e a
foreign key `Workspaces.IdOwnerUser` é `CASCADE` — um delete sem guarda levaria junto o espaço
compartilhado de outra pessoa.

**Os dois documentos nascem de MVP, e é uma decisão, não um atalho.** Este lançamento é para
conhecidos testarem, de graça: o controlador é pessoa física, não há cobrança, não há
processador de pagamento e não há assinatura para cancelar. **Quando entrar a cobrança, os dois
textos são revisados** — ver a linha de `Plans`/`Subscriptions` abaixo.

### 3. Produção: o código

Nada aqui é código de feature. É o que hoje funciona na máquina de desenvolvimento e muda de
comportamento — ou de superfície de ataque — no momento em que a mesma linha roda atrás de um
proxy, num container, com gente de fora batendo na porta:

- **Rate limiting, que não existe em lugar nenhum do projeto.** A primeira rota que dói é a
  pública que manda e-mail (`forgotPassword`). Hoje há **dois freios parciais e nenhum deles é
  rate limiting**: o `MailCooldown` da API, que é um `Map` em memória e só protege o
  `resendConfirmation`, e o `useCooldown` do cliente, que mora no navegador e qualquer um
  contorna com `curl`. O `forgotPassword` continua sem freio nenhum do lado do servidor;
- **o socket.io e o `/Cache`, herdados de outro projeto e nunca usados pelo cliente.** A API
  sobe uma segunda porta com `origin: "*"`, e as três rotas de `/Cache` deixam qualquer conta
  logada escrever sem limite na memória do processo e ler o que os outros escreveram — não são
  escopadas por workspace. Não há `socket.io-client` no front, nem um import de socket em
  `Frontend/src/`;
- **`trust proxy` não setado** — atrás do nginx, `req.ip` é o nginx para o mundo inteiro, que é
  a definição de um rate limiting que conta todo mundo como uma pessoa só;
- **`cors()` montado e aberto**, `express.json()` sem `limit`, e nenhum cabeçalho de segurança;
- **uma segunda variável de ambiente, não documentada, decidindo o ambiente.** O `AsyncHandler`
  lê `process.env.PROD`, que não está em `exemple.env` nem no `CLAUDE.md`: sem alguém adivinhar
  que ela existe, todo stack de erro vai para o stdout do container;
- **`Utils/constants.json` lido do disco a cada requisição** pelo `AsyncHandler`, para decidir
  dois booleanos de log. O arquivo é de outro projeto: fala de OEE, ordens de produção e MSSQL;
- **log só em arquivo**, em `process.cwd()/Logs` — dentro de um container isso some no próximo
  `up`, que é justamente quando alguém vai querer ler;
- **nenhum tratamento de `SIGTERM`.** O `docker stop` corta requisição em voo e pode interromper
  um tick de rotina depois de ele ter reivindicado o `RotineRuns` e antes de carimbar o
  `FinishedAt` — o mês fica sem fechar, e o catch-up não cobre esta;
- **o `knexfile` só declara a chave `development` e não há script de migration.** Com
  `NODE_ENV=production` o CLI do Knex procura `production`, não acha, e o primeiro deploy morre
  antes da primeira requisição;
- **`path: "*"` do chassi desenha `element: null`** — qualquer URL errada mostra a tela em
  branco, com a sidebar em volta.

### 4. Produção: o ambiente

O que não está versionado em `API/` nem em `Frontend/`, e que só se prova subindo:

- **`NODE_ENV=production` de verdade no deploy** — sem isso o `secure` nunca é setado no cookie
  de sessão;
- **`TZ=America/Sao_Paulo` no processo** — `moment` sem timezone usa o relógio do servidor, e
  em UTC uma rotina de "dia 1º às 00:30" dispara às 21:30 do dia 31 no Brasil e materializa o
  mês errado;
- **nginx servindo front e API na mesma origem** (`/` e `/api`) — é o que faz o
  `sameSite: 'strict'` funcionar sem CORS. Em dev o equivalente é o proxy do Vite, e a saída
  errada dos dois é afrouxar o cookie;
- **imagem e `compose`** dos dois lados, com o Postgres em container, o healthcheck sobre o
  `GET /Utils/Health` que já existe, e as migrations rodando no deploy;
- **certificado TLS.** Sem `https` o cookie `secure` não volta, e a sessão inteira morre;
- **SPF/DKIM/DMARC no domínio** — enviar como `@gastosmensais.com.br` por um SMTP não autorizado
  cai em spam, e nenhuma arquitetura conserta isso. **O provedor escolhido em 10/09 é o Resend,
  por SMTP** (`smtp.resend.com:465`, usuário literal `resend`, a API key como senha): o
  `Mailer` é nodemailer sobre SMTP genérico e não muda uma linha, então isto é troca de `.env`.
  A verificação do domínio no Resend é o que entrega os registros de SPF e DKIM prontos; o
  DMARC continua sendo escrito à mão;
- **as variáveis que se esquecem**: `APP_URL` (sem ela o link de recuperação de senha é montado
  com o `Host` da requisição), e `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`, que estão em `localhost` no
  exemplo — valor errado não dá erro, a biometria só não funciona;
- **os arquivos que o navegador procura sozinho**: `robots.txt`, manifesto, `apple-touch-icon`,
  e um favicon que não seja o `logo.png` de 761 KB baixado em toda página;
- **backup do Postgres com restore testado.** Um volume perdido é o produto inteiro, e backup
  que nunca foi restaurado não é backup.

---

## Fora do MVP, e por quê

Cada linha saiu por decisão registrada, não por esquecimento. **Nada disso vira gambiarra no
cliente enquanto não voltar como etapa de leva.**

| Item | Por que saiu | O que já está levantado |
| --- | --- | --- |
| **Notificações** | Fora do MVP em 07/09. Falta **definir o que gera aviso** — parcela vencendo, orçamento estourado, entrada não recebida | A tabela existe com `ReadAt`, `ScheduledFor`/`SentAt` e os índices. O `CHECK` do `Type` só tem `system` e `security`: todo aviso de domínio precisa de valor novo |
| **Conciliação de extrato** | Fora do MVP em 07/09 — virou o extrato manual, entregue na leva 5 (`contas/extrato`), que é o que a tela precisa | Três perguntas sem resposta: **de onde vem o extrato** (OFX/CSV ou Open Finance — um parser contra uma integração com credencial e homologação), **o que é um item "a resolver"**, e **se conciliar cria lançamento ou só marca os existentes** — se cria, é migration em `Inflows` e `Expenses` |
| **`UserDevices`** | Só faz sentido junto com notificações | Tabela existe, rota não |
| **`Plans` / `Subscriptions`** | Cobrança não faz parte do fluxo de um mês | Tabelas existem, rotas não. **Quando isto voltar, os termos de uso e a política de privacidade têm que ser revisados antes**: muda o controlador (o CNPJ assina no lugar da pessoa física), entram pagamento, reembolso e cancelamento, e o processador de pagamento vira mais um operador na política |
| **Fatura de cartão como entidade** | As datas da fatura já vivem na perna (`ClosingDate`/`DueDate`), e o extrato mostra a fatura sem precisar de tabela. Só se pagaria com conciliação, que também saiu | — |
| **"Continuar com Google"** | Não há OAuth na API | Desenhado no layout; o botão fica desabilitado |

Onde um botão faz parte da composição visual, ele fica **desabilitado e rotulado**, nunca
escondido: some do produto sem sumir do layout. Depois da leva 5 sobrou **um só**: o "Continuar
com Google" do login.

---

## As decisões que não se rediscutem

Todas foram tomadas com o porquê escrito, e o texto completo está nos documentos de
[Old/](Old/). Estão aqui porque **mudar qualquer uma delas é refazer código em cima**, não
porque precisem de nova discussão.

| Decisão | Consequência prática |
| --- | --- |
| **O workspace viaja dentro do token assinado** | Nunca há um `IdWorkspace` vindo do cliente, exceto em `POST /Workspaces/switch`, que reemite o token |
| **Assinado não é o mesmo que ainda verdadeiro** | Autenticação o token resolve; autorização só o banco responde. Toda seção com escopo de tenant abre com `assertMember`/`assertRole` |
| **O saldo é calculado a cada leitura, sem cache** | Não existe coluna de saldo. Um saldo plausível e errado é a pior falha que este app tem, e cache é como ela nasce |
| **`Expenses.Status` é derivado, num lugar só** | `ExpenseStatus.section.ts`, dentro da mesma transação. Nunca aceito num corpo de requisição |
| **A perna tem duas datas que discordam de propósito** | `CompetenceDate` (quando o gasto pesa) e `CashDate` (quando o dinheiro sai). Confundir as duas tira uma compra de agosto do saldo de agosto |
| **O filtro de período é `?From=&To=`, inclusivo nas duas pontas** | Uma fatura de cartão nunca coincide com o mês do calendário. `ReferenceMonth=YYYY-MM` fica só onde o mês é mesmo o mês: orçamento, saldo e relatórios |
| **Não existe header `Authorization`** | Só o cookie `HttpOnly` + `SameSite=Strict`. Um token válido mandado no header responde 401, e há teste provando |
| **Sem compatibilidade com legado no MVP** | Campo que a API deixou de devolver **some do cliente também**. Nada de mapa de chave antiga nem leitura defensiva "por enquanto" |
| **Os dois eixos do gasto não se cruzam** | `ExpensePayments` (financeiro) e `ExpensePersons` (analítico): duas formas e duas pessoas são **2 + 2 linhas, nunca 4** |
| **Todo total de gasto soma pernas, não compras** | 600 em 6× custa 100 a agosto |

---

## As levas daqui pra frente

**A leva 6 foi a primeira unificada** — um plano só, com as etapas da API e as do front na mesma
fila — e fechou em 09/09 com 18 de 18 etapas.

**O número começou em 6 porque era o primeiro livre.** O backend chegou até a Fase #3 e o front
até a Fase #5, e os dois históricos agora são um: recomeçar em 1 faria
`Fase #1 | Etapa 2` existir duas vezes no mesmo `git log` querendo dizer coisas diferentes.

**A próxima é a 7, e ela é a primeira de duas de preparação para produção.** O corte entre elas
é o que se prova de que jeito: a **7** — compliance e o código que muda de comportamento em
produção — se verifica com `npm test` e `npm run typecheck`, e é o que está versionado em `API/`
e `Frontend/`; a **8** — ambiente, e-mail do domínio, arquivos externos, infra e backup — é o
que está em volta dos dois, e só subindo se sabe. Juntá-las faria uma leva em que metade das
etapas não tem critério de aceite até o dia do deploy.

Cada leva ganha um arquivo em [Levas/](Levas/), no formato descrito lá. O que muda em relação
ao que existia antes:

- **Um plano cobre os dois lados.** Uma etapa que precisa de rota nova e de tela descreve as
  duas coisas e é entregue junta — era exatamente isso que o `Pendencias Backend.md` fazia
  atravessando dois repositórios, com semanas entre as duas metades.
- **Não há mais changelog de contrato.** O que mudava para o front era escrito porque o front
  não podia ler o código da API. Agora pode: o diff do commit é o changelog.
- **A execução é registrada no plano da própria leva**, na tabela de etapas, com commit e data.
  O `Levas executadas.md` separado existia porque plano e registro mudavam em ritmos diferentes
  em dois repositórios diferentes; com um histórico só, a linha da tabela e o commit ficam no
  mesmo lugar.
