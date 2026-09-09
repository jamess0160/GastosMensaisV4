import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

/* ════════════════════════════════════════════════════════════
   O gráfico do Relatório.

   IMPORTAÇÃO MODULAR, e não `import * as echarts from "echarts"`. O
   pacote inteiro passa de 1 MB — só os três tipos usados aqui, mais
   grade, dica e legenda, e o renderizador de canvas. A tela já é
   `lazy`, e importar o pacote completo desfaria isso: o Relatório é a
   única tela que carrega gráfico, e quem nunca o abre não deve baixá-lo.

   Registrar é global e idempotente: `echarts.use` na carga do módulo, e
   qualquer `<EChart>` da tela já encontra tudo pronto.
   ════════════════════════════════════════════════════════════ */
echarts.use([
    LineChart,
    BarChart,
    PieChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    CanvasRenderer,
]);

/** Um token do sistema, em cor de verdade.
 *
 *  O ECharts pinta em canvas e não enxerga `var(--ink-2)`, mas duplicar
 *  os hexadecimais aqui criaria uma segunda paleta que envelhece
 *  sozinha. Ler a variável computada mantém uma fonte da verdade só —
 *  `src/styles/tokens.css`. */
export function token(name: string): string {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function EChart({
    option,
    height = 300,
    /** Clique numa fatia/barra/ponto — o `name` da série ou do dado. */
    onPick,
    ariaLabel,
}: {
    option: EChartsCoreOption;
    height?: number;
    onPick?: (params: { name: string; seriesName?: string; dataIndex: number }) => void;
    ariaLabel?: string;
}) {
    const host = useRef<HTMLDivElement>(null);
    const chart = useRef<echarts.ECharts | null>(null);
    /* O handler muda de identidade a cada render (é quase sempre uma
       arrow inline). Guardado num ref, o efeito de montagem não precisa
       dele nas dependências — e assim o gráfico não é recriado a cada
       tecla digitada na busca. */
    const onPickRef = useRef(onPick);
    onPickRef.current = onPick;

    useEffect(() => {
        const element = host.current;
        if (!element) return;

        const instance = echarts.init(element);
        chart.current = instance;

        instance.on("click", (params) => {
            onPickRef.current?.({
                name: String(params.name),
                seriesName: params.seriesName,
                dataIndex: params.dataIndex,
            });
        });

        /* `ResizeObserver` e não `window.resize`: o painel muda de
           largura sem a janela mudar de tamanho — abrir a barra
           inferior, o slide-over, o teclado do telefone. */
        const observer = new ResizeObserver(() => instance.resize());
        observer.observe(element);

        return () => {
            observer.disconnect();
            instance.dispose();
            chart.current = null;
        };
    }, []);

    /* `notMerge`: trocar de visualização substitui a opção inteira. Sem
       isso, o eixo do gráfico de linha sobreviveria por baixo do donut. */
    useEffect(() => {
        chart.current?.setOption(option, true);
    }, [option]);

    return <div ref={host} style={{ height }} role="img" aria-label={ariaLabel} />;
}
