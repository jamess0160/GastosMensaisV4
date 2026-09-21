# Decisões — 18/09/2026

O que ficou fechado depois do conselho de 18/09 **e do debate que veio depois dele**. O conselho
está em [council-transcript-2026-09-18.md](council-transcript-2026-09-18.md); este arquivo é o que
sobrou dele já filtrado pelas objeções do dono, e é este que vale. Onde os dois discordam, vale
este.

## O preço

| Item | Decisão |
| --- | --- |
| Plano | **Um só.** Segmentar depois dos primeiros 50 pagantes |
| Mensal | **R\$29,90** |
| Anual | **R\$299,00**, oferecido **no mês 3**, nunca na entrada |
| Workspaces | **ilimitados, R\$0** |
| Membros (editor/viewer) | **ilimitados, R\$0** |
| Conexões bancárias | **3 inclusas**; da 4ª em diante **R\$12,90** |
| Conexões durante o trial | **uma** |
| Trial | **30 dias**, com pagamento autorizado no cadastro |

**Não se cobra por workspace.** Quatro dos cinco conselheiros contra, por quatro caminhos
independentes, e o argumento que decide é que o preço é autocontornável: o cliente junta tudo num
workspace só e paga menos. Ao contornar, ele destrói a higiene de dados de que o rateio analítico e
o orçamento por competência dependem — o preço cobraria para o usuário não sabotar o produto.
Workspace ilimitado e grátis passa a ser argumento de venda: *"separe seu MEI da sua casa, sem
pagar a mais."*

**R\$29,90 desde o lançamento, mesmo antes da integração existir** Preço de tabela não sobe para
quem já entrou. Lançar a R\$19,90 e subir quando o Open Finance sair trava a coorte mais conectada —
a mais cara de servir — no preço mais baixo para sempre. Lançando no preço do produto completo, a
integração chega para essa coorte como cumprimento de promessa, e o grandfathering deixa de ser
dívida.

**Escrever na página de preço agora:** *"os 50 primeiros mantêm R\$29,90 e as 3 conexões, para
sempre."*

**R\$12,90 na conexão extra, não R\$9,90.** A regra dos 2,5× estava medindo a coisa errada — cobria o
custo variável de R\$4 e ignorava os R\$160/mês fixos. R\$12,90 dá 3,2× e começa a amortizar o fixo.

## O compartilhamento

**Gratuito.** Unânime, 5 de 5, e o código já está em produção (`WorkspaceMembers`,
`WorkspaceInvites`). O segundo membro do casal não é cliente: é o mecanismo de retenção e o canal de
aquisição. Cobrar assento é vender a coisa que segura o cliente.

Na interface, chamar de gente: **"sua esposa também entra, sem pagar de novo"** — não "compartilhar
workspace". Ninguém sabe o que é um workspace.

Quatro travas, e a terceira é código que ainda não existe:

1. `editor` e `viewer` **não conectam conta bancária**. O gate de R\$4 é do pagante.
2. Convite **nunca** cria workspace novo sob o billing de quem convidou.
3. **Estado de falha:** pagante cancela ou o pagamento falha em definitivo → workspace vira
   somente-leitura por 30 dias, e **qualquer membro pode assumir a titularidade virando pagante**.
   Sem isso, o primeiro casal que separar é o primeiro Reclame Aqui.
4. **`IdUser` ativo por workspace instrumentado desde o dia 1.** Com compartilhamento grátis, metade
   dos usuários ativos não aparece na receita, e o gate de 50% de retenção no mês 3 mediria
   fantasma.

## Falha de pagamento

O número de "10–15%" que circulou é **falha por tentativa de cobrança, não churn**. Com régua de
retentativa a maior parte é recuperada; a perda líquida real fica em 2–4%/mês sem mecanismo nenhum,
e perto de 1% com um.

Cortar o consentimento na primeira falha **economiza o custo e perde o cliente.** No Open Finance,
voltar exige refazer a autorização no app do banco — o passo de maior fricção do produto inteiro.
R\$4/mês de consentimento é R\$0,13/dia; dez dias de tolerância custam R\$1,30 contra um cliente de
R\$29,90/mês.

**Régua:** falha → retentativa nos dias 3, 5 e 7, com o consentimento **vivo** e o app funcionando →
dia 10 sem pagamento, somente-leitura e consentimento cortado.

## O trial

**30 dias, uma conexão, pagamento autorizado no cadastro.**

Os 30 dias (e não 14) porque o fechamento de mês é o momento de valor. Vale saber que o Open Finance
devolve até 12 meses de histórico na primeira sincronização — então o que os 30 dias entregam de
verdade não é o "aha" do fechamento, é **formação de hábito**: categorizar com a própria mão, botar
um orçamento e ver se segurou.

**Uma conexão, não ilimitadas.** Custo e confiança apontam na mesma direção: R\$4 em vez de R\$12 por
curioso, e "conecte seu banco principal" é um pedido menor que "conecte suas contas". A 2ª e a 3ª
liberam na primeira cobrança confirmada. Quem precisa de três bancos para decidir em 30 dias não é
comprador mais qualificado.

Consentimento queimado em trial **é CAC**, e a conta fecha: R\$4 por curioso, conversão de 40–60% com
pagamento autorizado, CAC por pagante de R\$8–10. O risco não é o unitário, é o **caixa do mês 1** —
a fatura da Polp chega antes da receita daquela coorte.

## As duas janelas de confiança

O maior risco do lançamento, e ele é de copy, não de preço.

**A ordem já está certa: cartão primeiro, banco depois.** Cartão é o pedido mais barato — o
brasileiro digita cartão no iFood toda semana; consentimento bancário é novo. Pedir o caro primeiro,
sem cartão capturado, derruba a conversão de 40–60% para 8–15% e queima consentimento de todo
curioso.

**Não existe plano sem integração** — um app pago sem ela compete com planilha grátis e perde. Mas
isso não é a mesma coisa que não ter **lançamento manual como capacidade**, que é obrigatório:
dinheiro em espécie, renda informal, o banco que a Polp não cobre, e a pessoa que trava no
consentimento no dia 1 e conecta no dia 10. Como capacidade não desvaloriza nada; como plano mais
barato, desvaloriza.

**A crença falsa que custa os cadastros:** *"passar minha senha de banco para um site que eu nunca
vi"*. No Open Finance a autenticação acontece **dentro do app do banco do cliente**; nós nunca vemos
senha, o acesso é somente-leitura, ele revoga quando quiser e expira sozinho em 12 meses. A maioria
dos compradores não sabe disso, e desfazer essa crença vale mais que qualquer mudança de preço.

Na tela do consentimento:

- **"Você autoriza dentro do app do seu banco — nós nunca vemos sua senha"**, com a marca Open
  Finance visível (marca regulada pelo Banco Central, que empresta a confiança que o produto ainda
  não tem);
- **"Revogue quando quiser, em dois cliques"** — é verdade, e é o que derruba a objeção;
- CNPJ, política de privacidade, nome e rosto de quem fez — **antes** do pedido, não no rodapé;
- pedir **um** banco, o principal. Os 12 meses de histórico que voltam desse um fazem a venda do
  segundo sozinhos.

## A Polp

**Bancar o custo por 2 meses. Teto de exposição ~R\$700** (2 × R\$220 de fixo + ~R\$120/mês de
consentimento de trial). A aposta é pequena e não precisa de fila paga para se justificar.

Break-even com R\$29,90 e ~R\$1 de taxa de pagamento:

| Conexões por assinante | Margem por assinante | Pagantes para cobrir os R\$220 fixos |
| --- | --- | --- |
| 1 | R\$24,90 | **9** |
| 2 | R\$20,90 | **11** |
| 3 | R\$16,90 | **14** |

**O break-even é 9 a 14 pagantes, não 14 a 17** — a diferença é o preço de R\$29,90 em vez de
R\$19,90.

**O ativo em risco não são os R\$440, são as 3 a 6 semanas de desenvolvimento** — de 20 a 40 vezes a
exposição de caixa. Então as travas mudam de lugar:

- **Antes de escrever a integração:** 10 pessoas que disseram sim a R\$29,90 por escrito, com a
  integração prometida para N semanas. Não precisa ser pagamento, precisa ser compromisso explícito.
  Se dez pessoas não dão isso, o problema é o funil, e integração não conserta funil.
- **O limiar substitui o prazo:** **9 pagantes com pelo menos uma conexão até o dia 60.** "Dois
  meses" é deadline; isto é medida. Em 3 pagantes no dia 60, a resposta não é "mais um mês".
- **Perguntar por sandbox.** Uma fatia vertical — um banco, ler transações, gravar em `Expenses` — é
  provavelmente uma semana. As seis semanas são deduplicação, categorização, renovação e estados de
  erro.

## O que segue aberto

**Perguntas à Polp que ainda não foram respondidas** (da lista do conselho de 03/08 — só a de "por
consentimento, não por usuário" voltou):

1. Existe mínimo mensal, fidelidade ou prazo? Os R\$160 são piso ou mensalidade de plataforma?
2. São **participante autorizado (AISP) pelo BCB**, ou operam sobre a licença de terceiro? Qual o
   número?
3. Exige CNPJ? Qual porte?
4. Quais instituições cobertas, e qual o SLA?
5. **O que conta como 1 consentimento** — conta, instituição, ou produto (conta corrente e cartão do
   mesmo banco = 1 ou 2)?
6. **Renovação de consentimento rebilha** como novo consentimento?
7. **Consentimento revogado para de ser cobrado na hora, ou no fim do ciclo?** Esta decide se a
   régua de tolerância de 10 dias custa R\$1,30 ou um mês inteiro de consentimento.

**Decisões que não se toma agora:**

- eixo de expansão de receita para o ano 2 — é conexão sincronizada, e eventualmente um console
  multi-workspace de verdade para contador. Esse console **exige mudar o token** (hoje ele carrega um
  `IdWorkspace` e `POST /Workspaces/switch` reemite), então não é reaproveitar `viewer`. Não é
  trabalho de MVP;
- referral e afiliados — travados pelo conselho de 03/08 até 30 pagantes e o gate de retenção;
- mídia paga — travada até 50% de retenção no mês 3 numa coorte de 30+ pagantes desconhecidos.

## O que o conselho recomendou e foi rejeitado

Registrado porque o relatório em HTML ainda diz o contrário, e daqui a três meses a diferença não
vai ser óbvia.

| Recomendação do conselho | Por que caiu |
| --- | --- |
| Anual pré-pago **em destaque** na entrada | R\$299 na entrada é o terceiro pedido de confiança empilhado num produto sem marca que já pede cartão e acesso bancário. Recusar o anual em destaque contamina o mensal ao lado. Ele vai para o mês 3, onde cai na coorte que já provou retenção — e onde o consentimento está a ~9 meses de expirar, casando os ciclos. O preço plano já matou o problema do teto do Pix Automático que o anual resolveria |
| Trial de **14 dias** | 30, pelo fechamento de mês e pela formação de hábito |
| **Nenhuma conexão** no trial | Trial sem integração é trial de outro produto; ninguém autoriza pagamento para testar planilha com funções a mais. Vira **uma** conexão |
| **Só ligar a Polp contra fila já paga** | Era conselho para quem não podia bancar R\$700. O ativo a proteger são as 3–6 semanas, e a trava correta é 10 compromissos por escrito + limiar de 9 pagantes no dia 60 |
| Cortar o compartilhamento do lançamento (conselho de **03/08**) | Revertido por unanimidade em 18/09: o código já está pago e é o que segura o casal dentro do app |

---

*Fechado em 18/09/2026. Conselho: [transcrição](council-transcript-2026-09-18.md) ·
[relatório](council-report-2026-09-18.html). Anteriores:
[31/07](../2026-07-31%20Pre%C3%A7o/council-transcript-2026-07-31.md) ·
[02/08](../2026-08-02%20Pre%C3%A7o%202/council-transcript-2026-08-02.md) ·
[03/08](../2026-08-03%20Aquisi%C3%A7%C3%A3o/council-transcript-2026-08-03.md).*
