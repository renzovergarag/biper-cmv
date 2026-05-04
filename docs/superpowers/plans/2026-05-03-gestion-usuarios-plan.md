# Gestión de Usuarios, Agentes Conectados y Logs de Sesión — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar CRUD de usuarios con RBAC, panel lateral de agentes conectados en tiempo real vía socket, y logs de sesión para administradores.

**Architecture:** Enfoque Socket-driven + Prisma. APIs REST (`/api/admin/*`) protegen el CRUD. Socket server trackea agentes en memoria y emite eventos a sala `admin`. El frontend usa Server Components para carga inicial y Client Components para interactividad + tiempo real. Sin nuevas tablas en BD.

**Tech Stack:** Next.js 14 App Router, Prisma/MongoDB, Socket.io, jose (JWT), Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-05-03-gestion-usuarios-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/types/index.ts` | Modify | Tipos `AgenteConectado`, `LogSesion`, `UserListItem` |
| `apps/web/src/app/api/internal/session-log/route.ts` | Create | POST — registra LOGIN/LOGOUT (INTERNAL) |
| `apps/web/src/app/api/admin/users/route.ts` | Create | GET (listar) + POST (crear) usuarios |
| `apps/web/src/app/api/admin/users/[id]/route.ts` | Create | GET, PATCH, DELETE usuario individual |
| `apps/web/src/app/api/admin/sessions/route.ts` | Create | GET logs de sesión con filtros |
| `services/socket-server/src/socket/middleware.ts` | Modify | Aceptar rol ADMIN |
| `services/socket-server/src/socket/handlers.ts` | Modify | Trackear agentes + eventos admin + session-log |
| `apps/web/src/middleware.ts` | Modify | Extender matcher a `/api/admin/*` |
| `apps/web/src/components/ConnectedAgentsPanel.tsx` | Create | Panel lateral agentes conectados |
| `apps/web/src/components/UserFormModal.tsx` | Create | Modal crear/editar usuario |
| `apps/web/src/components/SessionLogsTab.tsx` | Create | Tabla logs de sesión con filtros |
| `apps/web/src/components/UsersPageClient.tsx` | Create | Tabla CRUD + pestañas + modal |
| `apps/web/src/app/dashboard/admin/users/page.tsx` | Create | Server component — carga socketUrl |
| `apps/web/src/components/DashboardContent.tsx` | Create | Wrapper client — renderiza children + panel |
| `apps/web/src/app/dashboard/layout.tsx` | Modify | Usar DashboardContent |
| `apps/web/src/components/Navigation.tsx` | Modify | Agregar enlace "Usuarios" para admin |

---

### Task 1: Tipos compartidos

**Files:**
- Modify: `apps/web/src/types/index.ts`

- [ ] **Step 1: Agregar tipos `AgenteConectado`, `LogSesion`, `UserListItem` a `apps/web/src/types/index.ts`**

```typescript
import { Prisma, Rol, NivelUrgencia, EstadoEvento } from "@prisma/client";

export type EventoWithRelations = Prisma.EventoGetPayload<{
    include: { creador: true; asignado: true };
}>;

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evento {
  id: string;
  titulo: string;
  origen: string;
  nivelUrgencia: NivelUrgencia;
  direccionExacta: string;
  coordenadas?: { lat: number; lng: number };
  telefonoContacto?: string;
  estado: EstadoEvento;
  creadorId: string;
  asignadoId?: string;
  createdAt: Date;
  updatedAt: Date;
  assignedAt?: Date;
  resolvedAt?: Date;
}

export interface LogAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string;
  usuarioId: string;
  detalle?: Record<string, unknown>;
  timestamp: Date;
}

export interface SocketEventPayloads {
  "evento:nuevo": { evento: Evento };
  "evento:asignar": { eventoId: string };
  "evento:actualizar-estado": { eventoId: string; nuevoEstado: EstadoEvento };
  "evento:actualizado": { evento: Evento };
  "evento:asignado-exito": { evento: Evento };
  "evento:asignado-error": { mensaje: string };
}

// === Tipos nuevos ===

export interface AgenteConectado {
    userId: string;
    email: string;
    nombre: string;
    socketId: string;
    connectedAt: string;
}

export interface LogSesion {
    id: string;
    accion: "LOGIN" | "LOGOUT";
    usuarioId: string;
    usuario: { nombre: string; email: string };
    detalle: { ip: string; userAgent: string } | null;
    timestamp: string;
}

export interface UserListItem {
    id: string;
    email: string;
    nombre: string;
    rol: Rol;
    activo: boolean;
    createdAt: string;
    updatedAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/types/index.ts
git commit -m "feat: agregar tipos AgenteConectado, LogSesion y UserListItem"
```

---

### Task 2: API Interna de Session Log

**Files:**
- Create: `apps/web/src/app/api/internal/session-log/route.ts`

- [ ] **Step 1: Crear `apps/web/src/app/api/internal/session-log/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        return NextResponse.json(
            { error: "Token requerido" },
            { status: 401 }
        );
    }

    const decoded = await verifyInternalToken(token);
    if (!decoded) {
        return NextResponse.json(
            { error: "Token inválido" },
            { status: 401 }
        );
    }

    const { usuarioId, accion, ip, userAgent } = await request.json();

    if (!usuarioId || !accion || !["LOGIN", "LOGOUT"].includes(accion)) {
        return NextResponse.json(
            { error: "usuarioId y accion (LOGIN|LOGOUT) son requeridos" },
            { status: 400 }
        );
    }

    await prisma.logAuditoria.create({
        data: {
            accion,
            entidad: "Sesion",
            entidadId: usuarioId,
            usuarioId,
            detalle: { ip: ip || "unknown", userAgent: userAgent || "unknown" },
        },
    });

    return NextResponse.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/internal/session-log/route.ts
git commit -m "feat: agregar API interna POST /api/internal/session-log"
```

---

### Task 3: API CRUD de Usuarios

**Files:**
- Create: `apps/web/src/app/api/admin/users/route.ts`
- Create: `apps/web/src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Crear `apps/web/src/app/api/admin/users/route.ts`**

```typescript
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
```

- [ ] **Step 2: Crear `apps/web/src/app/api/admin/users/[id]/route.ts`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/admin/users/route.ts apps/web/src/app/api/admin/users/[id]/route.ts
git commit -m "feat: agregar API CRUD de usuarios para admin"
```

---

### Task 4: API de Logs de Sesión

**Files:**
- Create: `apps/web/src/app/api/admin/sessions/route.ts`

- [ ] **Step 1: Crear `apps/web/src/app/api/admin/sessions/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Rol } from "@prisma/client";

export async function GET(request: NextRequest) {
    const token = request.cookies.get("token")?.value;
    if (!token) {
        return NextResponse.json(
            { error: "No autorizado" },
            { status: 401 }
        );
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.ADMIN) {
        return NextResponse.json(
            { error: "No autorizado" },
            { status: 401 }
        );
    }

    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get("usuarioId");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");
    const limit = Math.min(
        parseInt(searchParams.get("limit") || "50", 10),
        100
    );

    const where: Record<string, unknown> = {
        entidad: "Sesion",
    };

    if (usuarioId) {
        where.usuarioId = usuarioId;
    }

    if (fechaDesde || fechaHasta) {
        const timestamp: Record<string, Date> = {};
        if (fechaDesde) timestamp.gte = new Date(fechaDesde);
        if (fechaHasta) timestamp.lte = new Date(fechaHasta);
        where.timestamp = timestamp;
    }

    const logs = await prisma.logAuditoria.findMany({
        where,
        include: {
            usuario: {
                select: { nombre: true, email: true },
            },
        },
        orderBy: { timestamp: "desc" },
        take: limit,
    });

    return NextResponse.json({
        data: logs.map((log) => ({
            id: log.id,
            accion: log.accion,
            usuarioId: log.usuarioId,
            usuario: log.usuario,
            detalle: log.detalle,
            timestamp: log.timestamp.toISOString(),
        })),
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/admin/sessions/route.ts
git commit -m "feat: agregar API GET /api/admin/sessions para logs de sesión"
```

---

### Task 5: JWT `nombre` + Extender Socket Server

**Files:**
- Modify: `apps/web/src/lib/auth.ts` — agregar `nombre` a JWTPayload y generateToken
- Modify: `apps/web/src/app/api/auth/login/route.ts` — pasar `nombre` al generar token
- Modify: `services/socket-server/src/lib/auth.ts` — agregar `nombre` a SocketJWTPayload
- Modify: `services/socket-server/src/socket/middleware.ts` — aceptar ADMIN
- Modify: `services/socket-server/src/socket/handlers.ts` — trackear agentes + eventos admin

- [ ] **Step 1: Agregar `nombre` a `apps/web/src/lib/auth.ts`**

```typescript
import { Rol } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export interface JWTPayload {
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
  iat: number;
  exp: number;
}

interface InternalJWTPayload {
  sub: string;
  rol: string;
  iat: number;
  exp: number;
}

function getSecret(): Uint8Array {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(JWT_SECRET);
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "d": return value * 24 * 60 * 60;
    case "h": return value * 60 * 60;
    case "m": return value * 60;
    case "s": return value;
    default: return 7 * 24 * 60 * 60;
  }
}

export async function generateToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  const expiresIn = parseDuration(JWT_EXPIRES_IN);
  return new SignJWT({ email: payload.email, nombre: payload.nombre, rol: payload.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: payload.sub!,
      email: payload.email as string,
      nombre: payload.nombre as string,
      rol: payload.rol as Rol,
      iat: payload.iat!,
      exp: payload.exp!,
    };
  } catch {
    return null;
  }
}

// ... (verifyInternalToken y generateInternalToken sin cambios)
```

Nota: solo se modifican el interface `JWTPayload` (+`nombre`), `generateToken` (+`nombre` en SignJWT), y `verifyToken` (+`nombre` en return). El resto del archivo se mantiene igual.

- [ ] **Step 2: Actualizar `apps/web/src/app/api/auth/login/route.ts` — pasar `nombre` al token**

Cambiar la llamada a `generateToken` en línea 51-55:

```typescript
    const token = await generateToken({
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
    });
```

- [ ] **Step 3: Agregar `nombre` a `services/socket-server/src/lib/auth.ts`**

```typescript
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export interface SocketJWTPayload {
  sub: string;
  email: string;
  nombre: string;
  rol: "ADMIN" | "AGENT" | "INTERNAL";
  iat: number;
  exp: number;
}

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return JWT_SECRET;
}

export function verifySocketToken(token: string): SocketJWTPayload | null {
  try {
    return jwt.verify(token, getSecret()) as unknown as SocketJWTPayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Modificar `services/socket-server/src/socket/middleware.ts` para aceptar ADMIN**

```typescript
import { Socket } from "socket.io";
import { verifySocketToken, SocketJWTPayload } from "../lib/auth";

declare module "socket.io" {
    interface Socket {
        user: SocketJWTPayload;
    }
}

export function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error("Token de autenticación requerido"));
    }

    const decoded = verifySocketToken(token);

    if (!decoded) {
        return next(new Error("Token inválido"));
    }

    if (decoded.rol !== "AGENT" && decoded.rol !== "ADMIN") {
        return next(new Error("Acceso denegado: rol no autorizado"));
    }

    socket.user = decoded;
    next();
}
```

- [ ] **Step 2: Modificar `services/socket-server/src/socket/handlers.ts` para trackear agentes y eventos admin**

```typescript
import { Server, Socket } from "socket.io";
import { asignarEventoAtomico, actualizarEstadoEvento } from "../lib/api-client";

const ESTADOS_VALIDOS = ["EN_RUTA", "RESUELTO", "CANCELADO"] as const;

interface AgenteConectado {
    userId: string;
    email: string;
    nombre: string;
    socketId: string;
    connectedAt: string;
}

const agentesConectados = new Map<string, AgenteConectado>();

async function registrarSesion(
    usuarioId: string,
    accion: "LOGIN" | "LOGOUT",
    ip: string,
    userAgent: string
) {
    try {
        const { generateInternalToken } = await import("../lib/auth");
        const token = await generateInternalToken();
        const nextApiUrl =
            process.env.NEXT_API_URL || "http://localhost:3000";

        await fetch(`${nextApiUrl}/api/internal/session-log`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ usuarioId, accion, ip, userAgent }),
        });
    } catch (error) {
        console.error("Error al registrar sesión:", error);
    }
}

export function registerSocketHandlers(io: Server) {
    io.on("connection", (socket: Socket) => {
        const user = socket.user;

        if (user.rol === "ADMIN") {
            console.log(`Admin conectado: ${user.email} (${user.sub})`);

            socket.join("admin");

            socket.emit("agentes:lista", Array.from(agentesConectados.values()));

            socket.on("disconnect", () => {
                console.log(`Admin desconectado: ${user.email}`);
            });

            return;
        }

        // === AGENTE ===
        console.log(`Agente conectado: ${user.email} (${user.sub})`);

        socket.join(`agent:${user.sub}`);

        const agente: AgenteConectado = {
            userId: user.sub,
            email: user.email,
            nombre: user.nombre,
            socketId: socket.id,
            connectedAt: new Date().toISOString(),
        };

        agentesConectados.set(user.sub, agente);

        io.to("admin").emit("agentes:conectado", agente);

        const clientIp =
            socket.handshake.headers["x-forwarded-for"] ||
            socket.handshake.address ||
            "unknown";
        const clientIpStr = Array.isArray(clientIp)
            ? clientIp[0]
            : clientIp;
        const userAgent =
            (socket.handshake.headers["user-agent"] as string) || "unknown";

        registrarSesion(
            user.sub,
            "LOGIN",
            clientIpStr,
            userAgent
        );

        socket.on("evento:asignar", async ({ eventoId }) => {
            if (!eventoId || typeof eventoId !== "string") {
                socket.emit("evento:asignado-error", {
                    mensaje: "eventoId es requerido",
                });
                return;
            }

            try {
                const result = await asignarEventoAtomico(eventoId, user.sub);

                if (result.success) {
                    socket.emit("evento:asignado-exito", { evento: result.evento });
                    io.emit("evento:actualizado", { evento: result.evento });
                } else {
                    socket.emit("evento:asignado-error", {
                        mensaje: "El evento ya fue asignado a otro agente",
                    });
                }
            } catch (error) {
                console.error("Error en asignación:", error);
                socket.emit("evento:asignado-error", {
                    mensaje: "Error al asignar el evento",
                });
            }
        });

        socket.on("evento:actualizar-estado", async ({ eventoId, nuevoEstado }) => {
            if (!eventoId || typeof eventoId !== "string") {
                socket.emit("error", { mensaje: "eventoId es requerido" });
                return;
            }

            if (!nuevoEstado || !ESTADOS_VALIDOS.includes(nuevoEstado as any)) {
                socket.emit("error", { mensaje: "Estado no válido" });
                return;
            }

            try {
                const result = await actualizarEstadoEvento(
                    eventoId,
                    nuevoEstado,
                    user.sub
                );

                if (result.success) {
                    io.emit("evento:actualizado", { evento: result.evento });
                }
            } catch (error) {
                console.error("Error al actualizar estado:", error);
                socket.emit("error", { mensaje: "Error al actualizar estado" });
            }
        });

        socket.on("disconnect", () => {
            console.log(`Agente desconectado: ${user.email}`);

            agentesConectados.delete(user.sub);

            io.to("admin").emit("agentes:desconectado", {
                userId: user.sub,
            });

            const clientIp =
                socket.handshake.headers["x-forwarded-for"] ||
                socket.handshake.address ||
                "unknown";
            const clientIpStr = Array.isArray(clientIp)
                ? clientIp[0]
                : clientIp;
            const userAgent =
                (socket.handshake.headers["user-agent"] as string) || "unknown";

            registrarSesion(
                user.sub,
                "LOGOUT",
                clientIpStr,
                userAgent
            );
        });
    });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/app/api/auth/login/route.ts services/socket-server/src/lib/auth.ts services/socket-server/src/socket/middleware.ts services/socket-server/src/socket/handlers.ts
git commit -m "feat: agregar nombre al JWT y extender socket server para admin"
```

---

### Task 6: Middleware Next.js

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Extender matcher para proteger rutas `/api/admin/*`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat: proteger rutas /api/admin/* en middleware por rol ADMIN"
```

---

### Task 7: Componente ConnectedAgentsPanel

**Files:**
- Create: `apps/web/src/components/ConnectedAgentsPanel.tsx`

- [ ] **Step 1: Crear `apps/web/src/components/ConnectedAgentsPanel.tsx`**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { io, Socket } from "socket.io-client";
import type { AgenteConectado } from "@/types";

export default function ConnectedAgentsPanel() {
    const { user, token, isLoading } = useAuth();
    const [agentes, setAgentes] = useState<AgenteConectado[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);

    const connectSocket = useCallback(() => {
        if (!token) return undefined;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        const s = io(socketUrl, { auth: { token } });

        s.on("connect", () => {
            s.on("agentes:lista", (data: AgenteConectado[]) => {
                setAgentes(data);
            });

            s.on("agentes:conectado", (data: AgenteConectado) => {
                setAgentes((prev) => {
                    const filtered = prev.filter((a) => a.userId !== data.userId);
                    return [...filtered, data];
                });
            });

            s.on("agentes:desconectado", (data: { userId: string }) => {
                setAgentes((prev) =>
                    prev.filter((a) => a.userId !== data.userId)
                );
            });
        });

        return s;
    }, [token]);

    useEffect(() => {
        if (isLoading) return;

        const s = connectSocket();
        if (s) setSocket(s);

        return () => {
            s?.disconnect();
        };
    }, [isLoading, connectSocket]);

    if (isLoading) return null;

    if (user?.rol !== "ADMIN") return null;

    return (
        <aside className="w-72 flex-shrink-0">
            <div className="sticky top-6">
                <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Agentes Conectados
                        <span className="ml-auto text-xs font-normal text-gray-400">
                            {agentes.length}
                        </span>
                    </h3>

                    {agentes.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                            Sin agentes conectados
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {agentes.map((agente) => (
                                <li
                                    key={agente.userId}
                                    className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                        {agente.nombre
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {agente.nombre}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {agente.email}
                                        </p>
                                    </div>
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </aside>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ConnectedAgentsPanel.tsx
git commit -m "feat: agregar ConnectedAgentsPanel con tiempo real vía socket"
```

---

### Task 8: Componente UserFormModal

**Files:**
- Create: `apps/web/src/components/UserFormModal.tsx`

- [ ] **Step 1: Crear `apps/web/src/components/UserFormModal.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import type { UserListItem } from "@/types";
import type { Rol } from "@prisma/client";

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    usuario?: UserListItem | null;
}

export default function UserFormModal({
    isOpen,
    onClose,
    onSave,
    usuario,
}: UserFormModalProps) {
    const [nombre, setNombre] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rol, setRol] = useState<Rol>("AGENT");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const isEditing = !!usuario;

    useEffect(() => {
        if (usuario) {
            setNombre(usuario.nombre);
            setEmail(usuario.email);
            setRol(usuario.rol);
            setPassword("");
        } else {
            setNombre("");
            setEmail("");
            setPassword("");
            setRol("AGENT");
        }
        setError("");
    }, [usuario, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSaving(true);

        try {
            const url = isEditing
                ? `/api/admin/users/${usuario!.id}`
                : "/api/admin/users";
            const method = isEditing ? "PATCH" : "POST";

            const body: Record<string, unknown> = { nombre, email, rol };
            if (!isEditing) {
                body.password = password;
            } else if (password) {
                body.password = password;
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || data.mensaje || "Error al guardar");
                return;
            }

            onSave();
            onClose();
        } catch {
            setError("Error de conexión");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="fixed inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {isEditing ? "Editar Usuario" : "Nuevo Usuario"}
                </h2>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre
                            </label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                required
                                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Contraseña{" "}
                                {isEditing && (
                                    <span className="font-normal text-gray-400">
                                        (dejar vacío para mantener)
                                    </span>
                                )}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required={!isEditing}
                                minLength={6}
                                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rol
                            </label>
                            <select
                                value={rol}
                                onChange={(e) =>
                                    setRol(e.target.value as Rol)
                                }
                                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="AGENT">AGENT</option>
                                <option value="ADMIN">ADMIN</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
                        >
                            {saving
                                ? "Guardando..."
                                : isEditing
                                  ? "Guardar Cambios"
                                  : "Crear Usuario"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/UserFormModal.tsx
git commit -m "feat: agregar UserFormModal para crear/editar usuarios"
```

---

### Task 9: Componente SessionLogsTab

**Files:**
- Create: `apps/web/src/components/SessionLogsTab.tsx`

- [ ] **Step 1: Crear `apps/web/src/components/SessionLogsTab.tsx`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { LogSesion, UserListItem } from "@/types";

interface SessionLogsTabProps {
    usuarios: UserListItem[];
}

export default function SessionLogsTab({ usuarios }: SessionLogsTabProps) {
    const [logs, setLogs] = useState<LogSesion[]>([]);
    const [loading, setLoading] = useState(true);
    const [usuarioId, setUsuarioId] = useState("");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (usuarioId) params.set("usuarioId", usuarioId);
            if (fechaDesde) params.set("fechaDesde", new Date(fechaDesde).toISOString());
            if (fechaHasta) params.set("fechaHasta", new Date(fechaHasta + "T23:59:59").toISOString());
            params.set("limit", "100");

            const res = await fetch(`/api/admin/sessions?${params}`);
            if (res.ok) {
                const { data } = await res.json();
                setLogs(data);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [usuarioId, fechaDesde, fechaHasta]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const formatearFecha = (ts: string) =>
        new Date(ts).toLocaleString("es-CL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-3 items-end">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        Agente
                    </label>
                    <select
                        value={usuarioId}
                        onChange={(e) => setUsuarioId(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="">Todos</option>
                        {usuarios
                            .filter((u) => u.rol === "AGENT")
                            .map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.nombre}
                                </option>
                            ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        Desde
                    </label>
                    <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        Hasta
                    </label>
                    <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={fetchLogs}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                    Filtrar
                </button>
            </div>

            {loading ? (
                <p className="text-sm text-gray-400 py-4">Cargando...</p>
            ) : logs.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">
                    No hay registros de sesión
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                                <th className="px-4 py-2">Usuario</th>
                                <th className="px-4 py-2">Acción</th>
                                <th className="px-4 py-2">Fecha</th>
                                <th className="px-4 py-2">IP</th>
                                <th className="px-4 py-2">Navegador</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2">
                                        <div className="font-medium text-gray-900">
                                            {log.usuario?.nombre || "—"}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {log.usuario?.email || "—"}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                log.accion === "LOGIN"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                            }`}
                                        >
                                            {log.accion}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-500">
                                        {formatearFecha(log.timestamp)}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                                        {(log.detalle as Record<string, string>)?.ip ||
                                            "—"}
                                    </td>
                                    <td className="px-4 py-2 text-gray-400 text-xs max-w-[150px] truncate">
                                        {(log.detalle as Record<string, string>)
                                            ?.userAgent || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/SessionLogsTab.tsx
git commit -m "feat: agregar SessionLogsTab con filtros por agente y fecha"
```

---

### Task 10: Componente UsersPageClient

**Files:**
- Create: `apps/web/src/components/UsersPageClient.tsx`

- [ ] **Step 1: Crear `apps/web/src/components/UsersPageClient.tsx`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import UserFormModal from "@/components/UserFormModal";
import SessionLogsTab from "@/components/SessionLogsTab";
import type { UserListItem } from "@/types";

export default function UsersPageClient() {
    const [usuarios, setUsuarios] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"usuarios" | "logs">("usuarios");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserListItem | null>(null);

    const fetchUsuarios = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const { data } = await res.json();
                setUsuarios(data);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsuarios();
    }, [fetchUsuarios]);

    const handleEdit = (usuario: UserListItem) => {
        setEditingUser(usuario);
        setModalOpen(true);
    };

    const handleCreate = () => {
        setEditingUser(null);
        setModalOpen(true);
    };

    const handleToggleActivo = async (usuario: UserListItem) => {
        if (usuario.activo) {
            if (
                !confirm(
                    `¿Desactivar a ${usuario.nombre}? No podrá iniciar sesión.`
                )
            )
                return;

            const res = await fetch(`/api/admin/users/${usuario.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                fetchUsuarios();
            } else {
                const data = await res.json();
                alert(data.error || "Error al desactivar");
            }
        } else {
            const res = await fetch(`/api/admin/users/${usuario.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: true }),
            });
            if (res.ok) {
                fetchUsuarios();
            } else {
                const data = await res.json();
                alert(data.error || "Error al reactivar");
            }
        }
    };

    const getInitials = (nombre: string) =>
        nombre
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

    if (loading) {
        return (
            <p className="text-sm text-gray-400 py-4">Cargando usuarios...</p>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                    Gestión de Usuarios
                </h2>
                <button
                    onClick={handleCreate}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                    + Nuevo Usuario
                </button>
            </div>

            <div className="mb-6 border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab("usuarios")}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "usuarios"
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Usuarios
                    </button>
                    <button
                        onClick={() => setActiveTab("logs")}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "logs"
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Logs de Sesión
                    </button>
                </nav>
            </div>

            {activeTab === "usuarios" ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Usuario
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Rol
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {usuarios.map((usuario) => (
                                <tr
                                    key={usuario.id}
                                    className="hover:bg-gray-50"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                                {getInitials(usuario.nombre)}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {usuario.nombre}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {usuario.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                usuario.rol === "ADMIN"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-yellow-100 text-yellow-700"
                                            }`}
                                        >
                                            {usuario.rol}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                usuario.activo
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                            }`}
                                        >
                                            {usuario.activo
                                                ? "Activo"
                                                : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button
                                            onClick={() => handleEdit(usuario)}
                                            className="text-blue-600 hover:text-blue-800 font-medium mr-3"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleToggleActivo(usuario)
                                            }
                                            className={
                                                usuario.activo
                                                    ? "text-red-600 hover:text-red-800 font-medium"
                                                    : "text-green-600 hover:text-green-800 font-medium"
                                            }
                                        >
                                            {usuario.activo
                                                ? "Desactivar"
                                                : "Reactivar"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <SessionLogsTab usuarios={usuarios} />
            )}

            <UserFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={fetchUsuarios}
                usuario={editingUser}
            />
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/UsersPageClient.tsx
git commit -m "feat: agregar UsersPageClient con tabla CRUD y pestañas"
```

---

### Task 11: Página de Usuarios, DashboardContent, Layout y Navegación

**Files:**
- Create: `apps/web/src/app/dashboard/admin/users/page.tsx`
- Create: `apps/web/src/components/DashboardContent.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`
- Modify: `apps/web/src/components/Navigation.tsx`

- [ ] **Step 1: Crear `apps/web/src/app/dashboard/admin/users/page.tsx`**

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { Rol } from "@prisma/client";
import UsersPageClient from "@/components/UsersPageClient";

export default async function AdminUsersPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.ADMIN) redirect("/dashboard");

    return <UsersPageClient />;
}
```

- [ ] **Step 2: Crear `apps/web/src/components/DashboardContent.tsx`**

```typescript
"use client";

import ConnectedAgentsPanel from "@/components/ConnectedAgentsPanel";

export default function DashboardContent({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex gap-6">
            <main className="flex-1 min-w-0">{children}</main>
            <ConnectedAgentsPanel />
        </div>
    );
}
```

- [ ] **Step 3: Modificar `apps/web/src/app/dashboard/layout.tsx`**

```typescript
import Navigation from "@/components/Navigation";
import DashboardContent from "@/components/DashboardContent";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-100">
            <Navigation />
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <DashboardContent>{children}</DashboardContent>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Modificar `apps/web/src/components/Navigation.tsx` para agregar enlace "Usuarios"**

```typescript
"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
    const { user, logout, isLoading } = useAuth();
    const pathname = usePathname();

    if (isLoading) {
        return null;
    }

    return (
        <header className="bg-white shadow">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-semibold text-gray-900">
                            VIPER CMV
                        </h1>
                        {user && (
                            <nav className="flex gap-4">
                                {user.rol === "ADMIN" && (
                                    <>
                                        <Link
                                            href="/dashboard/admin"
                                            className={`text-sm font-medium transition-colors ${
                                                pathname === "/dashboard/admin"
                                                    ? "text-blue-600"
                                                    : "text-gray-500 hover:text-gray-700"
                                            }`}
                                        >
                                            Eventos
                                        </Link>
                                        <Link
                                            href="/dashboard/admin/users"
                                            className={`text-sm font-medium transition-colors ${
                                                pathname.startsWith(
                                                    "/dashboard/admin/users"
                                                )
                                                    ? "text-blue-600"
                                                    : "text-gray-500 hover:text-gray-700"
                                            }`}
                                        >
                                            Usuarios
                                        </Link>
                                    </>
                                )}
                                {user.rol === "AGENT" && (
                                    <Link
                                        href="/dashboard/agent"
                                        className={`text-sm font-medium transition-colors ${
                                            pathname === "/dashboard/agent"
                                                ? "text-blue-600"
                                                : "text-gray-500 hover:text-gray-700"
                                        }`}
                                    >
                                        Eventos
                                    </Link>
                                )}
                            </nav>
                        )}
                    </div>
                    {user && (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-700">
                                    {user.nombre}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                    {user.rol}
                                </span>
                            </div>
                            <button
                                onClick={logout}
                                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/admin/users/page.tsx apps/web/src/components/DashboardContent.tsx apps/web/src/app/dashboard/layout.tsx apps/web/src/components/Navigation.tsx
git commit -m "feat: integrar DashboardContent, UsersPage, y navegación con enlace Usuarios"
```

---

### Task 12: Verificación

**Files:** (none created/modified — verification only)

- [ ] **Step 1: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Build web**

```bash
npm run build:web
```
Expected: build exitoso, rutas `/dashboard/admin/users` y `/api/admin/*` compiladas.

- [ ] **Step 3: Commit si hay ajustes menores**

```bash
git add -A && git commit -m "chore: ajustes post-build de verificación"
```

---

## Orden de ejecución recomendado

1. Task 1 (tipos) → Task 2 (internal API) → Task 3 (CRUD API) → Task 4 (sessions API)
2. Task 5 (socket server) → Task 6 (middleware)
3. Task 7 → Task 8 → Task 9 → Task 10 → Task 11 (frontend components + pages)
4. Task 12 (verificación final)
