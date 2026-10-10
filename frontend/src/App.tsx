import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ApiError } from "./api/errors";
import { AuthProvider } from "./auth/AuthProvider";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { Loading } from "./components/states";
import LoginPage from "./pages/LoginPage";
import MarketsPage from "./pages/MarketsPage";
import NewMarketPage from "./pages/NewMarketPage";
import NotFoundPage from "./pages/NotFoundPage";

// The dashboard pulls in recharts; load it only when a market is opened.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry once for network/5xx errors; 4xx answers (auth, not found, validation) won't change.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/" element={<Navigate to="/markets" replace />} />
              <Route path="/markets" element={<MarketsPage />} />
              <Route path="/markets/new" element={<NewMarketPage />} />
              <Route
                path="/markets/:id"
                element={<Suspense fallback={<Loading label="Loading dashboard…" rows={6} />}><DashboardPage /></Suspense>}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
