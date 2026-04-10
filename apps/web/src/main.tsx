import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { useCurrentUser } from "./hooks/useAuth";
import { useAuthStore } from "./stores/authStore";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

// Initializes auth state before rendering — prevents flash-to-login on refresh.
function AuthInitializer({ children }: { children: React.ReactNode }) {
  useCurrentUser(); // runs /api/auth/me, sets authStore

  const { setUser } = useAuthStore();

  // Listen for session expiry emitted by the API layer
  useEffect(() => {
    function onExpired() {
      setUser(null);
      queryClient.clear();
    }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [setUser]);

  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthInitializer>
          <App />
        </AuthInitializer>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
