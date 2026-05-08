"use client";

import { useState, useEffect } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { NivelUrgencia, EstadoEvento } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { urgenciaBadgeVariant, urgenciaLabel } from "@/lib/theme";
import EventNotification from "@/components/EventNotification";
import { AddressLink } from "./AddressLink";

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
            setEventos((prev) => {
                const existe = prev.some((e) => e.id === evento.id);
                if (existe) {
                    return prev.map((e) => (e.id === evento.id ? evento : e));
                }
                if (evento.asignadoId === userId) {
                    return [evento, ...prev];
                }
                return prev;
            });
            setPendientes((prev) => prev.filter((e) => e.id !== evento.id));
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
                                    <p className="text-sm text-muted-foreground mb-3">
                                        <AddressLink
                                            direccion={evento.direccionExacta}
                                            coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                        />
                                    </p>
                                    <Button
                                        onClick={() =>
                                            handleAsignar(evento.id)
                                        }
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
                        {eventos.map((evento) => (
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
                                        Estado:{" "}
                                        <span className="font-medium text-foreground">
                                            {evento.estado}
                                        </span>
                                    </p>

                                    {evento.estado ===
                                        EstadoEvento.ASIGNADO &&
                                        evento.asignadoId === userId && (
                                            <Button
                                                onClick={() =>
                                                    handleCambiarEstado(
                                                        evento.id,
                                                        EstadoEvento.EN_RUTA
                                                    )
                                                }
                                                variant="default"
                                                className="w-full h-11 sm:h-9 text-sm bg-yellow-600 hover:bg-yellow-700"
                                            >
                                                Marcar En Ruta
                                            </Button>
                                        )}

                                    {evento.estado ===
                                        EstadoEvento.EN_RUTA &&
                                        evento.asignadoId === userId && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoEvento.RESUELTO
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
                                                            EstadoEvento.CANCELADO
                                                        )
                                                    }
                                                    variant="destructive"
                                                    className="w-full h-11 sm:h-9 text-sm"
                                                >
                                                    Cancelar
                                                </Button>
                                            </div>
                                        )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            <EventNotification socket={socket} />
        </div>
    );
}
