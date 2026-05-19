import { NextRequest, NextResponse } from "next/server";
import { EstadoAsignacion, EstadoEvento, Rol } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { recalcularEstadoEvento } from "@/lib/asignaciones";
import { notifyEventoActualizado } from "@/lib/socket-notify";

const ESTADOS_UNIBLES: EstadoEvento[] = [
    EstadoEvento.PENDIENTE,
    EstadoEvento.ASIGNADO,
    EstadoEvento.EN_RUTA,
];

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const eventoId = params.id;
        const { agenteId } = await request.json();

        if (!agenteId) {
            return NextResponse.json(
                { error: "agenteId requerido" },
                { status: 400 }
            );
        }

        const [evento, agente] = await Promise.all([
            prisma.evento.findUnique({
                where: { id: eventoId },
                select: { estado: true },
            }),
            prisma.user.findUnique({
                where: { id: agenteId },
                select: { rol: true, activo: true },
            }),
        ]);

        if (!evento) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        if (!agente || agente.rol !== Rol.AGENT || !agente.activo) {
            return NextResponse.json(
                { error: "Agente no válido" },
                { status: 400 }
            );
        }

        if (!ESTADOS_UNIBLES.includes(evento.estado)) {
            return NextResponse.json(
                { error: "El evento ya no admite agentes" },
                { status: 400 }
            );
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
        console.error("Error al agregar agente:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
