import { setupServer } from "msw/node";

/** Servidor de mentira que intercepta as requisições no nível da rede.
 *
 *  A diferença para "fingir a connection" é que aqui o axios, o
 *  interceptor de erro e o React Query rodam de verdade — então o teste
 *  cobre também o caminho do 406 virar mensagem na tela.
 *
 *  Começa sem handler nenhum: cada teste declara o que a API responde
 *  com `server.use(...)`, e o `resetHandlers` do setup limpa depois. */
export const server = setupServer();
