//  O que uma rotina é, e nada além disso.
//
//  A agenda é **declarativa e tipada**, não uma string de cron: `{ kind: "monthly", day: 1,
//  hour: 3 }` o compilador confere, `"0 3 1 * *"` ninguém confere. Foi por isso que o
//  node-cron ficou de fora — ele resolve só a metade fácil (o "venceu?"), que aqui são dez
//  linhas puras, e não faz a metade difícil: reivindicação, catch-up e registro da execução.
export namespace RotinesNamespace {

    export interface Rotine {
        /**
         * O nome que vai para `RotineRuns.Name` e para `Logs/rotines/<nome>/`.
         *
         * É a identidade da rotina no banco, então mudá-lo faz o motor achar que a rotina
         * nunca rodou — e a ocorrência vencida ser reivindicada de novo com o nome novo.
         */
        name: string
        schedule: Schedule
        /**
         * `ScheduledFor` é a ocorrência que está sendo executada, não o relógio.
         *
         * A distinção é o catch-up inteiro: rodando no dia 2 uma ocorrência do dia 1º, é o
         * dia 1º que a rotina tem que enxergar. Uma rotina que olhasse `moment()` por conta
         * própria materializaria o mês errado justamente no dia em que o servidor caiu.
         */
        run(ScheduledFor: string): Promise<void>
    }

    export type Schedule =
        | { kind: "daily", hour: number }
        | { kind: "monthly", day: number, hour: number }
}
