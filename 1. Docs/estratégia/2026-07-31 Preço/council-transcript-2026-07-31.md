# Transcrição do LLM Council — 31/07/2026

**Pauta:** preço mensal da licença e percentual de faturamento em marketing inicial, para um app de controle financeiro pessoal (Brasil).

---

## 1. Pergunta original (do usuário)

> Estou montando um aplicativo de controle financeiro para pessoas físicas, a ideia é ser algo simples que várias pessoas possam usar, preciso de ajuda para definir 2 pontos:
>
> 1 — Qual será o preço cobrado mensalmente dos usuários
> 2 — Quanto eu deveria investir em marketing inicialmente, pensando em percentual de faturamento
>
> Atualmente eu estimo os custos dele como sendo muito baixos, algo no máximo em torno de 100 a 200 reais por mês, e imaginei que uma licença seria de 15 a 20 reais, onde 10 usuários já batem o custo da operação. E o resto seria investido em marketing e melhorias para o produto.

---

## 2. Pergunta enquadrada (enviada aos 5 conselheiros)

> Desenvolvedor solo brasileiro está construindo um app de controle financeiro pessoal (pessoa física), simples, para várias pessoas usarem. Stack própria (Node/TypeScript/Express/Knex/MySQL, socket.io) — o custo de desenvolvimento é o próprio tempo dele. Infra estimada em R$100–200/mês no máximo. Hipótese dele: licença de R$15–20/mês; cerca de 10 assinantes já cobrem o custo da operação; o excedente vai para marketing e melhorias do produto. Concorrência no Brasil: Mobills, Organizze, Minhas Economias, YNAB, além de planilhas gratuitas e dos próprios apps de banco (Nubank, Itaú) com gestão financeira embutida.
>
> Duas decisões a tomar:
> (1) Qual o preço mensal cobrado dos usuários?
> (2) Quanto investir em marketing inicialmente, como percentual do faturamento?
>
> O que está em jogo: escolher errado o preço ancora o produto num segmento difícil de sair; queimar caixa em marketing sem retenção provada mata o projeto.

**Contexto varrido do workspace:** o repositório é a API do projeto (`CLAUDE.md` técnico, Node/TS/Express/Knex/MySQL, socket.io, cache in-memory, JWT próprio, criptografia AES com chave/IV fixos em `Utils/criptManager.ts`). Não há memória de negócio, dados de receita ou pesquisa de audiência salvos — o contexto comercial veio inteiramente da mensagem do usuário.

---

## 3. Pareceres dos conselheiros

### O Contrarian

Seus dois números escondem a pergunta que você está evitando: **quantas pessoas que não são suas amigas usaram isso por 90 dias seguidos?** Se a resposta é zero, preço e marketing são decisões fictícias.

A falha fatal não é preço, é entrada manual de dados. Mobills e Organizze têm Open Finance — o gasto aparece sozinho. O seu exige que a pessoa digite o pão de queijo. Apps de finanças pessoais perdem 60–80% dos usuários em 60 dias justamente por isso. E o Nubank faz de graça, dentro do app onde o dinheiro já está. Quando você for buscar agregador (Pluggy, Belvo), sua infra de R$100–200/mês vira R$1–3 por conta conectada por mês — a conta some.

"10 assinantes cobrem o custo" é uma armadilha psicológica. Cobre custo de servidor, não seu tempo. Você vai comemorar R$180/mês e passar dois anos preso num projeto que nunca precisou provar nada.

Marketing como % do faturamento é raciocínio circular: 20% de R$180 são R$36. CAC de app financeiro no Brasil é R$50–150 pago. Com R$18/mês e retenção mediana de 4 meses, LTV bruto é R$72 — menos taxa de gateway, 10–15% de cartão recusado, imposto. Unit economics negativa no dia um.

E: você guarda dado financeiro de terceiros, sozinho, com auth própria e chave AES fixa no código. LGPD não perdoa dev solo.

Se for cobrar: **R$29, não R$15–20**. Preço de incumbente com 1/10 das features é a pior posição do mercado, e barato atrai quem mais cancela.

Marketing: **0%**. Zero, até 20 estranhos passarem de 60 dias com retenção acima de 40%.

### O Pensador de Primeiros Princípios

Vocês estão precificando um produto que ainda não tem motivo para existir. As duas perguntas são consequências de uma decisão que não foi tomada: para quem, e por que não o app do banco.

Três suposições que precisam cair:

**1. "Infra = R$100–200/mês fixo."** Falso no momento em que você resolver o único problema real dessa categoria: entrada de dados. Ninguém abandona Mobills por causa da interface — abandona porque digitar gasto por 3 semanas é insuportável. A solução é Open Finance (Pluggy, Belvo), que cobra por conexão por usuário. Seu custo vira variável, R$5–15/usuário/mês. A R$15 de preço, sua margem some. Se você não resolve entrada de dados, é planilha com login e perde para o grátis. Essa é a decisão real — e ela define o preço, não o contrário.

**2. "10 assinantes cobrem a operação."** Cobrem a AWS, não você. R$200/mês contra um custo de oportunidade de R$100+/hora de dev. Breakeven de verdade não é a fatura de infra, é o seu tempo. Defina o número mínimo abaixo do qual você mata o projeto — algo como 150 assinantes pagantes em 12 meses — e trate qualquer coisa abaixo disso como sinal de encerramento, não de "precisa de mais marketing".

**3. "Marketing como % do faturamento."** 20% de R$300 é R$60. Métrica inexistente. Antes de retenção provada (60%+ ativos no mês 3), o orçamento correto em mídia paga é R$0. Distribuição paga em tempo, não em caixa.

Reenquadramento: PF genérica a R$15–20 é o pior segmento do Brasil — maior CAC, maior churn, substituto grátis com dados melhores. MEI e autônomo misturam pessoal e empresarial, nenhum banco resolve, e pagam R$49–79 sem piscar. Mesmo código, cliente diferente.

Não seja mais barato que o Mobills. Seja para outra pessoa.

### O Expansionista

**Preço: R$20 é o erro caro aqui — não porque é barato, mas porque é uma promessa pequena.**

Quem cobra R$15-20 está vendendo "onde foi meu dinheiro". Isso o Nubank te dá de graça e o Mobills te dá com anúncio. Você não ganha essa guerra e nem deveria querer.

Cobre R$39/mês. E justifique com a única coisa que os apps de banco estruturalmente não fazem: **visão consolidada entre instituições**. Open Finance via Pluggy/Belvo custa por conexão, mas transforma o produto de "planilha bonita" em "o único lugar onde eu vejo tudo". Isso sustenta R$39 e mata a comparação com grátis.

Três alavancas que você já tem construídas e não está cobrando por:

1. **Socket.io + cache multiusuário = plano casal.** Finança compartilhada é o caso de uso com maior retenção do mercado — dois cônjuges nunca cancelam junto. R$59/mês, e o CAC se divide por dois usuários.
2. **MEI/autônomo** misturando PF e PJ. Segmento enorme, mal atendido, e paga R$79 sem piscar porque o concorrente mental é o contador.
3. **Founding member vitalício: R$497, 100 vagas.** R$50k de caixa antes de você ter retenção provada. Isso é capital de risco sem diluição.

**Marketing: 0% do faturamento.** Percentual de R$200 é ruído. Sua moeda é tempo — 40% dele em distribuição. Recrute os 50 primeiros à mão, um a um. Ads só depois que o mês 3 de retenção passar de 60%.

O maior risco aqui não é errar o preço para cima. É construir por 18 meses um produto de R$20 e descobrir que R$39 teria custado o mesmo trabalho.

### O Outsider

Sou o cara que ia baixar esse app. Três coisas que travam antes de qualquer discussão de preço.

**Primeira: eu já tenho isso de graça.** Abro o Nubank e vejo meus gastos por categoria, sem digitar nada. Se o seu app me pede pra lançar despesa na mão, você não está competindo por R$19 — está competindo contra "dá trabalho". Preço nenhum resolve isso.

**Segunda: por que eu confiaria dinheiro a um app sem nome?** Vou procurar quem é você, quantas pessoas usam, o que acontece com meus dados. Não achando nada, fecho. Isso é anterior ao preço.

**Terceira: R$19,90/mês me soa caro porque eu comparo com Spotify e Netflix, não com Mobills.** Um app que me lembra que gastei demais custando o mesmo que meu entretenimento? Cancelo em fevereiro, junto com a academia.

**Preço:** cobre **anual, R$99–119, pago de uma vez**. Controle financeiro é promessa de Ano Novo — eu pago animado em janeiro e esqueço. No mensal eu desisto no terceiro mês e você nunca vê retenção real. E some com a decisão de R$15 vs R$20: pra mim é a mesma coisa, eu não sei julgar o valor ainda.

**Marketing: 0% agora.** Anúncio de app financeiro feito por desconhecido cheira a golpe. Você compraria? Gaste tempo, não dinheiro: coloque 30 pessoas reais usando de graça e pergunte por que voltaram.

**O que eu compraria de verdade:** o app onde eu e minha esposa vemos a mesma conta. Isso o Nubank não faz. Isso a planilha faz mal. Se o produto for "financeiro do casal/família", eu pago sem pensar no preço. Se for "mais um app de gastos", nenhum preço funciona.

### O Executor

**Preço: R$19,90/mês, com anual a R$179 (25% off). Decida hoje e pare de pensar nisso.**

Os R$9,90 são armadilha: mesmo esforço de suporte, metade da receita, e sinaliza "brinquedo" contra Mobills/Organizze. R$19,90 fica abaixo do YNAB e acima do ruído gratuito. E o anual é o que importa — ele resolve seu caixa de infra por 12 meses de uma vez e mata o churn mensal por esquecimento.

**Marketing como % do faturamento: zero, porque a conta não existe.** Com 10 assinantes você fatura R$200/mês. 20% disso é R$40. R$40 não compra nada em ads — compra 15 cliques e nenhum dado. Percentual de faturamento é métrica de empresa com faturamento. Você tem uma planilha.

O que fazer na segunda-feira:

1. **Checkout antes de qualquer feature.** Asaas ou Mercado Pago com assinatura recorrente e PIX. Um dia de trabalho. Sem isso, tudo o resto é hobby.
2. **Importação de OFX/CSV.** Ninguém migra de planilha ou do Mobills digitando 6 meses de lançamento à mão. Se seu app não importa extrato, seu preço é irrelevante — não há venda.
3. **Trinta pessoas, na mão.** Grupos de WhatsApp, comunidades de finanças, seu círculo. Cobre desde o primeiro. Gratuito não valida nada.
4. **Teto fixo de R$300/mês em ads, e só depois de 3 meses com retenção acima de 70%.** Antes disso você está pagando para descobrir que o produto não segura ninguém.

Seu risco real não é ancorar preço errado. É construir seis meses e nunca ter cobrado de ninguém.

---

## 4. Rodada de revisão cruzada (anônima)

**Mapeamento de anonimização** (revelado após a rodada):

| Letra | Conselheiro |
|---|---|
| A | O Outsider |
| B | O Executor |
| C | O Contrarian |
| D | O Expansionista |
| E | O Pensador de Primeiros Princípios |

### Revisor 1

**1. Mais forte: E.** É a única que ataca a premissa em vez do número. Mostra que "infra R$100–200 fixo" quebra no instante em que Open Finance entra (custo vira variável por usuário), define critério de morte falsificável (150 assinantes em 12 meses) e reposiciona o cliente (MEI/autônomo, R$49–79) em vez de brigar por preço em PF genérica. D chega perto e é melhor em empacotamento (plano casal, founding member), mas E dá o teste que impede o projeto de virar zumbi.

**2. Maior ponto cego: A.** Boa etnografia (confiança, atrito, casal), mas recomenda anual R$99–119 — ~R$9/mês — exatamente o preço que C e E provam ser margem negativa assim que houver agregador. A confunde "o que eu pagaria hoje" com "o que sustenta o produto", e ignora custo variável, LGPD e o fato de que anual antecipado esconde churn por 12 meses.

**3. Todos deixaram passar:** ninguém tratou Open Finance como barreira regulatória (Pluggy/Belvo exigem consentimento e instituição autorizada; não é só custo), nem CNPJ/nota fiscal/Simples, nem falha de cobrança recorrente no cartão no Brasil (~10–15% ao mês) que corrói o LTV já apertado. E os cinco disseram "0% em marketing" sem nomear o canal que substitui a mídia paga — unanimidade sem alternativa concreta.

### Revisor 2

**1. Mais forte: E.** É a única que ataca a premissa de custo, não o preço: com Open Finance o custo vira variável (R$5–15/usuário), e a R$15 a margem some — isso invalida o cálculo dos "10 assinantes" na origem. Soma a isso um critério de morte explícito (150 pagantes em 12 meses) e o reposicionamento de segmento. D chega perto e é melhor em monetização (casal, MEI, founding member vitalício), mas não define quando desistir.

**2. Maior ponto cego: B.** É a mais acionável e por isso a mais perigosa: manda travar R$19,90 e partir para checkout sem nunca perguntar se o produto tem razão de existir contra o app do banco. Ignora custo variável de agregador, LGPD (C é a única que vê) e trata churn como problema futuro. Cobrar rápido em cima da tese errada só acelera a confirmação do erro.

**3. Todos deixaram passar:** (a) se for app nativo, Apple/Google levam 15–30% — o R$19,90 vira R$14 líquido antes do gateway; (b) recorrência no cartão no Brasil falha 10–15%/mês, exigindo dunning e PIX recorrente; (c) consentimento de Open Finance expira em 12 meses e precisa ser renovado — é churn estrutural embutido.

### Revisor 3

**1. Mais forte: E.** É a única que derruba as duas premissas ao mesmo tempo: mostra que "infra fixa R$100–200" morre no instante em que você resolve entrada de dados (custo vira variável por usuário), e substitui "% de marketing" por um critério de morte verificável (150 assinantes em 12 meses). D chega perto e tem a melhor escada de preço; C tem a melhor aritmética (LTV R$72 vs CAC R$50–150) e o único alerta de LGPD/chave AES fixa.

**2. Maior ponto cego: B.** Trata o problema como execução ("decida e pare de pensar"), mas crava R$19,90 no segmento exatamente que C e E provam ser o pior do Brasil. OFX/CSV é curativo: quem exporta OFX manualmente é quem já usa planilha. B otimiza velocidade dentro de uma tese não validada.

**3. O que todas erraram:** agregador de Open Finance não é custo por conexão — Pluggy/Belvo exigem CNPJ, contrato e mínimo mensal na casa dos milhares. Isso inviabiliza R$100–200/mês antes de qualquer preço. Ninguém tocou em CNPJ para recorrência, teto do MEI, corte de 15–30% de app store, nem no compromisso de exportação de dados se o dev solo desistir.

### Revisor 4

**1. Mais forte: E.** É a única que ataca a premissa em vez do número. Mostra que "infra fixa R$100–200" morre no instante em que você resolve entrada de dados (custo vira variável por usuário), redefine breakeven como o seu tempo, e dá um critério falseável de morte (150 assinantes em 12 meses). O reenquadramento "não seja mais barato que o Mobills, seja para outra pessoa" (MEI/autônomo) é a única saída da guerra de preço. D chega perto, mas assume disposição a pagar R$39 sem evidência.

**2. Maior ponto cego: B.** Trata o problema como velocidade de execução e ignora a estrutura de custo que C, D e E expõem. Teto de R$300/mês em ads com CAC de R$50–150 compra 2 a 6 usuários — não é orçamento, é ruído. E "cobrar desde o primeiro" só funciona se o produto já vencer o grátis; B coloca OFX como item 2, não como condição.

**3. Todas erraram três coisas:**
- **Onde** recrutar. Cinco dizem "50 na mão", nenhuma nomeia canal (comunidades de planilha, finfluencers, ASO).
- **Custo de cobrar**: gateway + imposto + CNPJ comem 10–15% da mensalidade.
- **Bus factor**: por que pagar a um dev solo que pode sumir? Exportação aberta é feature de vendas.

### Revisor 5

**1. Mais forte: E.** É a única que ataca a premissa estrutural, não o número: custo vira variável com Open Finance (destrói a conta de R$100–200 fixos), define critério de morte do projeto (150 assinantes em 12 meses) e troca o segmento em vez de brigar por preço. C chega perto no unit economics (LTV R$72 vs CAC R$50–150), mas para no diagnóstico; E entrega decisão.

**2. Maior ponto cego: D.** Prescreve R$39 + Open Finance + "founding member vitalício R$497" sem notar que vitalício é passivo eterno de suporte e infra por conta conectada — receita única contra custo recorrente. Também assume que um dev sem marca consegue ancorar premium, exatamente o que A demole ("por que eu confiaria dinheiro a um app sem nome?").

**3. O que os cinco deixaram passar:** ninguém verificou se ele *consegue* contratar Pluggy/Belvo — exige CNPJ, contrato e diligência; sem isso, toda a tese de Open Finance de C, D e E é inexequível. Ninguém tratou tributação e limite do MEI, nem plano de saída (o que acontece com dados financeiros de terceiros se ele parar). E ninguém questionou canal: contadores e criadores de finanças como distribuição B2B2C derrubariam o CAC que todos citam como fatal.

**Placar da revisão:** E (Primeiros Princípios) — 5 votos de 5 como resposta mais forte. Pontos cegos: B (Executor) 3 votos, A (Outsider) 1, D (Expansionista) 1.

---

## 5. Síntese do Chairman

### Onde o conselho concorda

- **"% do faturamento em marketing" é a pergunta errada — 5 de 5.** 20% de R$200 é R$40; compra ~15 cliques e zero aprendizado. Percentual de faturamento é métrica de empresa que já tem faturamento.
- **R$15–20 é o pior lugar do mercado — 4 de 5 subiram o preço.** Preço de incumbente com 1/10 das features, e barato atrai quem mais cancela.
- **"10 assinantes cobrem o custo" é armadilha.** Cobrem o servidor, não o seu tempo. O risco não é falir — é passar dois anos num projeto que nunca precisou provar nada.
- **O gargalo é atrito de entrada de dados, não preço.** Enquanto for lançamento manual, o concorrente não é o Mobills — é "dá trabalho", e o app do banco já resolve de graça.

### Onde o conselho briga

1. **Preço.** Espectro completo: R$9/mês equivalente (Outsider, anual R$99–119) → R$19,90 (Executor) → R$29 (Contrarian) → R$39 (Expansionista) → R$49–79 com troca de segmento (Primeiros Princípios). A revisão derrubou as duas pontas: R$9 é margem negativa; R$39 exige marca inexistente.
2. **Open Finance é obrigatório ou inviável?** Três conselheiros o tratam como condição de existência do produto; três revisores independentes apontaram que Pluggy/Belvo exigem CNPJ, contrato e mínimo mensal na casa dos milhares — potencialmente inacessível hoje. É a incerteza mais cara da mesa.
3. **Para quem é isso?** PF genérica vs. MEI/autônomo (R$49–79) vs. casal/família (maior retenção do mercado; o Outsider "pagaria sem pensar no preço").

### Pontos cegos que só o peer review pegou

- Viabilidade contratual de Pluggy/Belvo (CNPJ + mínimo mensal) — **crítico**, reordena o roadmap inteiro.
- App store leva 15–30% se for app nativo: R$19,90 vira ~R$14 líquido.
- Recorrência de cartão falha 10–15%/mês no Brasil — exige dunning e PIX recorrente.
- Consentimento de Open Finance expira em 12 meses: churn estrutural embutido.
- "Founding member vitalício R$497" é passivo eterno contra custo variável recorrente — ideia morta.
- Nenhum conselheiro nomeou um canal concreto. Cinco "0% em ads" sem alternativa nomeada.
- Bus factor do dev solo: exportação aberta de dados é feature de vendas, não de engenharia.
- CNPJ, imposto e gateway comem 10–15% da mensalidade antes de qualquer marketing.
- LGPD: dado financeiro de terceiros com chave/IV AES fixos em `Utils/criptManager.ts`.

### A recomendação

**Preço: R$29/mês, anual R$249 (≈R$20,75/mês), plano casal/família R$45.** R$29 é o único ponto que sobrevive à aritmética — com CAC pago de R$50–150 e retenção mediana da categoria, R$18/mês dá economia unitária negativa no dia um, e R$39 exige uma marca que ainda não existe. Para os 100 primeiros: R$19 travado por **24 meses**, nunca vitalício.

**Marketing: 0% do faturamento em mídia paga.** A métrica correta não é percentual, é gatilho. Substitua orçamento em dinheiro por orçamento em tempo: 40% da semana em distribuição manual. Ligue ads apenas quando uma coorte de 30+ pagantes desconhecidos passar de 50% de retenção no mês 3; a partir daí, teto absoluto em reais com CAC pago ≤ 40% do LTV bruto de 12 meses. O benchmark de "20–40% da receita em marketing" é de SaaS maduro — aplicá-lo agora é dividir zero por zero.

**Reenquadramento a levar a sério:** a decisão que importa não é R$15 ou R$20 — é para quem. "Mais um app de gastos" não vence o app do banco em preço nenhum. "Onde eu e minha esposa vemos a mesma conta" ou "o app do MEI que separa PF de PJ" vence, e o mesmo código serve os dois.

### A primeira coisa a fazer

**Pré-venda para 10 estranhos a R$29, esta semana.** Landing page com o posicionamento escolhido (aposta: casal/família), checkout recorrente Asaas ou Mercado Pago com PIX, cobrança de verdade — não lista de espera, não gratuito. Um único teste responde as duas perguntas do conselho e mais uma que não foi feita: se ninguém desconhecido paga R$29, o problema nunca foi preço nem marketing.

---

*Conselho realizado em 31/07/2026 · 5 conselheiros independentes · 5 revisões cruzadas anônimas · 1 síntese do Chairman.*
