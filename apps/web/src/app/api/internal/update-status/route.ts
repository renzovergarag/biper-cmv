import { NextRequest, NextResponse } from "next/server";
import { EstadoAsignacion, EstadoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyInternalToken } from "@/lib/auth";
import { recalcularEstadoEvento } from "@/lib/asignaciones";

const ESTADOS_VALIDOS: EstadoAsignacion[] = [
    EstadoAsignacion.EN_RUTA,
    EstadoAsignacion.RESUELTO,
    EstadoAsignacion.ABANDONADO,
];

// Transiciones permitidas por agente: estadoActual -> estados destino válidos
const TRANSICIONES: Record<EstadoAsignacion, EstadoAsignacion[]> = {
    [EstadoAsignacion.ASIGNADO]: [
        EstadoAsignacion.EN_RUTA,
        EstadoAsignacion.ABANDONADO,
    ],
    [EstadoAsignacion.EN_RUTA]: [
        EstadoAsignacion.RESUELTO,
        EstadoAsignacion.ABANDONADO,
    ],
    [EstadoAsignacion.RESUELTO]: [],
    [EstadoAsignacion.ABANDONADO]: [],
};

export async function PATCH(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return NextResponse.json({ error: "Token requerido" }, { status: 401 });
        }

        const decoded = verifyInternalToken(token);
        if (!decoded) {
            return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
        }

        const { eventoId, agenteId, nuevoEstado } = await request.json();

        if (!eventoId || !agenteId || !nuevoEstado) {
            return NextResponse.json(
                { error: "eventoId, agenteId y nuevoEstado requeridos" },
                { status: 400 }
            );
        }

        if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
            return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
        }

        const evento = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { estado: true },
        });

        if (!evento) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        if (evento.estado === EstadoEvento.CANCELADO) {
            return NextResponse.json(
                { error: "El evento fue cancelado" },
                { status: 400 }
            );
        }

        const asignacion = await prisma.asignacionEvento.findUnique({
            where: { eventoId_agenteId: { eventoId, agenteId } },
        });

        if (!asignacion) {
            return NextResponse.json(
                { error: "No estás asignado a este evento" },
                { status: 400 }
            );
        }

        if (!TRANSICIONES[asignacion.estado].includes(nuevoEstado)) {
            return NextResponse.json(
                { error: "Transición no permitida" },
                { status: 400 }
            );
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.asignacionEvento.update({
                where: { eventoId_agenteId: { eventoId, agenteId } },
                data: {
                    estado: nuevoEstado as EstadoAsignacion,
                    resolvedAt:
                        nuevoEstado === EstadoAsignacion.RESUELTO
                            ? new Date()
                            : asignacion.resolvedAt,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "STATUS_CHANGED",
                    entidad: "AsignacionEvento",
                    entidadId: asignacion.id,
                    usuarioId: agenteId,
                    eventoId,
                    detalle: {
                        estadoAnterior: asignacion.estado,
                        nuevoEstado,
                    },
                },
            });

            await recalcularEstadoEvento(tx, eventoId, agenteId);

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignado: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error al actualizar estado:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
