# Como calcular churn — Gastos Mensais

Nota de referência criada em 02/08/2026, a partir do ponto levantado pelos revisores do [[council-transcript-2026-08-02|conselho de 02/08]]: *"break-even de 14 assinantes sem taxa de cancelamento não significa nada."*

---

## 1. Antes da fórmula: definir o que conta como "cancelado"

Sem essa regra escrita, todo número calculado depois é lixo. Com cobrança recorrente (PIX ou cartão), a definição correta é:

> **Churn = fim do prazo de tolerância sem pagamento confirmado.** Ex.: 10 dias após o vencimento.

Se marcar churn no dia em que o pagamento falhou, metade dos "cancelados" volta a pagar 3 dias depois e a série histórica vira ruído. Escolha o prazo, escreva, e não mude depois — mudar a definição no meio invalida a comparação entre meses.

---

## 2. A fórmula base

```
churn_mensal = cancelados_no_mês / ativos_no_início_do_mês
```

**Regra do denominador:** quem entrou durante o mês não conta no denominador desse mês. Caso contrário, um mês de boa aquisição faz o churn parecer artificialmente baixo — e o número mente justamente quando as coisas parecem estar indo bem.

---

## 3. Separar voluntário de involuntário

Esta é a distinção que muda o que fazer na prática:

| Tipo | Causa | O que realmente significa |
|---|---|---|
| **Voluntário** | a pessoa cancelou | problema de produto / valor percebido |
| **Involuntário** | cartão recusado, sem limite, cartão vencido | problema de cobrança |
| **Estrutural** | consentimento Open Finance expirou (12 meses) | problema de UX de renovação |

Cartão recorrente no Brasil falha **10–15% ao mês**. Somando tudo num número só, a conclusão é que o produto é ruim — quando o problema é o meio de pagamento. O resultado prático do erro é reescrever features em vez de trocar para Pix Automático.

**Guarde o motivo em coluna separada, sempre.**

---

## 4. Com menos de 50 clientes, a taxa de churn não significa nada

Com 20 assinantes: 1 cancelamento = 5%, 2 cancelamentos = 10%. O número oscila sem informar nada.

Até ~50 pagantes, meça duas coisas no lugar da taxa:

**a) Curva de retenção por coorte.** Agrupar por mês de entrada e acompanhar quantos ainda pagam no M1, M2, M3. É exatamente o gate definido no [[council-transcript-2026-07-31|conselho de 31/07]]: 50% de retenção no mês 3, em coorte de 30+ pagantes desconhecidos.

**b) Ligar para 100% de quem cancelar.** Com 20 clientes, 3 conversas valem mais que qualquer planilha. A partir de ~200 clientes a relação se inverte: a taxa passa a valer mais que a ligação.

---

## 5. O que precisa estar guardado

O erro que trava tudo depois é guardar apenas o **status atual** da assinatura. É preciso guardar o **histórico** — sem data de início, data de cancelamento e motivo, não há como recalcular churn retroativamente nem montar coorte nenhuma.

Campos mínimos na tabela de assinaturas:

| Campo | Para quê |
|---|---|
| `usuario_id` | identificar o assinante |
| `ciclo` (mensal/anual) | separar as duas séries — ver seção 6 |
| `valor` | churn de receita, quando houver mais de um preço |
| `iniciada_em` | define a coorte |
| `cancelada_em` | numerador do churn e ponto final da coorte |
| `motivo` | voluntário / falha de pagamento / consentimento expirado / reembolso |
| `motivo_texto` | o que a pessoa disse — mais valioso que a taxa nos primeiros meses |

---

## 6. As duas contas

### Churn do mês

```sql
SET @ini = '2026-09-01', @fim = '2026-09-30';

SELECT
  ativos_inicio,
  cancelados,
  ROUND(cancelados / NULLIF(ativos_inicio,0) * 100, 1) AS churn_pct
FROM (
  SELECT
    (SELECT COUNT(*) FROM assinaturas
      WHERE iniciada_em < @ini
        AND (cancelada_em IS NULL OR cancelada_em >= @ini)) AS ativos_inicio,
    (SELECT COUNT(*) FROM assinaturas
      WHERE iniciada_em < @ini
        AND cancelada_em BETWEEN @ini AND @fim)            AS cancelados
) t;
```

### Curva de retenção por coorte

É o número que importa agora — mais que o churn agregado.

```sql
SELECT
  DATE_FORMAT(iniciada_em, '%Y-%m') AS coorte,
  COUNT(*) AS tamanho,
  ROUND(100 * AVG(cancelada_em IS NULL
        OR TIMESTAMPDIFF(MONTH, iniciada_em, cancelada_em) >= 1), 0) AS m1,
  ROUND(100 * AVG(cancelada_em IS NULL
        OR TIMESTAMPDIFF(MONTH, iniciada_em, cancelada_em) >= 3), 0) AS m3,
  ROUND(100 * AVG(cancelada_em IS NULL
        OR TIMESTAMPDIFF(MONTH, iniciada_em, cancelada_em) >= 6), 0) AS m6
FROM assinaturas
WHERE ciclo = 'mensal'
GROUP BY coorte
ORDER BY coorte;
```

**Duas armadilhas de leitura:**

- Só leia a coluna M3 de coortes que já têm 3 meses de idade. As coortes recentes mostram 100% porque ainda não houve tempo de cancelar — não é retenção boa, é ausência de dado.
- **O plano anual não entra na mesma conta.** Ele esconde churn por 12 meses. Meça taxa de renovação no mês 12, em série separada. Misturar anual com mensal produz um churn artificialmente baixo que some de uma vez no aniversário.

---

## 7. Para que o número serve: ele define o teto de CAC

Aqui churn deixa de ser relatório e vira decisão. Com preço de R$24,90 e margem de contribuição ≈ **R$18,16** (já descontados Open Finance, gateway ~5% e imposto ~6%):

| Churn/mês | Vida média | LTV (margem) | CAC máximo (⅓ do LTV) |
|---|---|---|---|
| 3% | 33 meses | R$605 | R$200 |
| 5% | 20 meses | R$363 | R$120 |
| 8% | 12,5 meses | R$227 | **R$76** |
| 12% | 8 meses | R$151 | **R$50** |
| 15% | 6,7 meses | R$121 | **R$40** |

```
vida média = 1 / churn
LTV        = margem de contribuição / churn
teto CAC   = LTV / 3
```

CAC de app financeiro no Brasil é **R$50–150**. Logo:

- **Até ~5% de churn** → mídia paga fecha com folga.
- **~8% de churn** → teto de R$76, no limite. Só funciona nos canais mais baratos.
- **12% ou mais** → não fecha em nenhum cenário. Ligar ads é comprar prejuízo.

**Churn não é métrica de acompanhamento — é o interruptor do marketing.** É ele que diz se o gate do primeiro conselho abriu, e quanto se pode gastar no dia em que abrir.

---

## Resumo operacional

1. Escrever a regra de corte (10 dias de tolerância) antes de qualquer cobrança acontecer.
2. Guardar `iniciada_em`, `cancelada_em` e `motivo` desde a primeira assinatura — não dá para reconstruir depois.
3. Nos primeiros 50 clientes: ignorar a taxa, olhar a coorte, ligar para todo mundo que sair.
4. Nunca somar churn voluntário com falha de pagamento.
5. Manter mensal e anual em séries separadas.
6. Usar o churn medido para calcular o teto de CAC — e só então decidir sobre mídia paga.

---

*Ver também: [[council-transcript-2026-08-02]] · [[council-transcript-2026-07-31]] · [[2026-07-31 Consil]]*
