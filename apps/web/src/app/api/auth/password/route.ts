import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const schema = z.object({
    currentPassword: z.string().min(1, "Contraseña actual requerida"),
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function PATCH(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "Datos inválidos",
                    details: parsed.error.errors,
                },
                { status: 400 }
            );
        }

        const { currentPassword, newPassword } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { id: auth.user.sub },
        });
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no encontrado" },
                { status: 404 }
            );
        }

        const valid = await verifyPassword(currentPassword, user.password);
        if (!valid) {
            return NextResponse.json(
                { error: "Contraseña actual incorrecta" },
                { status: 401 }
            );
        }

        const hashed = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[auth/password] error:", err);
        return NextResponse.json(
            { error: "Error al cambiar contraseña" },
            { status: 500 }
        );
    }
}
