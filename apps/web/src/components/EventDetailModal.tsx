"use client";

import { useState, useEffect } from "react";
import { EstadoEvento, NivelUrgencia } from "@prisma/client";
import { EventoWithHistorial } from "@/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    urgenciaBadgeVariant,
    urgenciaLabel,
    estadoBadgeVariant,
    estadoLabel,
} from "@/lib/theme";
import EventTimeline from "./EventTimeline";

interface EventDetailModalProps {
    eventoId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    refreshVersion: number;
}

export default function EventDetailModal({
    eventoId,
    open,
    onOpenChange,
    refreshVersion,
}: EventDetailModalProps) {
    const [evento, setEvento] = useState<EventoWithHistorial | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
    }, [eventoId, open, refreshVersion]);

    function handleOpenChange(newOpen: boolean) {
        if (!newOpen) {
            setEvento(null);
            setError(null);
        }
        onOpenChange(newOpen);
    }

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
                                        {
                                            estadoLabel[
                                                evento.estado as EstadoEvento
                                            ]
                                        }
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
                                <span>
                                    {evento.direccionExacta}
                                </span>
                                {evento.telefonoContacto && (
                                    <span>{evento.telefonoContacto}</span>
                                )}
                            </div>
                        </div>

                        {/* Timeline */}
                        <EventTimeline
                            historial={evento.estadosHistorial || []}
                        />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
