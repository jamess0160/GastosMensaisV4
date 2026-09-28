# Transcrição do LLM Council — 28/09/2026

**Tema: diferenciação.** O quarto conselho sobre o mesmo produto. Os três anteriores foram sobre
preço (31/07), preço de novo (02/08) e aquisição (03/08), mais o de preço por workspace (18/09)
que fechou a tabela vigente. Este não é sobre quanto cobrar: é sobre **se existe do que cobrar**.

Metodologia: cinco conselheiros respondem de forma independente, sem se ver; as cinco respostas
são anonimizadas e embaralhadas; cinco revisores leem as cinco e apontam a mais forte, o maior
ponto cego e o que todas deixaram passar; o Chairman sintetiza.

---

## 1. Pergunta original (do usuário)

> Estou com uma dúvida muito grande sobre esse projeto. Ele ficou muito legal, e eu vejo grande
> uso nele. Mas dando uma pesquisada eu notei que fazer um gerenciador de finanças pessoais é
> algo comum para micro saas, e fiquei com medo do meu acabar sendo apenas mais um por aí. Não
> sei exatamente no que o meu se diferencia, mas eu sei que ele é a versão 4 de um produto que eu
> construí para mim mesmo e evolui ele pensando em compartilhar com outras pessoas. Preciso saber
> se esse medo faz sentido, ou se eu tenho uma vantagem em relação a outros produtos parecidos no
> mercado.

---

## 2. Pergunta enquadrada (enviada aos 5 conselheiros)

> **ESTE É O QUARTO CONSELHO SOBRE O MESMO PRODUTO.** Houve conselhos em 31/07/2026 (preço),
> 02/08/2026 (preço 2) e 03/08/2026 (aquisição). Preço já está fechado. A pergunta de hoje é
> outra: **diferenciação**.
>
> **O produto:** "Gastos Mensais V4" — app web de controle financeiro pessoal/familiar, Brasil,
> dev solo. React+Vite+TS no front, Express+Knex+PostgreSQL na API. **Está no ar** numa VPS
> própria, com backup agendado, restore testado e runbook escrito. É a **quarta versão** de algo
> que o autor construiu para si mesmo e evoluiu com a intenção de compartilhar.
>
> **Estado real do código (não é protótipo):**
>
> - 22 tabelas, 16 telas responsivas a 390px, **811 testes de integração** sem nenhum mock.
> - A modelagem é específica e deliberada, não genérica:
>   - **Cartão de crédito brasileiro de verdade:** `ClosingDay` (dia do mês em que fecha) +
>     `DueDay`, e a competência de uma compra é **o mês do ciclo que a pegou** — num cartão que
>     fecha dia 30, o gasto de 31/08 pesa em setembro. Isso nasceu de um bug relatado por uso
>     real, e a correção foi migration que recalculou dado gravado, movendo dinheiro entre meses.
>   - **Duas datas que discordam de propósito:** `CompetenceDate` (quando o gasto pesa no
>     orçamento) vs `CashDate` (quando o dinheiro sai da conta). Só divergem em cartão.
>   - **Dois eixos de rateio que nunca se cruzam:** `ExpensePayments` (financeiro, mexe saldo) e
>     `ExpensePersons` (analítico, quem gastou). Duas formas de pagamento e duas pessoas = 2+2
>     linhas, nunca 4. Cada eixo fecha com o total sozinho.
>   - **Rateio sempre em centavos por valor absoluto, nunca porcentagem.**
>   - **Parcelamento como pernas:** 600 em 6x é uma compra de 600 e seis pernas de 100; agosto
>     custa 100. Todo total soma pernas, não compras.
>   - **Orçamento = repartição da renda do mês**, por pessoa e/ou categoria, com precedência
>     (pessoa,categoria) → (pessoa,—), qualquer mês montável inclusive futuro, clonável do mês
>     anterior, e o que não casa aparece como `Unbudgeted`.
>   - **Saldo e orçamento seguem regras opostas** e ambos são calculados na API a cada leitura,
>     sem cache e sem coluna de saldo no banco.
>   - Workspaces múltiplos e grátis, membros ilimitados com papéis, compartilhamento grátis.
> - Também tem: extrato, fatura com tela e navegação de ciclos própria, estorno, gasto fixo,
>   exportação `.xlsx`, tema escuro, onboarding de 4 passos, LGPD (termos versionados com
>   re-aceite bloqueante), sessão só por cookie `HttpOnly` + `SameSite=Strict`.
> - As duas últimas levas nasceram de **uso real** — 13 e depois 9 retornos de quem usa — e uma
>   delas **apagou** uma feature porque duplicava resposta.
>
> **Estado de negócio:**
>
> - **Zero clientes pagantes.** Os poucos usuários atuais são conhecidos pessoais do dono.
> - Preço fechado: um plano só, **R$29,90/mês**, 3 conexões bancárias inclusas, R$12,90 a extra.
> - **A integração Open Finance NÃO existe ainda** — 3 a 6 semanas solo, via Polp a R$160/mês
>   fixo + ~R$4 por consentimento. Conselhos anteriores concluíram por unanimidade que "sem
>   integração, o app compete com planilha grátis e perde". Break-even: 9 a 14 pagantes.
> - Concorrência: Mobills, Organizze, Minhas Economias, Olivia, Wisecash e dezenas de micro-SaaS
>   brasileiros; os apps dos próprios bancos; YNAB/Actual/Firefly; planilhas e templates grátis.
> - Nenhum canal de aquisição construído. Mídia paga e referral travados até haver retenção
>   medida.
>
> **O que está em jogo:** 3 a 6 semanas de desenvolvimento solo mais custo fixo recorrente, mais
> o tempo de marketing num nicho saturado — contra a alternativa de reposicionar, estreitar o
> público, ou aceitar que é um projeto pessoal excelente sem mercado próprio.

---

## 3. Pareceres dos conselheiros

### O Contrarian

O medo faz sentido, mas ele está com medo da coisa errada.

Nada na sua lista de diferenciais é vendável. `CompetenceDate` vs `CashDate`, rateio em centavos,
811 testes sem mock, saldo sem cache — isso é invisível antes do uso e indistinguível de "mais um"
na landing page. Você não tem um diferencial de produto: tem um diferencial de *corretude*, e
corretude é o atributo que ninguém acredita até já ter sido traído, e que Mobills também alega
ter. Rigor de engenharia não aparece em nenhuma decisão de compra de R$29,90.

Pior: o Open Finance que os conselhos anteriores aprovaram **destrói** o pouco de diferenciação
que existe. Hoje seu ativo é um modelo de lançamento manual mais honesto que o dos outros. Com
dado entrando automático, o campo de batalha vira categorização automática, app nativo e marca —
exatamente onde você perde de goleada para quem tem capital. Você vai gastar 3 a 6 semanas e
R$160/mês fixo para se transformar em commodity mais rápido.

E sua evidência de tração é ruim. 22 retornos de conhecidos pessoais não é validação, é gentileza.
Zero pessoas já disseram sim a um preço. Amigo dá feedback; estranho dá churn.

A única coisa aqui que parece defensável você está escondendo: **dois eixos de rateio que não se
cruzam** — quem pagou ≠ quem gastou. Isso é casal e família, é o caso de uso que os concorrentes
fazem mal porque foi enxertado depois. Não é "gerenciador de finanças pessoais".

O teste que você está evitando: cobre R$29,90 de dez estranhos, hoje, na versão manual. Se ninguém
paga sem Open Finance, o Open Finance não é a solução — é só o preço mais alto do mesmo fracasso.

### O Pensador de Primeiros Princípios

Sua pergunta está errada em dois níveis.

**Primeiro:** "no que meu produto se diferencia" trata diferenciação como propriedade do produto.
Não é. É propriedade do *alternativo do comprador*. Uma feature só diferencia se a gambiarra atual
da pessoa quebra sem ela. Então a pergunta certa é: **existe alguém para quem Mobills, o app do
Nubank e a planilha estão todos quebrados?** Se você não consegue escrever esse alguém numa frase
sem usar a palavra "melhor", não há diferenciação — e aí nenhuma leva resolve.

**Segundo:** você não construiu um gerenciador de finanças pessoais. Isso é o rótulo da categoria
que você herdou ao pesquisar concorrentes, e ele te fez comparar seu app com a coisa errada. Olhe
a sua modelagem: os dois eixos de rateio que nunca se cruzam, competência por ciclo de cartão,
parcela como perna. Nada disso é sobre *rastrear* gasto. É sobre **contabilidade de uma casa onde
mais de uma pessoa gasta e paga em proporções diferentes**. Mobills responde "quanto eu gastei".
Você responde "quem gastou, quem pagou, e por que esses dois números não batem". São perguntas
diferentes. O app do banco nunca vai fazer a segunda — ele só vê uma conta, de uma pessoa.

**A consequência é desconfortável:** Open Finance é o investimento que te *desdiferencia*.
Importar extrato é exatamente o eixo onde você é comparável a quem tem capital, marca e app store.
Gastar 3-6 semanas nisso é pagar para entrar na grade de features onde você perde. O consenso
unânime dos conselhos anteriores é o pressuposto que eu desmontaria primeiro: ele assume que você
está na categoria "tracker".

**Teste antes de codar qualquer coisa:** ache 10 pessoas que dividem contas e que você não
conhece. Peça que descrevam o acerto do mês passado. Se a descrição exigir dois eixos, você tem
produto. Se for "a gente racha no meio", você tem um projeto pessoal excelente.

### O Expansionista

O medo está mirando o objeto errado. Você não construiu um gerenciador de finanças — construiu um
**motor de rateio doméstico** e embrulhou num app de finanças. Os concorrentes que você listou
resolvem "quanto eu gastei". Nenhum resolve "quanto **nós** gastamos e quem deve a quem", porque
nenhum tem dois eixos que fecham separados. Mobills não tem. Organizze não tem. Splitwise tem o
eixo de quem gastou e nenhum orçamento. O app do Nubank só vê o cartão do Nubank — não consegue
nem existir na conta de um casal.

Onde isso fica maior do que você está imaginando:

**1. O casal é o nicho, não o indivíduo.** Reposicionar para "dinheiro de casa, a dois" muda tudo:
membros ilimitados grátis deixa de ser custo e vira o canal — cada pagante traz 1 a 3 pessoas que
veem o produto funcionando todos os dias. R$29,90 por casa é R$15 por cabeça, e ninguém compara
com planilha porque planilha compartilhada entre duas pessoas é o inferno que eles já conhecem.

**2. Workspace múltiplo grátis é um segundo produto escondido.** MEI que mistura dinheiro de casa
com dinheiro do CNPJ são milhões de pessoas, e o competência-vs-caixa que você já modelou é
exatamente o que contador pede e nenhum app pessoal entrega.

**3. O motor vale mais que a tela.** 811 testes sem mock, rateio em centavos, ciclo de cartão
corrigido por migration retroativa — isso é infraestrutura licenciável. Planejador financeiro CFP
cobrando R$300/mês do cliente paga R$99 por assento sem pensar.

**4. Open Finance não é paridade, é alavanca.** Com consentimento e o ciclo de cartão correto,
você prevê a fatura antes de fechar. "Quanto ainda podemos gastar em setembro" — ninguém no Brasil
acerta isso hoje.

### O Outsider

Li a lista inteira e vou ser honesto: não entendi metade. "Dois eixos de rateio que nunca se
cruzam", "811 testes de integração sem mock", "calculado na API a cada leitura sem cache" — isso
não é vantagem, isso é o motor do carro. Ninguém compra carro porque a solda é boa.

Do que você listou, **duas** coisas me acertaram:

1. **O cartão que fecha dia 30 e joga a compra do dia 31 pro mês seguinte.** Isso eu sinto na
   pele. Todo mês eu olho a fatura e não sei se aquele gasto é "desse mês" ou não. Se você me
   disser "aqui a fatura bate com a do banco", eu entendo na hora.
2. **Saber quem gastou, e não só de qual conta saiu.** Eu e minha esposa dividimos as contas e
   isso é briga real em casa. O app do Nubank nunca vai resolver porque o dinheiro está espalhado
   em dois nomes e três bancos.

O resto é coisa que eu presumo que qualquer app faz.

Agora o problema de verdade, que não é concorrência: **eu já tentei três apps desses e parei em
duas semanas.** Não porque eram ruins — porque cansei de digitar. Então, pra mim, essa integração
com o banco não é uma feature que falta. É o produto. Sem ela você está me pedindo R$29,90 por mês
pra eu trabalhar de graça, quando meu banco já me mostra gasto por categoria sem eu fazer nada.

O medo faz sentido, mas não pelo motivo que você pensa. Não é que tem muita gente fazendo. É que
**nada do que você me contou é uma frase que eu repetiria pra um amigo.** Se você não consegue
terminar "é o app pra quem ___", eu também não vou conseguir.

### O Executor

Seu medo é uma hipótese, e hipótese se testa em um dia, não em seis semanas.

**Segunda-feira, 9h, sem escrever uma linha de código.** Baixe Mobills, Organizze e Minhas
Economias. Crie conta grátis nos três. Lance exatamente o mesmo caso, cronometrando: compra de
R$600 em 6x, feita em 31/08, num cartão que fecha dia 30 e vence dia 10; rateada entre duas
pessoas (60/40) e paga em duas formas. Depois abra a tela de "quanto gastei em agosto" de cada um.

Três resultados possíveis, e todos resolvem sua dúvida antes de quarta:

1. **Eles erram a competência** (meu palpite: a maioria joga em agosto ou não deixa você separar
   os dois eixos). Então você não tem medo, tem diferencial — e tem o material de marketing já
   pronto: três prints lado a lado, o seu certo, os outros errados. Isso é uma página de
   comparação, não um discurso de posicionamento.
2. **Eles acertam tudo.** Você economizou 6 semanas e R$160/mês. Vira projeto pessoal excelente,
   e pronto.
3. **Eles acertam, mas em 8 telas e 4 minutos** enquanto você faz em 1. Aí o diferencial é
   velocidade de lançamento, e o teste é outro: cronômetro.

**Terça:** mande uma pergunta só para as ~5 pessoas que deram os 22 retornos — "se eu desligasse o
app amanhã, o que você faria na mão?". A resposta delas é sua descrição de produto.

Open Finance não responde nada disso. Ele te iguala aos outros; não te diferencia. Construir
primeiro o que te iguala, para descobrir depois se você era diferente, é a ordem errada. Faça o
teste de duas horas antes de assinar qualquer R$160/mês.

---

## 4. Rodada de revisão cruzada (anônima)

**Mapa da anonimização**, revelado aqui e desconhecido dos revisores:

| Letra | Conselheiro |
| --- | --- |
| **A** | O Executor |
| **B** | O Contrarian |
| **C** | O Outsider |
| **D** | O Expansionista |
| **E** | O Pensador de Primeiros Princípios |

**Placar:** mais forte — **E** com 4 votos, **C** com 1. Maior ponto cego — **D**, unânime, 5 de 5.

### Revisor 1

**1. Mais forte: E.** É a única que ataca a pergunta, não a lista de features: diferenciação é
propriedade da alternativa do comprador, não do produto. Nomeia a categoria herdada errada
("tracker"), desmonta explicitamente o consenso unânime dos conselhos anteriores como
*pressuposto*, e fecha com teste falsificável em duas direções. B chega perto e acrescenta o teste
que importa (cobrar de dez estranhos hoje); A tem o melhor método, mas testa paridade de feature,
não disposição a pagar.

**2. Maior ponto cego: D.** É só upside, sem uma única hipótese que possa falhar. Licenciar "o
motor" para CFP a R$99/assento e atacar MEI partindo de **zero pagantes** e dev solo são dois
produtos novos, não alavancas. E trata 811 testes como ativo comercial — C mostra que o comprador
não vê solda. Falta: qualquer teste, e o custo de foco de abrir três frentes.

**3. Todas deixaram passar duas coisas:**

- **O meio-caminho.** C diz que abandonou por digitação, não por falta de Open Finance. Importar
  OFX/CSV resolve boa parte disso em dias, sem R$160/mês e sem consentimento — nenhuma resposta
  cogitou.
- **A economia unitária do preço já "fechado".** 3 conexões × R$4 + reconsentimento anual +
  suporte de conexão quebrada corroem R$29,90; break-even 9–14 pagantes assume churn zero.

### Revisor 2

**1. Mais forte: E.** É a única que ataca o erro de método, não só a resposta: diferenciação não é
propriedade do produto, é propriedade da alternativa que quebra. Ela nomeia a categoria herdada
("tracker") como a causa do medo, desmonta explicitamente o consenso unânime dos conselhos
anteriores em vez de herdá-lo, e fecha com um teste falsificável em duas direções. A tem o melhor
teste operacional (duas horas, três apps, um caso), mas mede features; E mede comprador.

**2. Maior ponto cego: D.** Com zero pagantes, ela empilha três produtos novos — nicho casal,
MEI/CNPJ, licenciar o motor a CFP a R$99/assento — e afirma sem verificação o que Mobills,
Organizze e Splitwise não fazem. Falta o único dado que importa: ninguém pagou nada ainda. Vender
motor a planejador é B2B com ciclo longo, contrato e suporte, o oposto de dev solo. B e E também
apostam no nicho, mas testam antes.

**3. O que as cinco deixaram passar:** o diferencial e o antídoto ao churn se contradizem. C
abandona apps por cansaço de digitar, mas o extrato do Open Finance jamais sabe **quem gastou** —
o eixo `ExpensePersons` só se preenche à mão. Automatizar não remove o trabalho onde o produto é
único. O conselho precisa decidir como o rateio analítico sobrevive sem digitação (regras,
sugestão, confirmação de um toque), ou o nicho morre pelo mesmo motivo que os concorrentes.

### Revisor 3

**1. Mais forte: C.** É a única que fala da posição do comprador e não do dono. Ela valida só duas
coisas (competência do ciclo do cartão e "quem gastou") e mata o resto como "solda do carro".
Principalmente: identifica o inimigo real — não é Mobills, é o abandono por digitação em duas
semanas — e entrega o teste mais barato de todos: terminar a frase "é o app pra quem ___". A e E
dão bons testes; B e E acertam que Open Finance desdiferencia, mas nenhuma sente o cansaço de
digitar.

**2. Maior ponto cego: D.** Inventa três mercados novos (MEI, licenciar o motor, assento de R$99
para CFP) para um dev solo com **zero pagantes** e nenhuma evidência de nenhum deles. Falta o que
todas as outras têm: um teste falsificável. É reposicionamento por entusiasmo — e trata 811 testes
como ativo comercial, o que C já mostrou que ninguém compra.

**3. Todas deixaram passar duas coisas:**

- **O banco dele já tem a resposta.** Uma query nos 22 usuários: quantos criaram `ExpensePersons`
  diferente de `ExpensePayments`? Se quase ninguém usou os dois eixos, a tese de diferenciação de
  B, D e E cai hoje, de graça.
- **Existe meio-caminho entre digitar e Open Finance:** import OFX/CSV e fatura, recorrência
  automática. Atacam o churn de C sem R$160/mês nem 6 semanas.

### Revisor 4

**1. Mais forte: E.** É a única que ataca a pergunta, não o produto: diferenciação não é
propriedade do app, é propriedade da alternativa quebrada do comprador. Disso ela deriva o
reenquadramento (contabilidade de casa, não tracker), a consequência incômoda (Open Finance
desdiferencia) e um teste falsificável com critério de parada — "se for 'racha no meio', é projeto
pessoal". B chega ao mesmo diagnóstico com mais força retórica e menos saída; A tem o melhor teste
operacional (2 horas, hoje) e complementa E.

**2. Maior ponto cego: D.** Empilha quatro alavancas — nicho casal, MEI/contador, licenciar o
motor a CFP por R$99/assento, previsão de fatura — todas dependentes da mesma premissa não
testada, com zero pagantes. Falta o passo que sustenta qualquer uma: uma venda a um estranho.
Vender motor B2B é outro produto, outro ciclo, outro suporte. E ignora que membros ilimitados
grátis também é custo de suporte, não só canal.

**3. Todas deixaram passar:** ele já tem a evidência no próprio banco. Quantos workspaces têm >1
membro? Em quantos gastos `ExpensePayments` ≠ `ExpensePersons`? Se o eixo duplo — a única
diferenciação apontada por B, D e E — não é usado pelos 22, a tese morre hoje, de graça. E ninguém
citou a terceira via: importar OFX/CSV/fatura mata "cansei de digitar" (C) em dias, sem R$160/mês
nem agregador regulado.

### Revisor 5

**1. A mais forte: E.** É a única que ataca a premissa, não o sintoma: diferenciação não é
propriedade do produto, é propriedade da alternativa que o comprador já usa. Daí sai a
consequência mais valiosa do conselho — Open Finance é o eixo onde ele é *comparável* — e um teste
falsificável (10 estranhos que dividem contas descrevendo o acerto do mês). A é a melhor
complementar: mesmo diagnóstico, teste ainda mais barato (duas horas cronometrando os
concorrentes).

**2. Maior ponto cego: D.** Empilha mercados que não existem no dado disponível — licenciar o
motor, MEI, CFP pagando R$99/assento — para quem tem *zero pagantes*. Afirma "Mobills não tem,
Organizze não tem" sem ter verificado (exatamente o teste que A propõe). E ignora que "membros
ilimitados grátis" deixa de ser canal barato quando cada consentimento custa R$4.

**3. O que as cinco passaram:** a economia unitária do preço já fechado. R$29,90 com 3 conexões,
R$160/mês fixo, R$4/consentimento — **e consentimento de Open Finance expira e precisa ser
renovado**, então é custo recorrente por conexão por membro, não one-off. Break-even de 9–14
pagantes assume consumo mínimo e nenhum workspace familiar grande. Ninguém checou se o preço
sobrevive ao próprio diferencial (casa com 4 pessoas e 3 bancos cada).

---

## 5. Síntese do Chairman

### Onde o conselho concorda

- **O medo faz sentido, mas está mirando o objeto errado — 5 de 5, por cinco caminhos
  independentes.** O problema não é "tem muita gente fazendo gerenciador de finanças". É que
  **nada do que ele lista é uma frase que um comprador repetiria para um amigo.** Ele não é mais
  um: ele é *indistinguível* de mais um — e isso é posicionamento, não produto.
- **A vantagem existe, e é UMA, não a lista: quem pagou ≠ quem gastou.** Os dois eixos que nunca
  se cruzam foram apontados como a única coisa defensável pelo Contrarian, pelo Expansionista e
  pelo Pensador de Primeiros Princípios — e é uma das duas únicas coisas que o Outsider entendeu
  sem explicação. Três conselheiros com incentivos opostos convergiram no mesmo item.
- **O segundo item vendável é o ciclo de cartão.** "A fatura bate com a do banco" é a única outra
  frase que atravessou até o Outsider. Notável porque ela não nasceu de estratégia: nasceu de um
  bug de uso real que virou migration.
- **Todo o resto do orgulho técnico é invisível no funil — 4 de 5.** 811 testes, saldo sem cache,
  rateio em centavos, `CompetenceDate` vs `CashDate` como conceito: isso é qualidade, e qualidade
  **retém, não adquire**. O Outsider foi literal: "ninguém compra carro porque a solda é boa".
- **A evidência atual não é validação — 2 de 5 explícitos, nenhum discordou.** 22 retornos de
  conhecidos pessoais é gentileza. Zero estranhos disseram sim a um preço.
- **Nenhum dos cinco recomendou começar por Open Finance agora.** Três disseram explicitamente
  para não começar; o Expansionista o quer *depois* do reposicionamento; o Outsider o quer, mas
  como comprador descrevendo a dor, não como conselho de sequência.

### Onde o conselho briga

**1. Open Finance desdiferencia, ou É o produto?**

O Contrarian, o Pensador de Primeiros Princípios e o Executor dizem a mesma coisa: importar
extrato é exatamente o eixo em que ele é comparável a quem tem capital, marca e app store. Gastar
3–6 semanas e assumir R$160/mês fixo é **pagar para virar commodity mais rápido**.

O Outsider — que é o comprador, e o único com dado de comportamento na mão — diz o oposto: ele
abandonou três apps em duas semanas, não por serem ruins, mas por cansaço de digitar. Sem
integração, R$29,90 é pagar para trabalhar de graça, competindo com o app do banco que mostra
categoria sem esforço nenhum.

**Por que pessoas razoáveis discordam: eles estão medindo coisas diferentes.** Os três primeiros
falam de **aquisição** (o que faz alguém escolher você); o Outsider fala de **retenção** (o que
faz alguém ficar). Open Finance é ruim de aquisição e bom de retenção, e as duas frases são
verdadeiras ao mesmo tempo. O Revisor 2 achou a costura, e ela é o achado mais fino da mesa
inteira — está nos pontos cegos abaixo.

**2. Expandir agora, ou reposicionar e parar aí?**

O Expansionista abre quatro frentes: casal, MEI/CNPJ, licenciar o motor a planejador financeiro, e
previsão de fatura. Os **cinco** revisores elegeram esse parecer como o maior ponto cego da mesa —
quatro alavancas apoiadas na mesma premissa não testada, com zero pagantes e um dev solo.

Mas o item 1 dele ("o casal é o nicho, não o indivíduo") é exatamente onde os outros quatro
convergem. O veredito, portanto, **parte esse parecer em dois**: o reposicionamento sim, as três
frentes B2B não.

**3. Qual teste vem primeiro.**

Executor: duas horas comparando concorrentes (mede paridade de feature). Contrarian: cobrar
R$29,90 de dez estranhos hoje (mede disposição a pagar). Primeiros Princípios: dez entrevistas com
quem divide contas (mede se a alternativa está quebrada). Todos os três são bons e nenhum é o
primeiro — o primeiro custa zero e saiu da revisão cruzada.

### Pontos cegos que só o peer review pegou

**1. A resposta já está no banco de produção dele. Dois revisores, independentemente — e nenhum
dos cinco conselheiros viu.**

A tese central deste conselho — de que o eixo duplo é a diferenciação — é falsificável **hoje, de
graça, sem falar com ninguém**. Em quantos gastos o rateio analítico é mais de uma pessoa? Quantos
workspaces têm mais de um membro? Quantas `Persons` sem `IdUser` (o filho, o cônjuge que não usa o
app) recebem rateio? Se os usuários atuais nunca usaram o segundo eixo, a tese de três
conselheiros morre em cinco minutos, e a resposta honesta à pergunta dele passa a ser: **sim, o
medo se justifica.** As tabelas e colunas para essa query existem — verificado no schema.

**2. O eixo que diferencia é o único que NENHUMA integração automatiza. Revisor 2, e é o achado
que resolve a briga nº 1.**

Extrato bancário diz de qual conta o dinheiro saiu. Ele **nunca** diz quem gastou.
`ExpensePersons` só se preenche à mão, por definição. Então Open Finance mata a digitação
exatamente na metade commodity do produto e deixa intacta a digitação da metade que diferencia.
Se o rateio analítico não ganhar regra, herança do mês anterior ou confirmação de um toque, o
nicho morre **pelo mesmo motivo** que fez o Outsider abandonar os concorrentes — só que agora na
feature que era o diferencial.

**3. A terceira via, ignorada por duas vezes. Três revisores.**

Import de OFX/CSV e de fatura mata "cansei de digitar" em dias, sem R$160/mês fixo, sem
consentimento regulado, sem expiração em 12 meses e sem 6 semanas. Isso já havia aparecido no
conselho de **03/08** como "alternativa nunca considerada" e foi ignorado; voltou agora por três
caminhos independentes. Duas vezes a mesma ideia barata sendo atropelada pela cara.

**4. O preço fechado não sobrevive ao posicionamento que este conselho recomenda. Dois
revisores.**

R$29,90 por casa com 3 conexões inclusas foi precificado em 18/09 para um comprador **individual**.
Se o diferencial é a casa com quatro pessoas e vários bancos, consentimento é custo recorrente por
conexão — e o break-even de 9–14 pagantes assume consumo mínimo. Isso não invalida a decisão de
18/09; marca que ela tem que ser relida quando o reposicionamento entrar, e não antes.

### A recomendação

**O medo é legítimo, e está mal endereçado. A vantagem existe, e é uma só.**

Ele não é "apenas mais um". Ele é **indistinguível** de mais um, o que é um problema diferente e
mais barato de consertar: nenhuma linha de código está errada, a frase está faltando. Um produto
com quatro versões, 811 testes e dois ciclos de retorno de uso real não tem problema de produto.

A vantagem é: **quem pagou não é quem gastou, com a competência do cartão certa, numa casa em que
mais de uma pessoa gasta.** Isso não é "gerenciador de finanças pessoais" — é contabilidade
doméstica, e é uma categoria em que o app do banco não consegue nem entrar (ele vê uma conta, de
uma pessoa) e em que Mobills e Organizze chegaram por enxerto. Todo o resto que ele listou é
qualidade: retém, não vende.

Concretamente, cinco decisões:

1. **Represe o Open Finance — não cancele, represe.** Quatro dos cinco e todos os revisores que
   tocaram no tema. Construir agora é comprar paridade no eixo em que ele perde, com custo fixo
   antes do primeiro pagante.
2. **Reposicione de "controle financeiro pessoal" para "o dinheiro da casa, quando mais de uma
   pessoa gasta".** Isso não é copy — é a escolha de contra quem competir: contra a planilha
   compartilhada e o grupo do WhatsApp, não contra Mobills.
3. **A frase que o Outsider pediu, e que o produto já cumpre:** *"o app do dinheiro da casa em que
   a fatura do cartão bate com a do banco e você sabe quem gastou — não só de qual conta saiu."*
   Duas capacidades, as duas prontas, as duas entendidas por quem não é técnico.
4. **As frentes B2B do Expansionista ficam em espera.** Licenciar o motor e vender a planejador
   financeiro são produtos novos, não alavancas. A exceção barata: MEI/workspace múltiplo é a
   segunda melhor hipótese e não custa nada ser testada na copy da mesma landing.
5. **A próxima leva de código não é integração: é o rateio analítico deixar de ser digitação.**
   Regra por categoria ou estabelecimento, herança do mês anterior, confirmação de um toque. É o
   único trabalho que fortalece o diferencial em vez de comprar paridade — e é exatamente onde as
   3 a 6 semanas deveriam ir. Quando a paridade voltar à fila, ela começa por **import de
   OFX/CSV**, não por agregador com custo fixo.

**Onde o Chairman discorda da maioria:** o Outsider está certo no diagnóstico e errado na cura.
Digitação mata, sim — mas a cura de maior alavancagem é automatizar o eixo que integração nenhuma
automatiza, não conectar banco. Ele é o único conselheiro com dado de comportamento real, e é por
isso que o item 5 existe.

### A primeira coisa a fazer

**Rode três queries no banco de produção, hoje, antes de escrever uma linha de copy ou de código.**

```sql
-- 1. O segundo eixo é realmente usado? Gastos rateados entre mais de uma pessoa.
SELECT e."IdWorkspace",
       COUNT(*) FILTER (WHERE p.pessoas > 1) AS gastos_rateados,
       COUNT(*)                              AS gastos_total
  FROM "Expenses" e
  JOIN (SELECT "IdExpense", COUNT(DISTINCT "IdPerson") AS pessoas
          FROM "ExpensePersons"
         GROUP BY "IdExpense") p ON p."IdExpense" = e."IdExpense"
 GROUP BY e."IdWorkspace";

-- 2. Os espaços têm mais de uma pessoa de verdade dentro?
SELECT "IdWorkspace", COUNT(*) AS membros
  FROM "WorkspaceMembers"
 GROUP BY "IdWorkspace"
HAVING COUNT(*) > 1;

-- 3. Pessoas sem login recebendo rateio — o filho, o cônjuge que não usa o app.
SELECT COUNT(DISTINCT ep."IdPerson") AS pessoas_sem_login_com_rateio
  FROM "ExpensePersons" ep
  JOIN "Persons" pe ON pe."IdPerson" = ep."IdPerson"
 WHERE pe."IdUser" IS NULL;
```

São cinco minutos e decidem tudo o que está acima. Se a maioria dos gastos tem **uma** pessoa no
eixo analítico, o reposicionamento recomendado é teoria bonita sobre uma feature que ninguém usa —
e a resposta honesta à pergunta dele é que o medo se justifica. Se o eixo é usado, ele não tem uma
hipótese de posicionamento: tem a primeira frase da landing page **com prova de uso**, antes de
gastar um real ou uma semana.

O procedimento de abrir o banco está no
[Deploy.md](../../Deploy.md#7-abrir-o-banco-no-dbeaver).

---

*Conselho de 28/09/2026. Cinco conselheiros, revisão cruzada anônima, síntese do Chairman.
Anteriores: [31/07 preço](../2026-07-31%20Pre%C3%A7o/council-transcript-2026-07-31.md) ·
[02/08 preço 2](../2026-08-02%20Pre%C3%A7o%202/council-transcript-2026-08-02.md) ·
[03/08 aquisição](../2026-08-03%20Aquisi%C3%A7%C3%A3o/council-transcript-2026-08-03.md) ·
[18/09 preço por workspace](../2026-09-18%20Pre%C3%A7o%20por%20workspace/Decis%C3%B5es.md).*
