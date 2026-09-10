/**
 * As duas chaves de log do projeto, como **constante de código**.
 *
 * Elas moravam em `Utils/constants.json`, um arquivo herdado de outro projeto que o
 * `AsyncHandler` lia — `fs.readFile` + `JSON.parse` — **a cada requisição**, antes do
 * middleware de acesso e antes de qualquer rota, para gastar o resultado numa linha só dentro
 * do `catch`. Uma syscall por request para ler dois booleanos, num arquivo cujo resto era
 * `MssqlMaxParameters` e tipo de indicador de OEE.
 *
 * **Constante de código, e não variável de ambiente.** São flags de desenvolvimento: mudam com
 * o código, não com o servidor. Passar por `.env` transformaria estas duas linhas em mais um
 * item para esquecer no deploy — e é justamente o `CONSTANTS_PATH` (mais o arquivo que a
 * imagem teria que copiar para o lugar certo) que esta troca apaga.
 *
 * E não virou um `constants.json` menor: o formato é que era o problema. Lido no import, um
 * módulo TypeScript ainda dá erro de compilação quando alguém digita a flag errada, coisa que
 * um `JSON.parse` só descobre em produção.
 */
export const logFlags = {
    //  Liga o registro em `Logs/error/` do erro que estourou dentro de uma rota
    //  (`AsyncHandler`). Um `APIError` 406 vira `userError`, o resto vira `error`.
    routeErrors: true,

    //  Liga o log por rotina em `Logs/rotines/<nome>/` (`RotineEngine`). A grafia `rotine`
    //  acompanha a da pasta e a do registro, escritas assim desde a V3.
    rotine: true,
}
