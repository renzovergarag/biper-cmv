"use client";

import { EstadoEvento } from "@prisma/client";
import { estadoLabel } from "@/lib/theme";

interface EstadoHistorialEntry {
    id: string;
    estado: EstadoEvento;
    timestamp: string | Date;
    notas: string | null;
    usuario: {
        id: string;
        nombre: string;
        email: string;
        rol: string;
    };
}

interface EventTimelineProps {
    historial: EstadoHistorialEntry[];
}

const estadoDotColor: Record<EstadoEvento, string> = {
    [EstadoEvento.PENDIENTE]: "bg-gray-400",
    [EstadoEvento.ASIGNADO]: "bg-gray-500",
    [EstadoEvento.EN_RUTA]: "bg-amber-500",
    [EstadoEvento.RESUELTO]: "bg-blue-500",
    [EstadoEvento.CANCELADO]: "bg-red-500",
};

const estadoCardBg: Record<EstadoEvento, string> = {
    [EstadoEvento.PENDIENTE]: "bg-gray-50 border-gray-200",
    [EstadoEvento.ASIGNADO]: "bg-gray-100 border-gray-300",
    [EstadoEvento.EN_RUTA]: "bg-amber-50 border-amber-200",
    [EstadoEvento.RESUELTO]: "bg-blue-50 border-blue-200",
    [EstadoEvento.CANCELADO]: "bg-red-50 border-red-200",
};

function formatDateTime(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function EventTimeline({ historial }: EventTimelineProps) {
    if (historial.length === 0) {
        return (
            <p className="text-muted-foreground text-sm text-center py-6">
                Sin historial de estados.
            </p>
        );
    }

    return (
        <div className="border-l-[3px] border-primary pl-4">
            {historial.map((entry) => (
                <div
                    key={entry.id}
                    className={`relative border rounded-lg p-3 mb-3 ${
                        estadoCardBg[entry.estado]
                    }`}
                >
                    <div
                        className={`absolute w-3 h-3 rounded-full border-2 border-background -left-[22px] top-4 ${
                            estadoDotColor[entry.estado]
                        }`}
                    />
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">
                            {estadoLabel[entry.estado]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {formatDateTime(entry.timestamp)}
                        </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Por: {entry.usuario.nombre} ({entry.usuario.rol.toLowerCase()})
                    </div>
                    {entry.notas ? (
                        <div className="mt-2 text-xs text-foreground bg-background/60 rounded px-2 py-1.5">
                            {entry.notas}
                        </div>
                    ) : (
                        <div className="mt-1 text-xs text-muted-foreground/50">
                            —
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
