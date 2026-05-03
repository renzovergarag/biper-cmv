import { Rol } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export interface JWTPayload {
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
  iat: number;
  exp: number;
}

interface InternalJWTPayload {
  sub: string;
  rol: string;
  iat: number;
  exp: number;
}

function getSecret(): Uint8Array {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(JWT_SECRET);
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "d": return value * 24 * 60 * 60;
    case "h": return value * 60 * 60;
    case "m": return value * 60;
    case "s": return value;
    default: return 7 * 24 * 60 * 60;
  }
}

export async function generateToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  const expiresIn = parseDuration(JWT_EXPIRES_IN);
  return new SignJWT({ email: payload.email, nombre: payload.nombre, rol: payload.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: payload.sub!,
      email: payload.email as string,
      nombre: payload.nombre as string,
      rol: payload.rol as Rol,
      iat: payload.iat!,
      exp: payload.exp!,
    };
  } catch {
    return null;
  }
}

export async function verifyInternalToken(token: string): Promise<InternalJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.rol !== "INTERNAL") {
      return null;
    }
    return {
      sub: payload.sub!,
      rol: payload.rol as string,
      iat: payload.iat!,
      exp: payload.exp!,
    };
  } catch {
    return null;
  }
}

export async function generateInternalToken(): Promise<string> {
  return new SignJWT({ rol: "INTERNAL" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("internal")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecret());
}
