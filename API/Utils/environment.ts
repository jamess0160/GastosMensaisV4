//  **Qual é o ambiente, perguntado em um lugar só.**
//
//  Havia duas variáveis dizendo a mesma coisa: `NODE_ENV`, que decide o `secure` do cookie, o
//  transporte do Mailer, o `.env.test` por cima do `.env` e o motor de rotinas; e uma `PROD`
//  que só o `AsyncHandler` conhecia, não documentada em lugar nenhum — então em produção,
//  sem alguém adivinhar que ela existia, todo stack de erro ia para o stdout do container.
//  `PROD` morreu, e como a pergunta passou a ser feita em mais de um ponto ela virou estas
//  duas funções. É isso que impede o terceiro lugar de comparar com "prod" ou "PRODUCTION" e
//  funcionar em tudo menos no que importa.
//
//  **Este é o único ponto do projeto que lê `process.env` fora do `enviromentManager`**, e a
//  exceção é o que a torna possível: `Utils.configEnv()` consulta o ambiente para decidir se
//  carrega o `.env.test`, ou seja, *antes* de qualquer `.env` ter sido lido — e o
//  `enviromentManager` chama o `configEnv` no seu próprio import. Passar por ele aqui fecharia
//  um ciclo de import. Não custa nada: `NODE_ENV` nunca vem do `.env`, vem do terminal
//  (`cross-env`) ou do orquestrador do deploy, que é onde ela precisa estar.
//
//  A leitura é feita **a cada chamada**, nunca capturada em uma const de import: a suíte do
//  Mailer troca `process.env.NODE_ENV` em runtime para provar o transporte SMTP, e um valor
//  congelado no import faria esse teste passar mentindo.

/**
 * Ambiente de produção — hoje: `secure` no cookie de sessão, o stack de erro fora do stdout e o
 * log do Winston pelo `Console` em vez de arquivo em disco.
 *
 * A ausência da variável é a resposta "não é produção", não um erro de boot: em
 * desenvolvimento ela simplesmente não existe. **Setar `NODE_ENV=production` no ambiente do
 * deploy é assunto de infra**; o que mora aqui é o código que se comporta certo quando ela
 * estiver setada.
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === "production"
}

/** Ambiente de teste — o `.env.test` por cima do `.env`, o `jsonTransport` do Mailer e o motor de rotinas desligado. */
export function isTest(): boolean {
    return process.env.NODE_ENV === "test"
}
