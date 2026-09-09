# Documentação de antes da junção dos repositórios

**Nada aqui é mantido.** Estes documentos descrevem o projeto quando ele era **dois
repositórios** — um da API, um do front — e foram congelados em 2026-09-09, quando os dois
viraram um só. Eles continuam versionados porque guardam o **porquê** de decisões que ainda
valem no código; não porque descrevam o estado de hoje.

O que descreve o estado de hoje é [../RoadMap MVP.md](../RoadMap%20MVP.md).

Em caso de conflito entre um documento daqui e o código, **o código ganha** — e o roadmap é
quem deve ser corrigido, não o arquivo daqui.

---

## O que tem aqui

### `Contrato Front-end/`

O contrato da API e o seu changelog. **Foi o documento mais importante dos dois repositórios e
é o que a junção matou**: ele existia para atravessar a fronteira entre eles — o front era
escrito contra um documento porque não enxergava o código da API. Agora enxerga.

| Arquivo | O que é |
| --- | --- |
| [API - Contrato Front-end.md](Contrato%20Front-end/API%20-%20Contrato%20Front-end.md) | Todas as rotas, a validação Joi de cada uma e o formato de cada resposta, como estavam em 08/09/2026 |
| [changelogs/](Contrato%20Front-end/changelogs/) | Um arquivo por leva do backend, com os deltas: `Fase #1` (vazio de propósito), `#2`, `#3` e `Fora de leva` |

Havia duas cópias do changelog, uma em cada repositório, e elas **já tinham divergido**: a do
front parou de receber entradas em algum ponto da Fase #3. A cópia da API — a completa — é a
que ficou. É o argumento contra o documento espelhado, escrito pelo próprio documento.

### `API/`

| Arquivo | O que é |
| --- | --- |
| [levas/1. ROADMAP- MVP.md](API/levas/1.%20ROADMAP-%20MVP.md) | O roadmap do backend, com as **quatro decisões transversais** que ainda mandam no código (workspace dentro do token, saldo calculado sem cache, quem escreve `Expenses.Status`, filtro `From`/`To`) |
| [levas/2. ...md](API/levas/2.%20Plano%20de%20Desenvolvimento%20-%20Leva%202.md) | As onze etapas que subiram junto com o MVP |
| [levas/3. ...md](API/levas/3.%20Plano%20de%20Desenvolvimento%20-%20Leva%203.md) | Rotinas, e-mail, `CompetenceMode`, relatórios e exportação — **é o documento com mais decisão registrada do projeto** |
| [Levas executadas.md](API/Levas%20executadas.md) | Etapa → commit → data das três levas do backend |
| [Pendencias Backend.md](API/Pendencias%20Backend.md) | As 21 pendências que o front levantou contra a API. Morreu por ter cumprido a função: uma pendência entre duas partes do mesmo repositório é uma etapa de leva, não um documento |

### `Front/`

| Arquivo | O que é |
| --- | --- |
| [levas/1. Plano de Desenvolvimento.md](Front/levas/1.%20Plano%20de%20Desenvolvimento.md) | Do zero ao MVP do cliente, com a regra de escopo que definiu tudo: implementar **só o que a API já expõe** |
| [levas/2. Plano de Ajustes 2.md](Front/levas/2.%20Plano%20de%20Ajustes%202.md) | A lista crua de ajustes do dono do projeto — o único documento aqui que não é plano, é pedido |
| [levas/3. Plano de Ajustes 3.md](Front/levas/3.%20Plano%20de%20Ajustes%203.md) | Mês compartilhado, navegação mobile e a reescrita de Gastos, Renda e Contas |
| [levas/4. Plano de Ajustes 4.md](Front/levas/4.%20Plano%20de%20Ajustes%204.md) | A primeira leva do front que nasce do changelog e não do layout |
| [levas/5. Plano de Ajustes 5.md](Front/levas/5.%20Plano%20de%20Ajustes%205.md) | **A única leva aberta quando os repositórios se juntaram** — as etapas 4 a 8 continuam por fazer, e por isso ela é a única daqui que o roadmap ainda cita como fila |

---

## Duas armadilhas de leitura

**A numeração das levas colide.** "Fase #3" do backend e "Fase #3" do front são levas
diferentes, de repositórios diferentes, e os commits de cada uma citam a sua. A leva 4 do front
foi a que implementou o changelog da Fase #2 do backend. É exatamente essa confusão que a
numeração unificada a partir da **leva 6** encerra — ver [../RoadMap MVP.md](../RoadMap%20MVP.md).

**Nenhum número de etapa daqui vale como referência.** A leva 3 do backend foi renumerada em
07/09/2026 e a renumeração quebrou silenciosamente quarenta e poucos ponteiros: cada um
continuou resolvendo, cada um passou a apontar para outra etapa. Ao citar um trabalho daqui,
cite **o nome do que ele entrega**, nunca "a etapa 7".
