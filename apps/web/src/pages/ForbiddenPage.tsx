import { useNavigate } from "react-router-dom";
import { ShieldOff } from "lucide-react";

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <ShieldOff size={36} className="text-muted-foreground/40" />
      <div>
        <h2 className="text-sm font-semibold text-foreground">Access Denied</h2>
        <p className="text-xs text-muted-foreground mt-1">
          You don't have permission to view this page.
        </p>
      </div>
      <button
        onClick={() => navigate(-1)}
        className="text-xs text-primary hover:underline"
      >
        Go back
      </button>
    </div>
  );
}
