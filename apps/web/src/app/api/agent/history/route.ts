import { NextRequest, NextResponse } from "next/server";
import { EstadoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    try {
        const eventos = await prisma.evento.findMany({
            where: {
                asignadoId: auth.user.sub,
                estado: {
                    in: [EstadoEvento.RESUELTO, EstadoEvento.CANCELADO],
                },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
            include: { creador: true, asignado: true },
        });

        return NextResponse.json({ eventos });
    } catch (err) {
        console.error("[agent/history] error:", err);
        return NextResponse.json(
            { error: "Error al cargar historial" },
            { status: 500 }
        );
    }
}
