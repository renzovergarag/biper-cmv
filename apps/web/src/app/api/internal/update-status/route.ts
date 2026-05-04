import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoEvento } from "@prisma/client";
import { verifyInternalToken } from "@/lib/auth";
import { ESTADO_EVENTO } from "@/lib/constants";

const ESTADOS_VALIDOS = [
  ESTADO_EVENTO.EN_RUTA,
  ESTADO_EVENTO.RESUELTO,
  ESTADO_EVENTO.CANCELADO,
];

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

    const { eventoId, nuevoEstado } = await request.json();

    if (!eventoId || !nuevoEstado) {
      return NextResponse.json(
        { error: "eventoId y nuevoEstado requeridos" },
        { status: 400 }
      );
    }

    if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
      return NextResponse.json(
        { error: "Estado no válido" },
        { status: 400 }
      );
    }

    const evento = await prisma.evento.findUnique({
      where: { id: eventoId },
    });

    if (!evento) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      );
    }

    if (evento.estado === ESTADO_EVENTO.RESUELTO || evento.estado === ESTADO_EVENTO.CANCELADO) {
      return NextResponse.json(
        { error: "Evento ya finalizado" },
        { status: 400 }
      );
    }

    const updateData: { estado: EstadoEvento; resolvedAt?: Date } = { estado: nuevoEstado as EstadoEvento };

    if (nuevoEstado === ESTADO_EVENTO.RESUELTO) {
      updateData.resolvedAt = new Date();
    }

    const [, , , updatedEvento] = await prisma.$transaction([
      prisma.evento.updateMany({
        where: { id: eventoId },
        data: updateData,
      }),
      prisma.logAuditoria.create({
        data: {
          accion: "STATUS_CHANGED",
          entidad: "Evento",
          entidadId: eventoId,
          usuarioId: evento.asignadoId || evento.creadorId,
          detalle: { estadoAnterior: evento.estado, nuevoEstado },
        },
      }),
      prisma.estadoHistorial.create({
        data: {
          eventoId,
          estado: nuevoEstado,
          usuarioId: evento.asignadoId || evento.creadorId,
        },
      }),
      prisma.evento.findUnique({
        where: { id: eventoId },
        include: { creador: true, asignado: true },
      }),
    ]);

    return NextResponse.json({ success: true, evento: updatedEvento });
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
