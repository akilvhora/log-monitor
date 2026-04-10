import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../lib/jwt.js";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies?.access_token;
  if (!token) {
    return reply
      .status(401)
      .send({ error: "Unauthorized", message: "No access token", statusCode: 401 });
  }

  try {
    const payload = await verifyAccessToken(token);
    request.user = payload;
  } catch {
    return reply
      .status(401)
      .send({ error: "TokenExpired", message: "Access token is invalid or expired", statusCode: 401 });
  }
}

export function requireRole(roles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!roles.includes(request.user?.role)) {
      return reply
        .status(403)
        .send({ error: "Forbidden", message: "Insufficient permissions", statusCode: 403 });
    }
  };
}
