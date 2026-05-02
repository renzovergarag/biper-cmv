import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalToken } from "@/lib/auth";
import { ESTADO_EVENTO } from "@/lib/constants";

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

    const result = await prisma.evento.updateMany({
      where: {
        id: eventoId,
        estado: ESTADO_EVENTO.PENDIENTE,
      },
      data: {
        estado: ESTADO_EVENTO.ASIGNADO,
        asignadoId: agenteId,
        assignedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({
        success: false,
        mensaje: "Evento ya asignado o no existe",
      });
    }

    const [evento] = await prisma.$transaction([
      prisma.evento.findUnique({
        where: { id: eventoId },
        include: { creador: true, asignado: true },
      }),
      prisma.logAuditoria.create({
        data: {
          accion: "ASSIGNED",
          entidad: "Evento",
          entidadId: eventoId,
          usuarioId: agenteId,
          detalle: { eventoId, agenteId },
        },
      }),
      prisma.estadoHistorial.create({
        data: {
          eventoId,
          estado: ESTADO_EVENTO.ASIGNADO,
          usuarioId: agenteId,
        },
      }),
    ]);

    return NextResponse.json({ success: true, evento });
  } catch (error) {
    console.error("Error en asignación:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
