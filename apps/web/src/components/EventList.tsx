"use client";

import { EventoWithRelations } from "@/types";
import { NivelUrgencia } from "@prisma/client";
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

interface EventListProps {
    eventos: EventoWithRelations[];
    onEventClick?: (eventoId: string) => void;
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

export default function EventList({ eventos, onEventClick }: EventListProps) {
    if (eventos.length === 0) {
        return (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center">
                <p className="text-muted-foreground">
                    No hay eventos registrados.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Urgencia</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Asignado a</TableHead>
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
                            <TableCell className="font-medium">
                                {evento.titulo}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {evento.origen}
                            </TableCell>
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
                            <TableCell className="text-muted-foreground">
                                {evento.asignado?.nombre || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDate(evento.createdAt)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
