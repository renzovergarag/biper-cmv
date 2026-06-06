import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { Rol } from "@prisma/client";
import { z } from "zod";

const subSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
    }),
});

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    if (auth.user.rol !== Rol.AGENT) {
        return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = subSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { endpoint, keys } = parsed.data;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    await prisma.suscripcionPush.upsert({
        where: { endpoint },
        create: {
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            userId: auth.user.sub,
            userAgent,
        },
        update: {
            p256dh: keys.p256dh,
            auth: keys.auth,
            userId: auth.user.sub,
            userAgent,
        },
    });

    return NextResponse.json({ success: true });
}
