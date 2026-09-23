# Levas

Um arquivo por leva, `<N>. <Nome da leva>.md`. **A próxima é a 10** — o porquê da numeração
começar em 6 está em [../RoadMap MVP.md](../RoadMap%20MVP.md#as-levas-daqui-pra-frente).

| Leva | Estado |
| --- | --- |
| [6. O cartão, o uso real e a gestão de membros](6.%20O%20cartão,%20o%20uso%20real%20e%20a%20gestão%20de%20membros.md) | escrita em 09/09/2026, **fechada** em 09/09/2026 — 18 de 18 etapas |
| [7. O que a lei cobra e o que só quebra em produção](7.%20O%20que%20a%20lei%20cobra%20e%20o%20que%20só%20quebra%20em%20produção.md) | escrita em 10/09/2026, 12 de 12 etapas fechadas no mesmo dia — **reaberta** em 11/09/2026 com a etapa 13, **fechada** no mesmo dia: 13 de 13 |
| [8. O que só se prova subindo](8.%20O%20que%20só%20se%20prova%20subindo.md) | escrita em 11/09/2026, **9 de 10 etapas** fechadas entre 11/09 e 13/09 — falta a do e-mail do domínio, que depende de conta no provedor e de registro no DNS |
| [9. O que voltou de quem usa](9.%20O%20que%20voltou%20de%20quem%20usa.md) | escrita em 22/09/2026, **em execução** desde 22/09 — 14 de 16 etapas fechadas |

**A 9 é a primeira que não nasce de uma lista interna.** As oito anteriores saíram do que o
projeto sabia que devia; esta sai de treze retornos de quem usou o produto no ar, e por isso ela
mistura defeito de uma linha com duas trocas de modelo — o ciclo do cartão e o orçamento.
Nenhuma leva anterior teve essa mistura, e a tabela de etapas dela abre dizendo de qual retorno
cada etapa veio.

A 6 foi a primeira que nasceu com os dois repositórios já juntos. A **7 e a 8 são a preparação
para produção**, e o corte entre elas é o que se prova de que jeito: na 7 muda o que está
versionado em `API/` e `Frontend/`, e a suíte responde; na **8** — imagens, `compose`, vhost,
e-mail do domínio, arquivos externos e backup — muda o que está em volta deles, e só subindo se
sabe. Nenhuma etapa da 8 se verifica com `npm test`.

**As duas estiveram abertas ao mesmo tempo, e isso não foi uma fila furada.** A 8 foi escrita em
11/09, com a etapa 13 da 7 ainda por executar, porque nenhuma etapa da 8 depende dela: o plano
se escreve inteiro antes do código, e o que ele descreve — imagem, `compose`, vhost — não
encosta no aceite dos termos. A ordem de **execução** foi a 13 primeiro, no mesmo 11/09: ela
fecha um buraco de um produto que já está escrito, e a 8 sobe o produto.

O resto do que falta está na [fila do roadmap](../RoadMap%20MVP.md#a-fila-até-o-mvp) — que diz
**o que falta**, não o que cada leva faz: o recorte é do plano da leva.

As levas anteriores — três do backend e cinco do front, com numeração própria e colidindo entre
si — estão em [../Old/](../Old/). Elas seguem valendo como referência de **formato** e de
**porquê**; as melhores nesse sentido são a
[leva 3 do backend](../Old/API/levas/3.%20Plano%20de%20Desenvolvimento%20-%20Leva%203.md) e a
[leva 5 do front](../Old/Front/levas/5.%20Plano%20de%20Ajustes%205.md).

---

## O documento vem antes do código

**Documentar não é a última etapa, é o passo zero.** O documento é o que o código segue, não o
registro do que já foi feito. Uma leva começa pela escrita do seu plano inteiro; a primeira
linha de código vem depois.

A razão é a que o histórico do projeto mostra: as decisões que custaram caro para desfazer — o
saldo em cache, a hierarquia de categorias, a data única na perna — foram todas tomadas com o
código já escrito, e o documento apenas registrou o que já estava lá. Escrito antes, o desenho
é discutível de graça.

## O formato

Um plano de leva tem três partes, nesta ordem.

**1. A abertura** diz de onde a leva nasce e o que está errado agora. Se nasce de uma lista de
pedidos, ela é citada; se nasce de um número errado na tela, o número errado aparece — com o
exemplo concreto que o produz, não a descrição do problema em abstrato.

**2. A tabela de etapas**, que é o índice e a fila ao mesmo tempo:

```markdown
| Etapa | Assunto | Lado | Depende de | Commit |
|---|---|---|---|---|
| 1 | [Listar os membros do espaço](#etapa-1--listar-os-membros-do-espaço) | API + Front | — | |
| 2 | [Trocar o papel de um membro](#etapa-2--trocar-o-papel-de-um-membro) | API + Front | 1 | |
```

A coluna **Lado** é a novidade do repositório único: `API`, `Front` ou `API + Front`. Uma etapa
`API + Front` é entregue **junta**, num commit só — foi a separação delas em dois repositórios
que criou o `Pendencias Backend.md`, com semanas entre as duas metades de um mesmo trabalho.

A coluna **Commit** nasce vazia e é preenchida quando a etapa fecha (ver abaixo).

**A ordem da tabela é a das dependências, não a do menu nem a da urgência** — e a seção seguinte
diz **por quê** cada etapa está onde está, que é o que decide se furar a fila é seguro.

**3. Uma seção por etapa**, sempre com as mesmas três coisas:

- **O problema** — o que está errado ou faltando hoje, com o caso concreto;
- **A correção** — o que passa a existir, incluindo as rotas e as telas, e as decisões tomadas
  com o porquê de cada uma;
- **Os arquivos** — o que se cria e o que se mexe.

E, no fim do documento, duas seções que o histórico provou que não são opcionais:

- **O que esta leva não faz**, com o motivo. É a linha que impede um pedaço de trabalho de
  sumir entre duas levas;
- **Verificação** — o critério de aceite de cada etapa, em termos do que se vê na tela ou na
  resposta, não em termos de teste passando.

## Um commit por etapa concluída

```
Fase #6 | Etapa 2. Trocar o papel de um membro
```

`Fase #<leva> | Etapa <número>. <título como está no plano>`. Todos os arquivos da etapa num
commit só, direto na `main` — a convenção completa está no
[CLAUDE.md da raiz](../../CLAUDE.md).

Ao fechar a etapa, **no mesmo commit**, preencha a coluna `Commit` da tabela. É a única coisa
que se escreve no plano ao terminar: terminar uma etapa não é motivo para editar o desenho
dela. Se a definição mudou enquanto a etapa era executada, isso é uma **segunda** edição, e ela
diz outra coisa.

## O número da etapa congela no primeiro commit

Enquanto nenhuma etapa da leva tiver sido executada, renumerar é livre — e vale a pena, se a
ordem dos números deixar de ser a ordem de execução. **A partir do primeiro commit
`Fase #N | Etapa M`, o número é identidade** e não se mexe mais: renumerar depois faz a
citação do commit apontar para outra etapa, sem quebrar nada e sem avisar ninguém.

Foi o que aconteceu em 07/09/2026, quando a leva 3 do backend foi renumerada — a tempo, porque
nada dela tinha sido executado — e mesmo assim quarenta e poucos ponteiros entre documentos
passaram a apontar para o lugar errado. Daí a regra que vem junto:

**Nenhum documento cita a etapa de outro documento.** Uma referência entre documentos nomeia a
**leva**, no máximo; o que precisa ser dito sobre a etapa se diz pelo nome do que ela entrega,
que não muda quando os números mudam.

## Uma leva fechada pode reabrir, no fim da fila

**Acrescentar uma etapa no fim não é renumerar**, e é por isso que é permitido mesmo depois de a
leva ter fechado: a nova ganha o próximo número livre e nenhum commit existente passa a apontar
para outro lugar. O que ela **não** pode é se encaixar no meio para ficar perto das parentes
dela — isso é renumerar, e a regra de cima vale.

Aconteceu em 11/09/2026 com a leva 7, que fechou com 12 etapas em 10/09 e ganhou a **13** no dia
seguinte. O critério é o que separa uma etapa nova de uma leva nova: reabre quando o trabalho é
**a mesma pergunta que a leva já estava respondendo** e depende de uma etapa dela — ali, o
re-aceite dos termos, que lê a coluna que a etapa 2 tinha acabado de gravar. Trabalho que só
*parece* do mesmo assunto começa leva própria.

Quando isso acontece, **a reabertura fica escrita na abertura do plano**, com a data e o que a
provocou. Uma etapa que aparece no fim de uma leva fechada, sem explicação, lê-se como esquecimento.
