import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { Rol } from "@prisma/client";
import { z } from "zod";

const unsubSchema = z.object({
    endpoint: z.string().url(),
});

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    if (auth.user.rol !== Rol.AGENT) {
        return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = unsubSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Acota el borrado al dueño para evitar que un agente elimine la
    // suscripción de otro conociendo su endpoint (IDOR).
    await prisma.suscripcionPush.deleteMany({
        where: { endpoint: parsed.data.endpoint, userId: auth.user.sub },
    });

    return NextResponse.json({ success: true });
}
