"use client";

import { EventoWithRelations } from "@/types";
import { NivelUrgencia } from "@prisma/client";
import { Siren } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    urgenciaBadgeVariant,
    urgenciaLabel,
    estadoLabel,
} from "@/lib/theme";
import { AddressLink } from "./AddressLink";

interface EventListProps {
    eventos: EventoWithRelations[];
    onEventClick?: (eventoId: string) => void;
    variant?: "default" | "compact";
}

function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function EventList({
    eventos,
    onEventClick,
    variant = "default",
}: EventListProps) {
    const isCompact = variant === "compact";

    if (eventos.length === 0) {
        return (
            <EmptyState
                icon={Siren}
                title="No hay eventos"
                description="Aún no se han registrado eventos en este listado"
            />
        );
    }

    return (
        <>
            {/* --- Desktop: tabla (≥1024px) --- */}
            <div className="hidden lg:block rounded-lg border bg-card text-card-foreground shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            {!isCompact && <TableHead>Origen</TableHead>}
                            <TableHead>Urgencia</TableHead>
                            <TableHead>Estado</TableHead>
                            {!isCompact && <TableHead>Asignado a</TableHead>}
                            <TableHead>Fecha</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {eventos.map((evento) => (
                            <TableRow
                                key={evento.id}
                                className={
                                    onEventClick
                                        ? "cursor-pointer hover:bg-muted/50"
                                        : ""
                                }
                                onClick={() => onEventClick?.(evento.id)}
                            >
                                <TableCell>
                                    <div className="font-medium">{evento.titulo}</div>
                                    {evento.direccionExacta && (
                                        <AddressLink
                                            direccion={evento.direccionExacta}
                                            coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                            className="text-xs text-muted-foreground"
                                        />
                                    )}
                                </TableCell>
                                {!isCompact && (
                                    <TableCell className="text-muted-foreground">
                                        {evento.origen}
                                    </TableCell>
                                )}
                                <TableCell>
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
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {estadoLabel[evento.estado]}
                                </TableCell>
                                {!isCompact && (
                                    <TableCell className="text-muted-foreground">
                                        {evento.asignado?.nombre || "—"}
                                    </TableCell>
                                )}
                                <TableCell className="text-muted-foreground">
                                    {formatDate(evento.createdAt)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* --- Mobile/Tablet: cards (<1024px) --- */}
            <div className="lg:hidden space-y-3">
                {eventos.map((evento) => (
                    <div
                        key={evento.id}
                        className={
                            "rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-2" +
                            (onEventClick
                                ? " cursor-pointer hover:bg-muted/50"
                                : "")
                        }
                        onClick={() => onEventClick?.(evento.id)}
                    >
                        <div className="flex justify-between items-start">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Título
                            </span>
                            <span className="text-sm font-medium text-right">
                                {evento.titulo}
                            </span>
                        </div>
                        {!isCompact && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                    Origen
                                </span>
                                <span className="text-sm">{evento.origen}</span>
                            </div>
                        )}
                        {evento.direccionExacta && (
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                    Dirección
                                </span>
                                <div className="text-sm text-right">
                                    <AddressLink
                                        direccion={evento.direccionExacta}
                                        coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Urgencia
                            </span>
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
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Estado
                            </span>
                            <span className="text-sm">
                                {estadoLabel[evento.estado]}
                            </span>
                        </div>
                        {!isCompact && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                    Asignado
                                </span>
                                <span className="text-sm">
                                    {evento.asignado?.nombre || "—"}
                                </span>
                            </div>
                        )}
                        {!isCompact && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                    Fecha
                                </span>
                                <span className="text-sm">
                                    {formatDate(evento.createdAt)}
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}
