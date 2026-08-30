// Importado explicitamente para não precisar dos globais do Node no
// tsconfig do app — lá, um `process` disponível seria armadilha:
// ele não existe no navegador.
import process from "node:process";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

/** O fuso é fixado antes de qualquer teste rodar.
 *
 *  Sem isso, uma máquina configurada em UTC passa em todos os testes de
 *  data e o bug aparece só em produção: `new Date("2026-05-05")` é lido
 *  como meia-noite UTC, que em UTC-3 é dia 04. É exatamente o erro que
 *  `src/lib/date.ts` existe para evitar, então o teste precisa rodar no
 *  fuso em que o sistema é usado. */
process.env.TZ = "America/Sao_Paulo";

// Nenhuma requisição sai de verdade nos testes: o que não tiver handler
// declarado quebra o teste em vez de bater na rede.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
