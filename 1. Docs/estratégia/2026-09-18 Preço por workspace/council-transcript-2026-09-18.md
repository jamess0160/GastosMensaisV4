# Transcrição do LLM Council — 18/09/2026

**Tema:** cobrar por workspace, e compartilhamento gratuito.

**Conselhos anteriores:** [31/07 Preço](../2026-07-31%20Pre%C3%A7o/council-transcript-2026-07-31.md) ·
[02/08 Preço 2](../2026-08-02%20Pre%C3%A7o%202/council-transcript-2026-08-02.md) ·
[03/08 Aquisição](../2026-08-03%20Aquisi%C3%A7%C3%A3o/council-transcript-2026-08-03.md)

---

## 1. Pergunta original (do usuário)

> Análise o projeto e me responda. Faz sentido cobrar por workspace? Eu pensei inicialmente que
> seria um preço de 19,90 pela primeira conta sincronizada e + 9,90 para cada conta em cima
> disso. Mas cobrar por 10 reais por workspace me parece fazer sentido. Não é algo que eu tenho
> custo, mas parece fazer sentido pro usuário (10,00 + 9,90 pelo primeiro workspace e conta,
> +9,90 por conta e + 10 para cada workspace. O que você acha disso? Também gostaria da opinião
> sobre o compartilhamento de workspace, ao meu ver seria gratuito, então um casal teria a conta
> de quem configurou tudo, e outro do casal teria apenas um conta de acesso (a parte de criação
> de conta e compartilhamento já estão prontas)

---

## 2. Pergunta enquadrada (enviada aos 5 conselheiros)

### Contexto do produto

"Gastos Mensais" — app web de controle financeiro pessoal (React + Vite / Express + Knex +
PostgreSQL), desenvolvedor solo brasileiro, pré-lançamento, ZERO clientes pagantes.

Núcleo: gastos parcelados (cada parcela é uma "perna"), rateio duplo (eixo financeiro × eixo
analítico), orçamento por competência, saldo calculado pela API. **Multi-workspace desde o
início**: todo dado escopado por `IdWorkspace`, que viaja dentro do token de sessão assinado;
`POST /Workspaces/switch` é a única rota que aceita `IdWorkspace` do cliente e reemite o token.

**Compartilhamento JÁ IMPLEMENTADO em produção:** `WorkspaceMembers` (papéis
owner/editor/viewer) e `WorkspaceInvites` (convite por e-mail com hash de 32 bytes, expira,
revogável, nunca concede 'owner'). Custo de desenvolvimento já pago.

"Conta sincronizada" = conexão Open Finance via fornecedor Polp. **NÃO implementada** (3–6
semanas solo: OAuth, consentimento, sync, deduplicação, categorização, renovação em 12 meses).
Custo: R$160/mês de plataforma + R$4 por consentimento (R$3,50 com 100, R$3 com 1.000, R$2,50
com 10.000+). VM R$60/mês. Break-even estimado 14–17 assinantes.

Sem plano gratuito (decidido). Trial de 14 dias com tudo ligado e pagamento autorizado no
cadastro. Zero mídia paga até o gate de 50% de retenção no mês 3 com coorte de 30+ pagantes.

### Decisões de conselhos anteriores (31/07, 02/08, 03/08)

- Plano único até 50 pagantes; "plano casal" morto.
- Regra própria do dono: add-on nunca abaixo de 2,5× o custo variável.
- O conselho de 03/08 recomendou: UM plano de R$29,90/mês com 3 conexões incluídas, +R$12,90
  além da 3ª, e CORTAR o acesso compartilhado do lançamento.
- O conselho de 03/08 concluiu que a objeção real do comprador não é preço, é CONFIANÇA.

### A pergunta nova

**1)** Cobrar por WORKSPACE faz sentido? Proposta: R$10,00/workspace + R$9,90/conta
sincronizada; entrada (1+1) = R$19,90/mês; +R$9,90 por conta; +R$10,00 por workspace. Ele
admite que workspace "não é algo que eu tenho custo", mas "parece fazer sentido pro usuário".

**2)** O compartilhamento deve ser GRATUITO? Casal: uma conta paga (quem configurou) e a outra
pessoa com "apenas uma conta de acesso", sem custo.

### O que está em jogo

O preço de tabela de lançamento e a arquitetura de billing (Pix Automático tem consentimento com
valor máximo; cartão falha 10–15%/mês). Zero clientes, nenhuma linha de billing escrita.

---

## 3. Pareceres dos conselheiros

### O Contrarian

A proposta quebra a regra do próprio dono no dia 1. R$9,90 ÷ R$4 = 2,47×. O piso dele é 2,5×. Se
a regra é real, o preço mínimo da conexão é R$10,00 — e se ele arredonda para baixo "porque 9,90
vende melhor", a regra nunca foi uma regra, era uma racionalização. Escolha uma das duas coisas
agora, porque a mesma flexibilidade vai reaparecer em cada decisão de margem.

Cobrar por workspace pune o comportamento que faz o produto funcionar. Workspace é a unidade de
higiene de dados — pessoal vs. família vs. MEI. Ao colocar R$10 nela, você ensina o usuário a
jogar tudo num workspace só. Ele obedece, o rateio analítico vira lixo, o orçamento por
competência perde sentido, e ele conclui que o app não serve. Você monetizou R$0 e degradou o
núcleo. Some isso a "não é algo que eu tenho custo" e você tem um preço que o comprador percebe
como taxa arbitrária — exatamente o tipo de coisa que mata confiança, o gargalo real identificado
em 03/08. A proposta responde ao problema de confiança com uma tela de preço mais complicada.

"Parece fazer sentido pro usuário" é jargão de arquitetura vazando pro pricing. Ninguém acorda
querendo comprar um workspace. Quantos clientes pediram o segundo? Zero — você tem zero clientes.

Dois eixos variáveis é o erro caro. Workspaces × conexões = matriz. Com Pix Automático, cada
mudança de faixa pode exigir novo consentimento de valor máximo; com cartão, 10–15% de falha em
cima de um valor que muda sozinho. Você está pedindo duas semanas de dunning e proration para
vender um SKU inventado.

Compartilhamento grátis: sim, mas com os olhos abertos. O convidado tem acesso de editor e
nenhuma relação de pagamento. Se o pagante cancela, o convidado perde tudo — e sua coorte de
retenção fica cega, porque metade dos usuários ativos não aparece na receita. Instrumente
`IdUser` ativo por workspace desde o primeiro dia, ou seu gate de 50% no mês 3 mede a coisa
errada.

### O Pensador de Primeiros Princípios

Você está precificando um recurso que não existe.

O eixo caro da sua tabela — a conta sincronizada — são 3 a 6 semanas de código, R$160/mês fixos e
um custo por consentimento que renova em 12 meses. Você não tem um único cliente que provou pagar
pelo app **sem** isso. Então a pergunta "R$10 por workspace ou R$29,90 com 3 conexões" está dois
passos à frente da única coisa que você precisa descobrir: alguém paga por parcelamento com
perna, rateio duplo e orçamento por competência, digitados à mão? Se sim, Open Finance é upsell
que você precifica depois com dados reais. Se não, nenhuma tabela salva.

Segundo: workspace não é unidade de valor, é unidade de isolamento de dados. Você admitiu que não
tem custo. O problema não é a margem — é que um segundo workspace não é um benefício, é uma
**tarefa**: o usuário separa pessoal de MEI porque precisa. Cobrar R$10 por isso é taxar o
usuário por organizar os próprios dados, e ele sente exatamente assim. Você vira o único app que
cobra por pasta.

Terceiro: "compartilhamento grátis" está enquadrado como pergunta de receita. Não é. O segundo
membro do casal não é cliente — é o mecanismo de retenção (dois humanos com dados lá dentro nunca
cancelam) e o canal de aquisição. Cobrar assento é vender a coisa que te segura.

O que reconstruo: **um preço fixo, zero medidores, no lançamento.** Nenhuma linha de billing
medido — Pix Automático com valor máximo e 10–15% de falha de cartão são problemas que você só
merece ter com 50 pagantes. Workspaces ilimitados, membros ilimitados, conexões: nenhuma, ainda.
Quando alguém pedir conexão, cobre por ela **na mão**, por fora, para os dez primeiros. Aí você
tem preço com evidência em vez de aritmética.

### O Expansionista

**Cobrar por workspace é a única coisa nessa mesa que tem expansão de receita embutida.** Conexão
bancária satura em 2–3 e para. Workspace não satura: PF, o MEI, a casa dos pais, a obra, o imóvel
alugado, a viagem. O brasileiro de classe média tem 3–5 caixinhas mentais e hoje é forçado a
misturar tudo ou abrir dois apps. Você tem a única arquitetura na categoria que separa PF de MEI
sem trocar de login — e está prestes a dar isso de graça dentro de um plano de R$29,90.

Net revenue retention acima de 100% sem vender nada novo é o ativo mais valioso de um SaaS solo.
R$29,90 flat não tem isso.

**Mas R$10 é subvalorizado e ancora workspace como acessório.** R$19,90 entrada / R$14,90 por
workspace extra. Quem abre o segundo workspace já provou o produto e é o seu usuário de maior
retenção — ele não vai embora por R$5.

**Compartilhamento grátis: sim, e mais agressivo do que ele propôs.** O convidado é aquisição de
custo zero com o código já pago, e resolve o problema de confiança que o conselho anterior
levantou — ninguém conecta banco por causa de um site sem marca, mas conecta porque o cônjuge já
usa. Só faça uma coisa: o convidado ganha "seu espaço pessoal" com botão de criar workspace
próprio. Casal que separa, ou que descobre que quer privacidade, vira dois pagantes.

**O adjacente escondido:** contador e planejador financeiro. `viewer` já existe. R$14,90 por
workspace escala linear para quem administra 10 clientes — canal de distribuição que traz clientes
já confiantes, sem mídia paga. Isso é um negócio de R$3k/mês por parceiro, não de 17 assinantes.

Construa billing medido em workspaces + conexões. Teto do Pix Automático em R$149 para nunca
recoletar consentimento num upgrade.

### O Outsider

**Eu não sei o que é "workspace".** Isso não é força de expressão: eu vi essa tela e travei. Não é
palavra de gente, é palavra de programador. "R$10 por workspace" me faz sentir que estou
comprando uma coisa que não sei pra que serve — e ninguém acorda querendo comprar um workspace.
Se você quer cobrar por isso, precisa nomear o que eu ganho: "sua empresa separada da sua casa",
"seu MEI". Aí eu entendo. Aí eu também pergunto: por que R$10 se é só uma pastinha?

**O que me assusta de verdade é R$9,90 por conta de banco.** Eu tenho Nubank, Itaú e Inter — todo
mundo tem três. Então meu preço real não é R$19,90, é R$39,70, e eu descubro isso *depois* de
entrar. Isso não é preço, é multa por ter dinheiro em mais de um lugar. No Mobills eu ligo tudo
por uns 20 e não penso mais nisso. Preço que cresce conforme eu uso o app me deixa com medo de
usar o app.

**E olha a ironia:** a única coisa que você cobra é justamente a que eu tenho mais medo de fazer.
Passar minha senha de banco pra um site que eu nunca vi, sem CNPJ na tela, sem review? Eu digito
na mão, obrigado. Você está cobrando pelo item que eu recuso e dando de graça o que me faria
ficar.

**Marido/esposa de graça: óbvio que sim.** Cobrar duas vezes pelo mesmo dinheiro da mesma casa é
ofensivo. Só não chame de "compartilhar workspace" — chame de "sua esposa também entra, sem pagar
de novo".

Me venda um preço só, uma linha, contas ilimitadas, cônjuge incluído. Se eu preciso de calculadora
pra saber quanto vou pagar, eu fecho a aba.

### O Executor

**1) Cobrar por workspace: não. Não é preço, é código que você joga fora.**

Segunda-feira de manhã, cobrar por workspace significa escrever medição em duas dimensões antes do
primeiro cliente. E a medição não é a parte difícil — `COUNT(*) FROM Workspaces WHERE owner = X` é
uma linha. A parte difícil são os casos de borda que ninguém coloca no plano:

- cliente apaga um workspace no dia 12 — reembolso proporcional, crédito, ou nada? Você tem que
  decidir isso no código;
- Pix Automático tem **valor máximo no consentimento**. Assinatura variável significa que subir de
  R$19,90 para R$39,80 estoura o teto e exige novo consentimento — ou seja, upgrade = o cliente
  reautoriza no app do banco. Isso é churn embutido no fluxo de upgrade;
- o banco revoga o consentimento Open Finance e a conexão morre. Você cobra R$9,90 no mês seguinte
  por uma conexão que não sincroniza? Esse é o bug de cobrança que gera chargeback e post no
  Reclame Aqui.

E o pior: workspace é **autocontornável**. O cliente junta tudo num workspace só e paga R$10 a
menos. Você construiu o próprio botão de downgrade e vai pagar com uma semana de billing.

**2) Compartilhamento grátis: sim, porque custa zero linhas.** Está em produção, testado, papéis
definidos. Decisão de não escrever código é a decisão mais rápida que existe. Duas verificações
concretas: (a) `editor` não pode conectar conta bancária — o gate de R$4 é do pagante; (b) convite
não cria workspace no CNPJ do pagante.

**O caminho de segunda-feira:** um SKU, R$29,90, 3 conexões, cobrança fixa. A 4ª conexão, nos
primeiros 50 clientes, é um e-mail e um `UPDATE` manual. Billing medido você escreve quando 5
pessoas pedirem — aí você já sabe qual eixo elas realmente compram.

---

## 4. Rodada de revisão cruzada (anônima)

**Mapeamento revelado:**

| Letra | Conselheiro |
| --- | --- |
| A | O Executor |
| B | O Contrarian |
| C | O Outsider |
| D | O Expansionista |
| E | O Pensador de Primeiros Princípios |

**Placar de "resposta mais forte":** E (Primeiros Princípios) — 4 votos · A (Executor) — 1 voto.
**Placar de "maior ponto cego":** D (Expansionista) — 5 votos, unânime.

### Revisor 1

**Mais forte: E.** É a única que ataca a premissa em vez da tabela: você está precificando um eixo
que são 3–6 semanas de código e zero evidência de disposição a pagar. Também reenquadra
corretamente a pergunta 2 (assento não é receita, é retenção + aquisição) e dá o caminho
reversível. A é o melhor complemento operacional — o teto do Pix Automático no upgrade e o
"workspace é autocontornável" são os argumentos mais concretos da mesa.

**Maior ponto cego: D.** Constrói NRR e canal de contadores sobre zero clientes. Ignora que o
mesmo "workspace" que ela quer vender é a higiene de dados do produto, que `viewer` sem relação de
pagamento não é um SKU B2B, e propõe billing medido em dois eixos antes do primeiro real. O teto
de R$149 não resolve: muda a faixa, muda o consentimento.

**O que todas deixaram passar:** o custo fixo de R$160/mês dita o gate, não o múltiplo de 2,5× —
abaixo de ~40 assinantes conectados, qualquer preço de conexão é negativo; a regra do dono mede a
variável e ignora o piso. Corolários não ditos: preço de tabela não sobe depois (grandfathering
dos 50 primeiros é decisão de hoje) e os R$4 renovam anualmente, então churn no mês 2 queima
consentimento pago.

### Revisor 2

**Mais forte: A.** É a única que traduz a decisão em trabalho de segunda-feira e nomeia dois
defeitos que as outras não veem: o autocontorno e o bug de cobrar R$9,90 por conexão cujo
consentimento o banco revogou. Fecha com caminho executável.

**Maior ponto cego: D.** Vende expansão de receita (NRR > 100%) sem um único cliente que provou
pagar a primeira mensalidade. Pior: o canal contador que ela chama de "R$3k/mês por parceiro"
pressupõe painel multi-workspace, billing consolidado e `viewer` com visão entre workspaces. Nada
disso existe. E o teto de R$149 no Pix Automático aumenta a recusa no consentimento inicial.

**O que todas deixaram passar:** o break-even de 14–17 é artefato do Polp — sem Open Finance o
custo é a VM e o break-even é 2–3. **Transferência de titularidade:** casal separa ou pagante
cancela, e o convidado gratuito não tem billing para assumir o workspace. E o gateway: Pix
Automático recorrente exige PSP brasileiro (Asaas/Pagar.me); isso — não a filosofia — decide se
billing medido é viável.

### Revisor 3

**Mais forte: E.** É a única que ataca a premissa: você está precificando um recurso que não
existe e não tem prova de que alguém paga pelo app digitado à mão. A recomendação é acionável e
reversível. A vem logo atrás pelos mecanismos concretos; B acerta o essencial ao flagrar que
R$9,90 ÷ R$4 = 2,47× já viola a regra do dono no dia 1.

**Maior ponto cego: D.** Projeta NRR, canal de contadores e R$3k/mês por parceiro com zero
clientes — e nunca responde à objeção de A e B: cobrar por workspace ensina o usuário a juntar
tudo num só, o que zera a receita e degrada o rateio. (C tem o cego simétrico: "contas ilimitadas"
arrebenta a margem de R$4/consentimento.)

**O que todas deixaram passar:** o trial pede **cartão e conta bancária na mesma janela** — dois
pedidos de confiança num app sem marca; sequenciar isso é a decisão de lançamento, não o preço.
R$160/mês fixo é piso: abaixo de ~6 pagantes com conexão, cada conexão dá prejuízo. E o workspace
compartilhado não tem **estado de falha**: cartão falha, o convidado perde acesso; owner cancela,
quem herda? Isso é código de billing obrigatório.

### Revisor 4

**Mais forte: E.** É a única que ataca a premissa, não a tabela. A consequência prática é correta:
preço fixo, zero medidores, conexão cobrada na mão para os dez primeiros. A é a melhor segunda e
complementa E com o argumento decisivo contra workspace pago — é autocontornável.

**Maior ponto cego: D.** Recomenda construir billing medido sobre demanda que ela mesma inventou:
"3–5 caixinhas mentais" com zero clientes. E o canal de contador ignora que o token carrega **um**
`IdWorkspace` — `viewer` não é console multicliente, é `POST /Workspaces/switch` dez vezes, mais
papel de operador de dados sob LGPD. (C tem o seu: "contas ilimitadas" é exatamente o único item
com custo variável real.)

**O que todas deixaram passar:** ninguém falou de **cobrança anual antecipada**. Ela resolve de uma
vez os três problemas citados soltos: falha de cartão de 10–15%/mês, teto de consentimento do Pix
Automático e o ciclo de 12 meses do consentimento Open Finance — casando receita e custo no mesmo
prazo. E ninguém tratou o R$160/mês fixo da Polp como o gate real: são 5–6 assinantes de prejuízo
puro antes do primeiro sincronizado. Só ligue a Polp contra lista de espera já paga.

### Revisor 5

**Mais forte: E.** É a única que ataca a premissa da pergunta: você está precificando um eixo que
não existe em código. Os R$29,90 com 3 conexões (conselho de 03/08) e a tabela do dono dependem
igualmente de 3–6 semanas ainda não escritas. E ainda dá o teste certo. A é o melhor complemento.

**Maior ponto cego: D.** Vende NRR e o canal contador/planejador, mas prescreve billing medido em
dois eixos com zero clientes — e não vê que o próprio caso que defende quebra a arquitetura: o
token carrega **um** `IdWorkspace`, e `POST /Workspaces/switch` reemite. Contador com 10 clientes
exige troca de contexto, não papel `viewer`. Falta também LGPD/operador de dados.

**O que todas deixaram passar:** trial de 14 dias com conexão bancária queima R$4 por curioso —
sobre R$220/mês de piso, antes de qualquer receita. Libere conexão só após a 1ª cobrança. E
**plano anual pré-pago** é a resposta real à arquitetura de billing: mata dunning, teto Pix e
reconsentimento de uma vez. Nenhuma das cinco citou.

---

## 5. Síntese do Chairman

### Onde o conselho concorda

**1. Não cobrar por workspace — 4 de 5.** Contrarian, Primeiros Princípios, Outsider e Executor
convergiram por quatro caminhos independentes e chegaram no mesmo lugar: workspace é unidade de
isolamento de dados, não de valor. O Contrarian viu o dano ao núcleo (o usuário junta tudo num
workspace só, o rateio analítico vira lixo), Primeiros Princípios viu a natureza da coisa ("você
vira o único app que cobra por pasta"), o Executor viu o defeito comercial (é **autocontornável** —
você construiu o próprio botão de downgrade) e o Outsider viu o que o comprador vê (não sabe o que
é workspace, e se soubesse perguntaria por que R$10 por uma pastinha). Só o Expansionista defende.

**2. Compartilhamento gratuito — 5 de 5, unânime.** E por razões que se somam em vez de competir:
custa zero linhas de código (Executor), o segundo membro é o mecanismo de retenção e o canal de
aquisição, não um cliente (Primeiros Princípios), resolve o gargalo de confiança porque ninguém
conecta banco por um site sem marca mas conecta porque o cônjuge já usa (Expansionista), e cobrar
duas vezes pelo mesmo dinheiro da mesma casa é ofensivo (Outsider). Unanimidade em conselho é
rara. Trate como decidido.

**3. Billing medido é prematuro — 4 de 5.** Contrarian ("duas semanas de dunning e proration para
vender um SKU inventado"), Primeiros Princípios ("nenhuma linha de billing medido"), Executor ("um
SKU, cobrança fixa, `UPDATE` manual nos primeiros 50") e Outsider ("se eu preciso de calculadora,
fecho a aba"). Discorda apenas o Expansionista.

**4. O eixo que você está precificando não existe em código — 3 de 5 explicitamente** (Primeiros
Princípios, Outsider, Contrarian por implicação), e os 5 revisores cruzados ratificaram isso como o
argumento mais forte da mesa. A tabela do dono e os R$29,90-com-3-conexões do conselho de 03/08
dependem igualmente de 3 a 6 semanas ainda não escritas.

**5. A proposta piora o gargalo que ela deveria resolver — 3 de 5.** Preço que cresce conforme o
uso, sobre um item que o comprador já teme (entregar acesso bancário a um app sem marca), é o
oposto de construir confiança. O Outsider formulou a ironia com precisão: **você cobra justamente
pelo item que ele recusa e dá de graça o que o faria ficar.**

### Onde o conselho briga

**Briga 1: preço flat mata a expansão de receita, ou salva o lançamento?**

O Expansionista está sozinho, mas não está sendo tolo. O argumento real dele é: NRR acima de 100%
sem vender nada novo é o ativo mais valioso de um SaaS solo, R$29,90 flat não tem isso, e conexão
bancária satura em 2–3 e para. Isso é verdade. Contra ele, os outros quatro dizem que expansão de
receita sobre zero clientes é aritmética sobre demanda inventada, e que o eixo que ele escolheu é
o pior possível porque é autocontornável e degrada o produto.

Conselheiros razoáveis discordam aqui porque **estão otimizando horizontes diferentes**: o
Expansionista otimiza o ano 2 (onde ele está certo que flat é uma armadilha), os outros otimizam a
semana 1 (onde ele está errado que se resolve isso agora). A síntese: a pergunta "onde está a
expansão de receita" é legítima e o conselho subestimou; a resposta "workspace" é errada.

**Briga 2: quantas conexões no preço — zero, três ou ilimitadas?**

Primeiros Princípios: nenhuma, ainda — venda na mão para os dez primeiros. Executor: três
inclusas, 4ª por e-mail e `UPDATE`. Outsider: ilimitadas, porque "todo mundo tem três bancos e
R$39,70 é multa por ter dinheiro em mais de um lugar". Três posições incompatíveis, e a do Outsider
é a única com defeito fatal — dois revisores apontaram que conexão é **o único item da tabela com
custo variável real e recorrente** (R$4 por consentimento, renovando a cada 12 meses). "Ilimitado"
ali é margem negativa contratada por escrito.

**Briga 3: a regra dos 2,5× é uma regra ou uma racionalização?**

O Contrarian fez disso um teste de integridade: R$9,90 ÷ R$4 = 2,47×, então ou o preço é R$10,00
ou a regra nunca existiu. Os revisores rebateram por um ângulo melhor: **a regra está medindo a
coisa errada.** Ela cobre o custo variável e ignora os R$160/mês fixos. Um múltiplo de 2,5× sobre
a variável pode ser prejuízo puro enquanto o fixo não estiver coberto. O Contrarian está certo
sobre a disciplina e errado sobre a fórmula.

### Pontos cegos que só o peer review pegou

**1. O gate real é o custo fixo, não o múltiplo.** Quatro dos cinco revisores, independentemente,
apontaram que ninguém tratou os R$160/mês da Polp como o piso que decide tudo. Os revisores
discordam entre si na conta (~6 pagantes num revisor, ~40 em outro) e essa discordância é
informativa: o número depende inteiramente de quantas conexões cada assinante liga. A R$29,90 com
3 conexões inclusas, a margem de contribuição é ~R$18 e você precisa de ~9 pagantes conectados só
para pagar a plataforma. Vendendo conexão a R$9,90 (R$5,90 de margem), precisa de 27 conexões.
**O break-even de 14–17 é artefato da Polp:** sem Open Finance, o custo é a VM e o break-even é
2–3 assinantes.

**2. Plano anual pré-pago resolve três problemas com uma decisão.** Dois revisores chegaram nisso
sozinhos e nenhum conselheiro mencionou: a falha de cartão de 10–15%/mês, o teto de valor do
consentimento do Pix Automático e o ciclo de 12 meses do consentimento Open Finance são o **mesmo
problema visto de três lados**, e cobrança anual antecipada mata os três de uma vez, casando
receita e custo no mesmo prazo. Isso é a resposta à sua pergunta de arquitetura de billing, e ela
não estava em nenhum parecer.

**3. O trial de 14 dias com conexão ligada queima R$4 por curioso.** Sobre um piso de R$220/mês
(Polp + VM), antes de qualquer receita. Ninguém viu.

**4. O trial pede cartão e conta bancária na mesma janela.** Dois pedidos de confiança máxima num
app sem marca, simultâneos. Um revisor cravou: **sequenciar isso é a decisão de lançamento, não o
preço.**

**5. O workspace compartilhado não tem estado de falha definido.** Três revisores. O cartão do
pagante falha: o convidado perde acesso aos dados dele. O pagante cancela ou o casal separa:
**quem herda o workspace?** O convidado gratuito não tem relação de billing para assumir. Isso é
código que o compartilhamento "já implementado" não tem.

**6. O canal de contador do Expansionista é arquiteturalmente impossível hoje.** Dois revisores: o
token carrega **um** `IdWorkspace` e `switch` reemite. `viewer` não é console multicliente — é
`switch` dez vezes. Mais papel de operador de dados sob LGPD, que ninguém tratou.

**7. Grandfathering dos 50 primeiros é decisão de hoje, não de depois.** Preço de tabela não sobe
para quem já entrou. Você está decidindo o preço vitalício da sua coorte mais valiosa achando que
está decidindo um preço de teste.

**8. Sua coorte de retenção vai medir a coisa errada.** O Contrarian foi o único a ver: com
compartilhamento grátis, metade dos usuários ativos não aparece na receita. O gate de "50% de
retenção no mês 3 com 30+ pagantes" precisa de `IdUser` ativo por workspace instrumentado **desde
o primeiro dia**.

### A recomendação

**Pergunta 1 — cobrar por workspace: não. Mate a ideia hoje e não a revisite.**

Não é uma questão de preço, é de três defeitos que se compõem. É autocontornável (o cliente junta
tudo e paga menos — você construiu o botão de downgrade). Ao ser contornada, **degrada o núcleo do
seu produto**: o rateio analítico e o orçamento por competência dependem da higiene de dados que o
workspace dá, e você estaria cobrando para o usuário não sabotá-la. E é percebida como taxa
arbitrária por um comprador que já não confia em você — sua própria admissão, "não é algo que eu
tenho custo", é o veredito. O comprador sente isso mesmo sem saber articular.

Eu concordo com a maioria, mas registro onde o Expansionista tem razão e o conselho foi preguiçoso:
**preço flat para sempre é uma armadilha real** e você precisa de um eixo de expansão. O eixo é
conexão sincronizada (e, no ano 2, um console multi-workspace de verdade para contador — que exige
mudar o token, não reaproveitar `viewer`). Não é workspace. Workspace é grátis e ilimitado, para
sempre, e isso passa a ser argumento de venda: *"separe seu MEI da sua casa, sem pagar a mais."*

**Pergunta 2 — compartilhamento gratuito: sim. Unânime, e você já pagou o código.**

Mas gratuito não é "sem regra". Quatro travas, todas baratas:

1. `editor` e `viewer` **não podem** conectar conta bancária. O gate de R$4 é do pagante.
2. Convite nunca cria workspace novo sob o billing do pagante.
3. **Estado de falha definido antes do primeiro convidado:** pagante cancela ou falha o pagamento →
   workspace vira somente-leitura por 30 dias, e qualquer membro pode assumir a titularidade
   virando pagante. Sem isso, o primeiro casal que separar é seu primeiro Reclame Aqui.
4. Instrumente `IdUser` ativo por workspace desde o dia 1, ou seu gate de retenção mede fantasma.

E chame de gente: **"sua esposa também entra, sem pagar de novo"** — não "compartilhar workspace".

**A estrutura de preço:**

| Item | Preço |
| --- | --- |
| **Um SKU, mensal** | **R$ 29,90/mês** |
| **Um SKU, anual pré-pago (o padrão em destaque)** | **R$ 299,00/ano** (2 meses grátis) |
| Workspaces | **ilimitados, R$ 0** |
| Membros (editor/viewer) | **ilimitados, R$ 0** |
| Contas sincronizadas | **zero no lançamento** — o recurso não existe |
| Quando a Polp ligar | **3 inclusas**; da 4ª em diante **R$ 12,90** |

Por que estes números:

- **R$29,90 sem conexão, e não R$19,90.** Porque preço de tabela não sobe para quem já entrou. Se
  você lança a R$19,90 e sobe quando o Open Finance sair, sua coorte mais conectada — a mais cara
  de servir — fica travada no preço mais baixo para sempre. Lance no preço que o produto vai ter
  **completo** e entregue a conexão a essa coorte como cumprimento de promessa. O grandfathering
  deixa de ser dívida e passa a ser presente. Escreva na página hoje: *"os 50 primeiros mantêm
  R$29,90 e as 3 conexões, para sempre."*
- **R$12,90, não R$9,90, na conexão extra.** Sua regra dos 2,5× está medindo errado — ela cobre a
  variável e ignora os R$160/mês fixos. R$12,90 dá 3,2× sobre R$4 e começa a amortizar o fixo. E
  resolve o teste de integridade do Contrarian sem que você tenha que fingir que 2,47 é 2,5: a
  regra fica **mais** rigorosa, não mais frouxa.
- **Anual pré-pago em destaque.** É a resposta real à sua pergunta de arquitetura de billing: mata
  o dunning dos 10–15% de falha de cartão, mata o teto de valor do consentimento do Pix Automático
  (um valor, um consentimento, nunca recoletado), e casa o prazo da receita com o ciclo de 12 meses
  do consentimento Open Finance. Um eixo variável com Pix Automático teria te custado duas semanas
  e churn embutido no fluxo de upgrade.
- **Nenhuma conexão no trial.** Libere sincronização só após a **primeira cobrança confirmada**.
  Curioso de 14 dias não queima R$4 seu.
- **Não peça cartão e banco na mesma janela.** Cartão no cadastro (já decidido), banco só depois da
  primeira cobrança — o que a regra acima já garante de graça. Dois pedidos de confiança
  simultâneos num app sem marca é onde você perde o cadastro.
- **Rejeito "contas ilimitadas"** do Outsider. É o único item da sua tabela com custo variável
  recorrente. Ilimitado ali é margem negativa por contrato.
- **Não ligue a Polp** até ter lista de espera **já paga** pedindo conexão. Os R$160/mês fixos são
  5 a 9 assinantes de prejuízo puro antes do primeiro sincronizado, e o break-even de 14–17
  desaparece se você simplesmente não ligar ainda: sem Open Finance, seu break-even é a VM — 2 a 3
  assinantes.

Zero medidores. Zero proration. Zero dunning. Uma linha na página de preço.

### A primeira coisa a fazer

**Cobre o primeiro pagante à mão, a R$29,90, por link de pagamento do seu PSP — sem escrever uma
única linha de billing e sem contratar a Polp.** Se ninguém pagar por parcelamento com perna,
rateio duplo e orçamento por competência digitados à mão, nenhuma tabela de preço desta reunião
importa. Se alguém pagar, você acabou de descobrir, de graça, qual eixo ele realmente compra — e
só então escreve billing para esse eixo.

---

*Conselho realizado em 18/09/2026 · 5 conselheiros independentes · 5 revisões cruzadas anônimas ·
1 síntese do Chairman.*
