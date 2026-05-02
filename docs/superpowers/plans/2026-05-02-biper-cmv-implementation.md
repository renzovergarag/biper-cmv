# BIPER-CMV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inicializar y estructurar un monorepo con Next.js (web/API) y un microservicio Socket.io (tiempo real) para gestión de eventos territoriales en tiempo real.

**Architecture:** Monorepo npm workspaces con dos servicios independientes: apps/web (Next.js App Router + Prisma + API REST) y services/socket-server (Express + Socket.io). Comunicación vía HTTP REST interno con JWT compartido.

**Tech Stack:** Node.js 20, Next.js 14+, Prisma 5+, MongoDB, Socket.io 4+, Express 4, Tailwind CSS 3.4, JWT, PM2, Nginx.

---

## File Structure

```
biper-cmv/
├── package.json                              # Workspace root
├── tsconfig.json                             # Root TypeScript config
├── .env.example                              # Variables de entorno ejemplo
├── .gitignore
├── apps/
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.mjs
│       ├── .env.example
│       ├── prisma/
│       │   └── schema.prisma                 # Modelos de DB
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   ├── globals.css
│           │   ├── api/
│           │   │   └── auth/
│           │   │       └── login/
│           │   │           └── route.ts
│           │   └── (dashboard)/
│           │       ├── admin/
│           │       │   └── page.tsx
│           │       └── agent/
│           │           └── page.tsx
│           ├── lib/
│           │   ├── prisma.ts                 # Prisma client singleton
│           │   ├── auth.ts                   # JWT helpers
│           │   └── constants.ts              # Enums compartidos
│           ├── types/
│           │   └── index.ts                  # Tipos compartidos
│           └── middleware.ts                 # Auth middleware
├── services/
│   └── socket-server/
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       ├── prisma/
│       │   └── schema.prisma                 # Copia del schema (lectura)
│       └── src/
│           ├── index.ts                      # Entry point Express + Socket.io
│           ├── socket/
│           │   ├── index.ts                  # Socket.io setup
│           │   ├── handlers.ts               # Event handlers
│           │   └── middleware.ts             # JWT validation middleware
│           ├── routes/
│           │   └── internal.ts               # REST endpoints internos
│           └── lib/
│               ├── auth.ts                   # JWT validation
│               └── api-client.ts             # HTTP client para Next.js
├── ecosystem.config.js                       # PM2 config
└── nginx/
    └── biper-cmv.conf                        # Nginx config
```

---

## Task 1: Inicializar Monorepo

**Files:**
- Create: `package.json` (root workspace)
- Create: `tsconfig.json` (root)
- Create: `.gitignore`
- Create: `.env.example` (root)

- [ ] **Step 1: Crear package.json root con npm workspaces**

```json
{
  "name": "biper-cmv",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "services/*"
  ],
  "scripts": {
    "dev:web": "npm run dev -w apps/web",
    "dev:socket": "npm run dev -w services/socket-server",
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:socket\"",
    "build:web": "npm run build -w apps/web",
    "build:socket": "npm run build -w services/socket-server",
    "build": "npm run build:web && npm run build:socket",
    "start:web": "npm run start -w apps/web",
    "start:socket": "npm run start -w services/socket-server",
    "db:generate": "npm run db:generate -w apps/web",
    "db:push": "npm run db:push -w apps/web",
    "db:migrate": "npm run db:migrate -w apps/web"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Crear tsconfig.json root**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 3: Crear .gitignore**

```
node_modules/
.next/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
```

- [ ] **Step 4: Crear .env.example root**

```
# Base de datos
DATABASE_URL="mongodb://localhost:27017/biper-cmv"

# Autenticación
JWT_SECRET="tu-secret-aqui-cambiar-en-produccion"
JWT_EXPIRES_IN="7d"

# URLs de servicios
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SOCKET_SERVER_URL="http://localhost:4000"
SOCKET_SERVER_INTERNAL_URL="http://localhost:4000"
```

- [ ] **Step 5: Instalar dependencias root**

```bash
npm install
```

---

## Task 2: Configurar Prisma y Modelos de MongoDB

**Files:**
- Create: `apps/web/prisma/schema.prisma`
- Create: `apps/web/package.json`
- Create: `services/socket-server/prisma/schema.prisma`
- Create: `services/socket-server/package.json`

- [ ] **Step 1: Crear package.json para apps/web**

```json
{
  "name": "@biper-cmv/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "prisma": "^5.20.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Crear schema.prisma para apps/web**

```prisma
// apps/web/prisma/schema.prisma

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Rol {
  ADMIN
  AGENT
}

enum NivelUrgencia {
  BAJA
  MEDIA
  ALTA
  CRITICA
}

enum EstadoEvento {
  PENDIENTE
  ASIGNADO
  EN_RUTA
  RESUELTO
  CANCELADO
}

model User {
  id               String   @id @default(auto()) @map("_id") @db.ObjectId
  email            String   @unique
  password         String
  nombre           String
  rol              Rol
  activo           Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  eventosCreados   Evento[] @relation("Creador")
  eventosAsignados Evento[] @relation("Asignado")
  logs             LogAuditoria[]
}

model Evento {
  id               String        @id @default(auto()) @map("_id") @db.ObjectId
  titulo           String
  origen           String
  nivelUrgencia    NivelUrgencia
  direccionExacta  String
  coordenadas      Json?
  telefonoContacto String?
  estado           EstadoEvento  @default(PENDIENTE)

  creadorId        String        @db.ObjectId
  creador          User          @relation("Creador", fields: [creadorId], references: [id])

  asignadoId       String?       @db.ObjectId
  asignado         User?         @relation("Asignado", fields: [asignadoId], references: [id])

  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  assignedAt       DateTime?
  resolvedAt       DateTime?

  logs             LogAuditoria[]
  estadosHistorial EstadoHistorial[]

  @@index([estado])
  @@index([creadorId])
  @@index([asignadoId])
  @@index([nivelUrgencia])
  @@index([createdAt])
}

model EstadoHistorial {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  eventoId  String   @db.ObjectId
  evento    Evento   @relation(fields: [eventoId], references: [id])
  estado    EstadoEvento
  usuarioId String   @db.ObjectId
  timestamp DateTime @default(now())
  notas     String?
}

model LogAuditoria {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  accion      String
  entidad     String
  entidadId   String   @db.ObjectId
  usuarioId   String   @db.ObjectId
  usuario     User     @relation(fields: [usuarioId], references: [id])
  detalle     Json?
  timestamp   DateTime @default(now())

  @@index([entidad, entidadId])
  @@index([usuarioId])
  @@index([timestamp])
  @@index([accion])
}
```

- [ ] **Step 3: Crear package.json para services/socket-server**

```json
{
  "name": "@biper-cmv/socket-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "prisma generate",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "socket.io": "^4.7.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.0.0",
    "prisma": "^5.20.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 4: Copiar schema.prisma a socket-server**

```bash
cp apps/web/prisma/schema.prisma services/socket-server/prisma/schema.prisma
```

- [ ] **Step 5: Instalar dependencias**

```bash
npm install
```

- [ ] **Step 6: Generar Prisma Client**

```bash
cd apps/web && npx prisma generate
cd ../..
cd services/socket-server && npx prisma generate
cd ../..
```

---

## Task 3: Configurar Next.js (Web)

**Files:**
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/.env.example`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Crear next.config.ts**

```typescript
// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 2: Crear tailwind.config.ts**

```typescript
// apps/web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Crear postcss.config.mjs**

```javascript
// apps/web/postcss.config.mjs
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

- [ ] **Step 4: Crear tsconfig.json para web**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Crear .env.example para web**

```
DATABASE_URL="mongodb://localhost:27017/biper-cmv"
JWT_SECRET="tu-secret-aqui-cambiar-en-produccion"
JWT_EXPIRES_IN="7d"
SOCKET_SERVER_URL="http://localhost:4000"
```

- [ ] **Step 6: Crear globals.css**

```css
/* apps/web/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 7: Crear layout.tsx**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Crear page.tsx (home)**

```typescript
// apps/web/src/app/page.tsx
export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          BIPER CMV
        </h1>
        <p className="text-lg text-gray-600">
          Sistema de Gestión de Eventos Territoriales
        </p>
        <div className="mt-8">
          <a
            href="/api/auth/login"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Iniciar Sesión
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verificar que Next.js compila**

```bash
cd apps/web && npm run build
```

---

## Task 4: Librerías Base (Prisma, Auth, Tipos)

**Files:**
- Create: `apps/web/src/lib/prisma.ts`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/constants.ts`
- Create: `apps/web/src/types/index.ts`

- [ ] **Step 1: Crear Prisma client singleton**

```typescript
// apps/web/src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

- [ ] **Step 2: Crear auth helpers**

```typescript
// apps/web/src/lib/auth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Rol } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-prod";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface JWTPayload {
  sub: string;
  email: string;
  rol: Rol;
  iat: number;
  exp: number;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function generateInternalToken(): string {
  return jwt.sign(
    { sub: "internal", rol: "INTERNAL" },
    JWT_SECRET,
    { expiresIn: "5m" }
  );
}
```

- [ ] **Step 3: Crear constantes/enums**

```typescript
// apps/web/src/lib/constants.ts
export const NIVEL_URGENCIA = {
  BAJA: "BAJA",
  MEDIA: "MEDIA",
  ALTA: "ALTA",
  CRITICA: "CRITICA",
} as const;

export const ESTADO_EVENTO = {
  PENDIENTE: "PENDIENTE",
  ASIGNADO: "ASIGNADO",
  EN_RUTA: "EN_RUTA",
  RESUELTO: "RESUELTO",
  CANCELADO: "CANCELADO",
} as const;

export const ROL = {
  ADMIN: "ADMIN",
  AGENT: "AGENT",
} as const;
```

- [ ] **Step 4: Crear tipos compartidos**

```typescript
// apps/web/src/types/index.ts
import { Rol, NivelUrgencia, EstadoEvento } from "@prisma/client";

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
```

---

## Task 5: Autenticación API Route

**Files:**
- Create: `apps/web/src/app/api/auth/login/route.ts`
- Create: `apps/web/src/middleware.ts`

- [ ] **Step 1: Crear login route**

```typescript
// apps/web/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateToken } from "@/lib/auth";
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

    const token = generateToken({
      sub: user.id,
      email: user.email,
      rol: user.rol,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Crear middleware.ts para protección de rutas**

```typescript
// apps/web/src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const decoded = verifyToken(token);

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
```

---

## Task 6: Configurar Socket Server

**Files:**
- Create: `services/socket-server/tsconfig.json`
- Create: `services/socket-server/.env.example`
- Create: `services/socket-server/src/index.ts`
- Create: `services/socket-server/src/socket/index.ts`
- Create: `services/socket-server/src/socket/handlers.ts`
- Create: `services/socket-server/src/socket/middleware.ts`
- Create: `services/socket-server/src/routes/internal.ts`
- Create: `services/socket-server/src/lib/auth.ts`
- Create: `services/socket-server/src/lib/api-client.ts`

- [ ] **Step 1: Crear tsconfig.json para socket-server**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Crear .env.example para socket-server**

```
PORT=4000
DATABASE_URL="mongodb://localhost:27017/biper-cmv"
JWT_SECRET="tu-secret-aqui-cambiar-en-produccion"
NEXT_API_URL="http://localhost:3000"
```

- [ ] **Step 3: Crear auth helpers para socket-server**

```typescript
// services/socket-server/src/lib/auth.ts
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-prod";

export interface SocketJWTPayload {
  sub: string;
  email: string;
  rol: "ADMIN" | "AGENT";
  iat: number;
  exp: number;
}

export function verifySocketToken(token: string): SocketJWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SocketJWTPayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Crear API client para llamar a Next.js**

```typescript
// services/socket-server/src/lib/api-client.ts
import jwt from "jsonwebtoken";

const NEXT_API_URL = process.env.NEXT_API_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-prod";

function getInternalToken(): string {
  return jwt.sign(
    { sub: "socket-server", rol: "INTERNAL" },
    JWT_SECRET,
    { expiresIn: "5m" }
  );
}

export async function callNextAPI<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const token = getInternalToken();

  const response = await fetch(`${NEXT_API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function asignarEventoAtomico(
  eventoId: string,
  agenteId: string
) {
  return callNextAPI<{ evento: unknown; success: boolean }>(
    "/api/internal/assign",
    "POST",
    { eventoId, agenteId }
  );
}

export async function actualizarEstadoEvento(
  eventoId: string,
  nuevoEstado: string,
  usuarioId: string
) {
  return callNextAPI<{ evento: unknown; success: boolean }>(
    "/api/internal/update-status",
    "PATCH",
    { eventoId, nuevoEstado, usuarioId }
  );
}
```

- [ ] **Step 5: Crear socket middleware**

```typescript
// services/socket-server/src/socket/middleware.ts
import { Socket } from "socket.io";
import { verifySocketToken } from "../lib/auth";

export function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Token de autenticación requerido"));
  }

  const decoded = verifySocketToken(token);

  if (!decoded) {
    return next(new Error("Token inválido"));
  }

  if (decoded.rol !== "AGENT") {
    return next(new Error("Acceso denegado: solo agentes permitidos"));
  }

  (socket as any).user = decoded;
  next();
}
```

- [ ] **Step 6: Crear socket handlers**

```typescript
// services/socket-server/src/socket/handlers.ts
import { Server, Socket } from "socket.io";
import { asignarEventoAtomico, actualizarEstadoEvento } from "../lib/api-client";

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`Agente conectado: ${user.email} (${user.sub})`);

    socket.join(`agent:${user.sub}`);

    socket.on("evento:asignar", async ({ eventoId }) => {
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
    });
  });
}
```

- [ ] **Step 7: Crear socket setup**

```typescript
// services/socket-server/src/socket/index.ts
import { Server } from "socket.io";
import { authenticateSocket } from "./middleware";
import { registerSocketHandlers } from "./handlers";

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.use(authenticateSocket);
  registerSocketHandlers(io);

  return io;
}
```

- [ ] **Step 8: Crear internal routes**

```typescript
// services/socket-server/src/routes/internal.ts
import { Router, Request, Response } from "express";
import { verifySocketToken } from "../lib/auth";

const router = Router();

function authenticateInternal(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const decoded = verifySocketToken(token);

  if (!decoded || decoded.rol !== "INTERNAL") {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  next();
}

router.post("/internal/events", authenticateInternal, (req: Request, res: Response) => {
  const { evento } = req.body;

  if (!evento) {
    return res.status(400).json({ error: "Datos de evento requeridos" });
  }

  req.app.get("io").emit("evento:nuevo", { evento });

  res.json({ success: true });
});

router.get("/internal/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
```

- [ ] **Step 9: Crear entry point**

```typescript
// services/socket-server/src/index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { setupSocketIO } from "./socket";
import internalRoutes from "./routes/internal";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(internalRoutes);

const httpServer = createServer(app);
const io = setupSocketIO(httpServer);

app.set("io", io);

httpServer.listen(PORT, () => {
  console.log(`Socket Server running on port ${PORT}`);
});
```

---

## Task 7: API Routes Internas (Next.js)

**Files:**
- Create: `apps/web/src/app/api/internal/assign/route.ts`
- Create: `apps/web/src/app/api/internal/update-status/route.ts`

- [ ] **Step 1: Crear ruta de asignación atómica**

```typescript
// apps/web/src/app/api/internal/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ESTADO_EVENTO } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.rol !== "INTERNAL") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { eventoId, agenteId } = await request.json();

    if (!eventoId || !agenteId) {
      return NextResponse.json(
        { error: "eventoId y agenteId requeridos" },
        { status: 400 }
      );
    }

    // Operación atómica: solo actualiza si estado es PENDIENTE
    const result = await prisma.evento.updateMany({
      where: {
        id: eventoId,
        estado: ESTADO_EVENTO.PENDIENTE,
      },
      data: {
        estado: ESTADO_EVENTO.ASIGNADO,
        asignadoId: agenteId,
        assignedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({
        success: false,
        mensaje: "Evento ya asignado o no existe",
      });
    }

    const evento = await prisma.evento.findUnique({
      where: { id: eventoId },
      include: { creador: true, asignado: true },
    });

    // Registrar en log de auditoría
    await prisma.logAuditoria.create({
      data: {
        accion: "ASSIGNED",
        entidad: "Evento",
        entidadId: eventoId,
        usuarioId: agenteId,
        detalle: { eventoId, agenteId },
      },
    });

    // Registrar en historial de estados
    await prisma.estadoHistorial.create({
      data: {
        eventoId,
        estado: ESTADO_EVENTO.ASIGNADO,
        usuarioId: agenteId,
      },
    });

    return NextResponse.json({ success: true, evento });
  } catch (error) {
    console.error("Error en asignación:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Crear ruta de actualización de estado**

```typescript
// apps/web/src/app/api/internal/update-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ESTADO_EVENTO } from "@/lib/constants";

const ESTADOS_VALIDOS = [
  ESTADO_EVENTO.EN_RUTA,
  ESTADO_EVENTO.RESUELTO,
  ESTADO_EVENTO.CANCELADO,
];

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.rol !== "INTERNAL") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { eventoId, nuevoEstado, usuarioId } = await request.json();

    if (!eventoId || !nuevoEstado || !usuarioId) {
      return NextResponse.json(
        { error: "eventoId, nuevoEstado y usuarioId requeridos" },
        { status: 400 }
      );
    }

    if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
      return NextResponse.json(
        { error: "Estado no válido" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { estado: nuevoEstado };

    if (nuevoEstado === ESTADO_EVENTO.RESUELTO) {
      updateData.resolvedAt = new Date();
    }

    const result = await prisma.evento.updateMany({
      where: { id: eventoId },
      data: updateData,
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      );
    }

    const evento = await prisma.evento.findUnique({
      where: { id: eventoId },
      include: { creador: true, asignado: true },
    });

    await prisma.logAuditoria.create({
      data: {
        accion: "STATUS_CHANGED",
        entidad: "Evento",
        entidadId: eventoId,
        usuarioId,
        detalle: { nuevoEstado },
      },
    });

    await prisma.estadoHistorial.create({
      data: {
        eventoId,
        estado: nuevoEstado,
        usuarioId,
      },
    });

    return NextResponse.json({ success: true, evento });
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

---

## Task 8: Dashboard Admin y Agent (UI Base)

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/page.tsx`
- Create: `apps/web/src/app/(dashboard)/agent/page.tsx`
- Create: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Crear layout de dashboard**

```typescript
// apps/web/src/app/(dashboard)/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold text-gray-900">
            BIPER CMV
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Crear página Admin**

```typescript
// apps/web/src/app/(dashboard)/admin/page.tsx
export default function AdminDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Panel de Administración
      </h2>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Vista de administración - Crear eventos, ver reportería
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear página Agent (mobile-first)**

```typescript
// apps/web/src/app/(dashboard)/agent/page.tsx
export default function AgentDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Modo Escucha
        </h2>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-gray-600">Conectado</span>
          </div>
          <p className="text-gray-500 text-sm">
            Esperando eventos...
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 9: Configurar PM2 y Nginx

**Files:**
- Create: `ecosystem.config.js`
- Create: `nginx/biper-cmv.conf`

- [ ] **Step 1: Crear PM2 ecosystem config**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "biper-web",
      cwd: "./apps/web",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "biper-socket",
      cwd: "./services/socket-server",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
    },
  ],
};
```

- [ ] **Step 2: Crear Nginx config**

```nginx
# nginx/biper-cmv.conf

upstream biper_web {
    server 127.0.0.1:3000;
}

upstream biper_socket {
    server 127.0.0.1:4000;
}

server {
    listen 80;
    server_name tu-dominio.com;

    # Web App (Next.js)
    location / {
        proxy_pass http://biper_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io
    location /socket.io/ {
        proxy_pass http://biper_socket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Internal API (block from external access)
    location /api/internal/ {
        deny all;
    }
}
```

---

## Task 10: Verificación Final

- [ ] **Step 1: Instalar todas las dependencias**

```bash
npm install
```

- [ ] **Step 2: Generar Prisma Client en ambos proyectos**

```bash
cd apps/web && npx prisma generate && cd ../..
cd services/socket-server && npx prisma generate && cd ../..
```

- [ ] **Step 3: Push schema a MongoDB**

```bash
cd apps/web && npx prisma db push && cd ../..
```

- [ ] **Step 4: Build web**

```bash
npm run build:web
```

- [ ] **Step 5: Build socket-server**

```bash
npm run build:socket
```

- [ ] **Step 6: Verificar que ambos servicios inician**

```bash
# Terminal 1
npm run dev:web

# Terminal 2
npm run dev:socket
```

- [ ] **Step 7: Verificar health check**

```bash
curl http://localhost:4000/internal/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## Self-Review

**1. Spec coverage:**
- [x] Monorepo structure
- [x] Prisma models (User, Evento, EstadoHistorial, LogAuditoria)
- [x] Enums (Rol, NivelUrgencia, EstadoEvento)
- [x] Índices en MongoDB
- [x] JWT auth con secret compartido
- [x] Operación atómica anti-carrera (updateMany con filtro estado=PENDIENTE)
- [x] Socket.io handlers para agentes
- [x] REST endpoints internos
- [x] Trazabilidad (LogAuditoria + EstadoHistorial)
- [x] RBAC (ADMIN vs AGENT)
- [x] Mobile-first agent UI
- [x] PM2 config
- [x] Nginx config

**2. Placeholder scan:** Ningún TBD o TODO encontrado.

**3. Type consistency:** Todos los tipos usan @prisma/client enums consistentemente. SocketEventPayloads en types/index.ts documenta la comunicación socket.
