//  A versao dos documentos legais que o cadastro carimba em `Users.TermsVersion`.
//
//  E a MESMA data impressa no topo de `/termos` e `/privacidade`, que sai da constante
//  `LEGAL_VERSION` em `Frontend/src/pages/Legal/LegalLayout.tsx` — la em "DD/MM/AAAA", porque
//  e texto para ler; aqui em "YYYY-MM-DD", porque e valor para comparar e ordenar.
//
//  **Mudou o texto de qualquer um dos dois documentos, muda esta linha e a de la, no mesmo
//  commit.** Nao ha numeracao paralela a manter em sincronia: a data e a versao. Este e um dos
//  casos em que o repositorio unico paga — antes um lado esperava o outro.
//
//  **O cliente nunca manda a versao.** Ele manda `AcceptedTerms: true`, e quem diz COM O QUE
//  ele concordou e a API: aceitar a versao do corpo seria aceitar que o cliente afirmasse ter
//  concordado com um documento antigo, que e o oposto do que a coluna prova.
export const TERMS_VERSION = "2026-09-11"
