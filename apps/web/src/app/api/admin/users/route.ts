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

export async function GET(request: NextRequest) {
    const admin = await verifyAdmin(request);
    if (!admin) {
        return NextResponse.json(
            { error: "No autorizado" },
            { status: 401 }
        );
    }

    const { searchParams } = new URL(request.url);
    const rol = searchParams.get("rol") as Rol | null;
    const activo = searchParams.get("activo");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (rol && Object.values(Rol).includes(rol)) {
        where.rol = rol;
    }

    if (activo === "true") where.activo = true;
    else if (activo === "false") where.activo = false;

    if (search) {
        where.OR = [
            { nombre: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
        ];
    }

    const usuarios = await prisma.user.findMany({
        where,
        select: {
            id: true,
            email: true,
            nombre: true,
            rol: true,
            activo: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
        data: usuarios.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
            updatedAt: u.updatedAt.toISOString(),
        })),
    });
}

export async function POST(request: NextRequest) {
    const admin = await verifyAdmin(request);
    if (!admin) {
        return NextResponse.json(
            { error: "No autorizado" },
            { status: 401 }
        );
    }

    const body = await request.json();
    const { email, nombre, password, rol } = body;

    if (!email || !nombre || !password || !rol) {
        return NextResponse.json(
            { error: "email, nombre, password y rol son requeridos" },
            { status: 400 }
        );
    }

    if (password.length < 6) {
        return NextResponse.json(
            { error: "La contraseña debe tener al menos 6 caracteres" },
            { status: 400 }
        );
    }

    if (!Object.values(Rol).includes(rol)) {
        return NextResponse.json(
            { error: "Rol inválido. Use ADMIN o AGENT" },
            { status: 400 }
        );
    }

    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) {
        return NextResponse.json(
            { error: "El email ya está registrado" },
            { status: 409 }
        );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const usuario = await prisma.user.create({
        data: { email, nombre, password: hashedPassword, rol },
        select: {
            id: true,
            email: true,
            nombre: true,
            rol: true,
            activo: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return NextResponse.json(
        {
            usuario: {
                ...usuario,
                createdAt: usuario.createdAt.toISOString(),
                updatedAt: usuario.updatedAt.toISOString(),
            },
        },
        { status: 201 }
    );
}
