import { NextRequest, NextResponse } from "next/server";
import { EstadoAsignacion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { recalcularEstadoEvento } from "@/lib/asignaciones";
import { notifyEventoActualizado } from "@/lib/socket-notify";

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string; agenteId: string } }
) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const { id: eventoId, agenteId } = params;

        const asignacion = await prisma.asignacionEvento.findUnique({
            where: { eventoId_agenteId: { eventoId, agenteId } },
        });

        if (!asignacion) {
            return NextResponse.json(
                { error: "El agente no está asignado a este evento" },
                { status: 404 }
            );
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.asignacionEvento.update({
                where: { eventoId_agenteId: { eventoId, agenteId } },
                data: { estado: EstadoAsignacion.ABANDONADO },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "UNASSIGNED",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: auth.user.sub,
                    detalle: { eventoId, agenteId, porAdmin: true },
                },
            });

            await recalcularEstadoEvento(tx, eventoId, auth.user.sub);

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignado: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        await notifyEventoActualizado(eventoActualizado);

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error al quitar agente:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
