"use client";

import { useState, useEffect } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";

interface Props {
    initialEventos: EventoWithRelations[];
    userId: string;
    socketUrl: string;
}

export default function AgentDashboardClient({
    initialEventos,
    userId,
    socketUrl,
}: Props) {
    const [eventos, setEventos] =
        useState<EventoWithRelations[]>(initialEventos);
    const [pendientes, setPendientes] = useState<EventoWithRelations[]>([]);
    const { socket, connected } = useSocket(socketUrl);

    useEffect(() => {
        fetch("/api/events?estado=PENDIENTE")
            .then((res) => res.json())
            .then((data) => setPendientes(data.data || []))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleNuevo = ({ evento }: { evento: EventoWithRelations }) => {
            setPendientes((prev) => [evento, ...prev]);
        };

        const handleActualizado = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setEventos((prev) =>
                prev.map((e) => (e.id === evento.id ? evento : e))
            );
            setPendientes((prev) =>
                prev.filter((e) => e.id !== evento.id)
            );
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
        };
    }, [socket]);

    const handleAsignar = (eventoId: string) => {
        if (!socket) return;
        socket.emit("evento:asignar", { eventoId });
    };

    const handleCambiarEstado = (eventoId: string, nuevoEstado: string) => {
        if (!socket) return;
        socket.emit("evento:actualizar-estado", { eventoId, nuevoEstado });
    };

    return (
        <div className="mx-auto max-w-md px-4 py-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                    Panel de Agente
                </h2>
                <div className="flex items-center gap-2">
                    <div
                        className={`h-3 w-3 rounded-full ${
                            connected
                                ? "bg-green-500 animate-pulse"
                                : "bg-red-500"
                        }`}
                    />
                    <span className="text-sm text-gray-600">
                        {connected ? "Conectado" : "Desconectado"}
                    </span>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    Disponibles
                </h3>
                {pendientes.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-500 text-sm">
                            No hay eventos disponibles.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendientes.map((evento) => (
                            <div
                                key={evento.id}
                                className="bg-white rounded-lg shadow p-4"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                        {evento.titulo}
                                    </h4>
                                    <span
                                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                            evento.nivelUrgencia === "CRITICA"
                                                ? "bg-red-100 text-red-800"
                                                : evento.nivelUrgencia ===
                                                  "ALTA"
                                                ? "bg-orange-100 text-orange-800"
                                                : evento.nivelUrgencia ===
                                                  "MEDIA"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : "bg-green-100 text-green-800"
                                        }`}
                                    >
                                        {evento.nivelUrgencia}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                    {evento.direccionExacta}
                                </p>
                                <button
                                    onClick={() => handleAsignar(evento.id)}
                                    className="w-full mt-2 bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700"
                                >
                                    Tomar caso
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    Mis Eventos
                </h3>
                {eventos.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-500 text-sm">
                            No tienes eventos asignados.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {eventos.map((evento) => (
                            <div
                                key={evento.id}
                                className="bg-white rounded-lg shadow p-4"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                        {evento.titulo}
                                    </h4>
                                    <span
                                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                            evento.nivelUrgencia === "CRITICA"
                                                ? "bg-red-100 text-red-800"
                                                : evento.nivelUrgencia ===
                                                  "ALTA"
                                                ? "bg-orange-100 text-orange-800"
                                                : evento.nivelUrgencia ===
                                                  "MEDIA"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : "bg-green-100 text-green-800"
                                        }`}
                                    >
                                        {evento.nivelUrgencia}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                    {evento.direccionExacta}
                                </p>
                                <p className="text-xs text-gray-500 mb-3">
                                    Estado:{" "}
                                    <span className="font-medium">
                                        {evento.estado}
                                    </span>
                                </p>

                                {evento.estado === "ASIGNADO" &&
                                    evento.asignadoId === userId && (
                                        <button
                                            onClick={() =>
                                                handleCambiarEstado(
                                                    evento.id,
                                                    "EN_RUTA"
                                                )
                                            }
                                            className="w-full bg-yellow-600 text-white text-sm py-2 rounded-md hover:bg-yellow-700"
                                        >
                                            Marcar En Ruta
                                        </button>
                                    )}

                                {evento.estado === "EN_RUTA" &&
                                    evento.asignadoId === userId && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() =>
                                                    handleCambiarEstado(
                                                        evento.id,
                                                        "RESUELTO"
                                                    )
                                                }
                                                className="bg-green-600 text-white text-sm py-2 rounded-md hover:bg-green-700"
                                            >
                                                Resolver
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleCambiarEstado(
                                                        evento.id,
                                                        "CANCELADO"
                                                    )
                                                }
                                                className="bg-red-600 text-white text-sm py-2 rounded-md hover:bg-red-700"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
