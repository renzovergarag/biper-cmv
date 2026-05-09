import { Server, Socket } from "socket.io";
import { asignarEventoAtomico, actualizarEstadoEvento } from "../lib/api-client.js";
import {
    type AgenteConectado,
    setAgent,
    removeAgent,
    listAgents,
} from "./agents-state.js";

const ESTADOS_VALIDOS = ["EN_RUTA", "RESUELTO", "CANCELADO"] as const;

async function registrarSesion(
    usuarioId: string,
    accion: "LOGIN" | "LOGOUT",
    ip: string,
    userAgent: string
) {
    try {
        const { generateInternalToken } = await import("../lib/auth");
        const token = await generateInternalToken();
        const nextApiUrl =
            process.env.NEXT_API_URL || "http://localhost:3000";

        await fetch(`${nextApiUrl}/api/internal/session-log`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ usuarioId, accion, ip, userAgent }),
        });
    } catch (error) {
        console.error(
            `Error al registrar sesión (${accion}) para usuario ${usuarioId}:`,
            error instanceof Error ? error.message : error,
            `| URL: ${process.env.NEXT_API_URL || "http://localhost:3000"}/api/internal/session-log`
        );
    }
}

export function registerSocketHandlers(io: Server) {
    io.on("connection", (socket: Socket) => {
        const user = socket.user;

        if (user.rol === "ADMIN") {
            console.log(`Admin conectado: ${user.email} (${user.sub})`);

            socket.join("admin");

            socket.emit("agentes:lista", listAgents());

            socket.on("disconnect", () => {
                console.log(`Admin desconectado: ${user.email}`);
            });

            return;
        }

        // === AGENTE ===
        console.log(`Agente conectado: ${user.email} (${user.sub})`);

        socket.join(`agent:${user.sub}`);

        const agente: AgenteConectado = {
            userId: user.sub,
            email: user.email,
            nombre: user.nombre,
            socketId: socket.id,
            connectedAt: new Date().toISOString(),
        };

        setAgent(agente);

        io.to("admin").emit("agentes:conectado", agente);

        const clientIp =
            socket.handshake.headers["x-forwarded-for"] ||
            socket.handshake.address ||
            "unknown";
        const clientIpStr = Array.isArray(clientIp)
            ? clientIp[0]
            : clientIp;
        const userAgent =
            (socket.handshake.headers["user-agent"] as string) || "unknown";

        registrarSesion(
            user.sub,
            "LOGIN",
            clientIpStr,
            userAgent
        );

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

            removeAgent(user.sub);

            io.to("admin").emit("agentes:desconectado", {
                userId: user.sub,
            });

            const clientIp =
                socket.handshake.headers["x-forwarded-for"] ||
                socket.handshake.address ||
                "unknown";
            const clientIpStr = Array.isArray(clientIp)
                ? clientIp[0]
                : clientIp;
            const userAgent =
                (socket.handshake.headers["user-agent"] as string) || "unknown";

            registrarSesion(
                user.sub,
                "LOGOUT",
                clientIpStr,
                userAgent
            );
        });
    });
}
