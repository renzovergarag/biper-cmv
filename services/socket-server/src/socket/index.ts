import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { authenticateSocket } from "./middleware.js";
import { registerSocketHandlers } from "./handlers.js";

export function setupSocketIO(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.use(authenticateSocket);
  registerSocketHandlers(io);

  return io;
}
