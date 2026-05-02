import { Server, Socket } from "socket.io";
import { asignarEventoAtomico, actualizarEstadoEvento } from "../lib/api-client";

const ESTADOS_VALIDOS = ["EN_RUTA", "RESUELTO", "CANCELADO"] as const;

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    const user = socket.user;
    console.log(`Agente conectado: ${user.email} (${user.sub})`);

    socket.join(`agent:${user.sub}`);

    socket.on("evento:asignar", async ({ eventoId }) => {
      if (!eventoId || typeof eventoId !== "string") {
        socket.emit("evento:asignado-error", {
          mensaje: "eventoId es requerido",
        });
        return;
      }

      try {
        const result = await asignarEventoAtomico(eventoId, user.sub);

        if (result.success) {
          socket.emit("evento:asignado-exito", { evento: result.evento });
          io.emit("evento:actualizado", { evento: result.evento });
        } else {
          socket.emit("evento:asignado-error", {
            mensaje: "El evento ya fue asignado a otro agente",
          });
        }
      } catch (error) {
        console.error("Error en asignación:", error);
        socket.emit("evento:asignado-error", {
          mensaje: "Error al asignar el evento",
        });
      }
    });

    socket.on("evento:actualizar-estado", async ({ eventoId, nuevoEstado }) => {
      if (!eventoId || typeof eventoId !== "string") {
        socket.emit("error", { mensaje: "eventoId es requerido" });
        return;
      }

      if (!nuevoEstado || !ESTADOS_VALIDOS.includes(nuevoEstado as any)) {
        socket.emit("error", { mensaje: "Estado no válido" });
        return;
      }

      try {
        const result = await actualizarEstadoEvento(
          eventoId,
          nuevoEstado,
          user.sub
        );

        if (result.success) {
          io.emit("evento:actualizado", { evento: result.evento });
        }
      } catch (error) {
        console.error("Error al actualizar estado:", error);
        socket.emit("error", { mensaje: "Error al actualizar estado" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Agente desconectado: ${user.email}`);
    });
  });
}
