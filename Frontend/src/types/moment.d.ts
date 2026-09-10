/** O arquivo de locale do moment é JS puro e não vem com declaração.
 *
 *  Ele é importado só pelo efeito colateral de registrar o `pt-br` (ver
 *  [src/lib/date.ts](../lib/date.ts)), e `noUncheckedSideEffectImports`
 *  exige que o módulo exista para o TypeScript também — sem isto o
 *  import não compila, e sem o import os nomes de mês saem em inglês. */
declare module "moment/locale/pt-br";
