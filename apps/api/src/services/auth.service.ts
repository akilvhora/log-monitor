import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, generateRefreshToken } from "../lib/jwt.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  pageAccess: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toSafe(u: {
  id: string; email: string; name: string | null; role: string;
  pageAccess: string[]; isActive: boolean; createdAt: Date; updatedAt: Date;
}): SafeUser {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role,
    pageAccess: u.pageAccess, isActive: u.isActive,
    createdAt: u.createdAt, updatedAt: u.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Token pairs
// ---------------------------------------------------------------------------

export async function createTokenPair(
  user: SafeUser,
): Promise<{ accessToken: string; rawRefreshToken: string }> {
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { tokenHash, userId: user.id, expiresAt },
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    pageAccess: user.pageAccess,
  });

  return { accessToken, rawRefreshToken };
}

export async function refreshAccessToken(
  rawToken: string,
): Promise<{ accessToken: string; rawRefreshToken: string; user: SafeUser }> {
  const tokenHash = hashToken(rawToken);

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) {
    throw Object.assign(new Error("Invalid refresh token"), { statusCode: 401 });
  }

  // Reuse detection: revoked token presented → revoke entire family
  if (record.revokedAt !== null) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw Object.assign(
      new Error("Token reuse detected. Please log in again."),
      { statusCode: 401 },
    );
  }

  if (record.expiresAt < new Date()) {
    throw Object.assign(new Error("Refresh token expired"), { statusCode: 401 });
  }

  if (!record.user.isActive) {
    throw Object.assign(new Error("Account has been deactivated"), { statusCode: 401 });
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const safeUser = toSafe(record.user);
  const tokens = await createTokenPair(safeUser);
  return { ...tokens, user: safeUser };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken
    .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// User lookups
// ---------------------------------------------------------------------------

export async function getUserByEmailWithPassword(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
}

export async function getUserById(id: string): Promise<SafeUser | null> {
  const u = await prisma.user.findUnique({ where: { id } });
  return u ? toSafe(u) : null;
}

export async function listUsers(): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map(toSafe);
}

// ---------------------------------------------------------------------------
// User CRUD
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role: "USER" | "ADMIN";
  pageAccess: string[];
}

export async function createUser(data: CreateUserInput): Promise<SafeUser> {
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase().trim() },
  });
  if (existing) {
    throw Object.assign(new Error("Email already in use"), { statusCode: 409 });
  }
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase().trim(),
      passwordHash,
      name: data.name,
      role: data.role,
      pageAccess: data.pageAccess,
    },
  });
  return toSafe(user);
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  pageAccess?: string[];
  isActive?: boolean;
  role?: "USER" | "ADMIN";
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
  requesterId: string,
): Promise<SafeUser> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw Object.assign(new Error("User not found"), { statusCode: 404 });

  if (target.role === "SUPER_ADMIN" && requesterId !== id) {
    throw Object.assign(new Error("Cannot modify the super admin"), { statusCode: 403 });
  }
  if (requesterId === id) {
    if (data.isActive === false)
      throw Object.assign(new Error("Cannot deactivate your own account"), { statusCode: 400 });
    if (data.role && data.role !== target.role)
      throw Object.assign(new Error("Cannot change your own role"), { statusCode: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (data.email) patch.email = data.email.toLowerCase().trim();
  if (data.name !== undefined) patch.name = data.name;
  if (data.password) patch.passwordHash = await hashPassword(data.password);
  if (data.pageAccess !== undefined) patch.pageAccess = data.pageAccess;
  if (data.isActive !== undefined && target.role !== "SUPER_ADMIN") patch.isActive = data.isActive;
  if (data.role && target.role !== "SUPER_ADMIN") patch.role = data.role;

  const user = await prisma.user.update({ where: { id }, data: patch });
  return toSafe(user);
}

export async function deleteUser(id: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw Object.assign(new Error("User not found"), { statusCode: 404 });
  if (target.role === "SUPER_ADMIN") {
    throw Object.assign(
      new Error("The super admin account cannot be deleted"),
      { statusCode: 403 },
    );
  }
  await prisma.user.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export async function ensureSuperAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("[auth] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping super admin seed");
    return;
  }

  const existing = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (existing) return;

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "SUPER_ADMIN",
      name: "Super Admin",
      pageAccess: ["dashboard", "logs", "ai", "settings"],
      isActive: true,
    },
  });
  console.log(`[auth] Super admin created: ${email}`);
}
