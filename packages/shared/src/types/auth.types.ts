export type PageKey = "dashboard" | "logs" | "ai" | "settings" | "import";
export type Role = "SUPER_ADMIN" | "ADMIN" | "USER";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  pageAccess: PageKey[];
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  pageAccess: PageKey[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role: "USER" | "ADMIN";
  pageAccess: PageKey[];
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: "USER" | "ADMIN";
  pageAccess?: PageKey[];
  isActive?: boolean;
}
