import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    try {
        const eventos = await prisma.evento.findMany({
            where: {
                asignaciones: {
                    some: {
                        agenteId: auth.user.sub,
                        estado: "RESUELTO",
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
            include: {
                creador: true,
                asignaciones: { include: { agente: true } },
            },
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
