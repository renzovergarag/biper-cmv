import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.errors },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    if (!user.activo) {
      return NextResponse.json(
        { error: "Cuenta desactivada" },
        { status: 403 }
      );
    }

    const validPassword = await verifyPassword(password, user.password);

    if (!validPassword) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const token = await generateToken({
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
