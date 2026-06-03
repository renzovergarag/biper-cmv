"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { EstadoEvento, NivelUrgencia } from "@prisma/client";
import { toast } from "sonner";
import { EventoWithHistorial } from "@/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
    urgenciaBadgeVariant,
    urgenciaLabel,
    estadoBadgeVariant,
    estadoLabel,
    estadoAsignacionLabel,
    estadoAsignacionBadgeVariant,
} from "@/lib/theme";
import EventTimeline from "./EventTimeline";
import { AddressLink } from "./AddressLink";

const EventMapPreview = dynamic(
    () => import("./EventMapPreview").then((m) => m.EventMapPreview),
    { ssr: false }
);

interface AgenteOption {
    id: string;
    nombre: string;
}

interface EventDetailModalProps {
    eventoId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    refreshVersion: number;
    isAdmin?: boolean;
}

const ESTADOS_UNIBLES: string[] = ["PENDIENTE", "ASIGNADO", "EN_RUTA", "EN_EL_LUGAR"];

export default function EventDetailModal({
    eventoId,
    open,
    onOpenChange,
    refreshVersion,
    isAdmin = false,
}: EventDetailModalProps) {
    const [evento, setEvento] = useState<EventoWithHistorial | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localVersion, setLocalVersion] = useState(0);
    const [agentes, setAgentes] = useState<AgenteOption[]>([]);
    const [agenteSel, setAgenteSel] = useState<string>("");
    const [accionLoading, setAccionLoading] = useState(false);

    useEffect(() => {
        if (!open || !eventoId) return;

        const controller = new AbortController();

        setLoading(true);
        setEvento(null);
        setError(null);

        fetch(`/api/events/${eventoId}`, { signal: controller.signal })
            .then((res) => {
                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error("Evento no encontrado");
                    }
                    throw new Error("Error al cargar el evento");
                }
                return res.json();
            })
            .then((data) => {
                setEvento(data.evento);
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                setError(err.message || "Error al cargar el evento");
            })
            .finally(() => {
                setLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [eventoId, open, refreshVersion, localVersion]);

    useEffect(() => {
        if (!open || !isAdmin) return;
        fetch("/api/users/agents")
            .then((res) => res.json())
            .then((data) => setAgentes(data.data || []))
            .catch(console.error);
    }, [open, isAdmin]);

    function handleOpenChange(newOpen: boolean) {
        if (!newOpen) {
            setEvento(null);
            setError(null);
            setAgenteSel("");
        }
        onOpenChange(newOpen);
    }

    const refetch = useCallback(() => setLocalVersion((v) => v + 1), []);

    const agregarAgente = async () => {
        if (!eventoId || !agenteSel) return;
        setAccionLoading(true);
        try {
            const res = await fetch(`/api/events/${eventoId}/asignaciones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agenteId: agenteSel }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Agente agregado");
            setAgenteSel("");
            refetch();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al agregar");
        } finally {
            setAccionLoading(false);
        }
    };

    const quitarAgente = async (agenteId: string) => {
        if (!eventoId) return;
        setAccionLoading(true);
        try {
            const res = await fetch(
                `/api/events/${eventoId}/asignaciones/${agenteId}`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Agente quitado");
            refetch();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al quitar");
        } finally {
            setAccionLoading(false);
        }
    };

    const cancelarEvento = async () => {
        if (!eventoId) return;
        setAccionLoading(true);
        try {
            const res = await fetch(`/api/events/${eventoId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: EstadoEvento.CANCELADO }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Evento cancelado");
            refetch();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al cancelar");
        } finally {
            setAccionLoading(false);
        }
    };

    const asignacionesActivas =
        evento?.asignaciones.filter((a) => a.estado !== "ABANDONADO") ?? [];
    const idsActivos = new Set(asignacionesActivas.map((a) => a.agenteId));
    const agentesDisponibles = agentes.filter((a) => !idsActivos.has(a.id));
    const puedeUnir = evento ? ESTADOS_UNIBLES.includes(evento.estado) : false;
    const puedeCancelar =
        evento &&
        evento.estado !== EstadoEvento.RESUELTO &&
        evento.estado !== EstadoEvento.CANCELADO;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="sr-only">
                        Detalle de evento
                    </DialogTitle>
                </DialogHeader>

                {loading && (
                    <p className="text-muted-foreground text-sm text-center py-8">
                        Cargando...
                    </p>
                )}

                {error && (
                    <p className="text-destructive text-sm text-center py-8">
                        {error}
                    </p>
                )}

                {evento && (
                    <>
                        {/* Encabezado */}
                        <div className="mb-5 pb-4 border-b">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-foreground">
                                    {evento.titulo}
                                </h3>
                                <div className="flex gap-2">
                                    <Badge
                                        variant={
                                            estadoBadgeVariant[
                                                evento.estado as EstadoEvento
                                            ]
                                        }
                                    >
                                        {estadoLabel[evento.estado as EstadoEvento]}
                                    </Badge>
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
                            </div>
                            <div className="flex gap-5 text-sm text-muted-foreground">
                                <AddressLink
                                    direccion={evento.direccionExacta}
                                    coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                />
                                {evento.telefonoContacto && (
                                    <span>{evento.telefonoContacto}</span>
                                )}
                            </div>
                        </div>

                        {/* Map preview (solo si hay coordenadas) */}
                        <EventMapPreview
                            coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                            className="mb-5"
                        />

                        {/* Agentes asignados */}
                        <div className="mb-5">
                            <h4 className="text-sm font-semibold text-foreground mb-2">
                                Agentes asignados
                            </h4>
                            {asignacionesActivas.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Sin agentes asignados.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {asignacionesActivas.map((a) => (
                                        <li
                                            key={a.id}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <span className="text-sm text-foreground">
                                                {a.agente.nombre}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={
                                                        estadoAsignacionBadgeVariant[
                                                            a.estado
                                                        ]
                                                    }
                                                >
                                                    {estadoAsignacionLabel[a.estado]}
                                                </Badge>
                                                {isAdmin && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            quitarAgente(a.agenteId)
                                                        }
                                                        disabled={accionLoading}
                                                        aria-label="Quitar agente"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {isAdmin && puedeUnir && (
                                <div className="flex gap-2 mt-3">
                                    <Select
                                        value={agenteSel}
                                        onValueChange={setAgenteSel}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Agregar agente..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agentesDisponibles.map((a) => (
                                                <SelectItem
                                                    key={a.id}
                                                    value={a.id}
                                                >
                                                    {a.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={agregarAgente}
                                        disabled={!agenteSel || accionLoading}
                                    >
                                        Agregar
                                    </Button>
                                </div>
                            )}

                            {isAdmin && puedeCancelar && (
                                <Button
                                    variant="destructive"
                                    className="w-full mt-3"
                                    onClick={cancelarEvento}
                                    disabled={accionLoading}
                                >
                                    Cancelar evento
                                </Button>
                            )}
                        </div>

                        {/* Timeline */}
                        <EventTimeline
                            historial={evento.estadosHistorial || []}
                            creacion={
                                evento.creador
                                    ? {
                                          creador: {
                                              nombre: evento.creador.nombre,
                                              rol: evento.creador.rol,
                                          },
                                          createdAt: evento.createdAt,
                                      }
                                    : undefined
                            }
                        />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
