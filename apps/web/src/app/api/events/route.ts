import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, generateInternalToken } from "@/lib/auth";
import { z } from "zod";
import { Prisma, NivelUrgencia, EstadoEvento, Rol } from "@prisma/client";

const createEventSchema = z.object({
    titulo: z.string().min(1, "Título requerido"),
    origen: z.string().min(1, "Origen requerido"),
    nivelUrgencia: z.nativeEnum(NivelUrgencia),
    direccionExacta: z.string().min(1, "Dirección requerida"),
    coordenadas: z.record(z.any()).optional().nullable(),
    telefonoContacto: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: "Token inválido" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const estado = searchParams.get("estado") as EstadoEvento | null;
        const nivelUrgencia = searchParams.get("nivelUrgencia") as NivelUrgencia | null;
        const asignadoId = searchParams.get("asignadoId");
        const creadorId = searchParams.get("creadorId");
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "10", 10);

        const where: Prisma.EventoWhereInput = {};
        if (estado) where.estado = estado;
        if (nivelUrgencia) where.nivelUrgencia = nivelUrgencia;
        if (asignadoId) where.asignadoId = asignadoId;
        if (creadorId) where.creadorId = creadorId;

        const skip = (page - 1) * limit;

        const [data, total] = await prisma.$transaction([
            prisma.evento.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: { creador: true, asignado: true },
            }),
            prisma.evento.count({ where }),
        ]);

        return NextResponse.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error listando eventos:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: "Token inválido" }, { status: 401 });
        }

        if (decoded.rol !== Rol.ADMIN) {
            return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
        }

        const body = await request.json();
        const result = createEventSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Datos inválidos", details: result.error.errors },
                { status: 400 }
            );
        }

        const {
            titulo,
            origen,
            nivelUrgencia,
            direccionExacta,
            coordenadas,
            telefonoContacto,
        } = result.data;

        const evento = await prisma.evento.create({
            data: {
                titulo,
                origen,
                nivelUrgencia,
                direccionExacta,
                coordenadas: coordenadas ?? undefined,
                telefonoContacto: telefonoContacto ?? undefined,
                creadorId: decoded.sub,
                estado: EstadoEvento.PENDIENTE,
            },
            include: { creador: true, asignado: true },
        });

        try {
            const socketUrl =
                process.env.SOCKET_SERVER_INTERNAL_URL || "http://localhost:4000";
            const internalToken = await generateInternalToken();
            await fetch(`${socketUrl}/internal/events`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${internalToken}`,
                },
                body: JSON.stringify({ evento }),
            });
        } catch (socketError) {
            console.error("Error notificando al socket server:", socketError);
        }

        return NextResponse.json({ success: true, evento }, { status: 201 });
    } catch (error) {
        console.error("Error creando evento:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
