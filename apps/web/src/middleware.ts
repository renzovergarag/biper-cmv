import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { Rol } from "@prisma/client";

export async function middleware(request: NextRequest) {
    const token = request.cookies.get("token")?.value;

    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const decoded = await verifyToken(token);

    if (!decoded) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith("/dashboard/admin") && decoded.rol !== Rol.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard/agent", request.url));
    }

    if (pathname.startsWith("/dashboard/agent") && decoded.rol !== Rol.AGENT) {
        return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    }

    if (pathname.startsWith("/api/admin") && decoded.rol !== Rol.ADMIN) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const response = NextResponse.next();
    response.headers.set("X-User-Id", decoded.sub);
    response.headers.set("X-User-Rol", decoded.rol);

    return response;
}

export const config = {
    matcher: ["/(dashboard)/:path*", "/(api/admin)/:path*"],
};
