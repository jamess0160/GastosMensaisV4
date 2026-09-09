// `defineConfig` vem do vitest para o bloco `test` ser tipado; o resto
// da config continua sendo a do Vite.
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// O cookie de sessao e HttpOnly + SameSite=Strict. Em dev, front e API em portas
// diferentes sao origens diferentes e o cookie nao viaja. Por isso /api e servido
// pelo proprio dev server via proxy, mantendo tudo em uma unica origem.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const target = env.VITE_API_PROXY_TARGET ?? "http://localhost:4000";

    return {
        plugins: [react()],
        resolve: {
            alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
        },
        server: {
            port: 5173,
            proxy: {
                "/api": {
                    target,
                    changeOrigin: false,
                    rewrite: (path) => path.replace(/^\/api/, ""),
                },
            },
        },
        test: {
            // jsdom em todos os testes: o baseURL do client é "/api",
            // relativo, e sem origem de documento o axios nem chega a
            // fazer a requisição. É também o ambiente em que o app roda.
            environment: "jsdom",
            setupFiles: ["./src/test/setup.ts"],
            include: ["src/**/tests/**/*.test.{ts,tsx}"],
            coverage: {
                include: ["src/lib/**", "src/api/**", "src/pages/**/sections/**"],
            },
        },
    };
});
