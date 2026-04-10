import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/authenticate.js";
import {
  getUserByEmailWithPassword,
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  createTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  verifyPassword,
} from "../services/auth.service.js";

// ---------------------------------------------------------------------------
// Rate limiting for login (in-memory, 10 req/min per IP)
// ---------------------------------------------------------------------------
const loginAttempts = new Map<string, number[]>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const times = (loginAttempts.get(ip) ?? []).filter((t) => now - t < window);
  times.push(now);
  loginAttempts.set(ip, times);
  return times.length <= 10;
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------
const IS_PROD = process.env.NODE_ENV === "production";

const ACCESS_COOKIE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "strict" : "lax") as "strict" | "lax",
  path: "/",
  maxAge: 900, // 15 min
};

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "strict" : "lax") as "strict" | "lax",
  path: "/api/auth/refresh",
  maxAge: 604_800, // 7 days
};

const CLEAR_ACCESS = { ...ACCESS_COOKIE, maxAge: 0 };
const CLEAR_REFRESH = { ...REFRESH_COOKIE, maxAge: 0 };

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]),
  pageAccess: z.array(z.enum(["dashboard", "logs", "ai", "settings"])),
});

const UpdateUserBody = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  pageAccess: z.array(z.enum(["dashboard", "logs", "ai", "settings"])).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/login
  app.post("/api/auth/login", async (request, reply) => {
    const ip = request.ip ?? "unknown";
    if (!checkLoginRateLimit(ip)) {
      return reply.status(429).send({
        error: "RateLimitExceeded",
        message: "Too many login attempts. Please wait a minute.",
        statusCode: 429,
      });
    }

    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      // Constant-time delay to prevent user enumeration
      await new Promise((r) => setTimeout(r, 200));
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid email or password",
        statusCode: 401,
      });
    }

    const { email, password } = parsed.data;
    const user = await getUserByEmailWithPassword(email);

    // Always run bcrypt to prevent timing attacks even if user not found
    const DUMMY_HASH = "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const passwordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordValid || !user.isActive) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid email or password",
        statusCode: 401,
      });
    }

    const safeUser = {
      id: user.id, email: user.email, name: user.name, role: user.role,
      pageAccess: user.pageAccess, isActive: user.isActive,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    };

    const { accessToken, rawRefreshToken } = await createTokenPair(safeUser);

    reply
      .setCookie("access_token", accessToken, ACCESS_COOKIE)
      .setCookie("refresh_token", rawRefreshToken, REFRESH_COOKIE);

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      pageAccess: user.pageAccess,
    });
  });

  // POST /api/auth/refresh
  app.post("/api/auth/refresh", async (request, reply) => {
    const rawToken = request.cookies?.refresh_token;
    if (!rawToken) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "No refresh token",
        statusCode: 401,
      });
    }

    try {
      const { accessToken, rawRefreshToken, user } = await refreshAccessToken(rawToken);

      reply
        .setCookie("access_token", accessToken, ACCESS_COOKIE)
        .setCookie("refresh_token", rawRefreshToken, REFRESH_COOKIE);

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        pageAccess: user.pageAccess,
      });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      reply.clearCookie("access_token", { path: "/" });
      reply.clearCookie("refresh_token", { path: "/api/auth/refresh" });
      return reply.status(e.statusCode ?? 401).send({
        error: "Unauthorized",
        message: e.message,
        statusCode: e.statusCode ?? 401,
      });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", async (request, reply) => {
    const rawToken = request.cookies?.refresh_token;
    if (rawToken) await revokeRefreshToken(rawToken);

    reply
      .setCookie("access_token", "", CLEAR_ACCESS)
      .setCookie("refresh_token", "", CLEAR_REFRESH);

    return reply.send({ ok: true });
  });

  // GET /api/auth/me  (requires auth)
  app.get(
    "/api/auth/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = await getUserById(request.user.sub);
      if (!user || !user.isActive) {
        reply.setCookie("access_token", "", CLEAR_ACCESS).setCookie("refresh_token", "", CLEAR_REFRESH);
        return reply.status(401).send({ error: "Unauthorized", message: "User not found or inactive", statusCode: 401 });
      }
      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        pageAccess: user.pageAccess,
      });
    },
  );

  // GET /api/auth/users  (admin+)
  app.get(
    "/api/auth/users",
    { preHandler: [authenticate, requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (_request, reply) => {
      const users = await listUsers();
      return reply.send(
        users.map((u) => ({
          id: u.id, email: u.email, name: u.name, role: u.role,
          pageAccess: u.pageAccess, isActive: u.isActive,
          createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString(),
        })),
      );
    },
  );

  // POST /api/auth/users  (admin+)
  app.post(
    "/api/auth/users",
    { preHandler: [authenticate, requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const parsed = CreateUserBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "ValidationError", message: parsed.error.message, statusCode: 400 });
      }
      try {
        const user = await createUser(parsed.data);
        return reply.status(201).send({
          id: user.id, email: user.email, name: user.name, role: user.role,
          pageAccess: user.pageAccess, isActive: user.isActive,
          createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
        });
      } catch (err) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: "Error", message: e.message, statusCode: e.statusCode ?? 500 });
      }
    },
  );

  // PUT /api/auth/users/:id  (admin+)
  app.put(
    "/api/auth/users/:id",
    { preHandler: [authenticate, requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateUserBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "ValidationError", message: parsed.error.message, statusCode: 400 });
      }
      try {
        const user = await updateUser(id, parsed.data, request.user.sub);
        return reply.send({
          id: user.id, email: user.email, name: user.name, role: user.role,
          pageAccess: user.pageAccess, isActive: user.isActive,
          createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
        });
      } catch (err) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: "Error", message: e.message, statusCode: e.statusCode ?? 500 });
      }
    },
  );

  // DELETE /api/auth/users/:id  (admin+)
  app.delete(
    "/api/auth/users/:id",
    { preHandler: [authenticate, requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await deleteUser(id);
        return reply.status(204).send();
      } catch (err) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: "Error", message: e.message, statusCode: e.statusCode ?? 500 });
      }
    },
  );
};
