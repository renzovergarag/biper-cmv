import { EstadoAsignacion, EstadoEvento, Prisma } from "@prisma/client";

/**
 * Deriva el estado de un evento a partir de sus asignaciones.
 * Las asignaciones ABANDONADO se ignoran (no cuentan para el consenso).
 * NO devuelve CANCELADO: ese estado es terminal y se setea explícitamente
 * por el admin, nunca se deriva.
 */
export function derivarEstadoEvento(
    asignaciones: { estado: EstadoAsignacion }[]
): EstadoEvento {
    const activas = asignaciones.filter(
        (a) => a.estado !== EstadoAsignacion.ABANDONADO
    );

    if (activas.length === 0) return EstadoEvento.PENDIENTE;

    if (activas.every((a) => a.estado === EstadoAsignacion.RESUELTO)) {
        return EstadoEvento.RESUELTO;
    }

    if (activas.some((a) => a.estado === EstadoAsignacion.EN_EL_LUGAR)) {
        return EstadoEvento.EN_EL_LUGAR;
    }

    if (
        activas.some(
            (a) =>
                a.estado === EstadoAsignacion.EN_RUTA ||
                a.estado === EstadoAsignacion.RESUELTO
        )
    ) {
        return EstadoEvento.EN_RUTA;
    }

    return EstadoEvento.ASIGNADO;
}

/**
 * Recalcula y persiste el estado del evento dentro de una transacción.
 * Lee las asignaciones, deriva el nuevo estado y, si cambió, actualiza el
 * Evento y registra EstadoHistorial + LogAuditoria.
 *
 * - No toca eventos CANCELADO (terminal).
 * - Al volver a PENDIENTE limpia assignedAt/resolvedAt.
 * - Al pasar a RESUELTO setea resolvedAt.
 * - Al asignarse por primera vez setea assignedAt.
 */
export async function recalcularEstadoEvento(
    tx: Prisma.TransactionClient,
    eventoId: string,
    usuarioId: string
): Promise<void> {
    const evento = await tx.evento.findUnique({
        where: { id: eventoId },
        select: { estado: true, assignedAt: true },
    });
    if (!evento) return;
    if (evento.estado === EstadoEvento.CANCELADO) return;

    const asignaciones = await tx.asignacionEvento.findMany({
        where: { eventoId },
        select: { estado: true },
    });

    const nuevoEstado = derivarEstadoEvento(asignaciones);
    if (nuevoEstado === evento.estado) return;

    const data: Prisma.EventoUpdateInput = { estado: nuevoEstado };

    if (nuevoEstado === EstadoEvento.PENDIENTE) {
        data.assignedAt = null;
        data.resolvedAt = null;
    } else if (
        evento.estado === EstadoEvento.PENDIENTE &&
        !evento.assignedAt
    ) {
        data.assignedAt = new Date();
    }

    if (nuevoEstado === EstadoEvento.RESUELTO) {
        data.resolvedAt = new Date();
    }

    await tx.evento.update({ where: { id: eventoId }, data });

    await tx.estadoHistorial.create({
        data: { eventoId, estado: nuevoEstado, usuarioId },
    });

    await tx.logAuditoria.create({
        data: {
            accion: "STATUS_CHANGED",
            entidad: "Evento",
            entidadId: eventoId,
            usuarioId,
            detalle: {
                estadoAnterior: evento.estado,
                nuevoEstado,
                derivado: true,
            },
        },
    });
}
