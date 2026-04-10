import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2, ShieldCheck, User as UserIcon, X, Check } from "lucide-react";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "../../hooks/useAuth";
import { useAuthStore } from "../../stores/authStore";
import type { UserRecord, PageKey } from "@log-monitor/shared";

const ALL_PAGES: { key: PageKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "logs", label: "Logs" },
  { key: "ai", label: "AI Analysis" },
  { key: "settings", label: "Settings" },
  { key: "import", label: "Import" },
];

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  ADMIN: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  USER: "bg-muted text-muted-foreground border-border",
};

// ---------------------------------------------------------------------------
// User form (create + edit)
// ---------------------------------------------------------------------------
interface UserFormProps {
  initial?: Partial<UserRecord>;
  onSave: (data: {
    email: string; password: string; name: string;
    role: "USER" | "ADMIN"; pageAccess: PageKey[];
  }) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function UserForm({ initial, onSave, onClose, isLoading }: UserFormProps) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">(
    (initial?.role === "ADMIN" ? "ADMIN" : "USER"),
  );
  const [pageAccess, setPageAccess] = useState<PageKey[]>(
    (initial?.pageAccess as PageKey[]) ?? [],
  );
  const [error, setError] = useState("");

  const togglePage = (key: PageKey) =>
    setPageAccess((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!initial && password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    try {
      await onSave({ email, password, name, role, pageAccess });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const isEdit = !!initial;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{isEdit ? "Edit User" : "Create User"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-xs text-muted-foreground">Email *</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs bg-muted border border-border rounded px-3 py-1.5 text-foreground"
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full text-xs bg-muted border border-border rounded px-3 py-1.5 text-foreground"
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Password {isEdit ? "(leave blank to keep)" : "*"}
              </label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs bg-muted border border-border rounded px-3 py-1.5 text-foreground"
                placeholder={isEdit ? "••••••••" : "Min 8 chars"}
                required={!isEdit}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Role</label>
            <div className="flex gap-2">
              {(["USER", "ADMIN"] as const).map((r) => (
                <button
                  key={r} type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                    role === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Page Access {role === "ADMIN" ? "(admins have all access)" : ""}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PAGES.map(({ key, label }) => {
                const checked = role === "ADMIN" || pageAccess.includes(key);
                const disabled = role === "ADMIN";
                return (
                  <button
                    key={key} type="button"
                    disabled={disabled}
                    onClick={() => togglePage(key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-colors ${
                      checked
                        ? "bg-primary/10 border-primary/40 text-foreground"
                        : "bg-muted border-border text-muted-foreground"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                      checked ? "bg-primary border-primary" : "border-muted-foreground"
                    }`}>
                      {checked && <Check size={10} className="text-primary-foreground" strokeWidth={3} />}
                    </div>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-1.5 rounded border border-border text-xs text-muted-foreground hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
              {isLoading && <Loader2 size={12} className="animate-spin" />}
              {isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function UsersPage() {
  const { user: me } = useAuthStore();
  const { data: users = [], isLoading } = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function handleCreate(data: Parameters<typeof createMutation.mutateAsync>[0]) {
    await createMutation.mutateAsync(data);
    setShowCreate(false);
  }

  async function handleUpdate(data: {
    email: string; password: string; name: string; role: "USER" | "ADMIN"; pageAccess: PageKey[];
  }) {
    if (!editing) return;
    await updateMutation.mutateAsync({
      id: editing.id,
      data: {
        email: data.email,
        name: data.name || undefined,
        password: data.password || undefined,
        role: data.role,
        pageAccess: data.pageAccess,
      },
    });
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirm(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">User Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage who can access the application and which pages they can view.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <Plus size={13} />
          Add User
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const isSuperAdmin = u.role === "SUPER_ADMIN";
              const isMe = u.id === me?.id;

              return (
                <div
                  key={u.id}
                  className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-lg"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {isSuperAdmin
                      ? <ShieldCheck size={16} className="text-purple-400" />
                      : <UserIcon size={16} className="text-muted-foreground" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {u.name ?? u.email}
                      </span>
                      {isMe && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${ROLE_BADGE[u.role]}`}>
                        {u.role.replace("_", " ")}
                      </span>
                      {!u.isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded border bg-destructive/10 text-destructive border-destructive/30">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                    {u.role === "USER" && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {ALL_PAGES.map(({ key, label }) => (
                          <span key={key}
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              u.pageAccess.includes(key)
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground/40"
                            }`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(!isSuperAdmin || isMe) && (
                      <button
                        title="Edit"
                        onClick={() => setEditing(u)}
                        className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {!isSuperAdmin && !isMe && (
                      deleteConfirm === u.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs px-2 py-1 rounded bg-destructive text-white hover:bg-destructive/90 disabled:opacity-60"
                          >
                            {deleteMutation.isPending ? "…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          title="Delete"
                          onClick={() => setDeleteConfirm(u.id)}
                          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <UserForm
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          isLoading={createMutation.isPending}
        />
      )}

      {editing && (
        <UserForm
          initial={editing}
          onSave={handleUpdate}
          onClose={() => setEditing(null)}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}
