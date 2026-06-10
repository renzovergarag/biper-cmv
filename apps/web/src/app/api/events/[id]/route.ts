import { NextRequest, NextResponse } from "next/server";
import { EstadoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { requireAdmin, requireSuperAdmin } from "@/lib/api-auth";
import {
    notifyEventoActualizado,
    notifyEventoEliminado,
} from "@/lib/socket-notify";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const token = request.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: "Token inválido" }, { status: 401 });
        }

        const { id } = params;

        const evento = await prisma.evento.findUnique({
            where: { id },
            include: {
                creador: true,
                asignaciones: { include: { agente: true } },
                estadosHistorial: {
                    include: { usuario: true },
                    orderBy: { timestamp: "asc" },
                },
            },
        });

        if (!evento || evento.eliminadoAt) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        return NextResponse.json({ evento });
    } catch (error) {
        console.error("Error obteniendo evento:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const eventoId = params.id;
        const { estado } = await request.json();

        if (estado !== EstadoEvento.CANCELADO) {
            return NextResponse.json(
                { error: "Solo se permite cancelar el evento" },
                { status: 400 }
            );
        }

        const actual = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { estado: true },
        });

        if (!actual) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        if (
            actual.estado === EstadoEvento.RESUELTO ||
            actual.estado === EstadoEvento.CANCELADO
        ) {
            return NextResponse.json(
                { error: "El evento ya está finalizado" },
                { status: 400 }
            );
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.evento.update({
                where: { id: eventoId },
                data: { estado: EstadoEvento.CANCELADO },
            });

            await tx.estadoHistorial.create({
                data: {
                    eventoId,
                    estado: EstadoEvento.CANCELADO,
                    usuarioId: auth.user.sub,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "STATUS_CHANGED",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: auth.user.sub,
                    detalle: {
                        estadoAnterior: actual.estado,
                        nuevoEstado: EstadoEvento.CANCELADO,
                        porAdmin: true,
                    },
                },
            });

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        await notifyEventoActualizado(eventoActualizado);

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error al cancelar evento:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const eventoId = params.id;

        const actual = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { estado: true, titulo: true, eliminadoAt: true },
        });

        if (!actual) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        if (actual.eliminadoAt) {
            return NextResponse.json(
                { error: "El evento ya fue eliminado" },
                { status: 409 }
            );
        }

        await prisma.$transaction(async (tx) => {
            await tx.evento.update({
                where: { id: eventoId },
                data: {
                    eliminadoAt: new Date(),
                    eliminadoPorId: auth.user.sub,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "EVENTO_ELIMINADO",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: auth.user.sub,
                    eventoId,
                    detalle: {
                        titulo: actual.titulo,
                        estadoAlEliminar: actual.estado,
                    },
                },
            });
        });

        await notifyEventoEliminado(eventoId);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error al eliminar evento:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
