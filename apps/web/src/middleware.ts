import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const decoded = await verifyToken(token);

  if (!decoded) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("X-User-Id", decoded.sub);
  response.headers.set("X-User-Rol", decoded.rol);

  return response;
}

export const config = {
  matcher: ["/(dashboard)/:path*"],
};
