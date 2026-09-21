# Transcrição do LLM Council — 03/08/2026

**Pauta:** avaliar o *Entendimento* registrado nas notas de 02/08 e responder as 3 perguntas novas — trial de 30 dias, programa de indicação entre usuários, e programa de afiliados para contadores e coaches financeiros.

**Conselhos anteriores:** [council-transcript-2026-08-02](../2026-08-02%20Preço%202/council-transcript-2026-08-02.md) · [council-transcript-2026-07-31](../2026-07-31%20Preço/council-transcript-2026-07-31.md)
**Notas avaliadas:** [Notas de 02/08](../2026-08-02%20Preço%202/Notas.md)
**Referência:** [[Como calcular churn]]

---

## 1. Pergunta original (do usuário)

> Veja as últimas notas da pasta do dia 02/08, avalie o entendimento e responda as perguntas.

---

## 2. Pergunta enquadrada (enviada aos 5 conselheiros)

> **Este é o TERCEIRO conselho sobre o mesmo produto.** Houve conselhos em 31/07/2026 e 02/08/2026.
>
> **O produto:** "Gastos Mensais", app de controle financeiro pessoal, Brasil, dev solo. Node/TypeScript/Express/Knex/MySQL. Zero clientes. **A integração Open Finance ainda não foi construída** — estimada em 3 a 6 semanas solo.
>
> **FATO NOVO E DECISIVO:** o usuário confirmou com a Polp que o custo de **R$4/mês é POR CONSENTIMENTO (conexão bancária), NÃO por usuário**. Escala: R$3,50 com 100 consentimentos, R$3,00 com 1.000, R$2,50 acima de 10.000. Isso resolve a maior incerteza do conselho anterior — 5 de 5 revisores tinham apontado que ninguém verificara esse dado.
>
> **ENTENDIMENTO registrado pelo usuário (a avaliar):**
> 1. Meta de 150 usuários morta; break-even real entre 14 e 17 assinantes.
> 2. Polp cobra por consentimento, com escala de volume.
> 3. Sem plano casal. Plano base R$19,90 (1 conexão) + R$9,90 por conexão adicional. Compartilhamento de acesso com outra conta já no plano base.
> 4. Sem plano gratuito — sem Open Finance o app "vira uma planilha diferente".
> 5. Vai usar assinatura pelo Mercado Livre/Mercado Pago em vez do Asaas, porque "no Asaas cobram R$1,99 por Pix". Contraria o conselho de 02/08, que recomendou Pix Automático via Asaas a 0,22–0,35%.
> 6. Só fez à Polp 1 das 4 perguntas recomendadas. Faltam: autorização BCB como AISP, cobertura de instituições, SLA, CNPJ/mínimo mensal/fidelidade.
>
> **ECONOMIA UNITÁRIA:** fixo R$160 (Polp) + R$60 (VM) = R$220/mês. Base R$19,90 − R$4 − ~R$1 gateway − ~R$1,20 imposto ≈ R$13,70. Add-on R$9,90 − R$4 ≈ R$4,80 (2,48x o custo; a regra estabelecida era nunca abaixo de 2,5x). Teto de CAC pelo churn: 5% → R$120; 8% → R$76; 12% → R$50.
>
> **AS TRÊS PERGUNTAS NOVAS:**
> 1. Trial de 30 dias — primeiro mês grátis após validar método de pagamento.
> 2. Referral entre usuários — quem indica ganha 25% off na próxima parcela; o novo ganha 25% off na primeira.
> 3. Afiliados (contadores e coaches financeiros) — comissão de ~25% sobre os 3 primeiros meses, sem desconto para o novo usuário.
>
> **O QUE ESTÁ EM JOGO:** margem de ~R$13,70 por assinante. Um trial de 30 dias, dois descontos de 25% empilhados e uma comissão de 25% por 3 meses atacam exatamente essa margem, num negócio com zero clientes e um dev solo que ainda não construiu a feature principal.

---

## 3. Pareceres dos conselheiros

### O Contrarian

**(a) O entendimento tem três erros e uma falsa sensação de resolução.**

Você declarou a incerteza resolvida tendo respondido **1 de 4 perguntas**. A pergunta 4 (mínimo mensal) é a que define seu break-even, não a 1. Se os R$160 são piso contratual, break-even = 16. Se não há piso, seu custo fixo é R$60 e break-even = 5. Você não sabe qual dos dois mundos habita e já reprecificou tudo. E se a Polp não for AISP autorizada pelo BCB — ela revende Pluggy/Belvo/Klavi — o R$4 é preço de intermediário, não piso estrutural.

**O add-on viola sua própria regra.** R$9,90 ÷ R$4 = 2,475x, não 2,5x. E R$4,80 não desconta imposto nem gateway: sobra ~R$4,20 = **1,95x**. Add-on tem que ser R$12,90.

**A margem de R$13,70 pressupõe 1 conexão por assinante — ninguém tem 1 banco.** Brasileiro médio tem 3 relacionamentos. Sem enforcement técnico rígido de contagem de consentimentos no dia 1, o cliente conecta 3 e paga 1: margem real **R$1,70**.

**Mercado Pago: você comparou o preço errado.** R$1,99 é a tarifa de cobrança Pix avulsa do Asaas (com isenção nas 100 primeiras/mês), não a de Pix Automático. Você trocou 0,22–0,35% por MDR de cartão de ~5% mais 10–15% de falha involuntária/mês. Com 100 assinantes: economiza ~R$100 em tarifa e perde ~R$240/mês em churn involuntário. O Mercado Pago já opera Pix Automático via API — se for MP, use Pix Automático, nunca assinatura por cartão.

**Assento compartilhado grátis no plano base** é exatamente o plano casal que você descartou, entregue de graça, ao segmento de maior disposição a pagar.

**(b) As três perguntas**

**Trial 30 dias: não.** Seu COGS é variável. Cada trial que conecta 3 bancos custa R$12 reais. A 40% de conversão, são R$30 de CAC de infraestrutura antes de qualquer marketing, contra teto de R$76. Pior: 30 dias empurra seu gate de retenção do mês 3 para o mês 4 — você atrasa o único sinal que importa. **14 dias, pagamento autorizado no cadastro.**

**Referral: matemática ótima, timing péssimo.** R$9,95 de CAC é o melhor canal da mesa. Mas referral é multiplicador de zero e você tem zero clientes. Não construa antes de 30 pagantes. Quando construir: desconto do indicador só libera após o **primeiro pagamento confirmado** do indicado, travado por CPF.

**Afiliados contador/coach: mate agora.** Contador atende PJ; seu produto é finanças pessoais. Coach financeiro vende curso de R$997 com 50% — você oferece R$14,93 total. Não move ninguém, e custa tracking, contrato, nota e retenção de imposto.

*Fontes:* [Asaas Pix](https://blog.asaas.com/pix-asaas/) · [Mercado Pago Pix Automático](https://www.mercadopago.com.br/blog/pix-automatico-gestao-assinaturas-receita-recorrente)

---

### O Pensador de Primeiros Princípios

**(a) O entendimento tem um erro aritmético que invalida a própria premissa.**

Se a Polp cobra **por consentimento**, então R$160 não é custo fixo — é custo variável. O único fixo é a VM: **R$60**. Break-even = 60 ÷ 13,70 ≈ **5 assinantes, não 15–16**. Ou o R$160 é um **piso mensal** (40 consentimentos) — e aí ele já sabe a resposta da pergunta "exige mínimo mensal?", contradizendo o item 6. Uma das duas afirmações é falsa. Isso não é detalhe: muda o negócio de "preciso de 16 clientes" para "preciso de 5", ou revela um compromisso contratual não declarado. **Descubra qual antes de qualquer outra decisão.**

O item 5 é o pior erro. Ele está comparando R$1,99 de tarifa contra uma taxa percentual, e ignorando o custo real: falha involuntária de cartão. LTV = margem ÷ churn. Pix: 13,70 ÷ 0,05 = **R$274**. Cartão com 12% de falha somada: 13,70 ÷ 0,12 = **R$114**. Ele economiza R$1,90/mês e queima **R$160 de LTV por cliente**. E a busca não confirma a Polp como participante autorizada pelo BCB — ela se descreve como camada de integração.

**(b) As três perguntas são a pergunta errada.**

Todas as três são mecanismos de **aquisição**. Você tem zero clientes e a feature principal não existe. Não há retenção para amplificar.

**1. Trial 30 dias: não.** O trial não é grátis — cada trialista queima **R$4 de caixa** (100 trials = R$400 sem receita). Pior: 30 dias adiam em um mês o único sinal que importa. Faça **7 dias + garantia de reembolso de 30 dias**. Estritamente melhor: você recebe o dinheiro, testa o pagamento de verdade, e o cliente tem mais proteção.

**2. Indicação:** o CAC é R$9,94 contra teto de R$120 — matematicamente barato, e irrelevante. Desconto não gera boca-a-boca; ele amplifica um boca-a-boca que ainda não existe. E convida autoindicação com duas contas. **Depois do gate de 50% no mês 3.**

**3. Afiliados:** CAC de R$14,92, também barato. Mas contador atende PJ, não pessoa física endividada. E programa de afiliado é gestão de parceiros — trabalho de time, não de dev solo sem produto. Se quiser testar: **3 parceiros a dedo, cupom manual, zero código.**

Gaste as 3–6 semanas na integração. Ela é o negócio inteiro.

*Fontes:* [Polp](https://polp.com.br/) · [Modelo de participação — Open Finance Brasil](https://openfinancebrasil.org.br/modelo-de-participacao/)

---

### O Expansionista

**(a) O entendimento é fiel em 4 de 5, e o erro é justamente o que mata o upside.**

Itens 1, 2, 4 e 6: corretos. Item 3 subestima. Item 5 está errado.

**Item 3:** o brasileiro de classe média não tem 1 banco — tem banco salário + Nubank + corretora + cartão. Seu ARPU real não é R$19,90, é **R$29,80–39,70** (2 a 3 conexões). O plano base não é o produto; **o add-on é**. Coloque 2 conexões no base para matar a objeção na hora do cadastro e deixe o R$9,90 correr a partir da terceira. Margem esperada por assinante: ~R$18–23, não R$13,70.

**Item 5 (erro):** os R$1,99 do Asaas são de Pix avulso, não de Pix Automático (0,22–0,35% = R$0,05 em R$19,90). No Mercado Pago você cai em cartão recorrente com MDR de 2%–3,5% — economia irrelevante — e perde o **split de pagamento nativo**, que é exatamente a infraestrutura que faz a pergunta 3 funcionar sozinha. Você trocaria R$1/mês pelo motor do seu canal B2B.

**O que ninguém viu:** a curva de volume não é economia, é **fosso**. A 10.000 consentimentos você paga R$2,50; qualquer entrante paga R$4. 37,5% de vantagem estrutural de custo, permanente.

**(b) As três perguntas**

**1. Trial 30 dias: sim, e é mais forte que 14 aqui.** O "aha" deste produto é o **fechamento do mês** — 14 dias não entrega isso. Com pagamento autorizado, converte 40–60%. Custo real do trial: **R$4**. Seu CAC nesse canal é R$4 contra R$50–150 de mercado. Ofereça 60 dias no anual.

**2. Referral: tímido e mal enquadrado.** 25% off diz "meu preço é inflado". Dê **1 mês grátis para os dois**: custo real R$8 de consentimento, CAC ~R$24 — 1/3 do mercado — e o preço permanece intacto. Sem teto nas indicações.

**3. Afiliados 25%/3 meses = R$14,93 por cliente.** Nenhum contador levanta da cadeira por R$15. Vire **revenda**: painel do contador, R$9,90/cliente, ele fatura ou repassa. Um contador com 80 clientes = **R$792/mês, ~R$550 de margem** — equivale a 40 assinantes B2C. E 125 contadores levam você aos 10.000 consentimentos; via B2C seriam 5.000 assinantes. O caminho B2B chega ao custo de R$2,50 **40x mais rápido**.

Construa o Open Finance uma vez. Venda-o duas.

*Fonte:* [Mercado Pago — Pix Automático em assinaturas](https://www.mercadopago.com.br/blog/pix-automatico-reduz-custo-cobranca-vendas-assinatura)

---

### O Outsider

Sou eu, na loja de apps, procurando "controle de gastos". Reação crua:

**O preço me confunde antes de me assustar.** "1 conexão bancária" — o que conta como conexão? Minha conta do Nubank e o cartão de crédito do Nubank são uma ou duas? E a Caixa da minha esposa? Eu tenho Nubank, Itaú e o cartão da Bradescard. Fazendo a conta na unha: R$19,90 + 9,90 + 9,90 = **R$39,70 por mês**. Isso é Netflix com Spotify junto. Pra um app que me mostra que eu gastei demais no iFood. Se eu não entendo quanto vou pagar na tela de preço, eu fecho. E eu não entendi.

**Sem plano grátis eu nem chego na tela de preço.** O problema não é pagar, é que eu não faço ideia de quem é você. Você tá me pedindo pra conectar minha conta bancária num app sem marca, sem review, sem nada, e pagar antes de ver. Banco é medo. Eu conecto minha conta no Mobills porque tem 100 mil avaliações. No seu, eu vou pensar "e se esse cara sumir com meus dados?". **Isso é maior que qualquer objeção de preço.**

**Trial com cartão cadastrado: eu já fui pego assim.** Trinta dias é tempo demais, eu esqueço, aí vem R$19,90 no fim do mês e eu fico puto — e puto com app de finanças é pior, porque é justamente a cobrança que eu não vi chegando. Se for fazer, 7 ou 14 dias e me avisa 3 dias antes. E se for por Mercado Pago, minha dúvida imediata é: **como eu cancelo?** Se eu não vir "cancele quando quiser, em 2 cliques", não cadastro.

**O link pro amigo: não mando.** 25% de R$19,90 é cinco reais. Eu não queimo minha imagem por cinco reais. Indicar app de finanças é meio constrangedor — parece que eu tô dizendo "você tá desorganizado". **Se fosse um mês inteiro grátis pros dois, aí sim eu mandaria no grupo da família.**

**Contador: eu desconfiaria na hora.** Não porque contador é desonesto, mas porque eu percebo esse jogo. E ninguém me pergunta se eu quero comissão do meu contador. Se ele falar "eu ganho uma parte, mas uso com todos os clientes", tudo bem. Se eu descobrir sozinho depois, **perdi a confiança nos dois**.

---

### O Executor

**Sobre as taxas — o usuário está parcialmente certo, e isso muda a conta.**

Confirmei na tabela oficial: Asaas cobra **R$1,99 por transação recebida** em Pix e boleto. **Não achei linha separada para Pix Automático** — a página não distingue. Os 0,22%–0,35% citados no conselho de 02/08 eu **não confirmei** em fonte alguma; provavelmente é a tarifa que o BCB deixa os PSPs cobrarem entre si, não o preço de balcão do Asaas. Trate como não verificado até abrir chamado no Asaas perguntando literalmente: *"qual a tarifa por cobrança recebida via Pix Automático na minha conta?"*.

Sobre o Mercado Pago: o próprio blog deles tem página de produto de **Pix Automático para assinaturas**, então "MP é cartão-only" está desatualizado. Mas **não consegui confirmar a taxa** do MP para Pix Automático. Duas perguntas, um chamado em cada, resposta em 48h.

Impacto na margem: R$1,99 em vez de R$1,00 derruba a margem base de R$13,70 para **R$12,71**. Break-even vai de ~16 para **~18 assinantes**. Sobrevive.

**Custo de construir:**
- **Trial 30 dias:** ~0 dias. Asaas e MP têm campo de data da primeira cobrança nativo. Você só grava `trial_ends_at` e libera feature. Meio dia com webhook.
- **Referral:** 3–4 dias. Tabela `referrals`, código por usuário, aplicar desconto na próxima cobrança — que é a parte chata: nenhum gateway tem "25% off só nessa parcela" bem resolvido em assinatura. Você acaba cancelando e recriando a cobrança do ciclo.
- **Afiliados:** 5–7 dias. É referral + painel do afiliado + cálculo de comissão + rotina de pagamento (pague na mão via Pix, não automatize). Contador não converte sem material de venda — mais 1 semana sua, não de código.

**Segunda-feira:** você tem zero clientes e o produto central não existe. Trial, referral e afiliados são features para distribuir algo que não roda. **Faz Open Finance. Só isso.** As 3 perguntas restantes à Polp vão junto no mesmo e-mail — se a Polp não for AISP autorizada, as 3 a 6 semanas viram zero e você economizou um mês.

**"Compartilhar acesso" em código:** isso é multiusuário, e é a coisa mais cara da lista. Todo `WHERE user_id = ?` vira `WHERE workspace_id = ?`. Migration de schema, refactor de toda query, tabela de membros, convite por e-mail, e a decisão de permissão. **5 a 8 dias.** Lance solo. Adicione quando o primeiro cliente pedir.

*Fontes:* [asaas.com/precos-e-taxas](https://www.asaas.com/precos-e-taxas) · [Mercado Pago — Pix Automático para assinaturas](https://www.mercadopago.com.br/blog/pix-automatico-vender-pacotes-assinaturas)

---

## 4. Rodada de revisão cruzada (anônima)

**Mapeamento de anonimização** (revelado após a rodada):

| Letra | Conselheiro |
|---|---|
| A | O Executor |
| B | O Contrarian |
| C | O Outsider |
| D | O Expansionista |
| E | O Pensador de Primeiros Princípios |

### Revisor 1

**1. Mais forte: B.** É a única que ataca o entendimento em quatro frentes independentes e todas verificáveis: o furo do mínimo mensal (define se o break-even é 16 ou 5), o add-on a 2,475x que viola a regra do próprio usuário, o vazamento de margem se não houver enforcement de contagem de consentimentos (R$13,70 vira R$1,70), e o "acesso compartilhado" que é o plano casal descartado, entregue de graça ao segmento que mais pagaria. E acerta o diagnóstico central: incerteza declarada resolvida com 1 de 4 respostas. A merece crédito por ser a única que checou a fonte e admitiu que os 0,22–0,35% nunca foram confirmados.

**2. Maior ponto cego: D.** Constrói toda a tese sobre os 0,22–0,35% como fato — número que A não conseguiu confirmar em lugar algum. Pior: o modelo de revenda para contador ignora que **consentimento Open Finance é por CPF titular, com autenticação no app do banco do próprio cliente**. O contador não pode consentir pelos 80 clientes; o "fosso" de 125 contadores até 10.000 consentimentos não existe mecanicamente. E 2 conexões no base derruba a margem para ~R$8.

**3. O que todos deixaram passar:** ninguém perguntou à Polp *o que conta como um consentimento* e *se consentimento cancelado ou expirado continua sendo cobrado*. Consentimento Open Finance expira e exige renovação — isso é churn silencioso, é o preço do add-on, e é exatamente a confusão que C descreve na tela de preço.

### Revisor 2

**1. Mais forte: B.** É a única que ataca o entendimento como um sistema: pega a contradição do R$160 (piso contratual → BE 16; sem piso → BE 5), o add-on que viola a própria regra 2,5x (R$4,80 vira ~R$4,20 líquido → deveria ser R$12,90), o vazamento de margem sem enforcement de contagem, e — o achado que só ela viu — que "acesso compartilhado grátis no base" é exatamente o plano casal descartado, dado de graça a quem mais pagaria. E acerta o mérito: Pix Automático ≠ Pix avulso, e cartão traz 10–15% de falha involuntária.

**2. Maior ponto cego: D.** Trata 0,22–0,35% como fato (A mostra que não está verificado), ignora o piso do R$160, e projeta ARPU de R$29,80–39,70 sem nenhum teste de disposição a pagar — C demonstra que R$39,70 faz o cliente fechar a tela. Pior: recomenda virar revenda B2B para contadores, um segundo negócio, para um dev solo sem produto.

**3. Todas erraram o ciclo de vida do consentimento.** No Open Finance Brasil o consentimento expira em até 12 meses e exige reautenticação — evento anual de churn e possível recobrança de R$4. E consentimento de quem cancela continua ativo (e faturado) até ser revogado: **sem rotina de revogação no offboarding, você paga por ex-clientes**. Ninguém tratou disso, nem do teto do MEI (~R$81k/ano) ou da exigência de CNPJ da Polp.

### Revisor 3

**1. Mais forte: B.** É a única que ataca a estrutura, não os sintomas: expõe que "incerteza resolvida" com 1 de 4 perguntas é falso, que a pergunta do mínimo mensal (não a do preço) define o break-even, que o add-on quebra a própria regra de 2,5x depois de imposto, e que sem *enforcement* de contagem a margem real é R$1,70. Também acerta o ponto decisivo do item 5: o risco não é a tarifa, é falha involuntária de cartão. Complemento obrigatório: só **A** teve honestidade epistêmica — os 0,22–0,35% não estão confirmados, e D e E os tratam como fato. E só A precificou "compartilhar acesso" pelo que é: refactor multi-tenant de 5–8 dias.

**2. Maior ponto cego: D.** Monta canal B2B, trial de 60 dias e indicação ilimitada sobre um produto que não existe, e chama a curva de volume de "fosso" — desconto por volume que qualquer concorrente negocia não é fosso. Pior: valida o item 6 (Polp pode não ser AISP) e depois constrói tudo ignorando que isso zera a tese.

**3. Todos deixaram passar:** consentimento de Open Finance **expira** (renovação periódica obrigatória) — é a maior fonte de churn silencioso e ninguém perguntou se a Polp cobra por consentimento *criado* ou *ativo*. Ninguém questionou que **Pix Automático depende do banco do pagador ter aderido**. E ninguém propôs a alternativa óbvia: validar disposição a pagar com importação OFX/CSV em 2 semanas, antes das 6.

### Revisor 4

**1. A mais forte: B.** É a única que ataca o *entendimento* em vez de responder as perguntas: separa "1 de 4 respostas" de "incerteza resolvida", mostra que a pergunta do mínimo mensal define o break-even, e faz o cálculo que ninguém fez — margem real de R$1,70 se o cliente conectar 3 bancos sem enforcement. Também é a única a nomear que o "acesso compartilhado grátis" é o plano casal descartado, entregue de graça ao segmento que mais pagaria. A merece menção: é a única com verificação real de fonte e com custo em dias — inclusive que "compartilhar acesso" é refactor multi-tenant de 5–8 dias.

**2. Maior ponto cego: D.** Trata 0,22–0,35% como fato e afirma que o MP perde Pix — A e B mostram que o MP já opera Pix Automático. Pior: é a única que *adiciona escopo* (2 conexões no base, revenda para contadores, painel B2B) para um dev solo sem produto.

**3. Todas passaram:** consentimento no Open Finance brasileiro **expira e exige renovação** — churn silencioso, refaz a jornada de conexão e pode **rebilhar R$4**. Some-se: status AISP/BCB da Polp (risco jurídico e LGPD como controlador) e concentração em fornecedor único sem plano B nem custo de troca estimado.

### Revisor 5

**1. Mais forte: A.** É a única que separa fato verificado de premissa herdada. B, D e E tratam os "0,22–0,35% do Pix Automático" como dado, quando isso veio do próprio conselho anterior e ninguém confirmou; A confirma o R$1,99, admite o que não achou e transforma a dúvida em ação (dois chamados, 48h). É também a única que precifica a moeda real de um dev solo — dias de trabalho — e a única que enxerga que "compartilhar acesso" é multiusuário: refactor de toda query para `workspace_id`, 5–8 dias. Isso é maior que trial, referral e afiliados somados.

**2. Maior ponto cego: D.** Constrói um canal B2B de 125 contadores, trial de 60 dias e referral de mês grátis sobre uma integração que não existe. Assume ARPU de R$29,80–39,70 sem checar disposição a pagar — C, que é justamente o cliente, diz que fecha o app nesse preço.

**3. O que todas deixaram passar:** o ciclo de vida do consentimento. No Open Finance o consentimento expira (teto de 12 meses) e quebra antes disso — é o maior matador de retenção da categoria e ninguém citou. Pior: ninguém perguntou à Polp se **renovação conta como novo consentimento** (R$4 de novo). Nem plano B se a Polp morrer.

---

**Placar da revisão:**
- **Mais forte:** B (Contrarian) — **4 votos de 5**. A (Executor) — 1 voto.
- **Maior ponto cego:** D (Expansionista) — **5 votos de 5**.
- **Convergência inédita: 5 de 5 revisores apontaram a mesma falha do conselho inteiro** — nenhum dos cinco conselheiros tratou o **ciclo de vida do consentimento** (expiração, renovação, revogação) e o que ele faz com custo, churn e preço.

---

## 5. Síntese do Chairman

### Onde o conselho concorda

- **O item 5 do seu entendimento está errado — 4 de 4 que tocaram no tema.** Os R$1,99 do Asaas são a tarifa de **cobrança Pix avulsa**, não de Pix Automático. Você comparou uma tarifa fixa com uma taxa percentual e ignorou o custo dominante: **falha involuntária de cartão, 10–15%/mês**. Em LTV: Pix a 5% de churn = R$274/cliente; cartão a 12% somado = R$114. Você economizaria R$1,90/mês e queimaria R$160 de LTV por cliente. **A escolha que importa não é Asaas vs Mercado Pago — é Pix Automático vs assinatura no cartão.** Os dois gateways já oferecem Pix Automático; escolha por tarifa depois de confirmar as duas, mas nunca troque para cartão-recorrente.
- **Você declarou uma incerteza resolvida tendo respondido 1 de 4 perguntas — 4 de 5.** A resposta que você trouxe (por consentimento) é valiosa e destrava o preço. Mas a pergunta que define seu break-even era a 4: **existe mínimo mensal?** Se os R$160 forem piso contratual, break-even = 16–18. Se não houver piso, seu único custo fixo é a VM (R$60) e o break-even é **5 assinantes**. Você reprecificou o negócio inteiro sem saber em qual dos dois mundos está.
- **As três perguntas são todas de aquisição, e você não tem o que adquirir — 4 de 5.** Trial, referral e afiliados distribuem um produto que não roda. A integração Open Finance é 3–6 semanas e não começou.
- **"Compartilhar acesso no plano base" tem que sair do lançamento — 2 de 5, e é o item mais subestimado.** Em código é multi-tenancy: todo `WHERE user_id` vira `WHERE workspace_id`, mais tabela de membros, convite e permissões — **5 a 8 dias**. Em negócio, é exatamente o plano casal que você descartou, entregue de graça ao segmento de maior disposição a pagar.
- **Trial de 30 dias: não — 4 de 5.** Três motivos independentes: empurra seu gate de retenção do mês 3 para o mês 4; cada trialista queima R$4–12 de consentimento real; e o cliente esquece e fica com raiva justamente da cobrança que não viu chegar.

### Onde o conselho briga

1. **O preço do add-on.** O Contrarian mostra que R$9,90 ÷ R$4 = 2,475x bruto, e depois de gateway e imposto sobra ~R$4,20 = **1,95x** — abaixo da sua própria regra de 2,5x; exige R$12,90. O Outsider, que é o cliente, faz a conta oposta: R$19,90 + 9,90 + 9,90 = R$39,70 e fecha a página. **Os dois estão certos e é por isso que a estrutura, não o número, é o problema** (resolvido na recomendação).
2. **Trial: 30 dias vs 14 vs 7.** O Expansionista é voz isolada a favor dos 30, com o melhor argumento da mesa: *o "aha" deste produto é o fechamento do mês, e 14 dias não entregam isso*. Quatro conselheiros rebatem pelo custo e pelo atraso do sinal. A briga tem uma saída que ninguém viu (abaixo).
3. **Afiliados: matar ou virar revenda.** O Expansionista propõe painel de contador a R$9,90/cliente. O Revisor 1 destruiu mecanicamente: **consentimento de Open Finance é por CPF do titular, autenticado no app do banco dele**. O contador não pode consentir pelos 80 clientes. O canal B2B pode existir como venda, nunca como revenda de conexões.

### Pontos cegos que só o peer review pegou

- **O maior, apontado por 5 de 5 revisores: ninguém — nem os cinco conselheiros — tratou o CICLO DE VIDA DO CONSENTIMENTO.** No Open Finance o consentimento **expira em até 12 meses** e exige reautenticação no banco. Isso significa três coisas que atingem direto seu modelo: *(i)* é a maior fonte de churn silencioso da categoria — o app simplesmente para de atualizar e o cliente cancela; *(ii)* **você não sabe se a Polp cobra por consentimento criado ou ativo** — se renovação conta como novo, seu custo por cliente dobra no aniversário; *(iii)* **se um cliente cancela e você não revoga o consentimento no offboarding, você continua pagando R$4/mês por ex-cliente, para sempre.** Essa última é um vazamento de caixa puro e é uma rotina de meia hora que precisa existir antes do primeiro cliente.
- **Enforcement de contagem de conexões.** Sem trava técnica no dia 1, o cliente do plano base conecta 3 bancos e paga por 1: margem real cai de R$13,70 para R$1,70.
- **Os 0,22–0,35% do Pix Automático nunca foram confirmados.** Vieram do conselho de 02/08 e três conselheiros os trataram como fato. O Executor foi o único a verificar e não achou fonte. Trate como não verificado.
- **Pix Automático depende do banco do pagador ter aderido.** Você precisa de fallback para quem não conseguir autorizar.
- **A revenda para contadores é mecanicamente impossível** como desenhada (consentimento é por CPF titular).
- **Teto do MEI (~R$81k/ano)** e exigência de CNPJ da Polp continuam sem resposta.
- **Alternativa nunca considerada:** validar disposição a pagar com **importação OFX/CSV em ~2 semanas**, antes de comprometer 6 semanas em Open Finance. Se ninguém importa um extrato, ninguém conecta um banco.

### A recomendação

**Sobre o entendimento: 4 dos 6 itens estão corretos. O item 5 está errado e o item 3 está incompleto.**

| Item | Veredito |
|---|---|
| 1. Break-even 14–17, meta de 150 morta | **Meta morta: correto.** Número: **não confirmado** — pode ser 5 (sem piso) ou 18 (com piso e tarifa de R$1,99). Falta a pergunta 4 à Polp. |
| 2. Polp cobra por consentimento, com escala | **Correto e é o destravamento da mesa.** Incompleto: falta saber o que *conta* como consentimento e se renovação rebilha. |
| 3. R$19,90 + R$9,90/conexão, acesso compartilhado no base | **Direção certa, execução errada.** Add-on abaixo da sua regra de 2,5x; acesso compartilhado é o plano casal de graça + 5–8 dias de refactor. |
| 4. Sem plano gratuito | **Correto.** Mas a objeção real do cliente não é preço, é **confiança** — e free não resolve isso; prova social e transparência resolvem. |
| 5. Mercado Livre porque Asaas cobra R$1,99/Pix | **Errado.** Comparação de produtos diferentes. A decisão real é Pix Automático vs cartão, e cartão custa 10–15%/mês de falha involuntária. |
| 6. Como calcular churn | **Correto e bem feito.** A nota é sólida; ela agora precisa incluir *consentimento expirado* como terceira categoria de churn — o que já está lá. |

**Sobre o preço: mude o eixo, não o número.**

O Contrarian e o Outsider estão os dois certos porque a estrutura força uma escolha entre margem e clareza. Saia dela:

> **Um plano só: R$29,90/mês, até 3 conexões incluídas. Conexão além da terceira: R$12,90.**

Por quê:
- **Margem melhora em todos os cenários.** Com 1 conexão usada (o caso mais comum nos primeiros meses): 29,90 − 4 − 1,99 − 1,80 = **R$22,11**. Com 2: **R$18,11**. Com 3 (pior caso): **R$14,11** — ainda acima dos R$13,70 do plano de R$19,90 com 1 conexão. Você não tem mais um upsell que destrói margem.
- **O Outsider entende em 2 segundos** e o preço não muda quando ele conecta o segundo banco. A objeção dele nunca foi o nível do preço — foi não saber quanto ia pagar.
- **Resolve o problema de enforcement:** um teto de 3 é uma trava simples e generosa, em vez de metering por unidade que vaza margem se você não implementar direito.
- **O add-on acima do teto respeita sua regra:** R$12,90 líquido ≈ R$10,20 sobre custo de R$4 = **2,55x**.
- **Um plano só porque você tem zero clientes.** Segmentar antes de ter dado de uso é otimização prematura — dobra suporte e billing sem informação.

**Corte do lançamento:** acesso compartilhado. Volta quando um cliente pagante pedir.

**Sobre as três perguntas:**

**1. Trial — 14 dias com tudo ligado e pagamento autorizado no cadastro. Não 30.** Mas o Expansionista tem razão sobre o "aha", e a solução não é esticar o trial: **o Open Finance devolve até 12 meses de histórico de transações na primeira sincronização**. Você entrega o fechamento de mês — na verdade, de vários meses — **no minuto 1**, não no dia 30. Isso mata a única boa razão para os 30 dias. Três obrigações que o Outsider deixou explícitas: aviso por e-mail 3 dias antes da primeira cobrança, botão de cancelar em 2 cliques, e a frase "cancele quando quiser" visível na tela de cadastro. Sem isso, o trial com pagamento autorizado gera raiva e chargeback.

**2. Referral — a mecânica está errada e o timing também.** Não construa antes de **30 pagantes e do gate de 50% de retenção no mês 3**. Referral é multiplicador: com zero clientes, multiplica zero. Quando construir, **não use 25% off** — o Outsider é literal: *"não queimo minha imagem por cinco reais"*, e desconto percentual comunica que seu preço é inflado. Use **1 mês grátis para os dois**. Custo real ~R$8 de consentimento, CAC efetivo ~R$24 contra teto de R$76–120, e o preço de tabela fica intacto. Duas travas: o crédito do indicador só libera **após o primeiro pagamento confirmado** do indicado, e trave por CPF contra autoindicação.

**3. Afiliados — não faça um programa. Faça 5 conversas.** A comissão de 25% por 3 meses (R$22,43 no preço novo) não move um contador, e o programa custa 5–7 dias de código mais painel, contrato, nota fiscal e retenção. Pior: a versão "revenda" é mecanicamente impossível — **o consentimento de Open Finance é dado pelo titular, autenticado no app do banco dele**; o contador não consente por ninguém. O que funciona agora: escolha **3 a 5 parceiros a dedo**, dê um **cupom manual** (planilha, zero código), pague por Pix na mão. E resolva o problema que o Outsider levantou: **declare a comissão na página** — *"seu contador recebe uma comissão por esta indicação"*. Descoberta depois, ela destrói a confiança nos dois; declarada antes, vira sinal de transparência num produto que pede acesso à conta bancária.

**A objeção que nenhuma das três perguntas endereça:** o Outsider não travou no preço, travou em **confiança** — *"você tá me pedindo pra conectar minha conta bancária num app sem marca e sem review"*. Nenhum trial, desconto ou comissão resolve isso. O que resolve: CNPJ visível, política de privacidade e LGPD na página, o nome e o rosto de quem fez, o selo do Open Finance, e as primeiras 20 avaliações. Isso é trabalho de landing page, não de billing — e vale mais que os três mecanismos somados.

### A primeira coisa a fazer

**Termine o e-mail para a Polp. Hoje. Ele ficou pela metade e está bloqueando tudo.**

Você fez 1 das 4 perguntas do conselho anterior. Agora são 7, e três delas são novas e vieram unanimemente da revisão cruzada:

1. Existe **mínimo mensal, fidelidade ou prazo de contrato**? Os R$160 são piso ou mensalidade de plataforma? *(decide se seu break-even é 5 ou 18)*
2. Vocês são **participante autorizado do Open Finance pelo BCB (AISP)**? Qual o número de autorização — ou vocês operam sobre outro provedor? *(decide se as 6 semanas de integração valem alguma coisa)*
3. Exige **CNPJ**? Qual porte?
4. Quais **instituições** estão cobertas e qual o **SLA**?
5. **O que conta como 1 consentimento?** Conta bancária, instituição, ou produto (conta corrente e cartão do mesmo banco = 1 ou 2)? *(decide o texto da sua tela de preço)*
6. **Renovação de consentimento conta como um novo consentimento cobrado?** *(decide se seu custo por cliente dobra no aniversário)*
7. **Consentimento revogado ou expirado para de ser cobrado imediatamente?** *(decide se você vai pagar R$4/mês por ex-clientes para sempre)*

São 20 minutos de escrita e definem: seu break-even, seu preço de add-on, o texto da sua página, e se o fornecedor existe. Comece a integração Open Finance na segunda **independentemente** — mas mande o e-mail antes, porque a resposta da pergunta 2 pode zerar as 6 semanas.

---

*Conselho realizado em 03/08/2026 · 5 conselheiros independentes · 5 revisões cruzadas anônimas · 1 síntese do Chairman.*
*Conselhos anteriores: [02/08](../2026-08-02%20Preço%202/council-transcript-2026-08-02.md) · [31/07](../2026-07-31%20Preço/council-transcript-2026-07-31.md)*
