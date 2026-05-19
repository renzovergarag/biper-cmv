import { NivelUrgencia, EstadoEvento, EstadoAsignacion } from "@prisma/client";

export const urgenciaBadgeVariant: Record<
    NivelUrgencia,
    "destructive" | "secondary" | "outline"
> = {
    [NivelUrgencia.CRITICA]: "destructive",
    [NivelUrgencia.ALTA]: "destructive",
    [NivelUrgencia.MEDIA]: "secondary",
    [NivelUrgencia.BAJA]: "outline",
};

export const urgenciaLabel: Record<NivelUrgencia, string> = {
    [NivelUrgencia.CRITICA]: "Crítica",
    [NivelUrgencia.ALTA]: "Alta",
    [NivelUrgencia.MEDIA]: "Media",
    [NivelUrgencia.BAJA]: "Baja",
};

export const estadoLabel: Record<EstadoEvento, string> = {
    [EstadoEvento.PENDIENTE]: "Pendiente",
    [EstadoEvento.ASIGNADO]: "Asignado",
    [EstadoEvento.EN_RUTA]: "En ruta",
    [EstadoEvento.RESUELTO]: "Resuelto",
    [EstadoEvento.CANCELADO]: "Cancelado",
};

export const estadoBadgeVariant: Record<
    EstadoEvento,
    "default" | "secondary" | "outline" | "destructive"
> = {
    [EstadoEvento.PENDIENTE]: "secondary",
    [EstadoEvento.ASIGNADO]: "default",
    [EstadoEvento.EN_RUTA]: "default",
    [EstadoEvento.RESUELTO]: "outline",
    [EstadoEvento.CANCELADO]: "destructive",
};

export const estadoAsignacionLabel: Record<EstadoAsignacion, string> = {
    [EstadoAsignacion.ASIGNADO]: "Asignado",
    [EstadoAsignacion.EN_RUTA]: "En ruta",
    [EstadoAsignacion.RESUELTO]: "Resuelto",
    [EstadoAsignacion.ABANDONADO]: "Abandonado",
};

export const estadoAsignacionBadgeVariant: Record<
    EstadoAsignacion,
    "default" | "secondary" | "outline" | "destructive"
> = {
    [EstadoAsignacion.ASIGNADO]: "secondary",
    [EstadoAsignacion.EN_RUTA]: "default",
    [EstadoAsignacion.RESUELTO]: "outline",
    [EstadoAsignacion.ABANDONADO]: "destructive",
};
