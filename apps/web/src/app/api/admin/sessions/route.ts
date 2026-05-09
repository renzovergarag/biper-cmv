import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdmin(request);
        if (!admin) {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const usuarioId = searchParams.get("usuarioId");
        const fechaDesde = searchParams.get("fechaDesde");
        const fechaHasta = searchParams.get("fechaHasta");
        const limit = Math.min(
            parseInt(searchParams.get("limit") || "50", 10),
            100
        );

        const where: Record<string, unknown> = {
            entidad: "Sesion",
        };

        if (usuarioId) {
            where.usuarioId = usuarioId;
        }

        if (fechaDesde || fechaHasta) {
            const timestamp: Record<string, Date> = {};
            if (fechaDesde) timestamp.gte = new Date(fechaDesde);
            if (fechaHasta) timestamp.lte = new Date(fechaHasta);
            where.timestamp = timestamp;
        }

        const logs = await prisma.logAuditoria.findMany({
            where,
            include: {
                usuario: {
                    select: { nombre: true, email: true },
                },
            },
            orderBy: { timestamp: "desc" },
            take: limit,
        });

        return NextResponse.json({
            data: logs.map((log) => ({
                id: log.id,
                accion: log.accion,
                usuarioId: log.usuarioId,
                usuario: log.usuario,
                detalle: log.detalle,
                timestamp: log.timestamp.toISOString(),
            })),
        });
    } catch (error) {
        console.error("Error en GET /api/admin/sessions:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
