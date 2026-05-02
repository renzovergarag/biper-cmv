import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export interface SocketJWTPayload {
  sub: string;
  email: string;
  rol: "ADMIN" | "AGENT" | "INTERNAL";
  iat: number;
  exp: number;
}

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return JWT_SECRET;
}

export function verifySocketToken(token: string): SocketJWTPayload | null {
  try {
    return jwt.verify(token, getSecret()) as unknown as SocketJWTPayload;
  } catch {
    return null;
  }
}
