import { NavLink } from "react-router-dom";
import { LayoutDashboard, ScrollText, Sparkles, Settings, Users, LogOut, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useLogout } from "../../hooks/useAuth";
import type { PageKey } from "@log-monitor/shared";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  page?: PageKey;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, page: "dashboard" },
  { to: "/logs", label: "Logs", icon: ScrollText, page: "logs" },
  { to: "/ai", label: "AI Analysis", icon: Sparkles, page: "ai" },
  { to: "/import", label: "Import Logs", icon: Upload, page: "import" },
  { to: "/settings", label: "Settings", icon: Settings, page: "settings" },
  { to: "/admin/users", label: "User Management", icon: Users, adminOnly: true },
];

export function Sidebar() {
  const { user } = useAuthStore();
  const logout = useLogout();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user) return false;
    if (item.adminOnly) return user.role === "SUPER_ADMIN" || user.role === "ADMIN";
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    return item.page ? user.pageAccess.includes(item.page) : true;
  });

  return (
    <div className="w-14 shrink-0 flex flex-col items-center py-4 gap-2 bg-card border-r border-border">
      {/* Logo */}
      <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center mb-3">
        <span className="text-primary text-xs font-bold">LM</span>
      </div>

      {/* Nav links */}
      {visibleItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={label}
          className={({ isActive }) =>
            cn(
              "w-9 h-9 rounded flex items-center justify-center transition-colors",
              isActive
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )
          }
        >
          <Icon size={17} />
        </NavLink>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      {user && (
        <button
          title="Sign out"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="w-9 h-9 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          <LogOut size={16} />
        </button>
      )}
    </div>
  );
}
