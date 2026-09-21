# Transcrição do LLM Council — 02/08/2026

**Pauta:** avaliar as notas do usuário contra o veredito do conselho de 31/07. Duas perguntas: (A) o preço está bom? (B) vale a pena ter um plano gratuito?

**Conselho anterior:** [council-transcript-2026-07-31.md](council-transcript-2026-07-31.md)
**Notas avaliadas:** [2026-07-31 Consil.md](Negócios/Gastos%20mensais/estratégia/2026-07-31%20Preço/Notas.md)

---

## 1. Pergunta original (do usuário)

> Observe o conteúdo do último conselho, e as notas que eu fiz. Avalie as notas com o conselho, preciso saber se preço está bom, e se vale a pena ter um plano gratuito.

---

## 2. Pergunta enquadrada (enviada aos 5 conselheiros)

> **Este é o SEGUNDO conselho.** Em 31/07/2026 o conselho já se reuniu sobre o mesmo produto. O usuário fez anotações desde então e tomou decisões que em parte CONTRARIAM o conselho anterior.
>
> **O produto:** app de controle financeiro pessoal ("Gastos Mensais"), Brasil, dev solo. Node/TypeScript/Express/Knex/MySQL, socket.io. Concorrência: Mobills, Organizze, Minhas Economias, YNAB, planilhas grátis, e os apps de banco.
>
> **Veredito do conselho anterior (31/07):** R$29/mês, anual R$249, casal/família R$45, 100 primeiros a R$19 por 24 meses. Marketing 0% em mídia paga até coorte de 30+ pagantes desconhecidos passar de 50% de retenção no mês 3. Consenso de que R$15–20 é "o pior lugar do mercado". Gargalo = atrito de entrada de dados. Alerta de que Pluggy/Belvo exigem CNPJ e mínimo na casa dos milhares.
>
> **As notas do usuário (decisões tomadas depois):**
> - Aceitou 0 investimento em marketing até ~150 usuários/mês.
> - Custo de Open Finance: Pluggy/Belvo ~R$2.500/mês. Alternativa em estudo, "Polp": R$160/mês fixo + R$4 por usuário.
> - A integração é passo obrigatório: "o produto não vende grandemente sem ela, é praticamente uma planilha paga".
> - Rejeitou o plano exclusivo para casal: "o casal tem mais dinheiro mas nem por isso iria pagar tanto. O ideal é um plano básico e avançado."
> - Plano básico: R$19,90/mês, 1 integração Open Finance.
> - Plano "casal": R$29,90/mês, 3 integrações Open Finance.
> - Infra: VM própria, teto R$60/mês. Futuramente AWS.
> - Plano gratuito (se existir): cadastros limitados, sem relatórios e gráficos, apenas visão mês a mês, sem exportação, sem Open Finance.
>
> **Perguntas abertas dele:**
> 1. Como fazer pagamento recorrente? Mercado Pago só aceita cartão. Quer PIX e "pagar conforme usa".
> 2. Vai ter plano free? Qual taxa de conversão esperar? Quantos planos pagos pagam um plano free? Qual o mínimo aceitável?
>
> **O que está em jogo:** ele baixou o preço abaixo do recomendado e agora tem custo variável real por usuário. Se a matemática unitária não fechar, ele escala para o prejuízo. E um plano free mal calibrado, com custo fixo de R$160+R$60/mês, pode consumir a operação antes de gerar um pagante.

**Contexto varrido do workspace:** pasta `Negócios/Gastos mensais/estratégia` (transcrição de 31/07, notas do usuário, relatório HTML do primeiro conselho). Não há memória de negócio, dados de receita ou pesquisa de audiência salvos.

---

## 3. Pareceres dos conselheiros

### O Contrarian

**A matemática que ele não fez.**

Custo fixo real: R$160 (Polp) + R$60 (VM) = R$220/mês.

Plano básico R$19,90 – R$4 (OF) – ~R$1,00 (gateway) – ~R$1,20 (imposto) = **R$13,70 líquidos**. Margem 69%.
Plano "casal" R$29,90 – R$12 (3 OF) – ~R$1,30 – ~R$1,80 = **R$14,80 líquidos**. Margem 50%.

Aí está a falha fatal: ele cobra **R$10 a mais para entregar R$8 a mais de custo**. O upgrade rende R$1,10. A estrutura de preço está invertida em relação à estrutura de custo — quanto mais o produto vende o plano "bom", pior fica a margem. E se o usuário do plano de R$29,90 usar só 1 conexão, ele pagou por capacidade ociosa e vai reclamar; se usar 3, você quase trabalha de graça.

Segundo furo: o gatilho de "150 usuários/mês" foi derivado do custo Pluggy de R$2.500. Com Polp, o break-even é **17 assinantes**, não 150. Ele está carregando uma meta de marketing herdada de premissas que ele mesmo já descartou.

Terceiro: R$13,70 é a margem *antes* de 10–15% de falha de recorrência no cartão. Real: ~R$12. E se algum dia for app nativo, a loja come R$6 e sobra R$8 — o plano básico vira caridade.

O plano free proposto (sem OF, sem relatórios, sem exportação) não custa dinheiro — custa pior: ele demonstra exatamente a "planilha paga" que o conselho identificou como o problema. Você vai gastar aquisição para ensinar as pessoas que seu produto é medíocre.

**(A)** R$24,90 básico com 1 integração; R$39,90 com 3. Integração extra R$9,90. Nunca venda conexão abaixo de 3x o custo.
**(B)** Sem free. Trial de 14 dias **com** Open Finance ligado — o valor está lá, não na versão capada.

### O Pensador de Primeiros Princípios

**A premissa quebrada: você derivou a meta de usuários de um custo que ainda não pagou, por uma feature que ainda não validou.**

"150 usuários/mês" não veio do mercado, veio da fatura da Pluggy. Você inverteu a causalidade — está dimensionando o negócio para caber num fornecedor. A pergunta real não é "qual preço cobre o Open Finance". É: *por que Open Finance?* Porque resolve atrito de entrada de dados. Isso é um fim; Open Finance é só um meio — e o mais caro de todos. OFX/CSV dos bancos, leitura de notificação no Android, encaminhamento de e-mail de fatura: custo variável zero. Se o atrito é mesmo o gargalo, teste o gargalo com o meio de R$0 antes de comprar o de R$4/usuário. Se ninguém importa um OFX, ninguém vai conectar conta bancária tampouco.

**O erro estrutural no preço:** R$19,90 → R$29,90 é +50% de receita para +200% de custo variável. Com Polp a R$4/conexão, o plano "caro" tem margem igual ou pior que o básico. Você construiu um upsell que destrói margem. Some 5% de gateway e 10–15% de falha de recorrência: R$29,90 vira ~R$24 líquido menos R$12 de custo = R$12. Idêntico ao básico. Seu produto premium é economicamente inútil.

**"Vale plano free?" também é a pergunta errada.** Free não é modelo de receita, é canal de distribuição — e só funciona com viralidade ou tráfego de topo. Você tem zero marketing e zero usuários. Free sem distribuição é só custo fixo.

**(A) Preço:** R$24,90 base com 1 conexão, +R$9 por conexão adicional. Anual R$249 pago à vista no PIX — resolve sua pergunta 1 e mata a falha de recorrência.
**(B) Free:** não. Trial de 21 dias sem cartão. Só isso.

### O Expansionista

**O custo variável que ele teme é o melhor ativo dessa estrutura.**

Polp a R$160 + R$4/usuário destrói o argumento dos 150 usuários. Com Pluggy, o break-even era ~150 pagantes. Com Polp, é 11. O indicador mínimo dele está errado por um fator de 13x — e ele está postergando marketing por causa de um número fantasma. Margem bruta a R$19,90 com R$4 de custo: 80%. Isso é margem de SaaS de verdade, não de app de nicho.

**O plano de 3 integrações não é "casal" — é o produto real.** Quem tem Nubank + Itaú + corretora é uma pessoa só. Ele acabou de inventar precificação por conexão sem perceber, e isso responde a pergunta 1 dele: "pagar conforme usa" = crédito de conexão via PIX. Add-on de R$8 por conexão extra é margem de 100%. Não trave o teto em R$29,90 — quem tem 6 contas paga R$49,90 sem piscar.

**A adjacência escondida:** cada cliente de um contador ou assessor é uma conexão. O mesmo motor de R$4/conexão vira produto B2B com ticket 10x. Não construa agora — mas não modele preço de forma que impeça isso.

**Free:** o custo marginal de um free sem Open Finance é essencialmente zero (VM já paga). O "risco de consumir a operação" não existe se free = sem conexão bancária. O que free realmente faz: substitui a planilha grátis, gera SEO e boca-a-boca com CAC zero, e transforma a dor de digitar manualmente no melhor argumento de venda que ele tem.

**(A)** Mantenha R$19,90 como entrada, mas crie R$29,90 (3 conexões) e R$49,90 (ilimitado/6). Add-on de conexão avulsa a R$8. Anual com desconto pago via PIX à vista.
**(B)** Sim. Free permanente, sem Open Finance, sem relatórios. Meta 4% de conversão; abaixo de 2% o funil está quebrado, não o preço.

### O Outsider

Sou o cara que baixaria isso. Reagindo do jeito que reagiria na loja.

**"1 integração Open Finance."** Eu não sei o que isso é. E quando entendo — "conecta 1 banco" — já é problema: eu tenho Nubank, conta salário no Itaú e um cartão do Inter. Uma conta só me deixa com metade dos gastos digitados na mão. Ou seja, pago R$19,90 e continuo digitando. Fecho a página aqui.

**O "plano casal" me irrita.** Se chama casal mas minha esposa não tem login? Então não é plano de casal, é plano de 3 bancos com nome errado. Isso me faz desconfiar do resto do app. Renomeia: "Básico 1 conta" / "Completo 3 contas". Aí eu entendo em 2 segundos e não me sinto enganado.

**O gratuito, como está descrito, é ofensivo.** "Sem gráficos, sem exportação, sem integração, cadastros limitados, dados corridos mês a mês" — isso é uma planilha pior que a planilha grátis que eu já baixo no Google. Ninguém vira cliente de um app que me deixou com gosto ruim na boca. Free assim não vende o pago, ele prova que o pago não vale.

**O que me faria pagar:** ver os gastos do MEU banco, categorizados, sem eu digitar nada, ANTES de dar meu cartão. 14 dias com tudo liberado. Se depois disso eu voltar pro Nubank, o app não era bom mesmo.

**Preço:** R$19,90 é Spotify. Spotify eu uso todo dia. Isso eu abro 2x por mês. Dói.

**(A)** Mantenha R$19,90, mas entregue 2 contas nele — 1 conta não resolve a vida de ninguém. E R$34,90 no completo com login pro cônjuge de verdade.
**(B)** Não faça free permanente. Faça trial de 14 dias com tudo. Um free capado destrói mais confiança do que gera conversão.

### O Executor

**Trava de segunda-feira: resolvida.** Pix Automático do BC está em produção desde janeiro/2026 e o Asaas já expõe via API (Jornada 3: consentimento captado no pagamento da primeira cobrança, taxa 0,22–0,35%). Conta PJ/MEI, sandbox, `POST /pixAutomatico/authorizations`, webhook `PAYMENT_RECEIVED`/`PAYMENT_OVERDUE`. Isso é 2 a 3 dias de dev, não um projeto. Não use "assinatura Mercado Pago" — cartão-only é exatamente o canal que falha 10–15%/mês. Faça Pix Automático como padrão e cartão como fallback.

**Agora a conta de esforço que mata o preço dele.** Polp: R$160 fixo + R$4/usuário. Básico R$19,90 − R$4 − taxa ≈ **R$15,80 de margem**. Casal R$29,90 − R$12 ≈ **R$17,80**. Ele cobra 50% a mais para ganhar R$2. O plano avançado é pior que o básico por conta atendida. Conserta assim: básico R$19,90 com 1 conexão, **+R$9,90 por conexão extra** (add-on, não plano). Cobrar por unidade de custo variável é uma linha de código; inventar plano é uma tela nova.

Fixo mensal: R$160 + R$60 VM = R$220. **Break-even em 14 assinantes.** Esse é o número dele, não 150.

O bloqueio real não é preço nem free: é a integração Open Finance. Estime 3 a 6 semanas solo (OAuth, tela de consentimento, sync, deduplicação, categorização, renovação de consentimento em 12 meses). Sem ela nada mais importa.

**(A) Preço:** R$19,90/mês com 1 conexão + R$9,90 por conexão extra. Anual R$199. Mata o "casal".
**(B) Free:** não. Freemium converte 2–4%; para os 14 pagantes você precisaria de ~400 usuários free, e você tem zero tráfego — free só adiciona suporte. Faça **trial de 14 dias com Pix Automático autorizado na entrada**. Cobra sozinho no dia 15.

Fontes: [docs.asaas.com/docs/pix-automatico](https://docs.asaas.com/docs/pix-automatico) · [Implementação](https://docs.asaas.com/docs/pix-automatico-implementacao) · [Diferença Pix Automático x Assinaturas](https://docs.asaas.com/docs/diferen%C3%A7a-entre-pix-autom%C3%A1tico-e-assinaturas-1)

---

## 4. Rodada de revisão cruzada (anônima)

**Mapeamento de anonimização** (revelado após a rodada):

| Letra | Conselheiro |
|---|---|
| A | O Expansionista |
| B | O Outsider |
| C | O Executor |
| D | O Contrarian |
| E | O Pensador de Primeiros Princípios |

### Revisor 1

**1. Mais forte: C.** É a única que remove o bloqueio real de execução em vez de só opinar sobre preço: Pix Automático via Asaas resolve o item de pagamento que ele levantou, o add-on de R$9,90 alinha preço à unidade de custo sem criar tela nova, e é a única que estima o custo de construir o Open Finance (3–6 semanas solo) — o gargalo que precede preço e free. D chega à mesma matemática, mas para na planilha.

**2. Maior ponto cego: B.** Acerta o diagnóstico de percepção (1 conexão não resolve nada; "casal" sem login é enganoso), mas não faz uma única conta. Pedir 2 conexões no plano de R$19,90 dobra o custo variável do tier de entrada, e "login de verdade pro cônjuge" a R$34,90 significa multiusuário, permissões e dados compartilhados — semanas de dev que ele não tem, no plano de menor margem.

**3. O que as cinco perderam:** ninguém verificou se a Polp cobra **R$4 por usuário ou por conexão**. A assume por usuário (margem 80%); C, D e E assumem por conexão (R$12 no plano de 3). Toda a tese de "upsell destrói margem" depende disso e está sem fonte. Também ausente: due diligence da Polp (preço 15x menor que Pluggy — é ITP autorizada pelo BC? SLA? plano B se morrer), LGPD com dados bancários em operação solo, e retenção — o gate que o primeiro conselho definiu e nenhum dos cinco revisitou.

### Revisor 2

**1. Mais forte: C.** É a única que responde à pergunta que ele realmente fez — pagamento. Pix Automático + Asaas resolve o "PIX e pagar conforme usa" que D e E ignoraram e A tratou como criatividade de precificação. Além disso corrige o break-even (14, não 150), mata o falso "casal" com add-on por conexão (uma linha de código vs. uma tela nova) e nomeia o gargalo verdadeiro: 3–6 semanas de dev de Open Finance, incluindo renovação de consentimento em 12 meses. Única ressalva: confirme taxas e disponibilidade do Pix Automático no Asaas antes de assumir 2–3 dias.

**2. Maior ponto cego: A.** Prega free permanente com "CAC zero", SEO e boca-a-boca — mas ele tem zero tráfego. C e E acertam: free sem distribuição não é canal, é suporte. Pior, A ainda empilha um produto B2B para contadores num dev solo que não entregou nem a primeira integração. Falta a única coisa que importa: sequenciamento.

**3. O que todas deixaram passar:** ninguém auditou a **Polp**. Toda a tese (break-even 14, margem 80%, morte dos 150) depende de um fornecedor desconhecido a 6% do preço da Pluggy. Perguntas não feitas: é instituição autorizada pelo BCB como AISP? Os R$4 são **por usuário** ou **por conexão** — porque C, D e E calcularam "3 OF = R$12" sem verificar, e se for por usuário a inversão de margem que quatro respostas usaram como argumento central simplesmente não existe. Qual a cobertura de bancos e o SLA? Concentrar o negócio inteiro nesse fornecedor é o risco maior que preço ou free.

### Revisor 3

**1. Mais forte: C.** É a única que resolve o problema que ele efetivamente levantou (PIX recorrente) com caminho executável — Pix Automático via Asaas, taxa, endpoint, webhook — em vez de teorizar. Soma a isso o conserto certo de preço (add-on por conexão, não plano novo), o break-even real (14) e o único alerta sobre o gargalo verdadeiro: 3–6 semanas para construir o Open Finance. A é a segunda melhor (reframe dos 150→11 é o insight de maior valor), mas se dispersa no tangente B2B.

**2. Maior ponto cego: B.** Zero economia unitária. Recomenda 2 conexões no plano de R$19,90 (R$8 de custo) e login de cônjuge a R$34,90 sem checar margem — exatamente a inversão custo/preço que C, D e E identificaram. Vale pelo diagnóstico de nomenclatura ("plano casal" sem login destrói confiança), não pela recomendação.

**3. Todas erraram:** o preço da Polp é **R$4 por usuário**, não por conexão. C, D e E calcularam R$12 para 3 conexões e construíram sobre isso toda a tese de "margem invertida". Se for por usuário, o plano de 3 conexões tem margem *melhor* e a recomendação inverte. Ninguém pediu a confirmação. E ninguém questionou se a Polp é instituição autorizada pelo BC, nem modelou churn — break-even de 14 sem taxa de cancelamento não significa nada.

### Revisor 4

**1. Mais forte: C.** É a única que desbloqueia o problema operacional real — Pix Automático do BC via Asaas, com endpoint, taxa e webhook nomeados — em vez de só reprecificar. Também acerta o break-even (14 assinantes), converte o "casal" em add-on por unidade de custo e nomeia o gargalo verdadeiro: 3–6 semanas para a integração Open Finance. A é a segunda melhor (add-on de conexão, free com custo marginal zero), mas é otimista demais.

**2. Maior ponto cego: B.** Ignora economia unitária por completo. Pedir 2 conexões no plano de R$19,90 dobra o custo variável do plano de entrada, e trial de 14 dias "com tudo liberado" significa pagar Open Finance por curioso sem cartão — exatamente o que quebra um dev solo sem caixa. Diagnostica bem a percepção ("plano casal sem login é enganação"), mas não sabe o que custa consertá-la.

**3. O que todas erraram:** o enunciado diz **R$4 por usuário**, não por conexão. C, D e E calcularam R$12 no plano de 3 integrações e construíram toda a tese da "margem invertida" em cima disso — se a cobrança for por usuário, o problema não existe. Ninguém pediu o contrato do Polp: cobertura de instituições, autorização do BC como AISP, SLA. Todo break-even de 11–17 assinantes depende de um fornecedor não verificado.

### Revisor 5

**1. Mais forte: C.** Única que resolve o bloqueio operacional real em vez de opinar sobre ele: Pix Automático via Asaas (Jornada 3, 0,22–0,35%), com estimativa de esforço. Também corrige o break-even (14, não 150), transforma "casal" em add-on por unidade de custo, e nomeia o gargalo verdadeiro — 3 a 6 semanas de integração Open Finance, incluindo renovação de consentimento. D chega perto na matemática, mas para na análise; C entrega execução.

**2. Maior ponto cego: B.** Voz do usuário útil ("plano casal sem login é mentira"), mas zero economia unitária. Pede 2 conexões a R$19,90 e trial de 14 dias com tudo ligado sem notar que cada conta conectada custa dinheiro — trial aberto vira custo variável de aquisição, com abuso e churn pós-trial não modelados. Falta também o que dispara conversão dentro do trial.

**3. Todas deixaram passar:**
- **O custo citado é "R$4 por usuário", não por conexão.** A, C, D e E construíram add-on por conexão em cima disso. Se for por usuário, a tese de "margem invertida" cai inteira. Confirmar no contrato antes de precificar.
- **Risco de fornecedor:** Polp a R$160 vs Pluggy a R$2.500 é 15x. Ninguém perguntou se é participante autorizado no Open Finance, SLA, ou o que acontece se repreçar. Todo o modelo depende de um único fornecedor barato.
- **Churn:** com break-even de 14, 8%/mês de cancelamento consome a base antes do crescimento.

**Placar da revisão:** C (Executor) — **5 votos de 5** como resposta mais forte. Pontos cegos: B (Outsider) 4 votos, A (Expansionista) 1 voto.
**Convergência inédita:** **5 de 5 revisores** apontaram a mesma falha do conselho inteiro — ninguém verificou se os R$4 da Polp são por usuário ou por conexão.

---

## 5. Síntese do Chairman

### Onde o conselho concorda

- **A meta de 150 usuários/mês está morta — 5 de 5.** Ela foi derivada da fatura de R$2.500 da Pluggy. Com Polp (R$160 + R$60 de VM = R$220 fixos), o break-even real fica entre **14 e 17 assinantes**. Ele está postergando marketing e adiando decisões por causa de um número que ele mesmo já invalidou ao trocar de fornecedor.
- **O nome "plano casal" tem que morrer — 4 de 5.** Ele mesmo escreveu que casal com dois acessos não faz sentido, mas manteve o rótulo num plano que só entrega mais conexões bancárias. Isso não é um detalhe de marketing: o Outsider fecha a página por desconfiança, e os outros conselheiros mostram que o rótulo esconde a lógica econômica real (conexões, não pessoas).
- **Plano gratuito: NÃO — 4 de 5.** O free proposto (sem Open Finance, sem relatórios, sem exportação, cadastros limitados) é exatamente a "planilha paga" que o conselho de 31/07 identificou como o problema central do produto. Ele não gera conversão; ele *prova* que o pago não vale. E freemium é canal de distribuição, não modelo de receita — exige tráfego de topo, que ele não tem e decidiu não comprar.
- **Mercado Pago com assinatura por cartão está errado — unânime entre quem tocou no tema.** Cartão-only é exatamente o canal que falha 10–15%/mês no Brasil.
- **O gargalo continua não sendo preço.** É a integração de Open Finance (3–6 semanas solo: OAuth, consentimento, sync, deduplicação, categorização, renovação em 12 meses). Preço e free são decisões que só importam depois dela.

### Onde o conselho briga

1. **O preço base.** Executor e Outsider mantêm R$19,90; Contrarian e Primeiros Princípios sobem para R$24,90; Expansionista mantém R$19,90 mas cria escada até R$49,90. A divergência é real e tem uma raiz identificável: **o primeiro conselho condenou R$19,90 sob a premissa de CAC pago de R$50–150.** Ele decidiu 0% de mídia paga. Com CAC ≈ 0, R$19,90 fecha. A objeção original não foi respondida — ela foi anulada por uma mudança de premissa.
2. **O que o plano de entrada deve entregar.** O Outsider diz que 1 conexão não resolve a vida de ninguém e que ele fecha a página. Três revisores rebatem: dar 2 conexões dobra o custo variável do tier de menor margem. Essa briga só se resolve com o dado que ninguém tem (abaixo).
3. **Free permanente vs. trial.** O Expansionista é voz isolada a favor do free (custo marginal ~zero sem Open Finance). Dois revisores derrubaram: sem tráfego, free não é canal — é suporte.

### Pontos cegos que só o peer review pegou

- **O maior de todos, apontado por 5 de 5 revisores: ninguém verificou se os R$4 da Polp são por USUÁRIO ou por CONEXÃO.** Suas notas dizem "por usuário". Quatro dos cinco conselheiros calcularam como se fosse por conexão (R$12 no plano de 3) e construíram sobre isso toda a tese da "margem invertida". **Se for por usuário, essa tese não existe** — e a recomendação de preço se inverte. Isto é a incerteza mais cara da mesa, e ela é resolvível com um e-mail.
- **Risco de fornecedor único, não auditado.** Polp custa 6% do preço da Pluggy. Ninguém perguntou: é participante autorizado no Open Finance / AISP pelo BCB? Qual a cobertura de instituições? Tem SLA? Exige CNPJ e mínimo mensal? O que acontece se repreçar ou fechar? Todo o modelo econômico está apoiado nesse fornecedor.
- **Churn não foi modelado por ninguém.** Break-even de 14 assinantes sem taxa de cancelamento é um número decorativo. A 8%/mês de churn, a base se consome antes de crescer.
- **Trial "com tudo liberado" tem custo variável.** Cada trial que conecta banco custa dinheiro real antes de qualquer pagamento. Autorizar o pagamento na entrada resolve isso.
- **O primeiro conselho definiu um gate de retenção (50% no mês 3) que nenhum dos cinco revisitou.** Ele segue sendo o critério que libera marketing — não os 150 usuários.
- **LGPD e a chave/IV AES fixos em `Utils/criptManager.ts`** continuam sem endereçamento, agora com um agravante: um plano free colocaria dados financeiros de não-pagantes sob a mesma exposição.

### A recomendação

**Sobre o preço: a estrutura está errada, o número está aceitável.**

Você não tem um problema de R$19,90 vs R$29. Você tem um problema de **eixo de diferenciação**. Você escolheu diferenciar seus planos por *número de conexões bancárias* — e a resposta certa depende inteiramente do dado que ninguém verificou:

- **Se a Polp cobra por CONEXÃO:** sua escada está economicamente invertida. R$29,90 com 3 conexões entrega R$1,10 a mais de margem que R$19,90 com 1. Nesse caso, mate o segundo plano e venda **conexão avulsa como add-on** (R$9,90), que é uma linha de código em vez de uma tela nova, e nunca abaixo de 2,5x o custo.
- **Se a Polp cobra por USUÁRIO — que é o que suas notas dizem:** então **precificar por conexão é irracional**. Você está criando fricção artificial num recurso que não te custa nada — e é justamente o recurso que gera lock-in (quanto mais contas conectadas, menor o churn). Nesse cenário: **conexões ilimitadas em todos os planos pagos**, e diferencie por relatórios, exportação e multiusuário.

**Minha recomendação, assumindo o cenário das suas notas (por usuário):** **um plano só, R$24,90/mês, conexões ilimitadas, tudo liberado. Anual R$249 via PIX à vista.**

Um plano só porque você tem zero clientes. Dois planos com zero clientes é otimização prematura: dobra a superfície de suporte, dobra o código de billing, e você não tem nenhum dado que diga onde a linha de corte deveria estar. Segmente depois dos primeiros 50 pagantes, com dado real de uso.

R$24,90 e não R$19,90 porque a diferença de R$5 não muda conversão nessa faixa (a barreira psicológica está acima de R$30), mas te dá a margem que vai financiar o CAC no dia em que você ligar aquisição paga. E R$24,90 e não R$29 porque o argumento do primeiro conselho contra R$19,90 dependia de CAC pago — premissa que você removeu.

**Sobre o plano gratuito: não faça. 4 de 5 conselheiros contra, e a aritmética fecha contra.**

Respondendo às suas perguntas diretamente:

| Pergunta sua | Resposta do conselho |
|---|---|
| Qual taxa de conversão esperar? | Freemium B2C: **2–5%** é a faixa real. 4%+ é bom. Trial **com** pagamento autorizado na entrada: **40–60%**. Trial sem cartão: **8–15%**. |
| Quantos pagos pagam um free? | Errado o enquadramento. O custo de um free user sem Open Finance é infra (centavos). O custo real é **seu tempo de suporte** e a diluição da sua atenção — e esse não é pago por nenhum número de assinantes. |
| Qual o mínimo de conversão aceitável? | Para o free se pagar com break-even de ~15 pagantes, você precisa de **~375 free users a 4%** ou **~750 a 2%**. Você não tem 375 visitantes, muito menos cadastros. |

E o mais importante: o seu free proposto remove Open Finance — que é, pelo seu próprio diagnóstico, a única coisa que faz o produto não ser uma planilha. Você estaria gastando seu esforço de aquisição para entregar às pessoas a versão do produto que você mesmo classificou como não-vendável.

**Faça no lugar: trial de 14 dias com TUDO ligado, incluindo Open Finance, com Pix Automático autorizado no cadastro.** Cobra sozinho no dia 15. Isso resolve as três coisas de uma vez — o Outsider vê o valor antes de pagar, você não paga conexão de curioso indefinidamente, e a conversão sobe de 8–15% para 40–60%.

**Sobre pagamento recorrente (sua pergunta 1):** não use assinatura do Mercado Pago. Use **Pix Automático** (em produção no BC desde janeiro/2026), exposto via API pelo Asaas — consentimento captado no pagamento da primeira cobrança, taxa 0,22–0,35%, webhooks de pagamento. Cartão como fallback, nunca como padrão. Isso responde tanto "PIX" quanto "pagar conforme usa".

**Sobre a meta de 150 usuários:** substitua por dois números distintos, que você estava misturando num só.
- **~15 assinantes** = break-even de caixa. Para de sangrar dinheiro.
- **~150 assinantes** = break-even do seu tempo. Continua válido como critério de morte do projeto, exatamente como o conselho de 31/07 colocou — mas ele não tem nada a ver com quando ligar marketing.
O gatilho de marketing continua sendo o do primeiro conselho: **50% de retenção no mês 3, numa coorte de 30+ pagantes desconhecidos.**

### A primeira coisa a fazer

**Mande um e-mail para a Polp hoje com quatro perguntas, e não escreva uma linha de código de billing antes da resposta:**

1. Os R$4 são cobrados **por usuário cadastrado** ou **por conexão bancária ativa**?
2. Vocês são participante autorizado do Open Finance pelo Banco Central (AISP)? Qual o número de autorização?
3. Quais instituições estão cobertas e qual o SLA de disponibilidade?
4. Exige CNPJ? Tem mínimo mensal, fidelidade ou prazo de contrato?

A resposta da pergunta 1 decide sozinha se sua estrutura de planos é boa ou economicamente invertida — o conselho inteiro dividiu-se exatamente sobre isso, e os cinco revisores apontaram, independentemente, que ninguém verificou. As perguntas 2 a 4 decidem se a Polp existe como fornecedor viável ou se você volta para a realidade de R$2.500/mês da Pluggy, onde a meta de 150 usuários volta a valer e todo o resto muda.

---

*Conselho realizado em 02/08/2026 · 5 conselheiros independentes · 5 revisões cruzadas anônimas · 1 síntese do Chairman.*
*Conselho anterior: [council-transcript-2026-07-31.md](council-transcript-2026-07-31.md)*
