import { generateInternalToken } from "@/lib/auth";

/**
 * Notifica al socket-server que un evento cambió, para que difunda
 * "evento:actualizado" a todos los clientes conectados.
 * Falla en silencio (log) para no romper la respuesta HTTP al cliente.
 */
export async function notifyEventoActualizado(evento: unknown): Promise<void> {
    try {
        const socketUrl =
            process.env.SOCKET_SERVER_INTERNAL_URL || "http://localhost:4000";
        const token = await generateInternalToken();
        await fetch(`${socketUrl}/internal/evento-actualizado`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ evento }),
        });
    } catch (error) {
        console.error("Error notificando al socket server:", error);
    }
}
