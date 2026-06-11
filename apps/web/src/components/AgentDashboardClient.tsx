"use client";

import { useState, useEffect } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { NivelUrgencia, EstadoAsignacion } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { urgenciaBadgeVariant, urgenciaLabel } from "@/lib/theme";
import EventNotification from "@/components/EventNotification";
import PushNotificationsBanner from "@/components/PushNotificationsBanner";
import { AddressLink } from "./AddressLink";

interface Props {
    initialEventos: EventoWithRelations[];
    userId: string;
    socketUrl: string;
}

const ESTADOS_UNIBLES = ["PENDIENTE", "ASIGNADO", "EN_RUTA", "EN_EL_LUGAR"];

function formatCreatedAt(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
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

    const tieneAsignacionActiva = (e: EventoWithRelations) =>
        e.asignaciones.some(
            (a) => a.agenteId === userId && a.estado !== "ABANDONADO"
        );

    const miEstado = (e: EventoWithRelations): EstadoAsignacion | undefined =>
        e.asignaciones.find((a) => a.agenteId === userId)?.estado;

    const otrosActivos = (e: EventoWithRelations) =>
        e.asignaciones.filter(
            (a) => a.agenteId !== userId && a.estado !== "ABANDONADO"
        ).length;

    useEffect(() => {
        // "Disponibles": eventos unibles donde el agente no participa.
        Promise.all([
            fetch("/api/events?estado=PENDIENTE").then((r) => r.json()),
            fetch("/api/events?estado=ASIGNADO").then((r) => r.json()),
            fetch("/api/events?estado=EN_RUTA").then((r) => r.json()),
            fetch("/api/events?estado=EN_EL_LUGAR").then((r) => r.json()),
        ])
            .then(([p, a, e, l]) => {
                const todos: EventoWithRelations[] = [
                    ...(p.data || []),
                    ...(a.data || []),
                    ...(e.data || []),
                    ...(l.data || []),
                ];
                setPendientes(todos.filter((ev) => !tieneAsignacionActiva(ev)));
            })
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
            setEventos((prev) => {
                if (tieneAsignacionActiva(evento)) {
                    return prev.some((e) => e.id === evento.id)
                        ? prev.map((e) => (e.id === evento.id ? evento : e))
                        : [evento, ...prev];
                }
                return prev.filter((e) => e.id !== evento.id);
            });

            setPendientes((prev) => {
                const mostrar =
                    ESTADOS_UNIBLES.includes(evento.estado) &&
                    !tieneAsignacionActiva(evento);
                if (mostrar) {
                    return prev.some((e) => e.id === evento.id)
                        ? prev.map((e) => (e.id === evento.id ? evento : e))
                        : [evento, ...prev];
                }
                return prev.filter((e) => e.id !== evento.id);
            });
        };

        const handleEliminado = ({ id }: { id: string }) => {
            setEventos((prev) => prev.filter((e) => e.id !== id));
            setPendientes((prev) => prev.filter((e) => e.id !== id));
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);
        socket.on("evento:eliminado", handleEliminado);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
            socket.off("evento:eliminado", handleEliminado);
        };
    }, [socket, userId]);

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
            <PushNotificationsBanner />
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-foreground">
                    Panel de Agente
                </h2>
                <div className="flex items-center gap-2">
                    <div
                        className={`h-3 w-3 rounded-full ${
                            connected
                                ? "bg-green-500 animate-pulse"
                                : "bg-destructive"
                        }`}
                    />
                    <span className="text-sm text-muted-foreground">
                        {connected ? "Conectado" : "Desconectado"}
                    </span>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                    Disponibles
                </h3>
                {pendientes.length === 0 ? (
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground text-sm">
                                No hay eventos disponibles.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {pendientes.map((evento) => (
                            <Card key={evento.id}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-foreground text-sm">
                                            {evento.titulo}
                                        </h4>
                                        <Badge
                                            variant={
                                                urgenciaBadgeVariant[
                                                    evento.nivelUrgencia as NivelUrgencia
                                                ]
                                            }
                                        >
                                            {urgenciaLabel[
                                                evento.nivelUrgencia as NivelUrgencia
                                            ] || evento.nivelUrgencia}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-1">
                                        <AddressLink
                                            direccion={evento.direccionExacta}
                                            coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                        />
                                    </p>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Por {evento.creador.nombre} · {formatCreatedAt(evento.createdAt)}
                                        {otrosActivos(evento) > 0 &&
                                            ` · ${otrosActivos(evento)} agente(s) en camino`}
                                    </p>
                                    <Button
                                        onClick={() => handleAsignar(evento.id)}
                                        className="w-full h-11 sm:h-9 text-sm"
                                    >
                                        Tomar caso
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                    Mis Eventos
                </h3>
                {eventos.length === 0 ? (
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground text-sm">
                                No tienes eventos asignados.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {eventos.map((evento) => {
                            const estadoAgente = miEstado(evento);
                            return (
                                <Card key={evento.id}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-semibold text-foreground text-sm">
                                                {evento.titulo}
                                            </h4>
                                            <Badge
                                                variant={
                                                    urgenciaBadgeVariant[
                                                        evento.nivelUrgencia as NivelUrgencia
                                                    ]
                                                }
                                            >
                                                {urgenciaLabel[
                                                    evento.nivelUrgencia as NivelUrgencia
                                                ] || evento.nivelUrgencia}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-1">
                                            <AddressLink
                                                direccion={evento.direccionExacta}
                                                coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                            />
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Por {evento.creador.nombre} · {formatCreatedAt(evento.createdAt)}
                                            {otrosActivos(evento) > 0 &&
                                                ` · Tú + ${otrosActivos(evento)} agente(s)`}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Mi estado:{" "}
                                            <span className="font-medium text-foreground">
                                                {estadoAgente}
                                            </span>
                                        </p>

                                        {estadoAgente ===
                                            EstadoAsignacion.ASIGNADO && (
                                            <Button
                                                onClick={() =>
                                                    handleCambiarEstado(
                                                        evento.id,
                                                        EstadoAsignacion.EN_RUTA
                                                    )
                                                }
                                                variant="default"
                                                className="w-full h-11 sm:h-9 text-sm bg-yellow-600 hover:bg-yellow-700"
                                            >
                                                Marcar En Ruta
                                            </Button>
                                        )}

                                        {estadoAgente ===
                                            EstadoAsignacion.EN_RUTA && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoAsignacion.EN_EL_LUGAR
                                                        )
                                                    }
                                                    className="w-full h-11 sm:h-9 text-sm bg-green-600 hover:bg-green-700"
                                                >
                                                    Llegué al lugar
                                                </Button>
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoAsignacion.ABANDONADO
                                                        )
                                                    }
                                                    variant="destructive"
                                                    className="w-full h-11 sm:h-9 text-sm"
                                                >
                                                    Abandonar
                                                </Button>
                                            </div>
                                        )}

                                        {estadoAgente ===
                                            EstadoAsignacion.EN_EL_LUGAR && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoAsignacion.RESUELTO
                                                        )
                                                    }
                                                    className="w-full h-11 sm:h-9 text-sm bg-green-600 hover:bg-green-700"
                                                >
                                                    Resolver
                                                </Button>
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoAsignacion.ABANDONADO
                                                        )
                                                    }
                                                    variant="destructive"
                                                    className="w-full h-11 sm:h-9 text-sm"
                                                >
                                                    Abandonar
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
            <EventNotification socket={socket} />
        </div>
    );
}
