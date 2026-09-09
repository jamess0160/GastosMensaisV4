# Convenções de trabalho

Front-end do Gastos Mensais — React 18 + TypeScript + Vite, React Query,
React Router, ECharts. `npm run dev`, `npm run typecheck`, `npm test`,
`npm run format:check`.

Dois documentos mandam no código:

- **[Docs/API - Contrato Front-end.md](Docs/API%20-%20Contrato%20Front-end.md)** — o que a API
  aceita e devolve **hoje**. É fonte, não rascunho: **não se edita**. A seção
  **18. Changelog** lista o que mudou desde a última leitura, da mais recente
  para a mais antiga, com o marcador (🔴 quebra / 🟡 comportamento / 🟢 adição)
  e a ação do front.
- **[Docs/levas/](Docs/levas/)** — o plano de cada fase, em etapas.

## O documento da fase vem antes do código

Toda fase começa pela criação do seu plano em `Docs/levas/<N>. <Nome>.md`, no
formato das anteriores: tabela de etapas com marcador e dependências, e depois
uma seção por etapa com **o problema / a correção / arquivos**.

Documentar **não é a última etapa** — é o passo zero. O documento é o que o
código segue, não o registro do que já foi feito. Atualizações de
[Docs/Pendencias Backend.md](Docs/Pendencias%20Backend.md) entram na etapa a que
pertencem, nunca numa etapa de documentação separada.

## Um commit por etapa concluída

Ao concluir uma etapa, commitar **todos os arquivos** dela de uma vez, com a
mensagem no formato:

```
Fase #4 | Etapa 12. Lista de gastos com os filhos
```

`Fase #<número da fase> | Etapa <número>. <título da etapa como está no plano>`.
Antes de commitar: `npm run typecheck` e `npm test`. O trabalho é direto na
`main`, como todo o histórico do projeto.

## Sem compatibilidade com legado no MVP

O banco é ajustado junto com o contrato. Quando um campo muda de nome ou some,
ele **some do cliente também**: nada de mapa de chave antiga, leitura defensiva
ou fallback de formato "por enquanto". Um campo que a API não devolve mais não
é lido em lugar nenhum.

## O que a tela nunca recalcula

`Balance` (saldo da conta) e `Spent` (comprometido do orçamento) são calculados
pela API a cada leitura, com regras de data que o cliente não repete. Somar
lançamentos no cliente para conferir esses números dá diferente — e o certo é o
da API. O que o cliente agrega são as **pernas** (`ExpensePayments`), que é a
unidade de todo total de gasto: 600 em 6× é uma compra de 600 e seis pernas de
100.
