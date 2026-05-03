import { NextRequest, NextResponse } from "next/server";
import { verifyInternalToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        return NextResponse.json(
            { error: "Token requerido" },
            { status: 401 }
        );
    }

    const decoded = await verifyInternalToken(token);
    if (!decoded) {
        return NextResponse.json(
            { error: "Token inválido" },
            { status: 401 }
        );
    }

    const { usuarioId, accion, ip, userAgent } = await request.json();

    if (!usuarioId || !accion || !["LOGIN", "LOGOUT"].includes(accion)) {
        return NextResponse.json(
            { error: "usuarioId y accion (LOGIN|LOGOUT) son requeridos" },
            { status: 400 }
        );
    }

    await prisma.logAuditoria.create({
        data: {
            accion,
            entidad: "Sesion",
            entidadId: usuarioId,
            usuarioId,
            detalle: { ip: ip || "unknown", userAgent: userAgent || "unknown" },
        },
    });

    return NextResponse.json({ success: true }, { status: 201 });
}
