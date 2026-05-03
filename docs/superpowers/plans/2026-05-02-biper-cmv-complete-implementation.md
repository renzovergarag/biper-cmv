# BIPER-CMV Funcionalidades Pendientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir las APIs públicas, dashboards funcionales (admin y agente), conexión Socket.io client e integración tiempo-real para que la aplicación pase de ~20% a ~75% de funcionalidad operativa.

**Architecture:** Next.js App Router con Server Components para carga inicial de datos y Client Components para interactividad (modales, sockets, botones). El backend Socket.io recibe notificaciones REST desde Next.js para emitir eventos en tiempo real.

**Tech Stack:** Next.js 14, Prisma 5, MongoDB, Socket.io 4, Tailwind CSS 3.4, jose, Zod.

---

## File Structure (nuevos y modificados)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts          # (existente)
│   │   │   │   ├── logout/route.ts         # NUEVO
│   │   │   │   └── me/route.ts             # NUEVO
│   │   │   ├── events/
│   │   │   │   └── route.ts                # NUEVO (GET listar, POST crear)
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts            # NUEVO
│   │   │   └── users/
│   │   │       └── agents/
│   │   │           └── route.ts            # NUEVO
│   │   ├── dashboard/
│   │   │   ├── admin/
│   │   │   │   └── page.tsx                # REESCRIBIR (Server Component)
│   │   │   ├── agent/
│   │   │   │   └── page.tsx                # REESCRIBIR (Server Component)
│   │   │   └── layout.tsx                  # REESCRIBIR
│   │   └── layout.tsx                      # MODIFICAR (agregar AuthProvider)
│   ├── components/
│   │   ├── providers/
│   │   │   └── AuthProvider.tsx            # NUEVO
│   │   ├── Navigation.tsx                  # NUEVO
│   │   ├── EventList.tsx                   # NUEVO
│   │   ├── CreateEventModal.tsx            # NUEVO
│   │   ├── AdminDashboardClient.tsx        # NUEVO
│   │   └── AgentDashboardClient.tsx        # NUEVO
│   ├── hooks/
│   │   ├── useAuth.ts                      # NUEVO (exportado desde AuthProvider)
│   │   └── useSocket.ts                    # NUEVO
│   └── middleware.ts                       # MODIFICAR (protección por rol)
```

---

## Task 1: APIs Públicas (Eventos y Agentes)

**Files:**
- Create: `apps/web/src/app/api/events/route.ts`
- Create: `apps/web/src/app/api/events/[id]/route.ts`
- Create: `apps/web/src/app/api/users/agents/route.ts`
- Create: `apps/web/src/app/api/auth/me/route.ts`

- [ ] **Step 1: GET /api/events (listar con filtros)**

```typescript
// apps/web/src/app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoEvento } from "@prisma/client";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const estado = searchParams.get("estado") as EstadoEvento | null;
        const asignadoId = searchParams.get("asignadoId");
        const creadorId = searchParams.get("creadorId");

        const where: Record<string, unknown> = {};
        if (estado) where.estado = estado;
        if (asignadoId) where.asignadoId = asignadoId;
        if (creadorId) where.creadorId = creadorId;

        const eventos = await prisma.evento.findMany({
            where,
            include: {
                creador: { select: { id: true, nombre: true, email: true } },
                asignado: { select: { id: true, nombre: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ eventos });
    } catch (error) {
        console.error("GET /api/events error:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: POST /api/events (crear evento, solo admin)**

```typescript
// apps/web/src/app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, generateInternalToken } from "@/lib/auth";
import { z } from "zod";
import { NivelUrgencia } from "@prisma/client";

const createEventoSchema = z.object({
    titulo: z.string().min(1, "Título requerido"),
    origen: z.string().min(1, "Origen requerido"),
    nivelUrgencia: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
    direccionExacta: z.string().min(1, "Dirección requerida"),
    coordenadas: z
        .object({ lat: z.number(), lng: z.number() })
        .nullable()
        .optional(),
    telefonoContacto: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json(
                { error: "No autenticado" },
                { status: 401 }
            );
        }

        const decoded = await verifyToken(token);
        if (!decoded || decoded.rol !== "ADMIN") {
            return NextResponse.json(
                { error: "Acceso denegado" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const parsed = createEventoSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Datos inválidos", details: parsed.error.errors },
                { status: 400 }
            );
        }

        const evento = await prisma.evento.create({
            data: {
                ...parsed.data,
                creadorId: decoded.sub,
            },
            include: {
                creador: { select: { id: true, nombre: true, email: true } },
                asignado: { select: { id: true, nombre: true, email: true } },
            },
        });

        // Notificar a socket server para broadcast en tiempo real
        try {
            const internalToken = await generateInternalToken();
            const socketUrl =
                process.env.SOCKET_SERVER_INTERNAL_URL ||
                "http://localhost:4000";
            await fetch(`${socketUrl}/internal/events`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${internalToken}`,
                },
                body: JSON.stringify({ evento }),
            });
        } catch (socketErr) {
            console.error("Error notificando a socket server:", socketErr);
            // No fallar la creación del evento si el socket no responde
        }

        return NextResponse.json({ evento }, { status: 201 });
    } catch (error) {
        console.error("POST /api/events error:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 3: GET /api/events/[id] (detalle de evento)**

```typescript
// apps/web/src/app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const evento = await prisma.evento.findUnique({
            where: { id: params.id },
            include: {
                creador: { select: { id: true, nombre: true, email: true } },
                asignado: { select: { id: true, nombre: true, email: true } },
                estadosHistorial: { orderBy: { timestamp: "desc" } },
            },
        });

        if (!evento) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        return NextResponse.json({ evento });
    } catch (error) {
        console.error("GET /api/events/[id] error:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 4: GET /api/users/agents (listar agentes activos)**

```typescript
// apps/web/src/app/api/users/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json(
                { error: "No autenticado" },
                { status: 401 }
            );
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
            return NextResponse.json(
                { error: "Token inválido" },
                { status: 401 }
            );
        }

        const agentes = await prisma.user.findMany({
            where: { rol: "AGENT", activo: true },
            select: { id: true, nombre: true, email: true },
            orderBy: { nombre: "asc" },
        });

        return NextResponse.json({ agentes });
    } catch (error) {
        console.error("GET /api/users/agents error:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 5: GET /api/auth/me (sesión activa + token para socket)**

```typescript
// apps/web/src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ user: null, token: null });
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ user: null, token: null });
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: { id: true, nombre: true, email: true, rol: true },
        });

        if (!user) {
            return NextResponse.json({ user: null, token: null });
        }

        return NextResponse.json({ user, token });
    } catch (error) {
        console.error("GET /api/auth/me error:", error);
        return NextResponse.json({ user: null, token: null });
    }
}
```

---

## Task 2: Logout API

**Files:**
- Create: `apps/web/src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Crear endpoint de logout**

```typescript
// apps/web/src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    return response;
}
```

---

## Task 3: Instalar Socket.io Client en Web

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Instalar dependencia**

```bash
npm install socket.io-client -w apps/web
```

---

## Task 4: Extender Socket Server para Broadcast Admin

**Files:**
- Modify: `services/socket-server/src/routes/internal.ts`

- [ ] **Step 1: Verificar compatibilidad del endpoint existente**

El socket server ya tiene `POST /internal/events` que emite `evento:nuevo`. Verificar que acepta tokens `INTERNAL` (lo hace). No se requieren cambios en el socket server para esta fase.

---

## Task 5: Protección de Rutas por Rol en Middleware

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Agregar redirección por rol**

```typescript
// apps/web/src/middleware.ts
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

    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/dashboard/admin") && decoded.rol !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard/agent", request.url));
    }

    if (pathname.startsWith("/dashboard/agent") && decoded.rol !== "AGENT") {
        return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    }

    const response = NextResponse.next();
    response.headers.set("X-User-Id", decoded.sub);
    response.headers.set("X-User-Rol", decoded.rol);
    return response;
}

export const config = {
    matcher: ["/(dashboard)/:path*"],
};
```

---

## Task 6: AuthProvider y Hook useAuth

**Files:**
- Create: `apps/web/src/components/providers/AuthProvider.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Crear AuthProvider con contexto**

```typescript
// apps/web/src/components/providers/AuthProvider.tsx
"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";

interface AuthUser {
    id: string;
    email: string;
    nombre: string;
    rol: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    token: null,
    loading: true,
    logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((res) => res.json())
            .then((data) => {
                if (data.user) {
                    setUser(data.user);
                    setToken(data.token);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const logout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setToken(null);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
```

- [ ] **Step 2: Inyectar AuthProvider en layout raíz**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

export const metadata: Metadata = {
    title: "BIPER CMV - Gestión de Eventos",
    description: "Sistema de despacho y gestión de eventos territoriales",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body className="antialiased">
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
```

---

## Task 7: Hook useSocket

**Files:**
- Create: `apps/web/src/hooks/useSocket.ts`

- [ ] **Step 1: Crear hook de conexión Socket.io**

```typescript
// apps/web/src/hooks/useSocket.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/providers/AuthProvider";

export function useSocket(socketUrl: string) {
    const { token, user } = useAuth();
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!token || !user) return;

        const socket = io(socketUrl, {
            auth: { token },
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
            setConnected(true);
        });

        socket.on("disconnect", () => {
            setConnected(false);
        });

        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [token, user, socketUrl]);

    return { socket: socketRef.current, connected };
}
```

---

## Task 8: Layout de Dashboard con Navegación

**Files:**
- Create: `apps/web/src/components/Navigation.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`

- [ ] **Step 1: Crear componente Navigation**

```typescript
// apps/web/src/components/Navigation.tsx
"use client";

import { useAuth } from "@/components/providers/AuthProvider";

export function Navigation() {
    const { user, logout, loading } = useAuth();

    if (loading) return null;

    return (
        <nav className="bg-white shadow">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                    BIPER CMV
                </h1>
                {user && (
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                            {user.nombre}{" "}
                            <span className="text-xs uppercase bg-gray-200 px-2 py-1 rounded ml-1">
                                {user.rol}
                            </span>
                        </span>
                        <button
                            onClick={logout}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                            Cerrar sesión
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
```

- [ ] **Step 2: Reescribir layout de dashboard**

```typescript
// apps/web/src/app/dashboard/layout.tsx
import { Navigation } from "@/components/Navigation";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-100">
            <Navigation />
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
```

---

## Task 9: Dashboard Administrador

**Files:**
- Create: `apps/web/src/components/EventList.tsx`
- Create: `apps/web/src/components/CreateEventModal.tsx`
- Create: `apps/web/src/components/AdminDashboardClient.tsx`
- Modify: `apps/web/src/app/dashboard/admin/page.tsx`

- [ ] **Step 1: Crear componente EventList**

```typescript
// apps/web/src/components/EventList.tsx
"use client";

import { Evento, User } from "@prisma/client";

type EventoWithRelations = Evento & {
    creador: Pick<User, "id" | "nombre" | "email"> | null;
    asignado: Pick<User, "id" | "nombre" | "email"> | null;
};

interface EventListProps {
    eventos: EventoWithRelations[];
}

export function EventList({ eventos }: EventListProps) {
    if (eventos.length === 0) {
        return (
            <p className="text-gray-500">
                No hay eventos registrados.
            </p>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Título
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Origen
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Urgencia
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Asignado a
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {eventos.map((evento) => (
                        <tr key={evento.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {evento.titulo}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {evento.origen}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span
                                    className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                                        evento.nivelUrgencia === "CRITICA"
                                            ? "bg-red-100 text-red-800"
                                            : evento.nivelUrgencia === "ALTA"
                                            ? "bg-orange-100 text-orange-800"
                                            : evento.nivelUrgencia === "MEDIA"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-green-100 text-green-800"
                                    }`}
                                >
                                    {evento.nivelUrgencia}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {evento.estado}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {evento.asignado
                                    ? evento.asignado.nombre
                                    : "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(
                                    evento.createdAt
                                ).toLocaleDateString("es-CL")}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 2: Crear componente CreateEventModal**

```typescript
// apps/web/src/components/CreateEventModal.tsx
"use client";

import { useState } from "react";
import { NivelUrgencia } from "@prisma/client";

interface CreateEventModalProps {
    onEventCreated: (evento: any) => void;
}

export function CreateEventModal({
    onEventCreated,
}: CreateEventModalProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        titulo: "",
        origen: "",
        nivelUrgencia: "MEDIA" as NivelUrgencia,
        direccionExacta: "",
        telefonoContacto: "",
        lat: "",
        lng: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const body: Record<string, unknown> = {
            titulo: form.titulo,
            origen: form.origen,
            nivelUrgencia: form.nivelUrgencia,
            direccionExacta: form.direccionExacta,
            telefonoContacto: form.telefonoContacto || null,
        };

        if (form.lat && form.lng) {
            body.coordenadas = {
                lat: parseFloat(form.lat),
                lng: parseFloat(form.lng),
            };
        }

        try {
            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error("Error al crear evento");

            const data = await res.json();
            onEventCreated(data.evento);
            setOpen(false);
            setForm({
                titulo: "",
                origen: "",
                nivelUrgencia: "MEDIA",
                direccionExacta: "",
                telefonoContacto: "",
                lat: "",
                lng: "",
            });
        } catch {
            alert("Error al crear el evento");
        } finally {
            setLoading(false);
        }
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
            >
                + Crear Evento
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Nuevo Evento
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Título
                        </label>
                        <input
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={form.titulo}
                            onChange={(e) =>
                                setForm({ ...form, titulo: e.target.value })
                            }
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Origen
                        </label>
                        <input
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={form.origen}
                            onChange={(e) =>
                                setForm({ ...form, origen: e.target.value })
                            }
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Nivel de Urgencia
                        </label>
                        <select
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={form.nivelUrgencia}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    nivelUrgencia: e.target
                                        .value as NivelUrgencia,
                                })
                            }
                        >
                            <option value="BAJA">Baja</option>
                            <option value="MEDIA">Media</option>
                            <option value="ALTA">Alta</option>
                            <option value="CRITICA">Crítica</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Dirección Exacta
                        </label>
                        <input
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={form.direccionExacta}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    direccionExacta: e.target.value,
                                })
                            }
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Teléfono de Contacto
                        </label>
                        <input
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={form.telefonoContacto}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    telefonoContacto: e.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Latitud
                            </label>
                            <input
                                type="number"
                                step="any"
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={form.lat}
                                onChange={(e) =>
                                    setForm({ ...form, lat: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Longitud
                            </label>
                            <input
                                type="number"
                                step="any"
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={form.lng}
                                onChange={(e) =>
                                    setForm({ ...form, lng: e.target.value })
                                }
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? "Creando..." : "Crear Evento"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Crear AdminDashboardClient**

```typescript
// apps/web/src/components/AdminDashboardClient.tsx
"use client";

import { useState } from "react";
import { Evento, User } from "@prisma/client";
import { EventList } from "./EventList";
import { CreateEventModal } from "./CreateEventModal";
import { useSocket } from "@/hooks/useSocket";

type EventoWithRelations = Evento & {
    creador: Pick<User, "id" | "nombre" | "email"> | null;
    asignado: Pick<User, "id" | "nombre" | "email"> | null;
};

interface Props {
    initialEventos: EventoWithRelations[];
    socketUrl: string;
}

export default function AdminDashboardClient({
    initialEventos,
    socketUrl,
}: Props) {
    const [eventos, setEventos] = useState<EventoWithRelations[]>(
        initialEventos
    );
    const { connected } = useSocket(socketUrl);

    const handleEventCreated = (evento: EventoWithRelations) => {
        setEventos((prev) => [evento, ...prev]);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        Panel de Administración
                    </h2>
                    {connected && (
                        <span className="text-xs text-green-600 font-medium">
                            ● Tiempo real conectado
                        </span>
                    )}
                </div>
                <CreateEventModal onEventCreated={handleEventCreated} />
            </div>
            <EventList eventos={eventos} />
        </div>
    );
}
```

- [ ] **Step 4: Reescribir página Admin (Server Component)**

```typescript
// apps/web/src/app/dashboard/admin/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminDashboardClient from "@/components/AdminDashboardClient";

export default async function AdminDashboardPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== "ADMIN") redirect("/dashboard");

    const eventos = await prisma.evento.findMany({
        include: {
            creador: { select: { id: true, nombre: true, email: true } },
            asignado: { select: { id: true, nombre: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return (
        <AdminDashboardClient
            initialEventos={eventos}
            socketUrl={
                process.env.SOCKET_SERVER_URL || "http://localhost:4000"
            }
        />
    );
}
```

---

## Task 10: Dashboard Agente

**Files:**
- Create: `apps/web/src/components/AgentDashboardClient.tsx`
- Modify: `apps/web/src/app/dashboard/agent/page.tsx`

- [ ] **Step 1: Crear AgentDashboardClient**

```typescript
// apps/web/src/components/AgentDashboardClient.tsx
"use client";

import { useState, useEffect } from "react";
import { Evento } from "@prisma/client";
import { useSocket } from "@/hooks/useSocket";

type EventoWithCreador = Evento & {
    creador: { nombre: string; email: string } | null;
};

interface Props {
    initialEventos: EventoWithCreador[];
    userId: string;
    socketUrl: string;
}

export default function AgentDashboardClient({
    initialEventos,
    userId,
    socketUrl,
}: Props) {
    const [eventos, setEventos] = useState<EventoWithCreador[]>(initialEventos);
    const [pendientes, setPendientes] = useState<EventoWithCreador[]>([]);
    const { socket, connected } = useSocket(socketUrl);

    useEffect(() => {
        fetch("/api/events?estado=PENDIENTE")
            .then((res) => res.json())
            .then((data) => setPendientes(data.eventos || []))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on(
            "evento:nuevo",
            ({ evento }: { evento: EventoWithCreador }) => {
                setPendientes((prev) => [evento, ...prev]);
            }
        );

        socket.on(
            "evento:actualizado",
            ({ evento }: { evento: EventoWithCreador }) => {
                setEventos((prev) =>
                    prev.map((e) => (e.id === evento.id ? evento : e))
                );
                setPendientes((prev) =>
                    prev.filter((e) => e.id !== evento.id)
                );
            }
        );

        return () => {
            socket.off("evento:nuevo");
            socket.off("evento:actualizado");
        };
    }, [socket]);

    const handleAsignar = (eventoId: string) => {
        if (!socket) return;
        socket.emit("evento:asignar", { eventoId });
    };

    const handleCambiarEstado = (eventoId: string, nuevoEstado: string) => {
        if (!socket) return;
        socket.emit("evento:actualizar-estado", { eventoId, nuevoEstado });
    };

    return (
        <div className="mx-auto max-w-md px-4 py-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                    Panel de Agente
                </h2>
                <div className="flex items-center gap-2">
                    <div
                        className={`h-3 w-3 rounded-full ${
                            connected
                                ? "bg-green-500 animate-pulse"
                                : "bg-red-500"
                        }`}
                    />
                    <span className="text-sm text-gray-600">
                        {connected ? "Conectado" : "Desconectado"}
                    </span>
                </div>
            </div>

            {/* Eventos Disponibles */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    Disponibles
                </h3>
                {pendientes.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-500 text-sm">
                            No hay eventos disponibles.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendientes.map((evento) => (
                            <div
                                key={evento.id}
                                className="bg-white rounded-lg shadow p-4"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                        {evento.titulo}
                                    </h4>
                                    <span
                                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                            evento.nivelUrgencia === "CRITICA"
                                                ? "bg-red-100 text-red-800"
                                                : evento.nivelUrgencia ===
                                                  "ALTA"
                                                ? "bg-orange-100 text-orange-800"
                                                : evento.nivelUrgencia ===
                                                  "MEDIA"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : "bg-green-100 text-green-800"
                                        }`}
                                    >
                                        {evento.nivelUrgencia}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                    {evento.direccionExacta}
                                </p>
                                <button
                                    onClick={() =>
                                        handleAsignar(evento.id)
                                    }
                                    className="w-full mt-2 bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700"
                                >
                                    Tomar caso
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Mis Eventos */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    Mis Eventos
                </h3>
                {eventos.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-500 text-sm">
                            No tienes eventos asignados.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {eventos.map((evento) => (
                            <div
                                key={evento.id}
                                className="bg-white rounded-lg shadow p-4"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                        {evento.titulo}
                                    </h4>
                                    <span
                                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                            evento.nivelUrgencia === "CRITICA"
                                                ? "bg-red-100 text-red-800"
                                                : evento.nivelUrgencia ===
                                                  "ALTA"
                                                ? "bg-orange-100 text-orange-800"
                                                : evento.nivelUrgencia ===
                                                  "MEDIA"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : "bg-green-100 text-green-800"
                                        }`}
                                    >
                                        {evento.nivelUrgencia}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                    {evento.direccionExacta}
                                </p>
                                <p className="text-xs text-gray-500 mb-3">
                                    Estado:{" "}
                                    <span className="font-medium">
                                        {evento.estado}
                                    </span>
                                </p>

                                {evento.estado === "ASIGNADO" &&
                                    evento.asignadoId === userId && (
                                        <button
                                            onClick={() =>
                                                handleCambiarEstado(
                                                    evento.id,
                                                    "EN_RUTA"
                                                )
                                            }
                                            className="w-full bg-yellow-600 text-white text-sm py-2 rounded-md hover:bg-yellow-700"
                                        >
                                            Marcar En Ruta
                                        </button>
                                    )}

                                {evento.estado === "EN_RUTA" &&
                                    evento.asignadoId === userId && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() =>
                                                    handleCambiarEstado(
                                                        evento.id,
                                                        "RESUELTO"
                                                    )
                                                }
                                                className="bg-green-600 text-white text-sm py-2 rounded-md hover:bg-green-700"
                                            >
                                                Resolver
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleCambiarEstado(
                                                        evento.id,
                                                        "CANCELADO"
                                                    )
                                                }
                                                className="bg-red-600 text-white text-sm py-2 rounded-md hover:bg-red-700"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Reescribir página Agente (Server Component)**

```typescript
// apps/web/src/app/dashboard/agent/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AgentDashboardClient from "@/components/AgentDashboardClient";

export default async function AgentDashboardPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== "AGENT") redirect("/dashboard");

    const eventos = await prisma.evento.findMany({
        where: { asignadoId: decoded.sub },
        include: {
            creador: { select: { id: true, nombre: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return (
        <AgentDashboardClient
            initialEventos={eventos}
            userId={decoded.sub}
            socketUrl={
                process.env.SOCKET_SERVER_URL || "http://localhost:4000"
            }
        />
    );
}
```

---

## Task 11: Verificación Final

- [ ] **Step 1: Instalar dependencias y generar Prisma Client**

```bash
npm install && npm run db:generate
```

- [ ] **Step 2: Build de la aplicación web**

```bash
npm run build:web
```

**Esperado:** Build exitoso sin errores de TypeScript.

- [ ] **Step 3: Verificar flujo end-to-end**

Levantar ambos servicios:

```bash
# Terminal 1
npm run dev:web

# Terminal 2
npm run dev:socket
```

Verificar:
1. Login como admin → redirect a `/dashboard/admin`
2. En `/dashboard/admin` se ve la tabla de eventos y el botón "Crear Evento"
3. Crear un evento → aparece en la tabla y el socket server recibe la notificación
4. Login como agente → redirect a `/dashboard/agent`
5. En `/dashboard/agent` se ven eventos disponibles y "Mis Eventos"
6. El agente puede pulsar "Tomar caso" en un evento disponible
7. El evento desaparece de disponibles y aparece en "Mis Eventos" con estado ASIGNADO
8. El agente puede cambiar el estado a EN_RUTA, RESUELTO o CANCELADO
9. Logout funciona y redirige a `/login`

---

## Self-Review

**1. Spec coverage:**
- [x] API `GET/POST /api/events` — Task 1 Steps 1-2
- [x] API `GET /api/users/agents` — Task 1 Step 4
- [x] API `GET /api/auth/me` — Task 1 Step 5
- [x] Logout — Task 2
- [x] Socket.io client en web — Task 3 + Task 7
- [x] Notificación socket al crear evento — Task 1 Step 2
- [x] Protección de rutas por rol — Task 5
- [x] AuthProvider / useAuth — Task 6
- [x] Navigation / Dashboard layout — Task 8
- [x] Dashboard Admin (lista + crear evento) — Task 9
- [x] Dashboard Agente (socket, mis eventos, cambiar estado) — Task 10

**2. Placeholder scan:** Ningún TBD, TODO o sección incompleta encontrada.

**3. Type consistency:** Todos los tipos usan `@prisma/client`. El hook `useSocket` recibe `socketUrl` como prop desde Server Components (evita necesitar `NEXT_PUBLIC_` env var). Las relaciones de eventos usan `Pick<User, ...>` consistentemente.

---

## Notas de Implementación

- **No se modifica el schema de Prisma** en este plan; usa el existente.
- **No se modifica el socket server** salvo que sea necesario; el endpoint `/internal/events` ya existe y acepta tokens `INTERNAL`.
- **La asignación manual por admin** queda fuera de este plan (P2 según informe). El admin crea eventos; los agentes los toman vía Socket.io.
- **Las coordenadas** son opcionales en el formulario de creación.
- **El agente fetchea eventos pendientes** desde el client component para mantener el server component simple.
