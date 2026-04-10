import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../../stores/authStore";
import type { PageKey } from "@log-monitor/shared";

export function PermissionGate({ page, children }: { page: PageKey; children: ReactNode }) {
  const { user } = useAuthStore();

  if (!user) return null;

  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    return <>{children}</>;
  }

  if (!user.pageAccess.includes(page)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
