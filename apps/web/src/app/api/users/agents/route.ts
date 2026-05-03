import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { Rol } from "@prisma/client";

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

        const agents = await prisma.user.findMany({
            where: {
                rol: Rol.AGENT,
                activo: true,
            },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                activo: true,
            },
            orderBy: { nombre: "asc" },
        });

        return NextResponse.json({ data: agents });
    } catch (error) {
        console.error("Error listando agentes:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
