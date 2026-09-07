# Levas executadas

**Este documento é o registro do que foi feito.** Os documentos em [levas/](levas/) são o
*desenho*: o que cada etapa é, por que foi decidida daquele jeito, e o que decidir antes de
começá-la. Este aqui responde outra pergunta — **quais etapas existem em código hoje, e em qual
commit**.

A separação existe porque os dois mudam em ritmos diferentes:

| | Muda quando |
| --- | --- |
| `docs/levas/<n>. ...md` | uma **definição** muda: um desenho é fechado, uma decisão é revista, uma etapa nasce ou é descartada |
| **este documento** | uma **etapa é concluída** — uma linha sai de "pendente" e ganha commit e data |

Terminar uma etapa **não** é motivo para editar o documento da leva. Se ao executar uma etapa a
definição dela mudou, aí são duas edições, e elas dizem coisas diferentes: lá o que passou a
valer, aqui que foi entregue.

---

## Resumo

| Leva | Documento | Estado | Etapas | Período |
| --- | --- | --- | --- | --- |
| **1 — MVP** | [1. ROADMAP- MVP.md](levas/1.%20ROADMAP-%20MVP.md) | **fechada**, com duas etapas deixadas de fora de propósito | 8 de 10 | 2026-07-30 → 2026-08-30 |
| **2 — o que sobe junto com o MVP** | [2. Plano de Desenvolvimento - Leva 2.md](levas/2.%20Plano%20de%20Desenvolvimento%20-%20Leva%202.md) | **fechada** | 11 de 11 | 2026-09-04 → 2026-09-05 |
| **3 — o que depende de infra ou de decisão** | [3. Plano de Desenvolvimento - Leva 3.md](levas/3.%20Plano%20de%20Desenvolvimento%20-%20Leva%203.md) | **em andamento** | 1 de 10 | 2026-09-07 → |

**Suítes:** 13 arquivos `.test.ts`, um por feature. A leva 1 fechou com **391 testes**; o total
depois da leva 2 não foi anotado no fim dela — a próxima execução completa da suíte preenche este
número.

---

## Leva 1 — MVP

O desenho está no [ROADMAP](levas/1.%20ROADMAP-%20MVP.md). A convenção de mensagem de commit por
etapa só nasceu na leva 2, então aqui o mapeamento etapa → commit é reconstruído a partir do
conteúdo, e uma etapa pode aparecer em mais de um commit.

### Base, antes das etapas

| O que | Commit | Data |
| --- | --- | --- |
| Estrutura do banco (as 22 migrations) | `671f43f` | 2026-08-24 |
| Padrão de testes de integração | `c0b1d84` | 2026-08-24 |
| Workspaces, autenticação e biometria | `7576915` | 2026-08-26 |
| Remoção da camada de criptografia do `.env` | `de2daaa` | 2026-08-26 |
| Token JWT sai do header e vira cookie; `IdWorkspace` entra no token | `70129a2` | 2026-08-28 |

### Etapas

| Etapa | O que é | Commit | Data |
| --- | --- | --- | --- |
| **1** | Contas e formas de pagamento | `786e368` | 2026-08-28 |
| **2** | Categorias — a hierarquia foi derrubada em `0a2c6b9` | `7d82be4` | 2026-08-28 |
| **3** | Pessoas e tags — as tags entraram junto com os gastos, em `db034de` | `b8c0512` | 2026-08-29 |
| **4** | Entradas e transferências, e o saldo calculado estreando | `eb7ba11` | 2026-08-29 |
| **5** | Gasto simples | `db034de` | 2026-08-29 |
| **6** | Parcelamento | `db034de` | 2026-08-29 |
| **7** | Gasto fixo | `db034de` | 2026-08-29 |
| **8** | Orçamento — **entregue em versão reduzida**: teto por categoria e mês com o comprometido calculado, cadastro do mês manual | `7f43f68` | 2026-08-29 |

### Deixadas de fora, e onde foram parar

| Etapa | Por quê | Onde está agora |
| --- | --- | --- |
| **8b** — a rotina mensal do orçamento | Precisa de agendador, que o projeto não tinha | Na [leva 3](levas/3.%20Plano%20de%20Desenvolvimento%20-%20Leva%203.md), com o desenho fechado e o agendador junto |
| **9** — compartilhamento de workspace | Fora do MVP, mas com uma pendência de segurança aberta | **Parcialmente feita:** o convite e o aceite foram feitos na leva 2, e fecharam a pendência. A gestão de membros (listar, trocar papel, remover, sair, transferir propriedade) continua aberta e não está em leva nenhuma |

---

## Leva 2 — o que sobe junto com o MVP

Onze etapas, todas concluídas, cada uma no seu commit — é a primeira leva a seguir a convenção de
mensagem descrita no `CLAUDE.md`.

| Etapa | O que é | Commit | Data |
| --- | --- | --- | --- |
| **1** | Logout | `6a4bea0` | 2026-09-04 |
| **2** | Convite de workspace, e `IdWorkspace` sai do cadastro | `83b92af` | 2026-09-04 |
| **3** | `Occurrences` sai do corpo do gasto | `8553f98` | 2026-09-04 |
| **4** | `Brand` e `LastDigits` saem do cartão | `51f1207` | 2026-09-04 |
| **5** | Desfazer o recebimento de uma entrada | `9a2c3bf` | 2026-09-04 |
| **6** | `POST /Inflows/batch`, e o enterro do clone | `6fc7065` | 2026-09-04 |
| **7** | As pernas de um período | `038d9fd` | 2026-09-05 |
| **8** | Conta "apenas cartão", e quem aceita cartão de crédito | `5e9405d` | 2026-09-05 |
| **9** | Orçamento por pessoa | `37982f6` | 2026-09-05 |
| **10** | O cartão ganha os dois fatos que faltavam — e a `CompetenceDate` nasce | `ae916d1` | 2026-09-05 |
| **11** | Estorno: gasto negativo no crédito | `c969cdb` | 2026-09-05 |

**Duas pendências não viraram etapa**, e está registrado no documento da leva por quê: a 11
(clonar o mês anterior) foi substituída pela 15, que é a etapa 6; e a 13 (`IncludeCanceled`) foi
aplicada solta, antes da leva — ver abaixo.

---

## Fora de leva

Trabalho que existe em código e não pertence a etapa nenhuma. Fica aqui para não ser procurado
numa leva onde não está.

| O que | Commit | Data | Observação |
| --- | --- | --- | --- |
| `IncludeCanceled` em `GET /Expenses` | `826a173` | 2026-09-03 | É a pendência 13; entrou antes de a leva 2 ser escrita, e o documento dela a registra como aplicada |
| `POST /Workspaces` — criar um workspace novo | `f18b9b3` | 2026-09-06 | Encosta na etapa 9 da leva 1 sem ser ela: cria o workspace de quem já tem conta, e não mexe em membro nem em sessão |
| Correções pontuais de cadastro e de busca de contas | `ef87996`, `48ea08e`, `e0f4f8b`, `ac3c826` | 2026-08-31 → 2026-09-03 | Ajustes sobre a etapa 1 da leva 1 |

---

## Leva 3 — em andamento

| Etapa | O que é | Commit | Data |
| --- | --- | --- | --- |
| **1** | O motor de rotinas | `7ada095` | 2026-09-07 |

Cada etapa concluída ganha sua linha, com commit e data, no commit em que for concluída.

**O que falta se lê no [documento da leva](levas/3.%20Plano%20de%20Desenvolvimento%20-%20Leva%203.md)** — a tabela dele é a fonte, e este documento
não a copia. O espelho que existia aqui foi removido em 2026-09-07: ele duplicava dez linhas que
mudam sozinhas, e a renumeração daquele dia mostrou o preço — duas tabelas dizendo números
diferentes sobre a mesma etapa, sem que nada avisasse qual estava velha.

**Os números da leva 3 mudaram em 2026-09-07, e mudam uma vez só.** Ela foi renumerada para que a
ordem dos números **seja** a ordem de execução, o que só pôde ser feito porque nada dela tinha
sido executado. Do primeiro commit `Fase #3 | Etapa N` em diante o número congela: é ele que o
commit cita, e reordenar depois faria a citação apontar para outra etapa.

Notificações e conciliação de extrato **saíram do MVP** na mesma data e não têm número nenhum.

---

## Como manter este documento

Ao concluir uma etapa, no **mesmo commit** da etapa:

1. mova a linha da tabela de pendentes para a tabela de executadas da leva, com **commit e data**;
2. atualize o **Resumo** — a contagem de etapas e, se a leva fechou, o estado e a data final;
3. se a etapa deixou algo de fora de propósito, registre em "deixadas de fora" **onde aquilo foi
   parar**, como as etapas 8b e 9 da leva 1 estão registradas. É a linha que impede um pedaço de
   trabalho de sumir entre duas levas.

E o que **não** entra aqui: o porquê de uma decisão (isso é do documento da leva), o que mudou
para o front (isso é a seção 18 do
[contrato](API%20-%20Contrato%20Front-end.md)), e commit de ajuste que não fecha etapa.
