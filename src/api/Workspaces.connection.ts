import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Workspaces` — não há POST: hoje é um workspace por usuário e
 *  ele nasce no cadastro. */
class Connection {
    private readonly route = "/Workspaces";

    /** Os workspaces em que o usuário é membro. */
    async getSelf(): Promise<ApiTypes.Workspace[]> {
        const { data } = await http.get<ApiTypes.Workspace[]>(`${this.route}/getSelf`);
        return data;
    }

    /** A única rota que recebe IdWorkspace do cliente: confere a matrícula
     *  e REEMITE o cookie, porque o workspace vive dentro do token. */
    async switch(idWorkspace: number): Promise<ApiTypes.Workspace> {
        const { data } = await http.post<ApiTypes.Workspace>(`${this.route}/switch`, {
            IdWorkspace: idWorkspace,
        });
        return data;
    }

    /** Edita o workspace selecionado na sessão — sem id no caminho. */
    async update(name: string): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(this.route, { Name: name });
        return data;
    }
}

export const WorkspacesConnection = new Connection();
