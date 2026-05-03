import { NextRequest } from "next/server";
import { verifyToken, JWTPayload } from "@/lib/auth";
import { Rol } from "@prisma/client";

export async function verifyAdmin(
    request: NextRequest
): Promise<JWTPayload | null> {
    const token = request.cookies.get("token")?.value;
    if (!token) return null;
    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.ADMIN) return null;
    return decoded;
}
