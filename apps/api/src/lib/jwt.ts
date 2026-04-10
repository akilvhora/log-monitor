import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  pageAccess: string[];
  iat?: number;
  exp?: number;
}

function accessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret());
  return payload as unknown as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return randomBytes(64).toString("hex");
}
