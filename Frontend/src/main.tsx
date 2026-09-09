import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ApiUnauthorizedError } from "@/api/client";
import { router } from "@/app/routes";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { installTelemetry } from "@/app/telemetry";
import "@/styles/global.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Um 401 não se resolve repetindo: o guard manda ao login.
            retry: (failureCount, error) =>
                !(error instanceof ApiUnauthorizedError) && failureCount < 2,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
        },
    },
});

// Erro solto e promessa rejeitada sem `catch` viram `POST /Utils/Logs`.
installTelemetry();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </ErrorBoundary>
    </StrictMode>,
);
