import { useState, useEffect, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useLogin } from "../hooks/useAuth";
import type { AuthUser, PageKey } from "@log-monitor/shared";

const DEFAULT_PAGE: Record<PageKey, string> = {
  dashboard: "/",
  logs: "/logs",
  ai: "/ai",
  settings: "/settings",
  import: "/import",
};

function getFirstPermittedPath(user: AuthUser): string {
  for (const page of ["dashboard", "logs", "ai", "settings"] as PageKey[]) {
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.pageAccess.includes(page)) {
      return DEFAULT_PAGE[page];
    }
  }
  return "/403";
}

export function LoginPage() {
  const { user, isInitialized } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loginMutation.isSuccess && loginMutation.data) {
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? getFirstPermittedPath(loginMutation.data), { replace: true });
    }
  }, [loginMutation.isSuccess, loginMutation.data, location.state, navigate]);

  if (isInitialized && user) {
    return <Navigate to={getFirstPermittedPath(user)} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await loginMutation.mutateAsync({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">LM</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Log Monitor</h1>
          <p className="text-xs text-muted-foreground">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {loginMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {loginMutation.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
