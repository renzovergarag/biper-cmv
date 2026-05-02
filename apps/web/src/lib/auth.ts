import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Rol } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export interface JWTPayload {
  sub: string;
  email: string;
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

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return JWT_SECRET;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES_IN, algorithm: "HS256" } as SignOptions);
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getSecret()) as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyInternalToken(token: string): InternalJWTPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as unknown as InternalJWTPayload;
    if (decoded.rol !== "INTERNAL") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function generateInternalToken(): string {
  const options: SignOptions = { expiresIn: "5m", algorithm: "HS256" };
  return jwt.sign(
    { sub: "internal", rol: "INTERNAL" },
    getSecret(),
    options
  );
}
