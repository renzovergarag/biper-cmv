import { Socket } from "socket.io";
import { verifySocketToken, SocketJWTPayload } from "../lib/auth.js";

declare module "socket.io" {
  interface Socket {
    user: SocketJWTPayload;
  }
}

export function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Token de autenticación requerido"));
  }

  const decoded = verifySocketToken(token);

  if (!decoded) {
    return next(new Error("Token inválido"));
  }

  if (decoded.rol !== "AGENT" && decoded.rol !== "ADMIN") {
    return next(new Error("Acceso denegado: rol no autorizado"));
  }

  socket.user = decoded;
  next();
}
