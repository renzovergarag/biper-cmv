import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalToken } from "@/lib/auth";
import { EstadoAsignacion, EstadoEvento } from "@prisma/client";
import { recalcularEstadoEvento } from "@/lib/asignaciones";

const ESTADOS_UNIBLES: EstadoEvento[] = [
    EstadoEvento.PENDIENTE,
    EstadoEvento.ASIGNADO,
    EstadoEvento.EN_RUTA,
    EstadoEvento.EN_EL_LUGAR,
];

export async function POST(request: NextRequest) {
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

        const { eventoId, agenteId } = await request.json();

        if (!eventoId || !agenteId) {
            return NextResponse.json(
                { error: "eventoId y agenteId requeridos" },
                { status: 400 }
            );
        }

        const evento = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { estado: true },
        });

        if (!evento) {
            return NextResponse.json({
                success: false,
                mensaje: "El evento no existe",
            });
        }

        if (!ESTADOS_UNIBLES.includes(evento.estado)) {
            return NextResponse.json({
                success: false,
                mensaje: "El evento ya no admite agentes",
            });
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.asignacionEvento.upsert({
                where: { eventoId_agenteId: { eventoId, agenteId } },
                create: {
                    eventoId,
                    agenteId,
                    estado: EstadoAsignacion.ASIGNADO,
                    resolvedAt: null,
                },
                update: {
                    estado: EstadoAsignacion.ASIGNADO,
                    resolvedAt: null,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "ASSIGNED",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: agenteId,
                    detalle: { eventoId, agenteId },
                },
            });

            await recalcularEstadoEvento(tx, eventoId, agenteId);

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error en asignación:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
