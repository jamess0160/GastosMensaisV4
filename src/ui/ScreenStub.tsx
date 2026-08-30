import { PageHead, Workspace, Card } from "@/ui/primitives";

/** Marcador das telas ainda não convertidas. `source` aponta o arquivo
 *  do layout que é a fonte da conversão, e `frames` os estados que ele
 *  desenha — é o que falta transcrever. */
export function ScreenStub({
    title,
    subtitle,
    source,
    frames,
}: {
    title: string;
    subtitle: string;
    source: string;
    frames: string[];
}) {
    return (
        <Workspace>
            <PageHead title={title} subtitle={subtitle} />
            <Card>
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
                    Tela ainda não convertida. Fonte do layout:{" "}
                    <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{source}</code>
                    <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                        {frames.map((frame) => (
                            <li key={frame}>{frame}</li>
                        ))}
                    </ul>
                </div>
            </Card>
        </Workspace>
    );
}
