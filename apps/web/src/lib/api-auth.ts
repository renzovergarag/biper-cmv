import { NextRequest, NextResponse } from "next/server";
import { Rol } from "@prisma/client";
import { verifyToken, type JWTPayload } from "@/lib/auth";

export interface AuthOk {
    ok: true;
    user: JWTPayload;
}

export interface AuthFail {
    ok: false;
    response: NextResponse;
}

export type AuthResult = AuthOk | AuthFail;

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
    const token = request.cookies.get("token")?.value;
    if (!token) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "No autorizado" },
                { status: 401 }
            ),
        };
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Token inválido" },
                { status: 401 }
            ),
        };
    }

    return { ok: true, user: decoded };
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
    const result = await requireAuth(request);
    if (!result.ok) return result;

    if (result.user.rol !== Rol.ADMIN) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Acceso denegado" },
                { status: 403 }
            ),
        };
    }

    return result;
}
