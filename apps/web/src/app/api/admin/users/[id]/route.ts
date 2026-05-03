import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Rol } from "@prisma/client";
import bcrypt from "bcrypt";

async function verifyAdmin(request: NextRequest) {
    const token = request.cookies.get("token")?.value;
    if (!token) return null;
    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.ADMIN) return null;
    return decoded;
}

const userSelect = {
    id: true,
    email: true,
    nombre: true,
    rol: true,
    activo: true,
    createdAt: true,
    updatedAt: true,
};

function serializeUser(u: Record<string, unknown>) {
    return {
        ...u,
        createdAt: (u.createdAt as Date).toISOString(),
        updatedAt: (u.updatedAt as Date).toISOString(),
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const admin = await verifyAdmin(request);
    if (!admin) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
        where: { id: params.id },
        select: userSelect,
    });

    if (!usuario) {
        return NextResponse.json(
            { error: "Usuario no encontrado" },
            { status: 404 }
        );
    }

    return NextResponse.json({ usuario: serializeUser(usuario) });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const admin = await verifyAdmin(request);
    if (!admin) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const usuarioActual = await prisma.user.findUnique({
        where: { id: params.id },
    });

    if (!usuarioActual) {
        return NextResponse.json(
            { error: "Usuario no encontrado" },
            { status: 404 }
        );
    }

    const updateData: Record<string, unknown> = {};

    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.email !== undefined) {
        if (body.email !== usuarioActual.email) {
            const existe = await prisma.user.findUnique({
                where: { email: body.email },
            });
            if (existe) {
                return NextResponse.json(
                    { error: "El email ya está registrado" },
                    { status: 409 }
                );
            }
        }
        updateData.email = body.email;
    }
    if (body.password !== undefined) {
        if (body.password.length < 6) {
            return NextResponse.json(
                { error: "La contraseña debe tener al menos 6 caracteres" },
                { status: 400 }
            );
        }
        updateData.password = await bcrypt.hash(body.password, 10);
    }
    if (body.rol !== undefined) {
        if (!Object.values(Rol).includes(body.rol)) {
            return NextResponse.json(
                { error: "Rol inválido. Use ADMIN o AGENT" },
                { status: 400 }
            );
        }

        if (body.rol !== usuarioActual.rol && usuarioActual.rol === Rol.ADMIN) {
            const adminsCount = await prisma.user.count({
                where: { rol: Rol.ADMIN, activo: true },
            });
            if (adminsCount <= 1) {
                return NextResponse.json(
                    {
                        error:
                            "No se puede cambiar el rol del último admin activo",
                    },
                    { status: 400 }
                );
            }
        }
        updateData.rol = body.rol;
    }
    if (body.activo !== undefined) updateData.activo = body.activo;

    const usuario = await prisma.user.update({
        where: { id: params.id },
        data: updateData,
        select: userSelect,
    });

    return NextResponse.json({ usuario: serializeUser(usuario) });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const admin = await verifyAdmin(request);
    if (!admin) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (params.id === admin.sub) {
        return NextResponse.json(
            { error: "No puedes desactivar tu propio usuario" },
            { status: 400 }
        );
    }

    const usuario = await prisma.user.findUnique({
        where: { id: params.id },
    });

    if (!usuario) {
        return NextResponse.json(
            { error: "Usuario no encontrado" },
            { status: 404 }
        );
    }

    if (usuario.rol === Rol.ADMIN) {
        const adminsCount = await prisma.user.count({
            where: { rol: Rol.ADMIN, activo: true },
        });
        if (adminsCount <= 1) {
            return NextResponse.json(
                { error: "No se puede desactivar al último admin activo" },
                { status: 400 }
            );
        }
    }

    const desactivado = await prisma.user.update({
        where: { id: params.id },
        data: { activo: false },
        select: userSelect,
    });

    return NextResponse.json({ usuario: serializeUser(desactivado) });
}
