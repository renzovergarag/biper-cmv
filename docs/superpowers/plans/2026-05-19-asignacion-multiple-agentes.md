# Asignación múltiple de agentes a un evento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la relación evento-agente de 1:1 a 1:N mediante un modelo de unión explícito `AsignacionEvento`, con estado de evento derivado y cierre por consenso.

**Architecture:** Nueva colección `AsignacionEvento` (N:N entre `Evento` y `User`). El `estado` del evento se deriva de sus asignaciones activas mediante una función pura `derivarEstadoEvento`, recalculada transaccionalmente tras cada cambio. Los agentes se auto-asignan vía socket; el admin agrega/quita agentes y cancela eventos vía API REST, que difunde los cambios al socket-server. Durante la transición se conservan los campos `asignadoId`/`asignado` para que cada commit compile; una tarea final de limpieza los elimina.

**Tech Stack:** Next.js 14 (App Router, API routes), Prisma 5 + MongoDB, Express + Socket.io, TypeScript, shadcn/ui, `tsx` para scripts.

**Spec:** `docs/superpowers/specs/2026-05-14-asignacion-multiple-agentes-design.md`

---

## Notas para quien implementa

- **Idioma:** el proyecto está en español (modelos, enums, rutas, mensajes). Mantenerlo.
- **Estilo:** indentación de 4 espacios, sin tabs, `const` sobre `let`, sin `var`.
- **No hay framework de tests.** El único test unitario es un script `tsx` con `node:assert` para la función pura `derivarEstadoEvento`. Todo lo demás se verifica con typecheck (`npx tsc --noEmit -p <tsconfig>`) y QA manual.
- **MongoDB debe estar corriendo** (Docker Compose, puerto host 27018) para `db:push` y para QA manual.
- **Hay dos schemas Prisma idénticos** que deben mantenerse en sincronía: `apps/web/prisma/schema.prisma` y `services/socket-server/prisma/schema.prisma`.
- **Comandos de verificación usados en el plan** (ejecutar desde la raíz del repo):
  - Typecheck web: `npx tsc --noEmit -p apps/web/tsconfig.json`
  - Typecheck socket: `npx tsc --noEmit -p services/socket-server/tsconfig.json`
  - Prisma web: `npm run db:generate -w apps/web` / `npm run db:push -w apps/web`
  - Prisma socket: `npm run db:generate -w services/socket-server` / `npm run db:push -w services/socket-server`

---

## Task 1: Schema — agregar `EstadoAsignacion` y `AsignacionEvento` (aditivo)

Se agrega el nuevo enum, el modelo de unión y las relaciones inversas **conservando** `asignadoId`/`asignado` para no romper el código existente. Ambos schemas deben quedar idénticos.

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `services/socket-server/prisma/schema.prisma`

- [ ] **Step 1: Agregar el enum `EstadoAsignacion`**

En `apps/web/prisma/schema.prisma`, después del bloque `enum EstadoEvento { ... }`, agregar:

```prisma
enum EstadoAsignacion {
  ASIGNADO
  EN_RUTA
  RESUELTO
  ABANDONADO
}
```

- [ ] **Step 2: Agregar la relación `asignaciones` en `Evento`**

En el modelo `Evento`, después de la línea `asignado          User?         @relation("Asignado", fields: [asignadoId], references: [id])` agregar (NO eliminar `asignadoId`/`asignado` todavía):

```prisma
  asignaciones     AsignacionEvento[]
```

- [ ] **Step 3: Reemplazar la relación de asignaciones en `User`**

En el modelo `User`, dejar `eventosAsignados` como está (se elimina en la limpieza final) y agregar debajo de `eventosAsignados Evento[] @relation("Asignado")`:

```prisma
  asignaciones     AsignacionEvento[] @relation("AgenteAsignaciones")
```

- [ ] **Step 4: Agregar el modelo `AsignacionEvento`**

Al final del archivo `apps/web/prisma/schema.prisma`, agregar:

```prisma
model AsignacionEvento {
  id         String           @id @default(auto()) @map("_id") @db.ObjectId
  eventoId   String           @db.ObjectId
  evento     Evento           @relation(fields: [eventoId], references: [id])
  agenteId   String           @db.ObjectId
  agente     User             @relation("AgenteAsignaciones", fields: [agenteId], references: [id])
  estado     EstadoAsignacion @default(ASIGNADO)
  assignedAt DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
  resolvedAt DateTime?

  @@unique([eventoId, agenteId])
  @@index([agenteId])
  @@index([eventoId])
  @@index([estado])
}
```

- [ ] **Step 5: Replicar exactamente los Steps 1-4 en el schema del socket-server**

Aplicar los mismos cuatro cambios a `services/socket-server/prisma/schema.prisma`. Verificar que ambos quedan idénticos:

Run: `diff apps/web/prisma/schema.prisma services/socket-server/prisma/schema.prisma && echo "IDÉNTICOS"`
Expected: imprime `IDÉNTICOS` (sin diferencias).

- [ ] **Step 6: Generar cliente y aplicar a la base (requiere MongoDB corriendo)**

Run:
```bash
npm run db:push -w apps/web
npm run db:generate -w apps/web
npm run db:generate -w services/socket-server
```
Expected: `db:push` reporta los nuevos índices/colección sin errores; ambos `db:generate` terminan con "Generated Prisma Client".

- [ ] **Step 7: Verificar typecheck (debe seguir compilando, cambios aditivos)**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add apps/web/prisma/schema.prisma services/socket-server/prisma/schema.prisma
git commit -m "feat(schema): agregar modelo AsignacionEvento y enum EstadoAsignacion"
```

---

## Task 2: Lógica de estado — `derivarEstadoEvento` + `recalcularEstadoEvento` (TDD para la función pura)

**Files:**
- Create: `apps/web/src/lib/asignaciones.ts`
- Create: `apps/web/scripts/test-derivar-estado.ts`
- Modify: `apps/web/package.json` (agregar script `test:derivar`)

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/web/scripts/test-derivar-estado.ts`:

```typescript
import assert from "node:assert/strict";
import { EstadoAsignacion, EstadoEvento } from "@prisma/client";
import { derivarEstadoEvento } from "../src/lib/asignaciones";

const A = EstadoAsignacion;
const E = EstadoEvento;

// Sin asignaciones activas → PENDIENTE
assert.equal(derivarEstadoEvento([]), E.PENDIENTE);

// Solo ASIGNADO → ASIGNADO
assert.equal(derivarEstadoEvento([{ estado: A.ASIGNADO }]), E.ASIGNADO);

// Mezcla ASIGNADO + EN_RUTA → EN_RUTA
assert.equal(
    derivarEstadoEvento([{ estado: A.ASIGNADO }, { estado: A.EN_RUTA }]),
    E.EN_RUTA
);

// Todas RESUELTO → RESUELTO
assert.equal(
    derivarEstadoEvento([{ estado: A.RESUELTO }, { estado: A.RESUELTO }]),
    E.RESUELTO
);

// Una RESUELTO y otra ASIGNADO (no todas cerradas) → EN_RUTA
assert.equal(
    derivarEstadoEvento([{ estado: A.RESUELTO }, { estado: A.ASIGNADO }]),
    E.EN_RUTA
);

// ABANDONADO se ignora: queda solo una ASIGNADO → ASIGNADO
assert.equal(
    derivarEstadoEvento([{ estado: A.ABANDONADO }, { estado: A.ASIGNADO }]),
    E.ASIGNADO
);

// Todas ABANDONADO → PENDIENTE
assert.equal(
    derivarEstadoEvento([{ estado: A.ABANDONADO }, { estado: A.ABANDONADO }]),
    E.PENDIENTE
);

console.log("✓ derivarEstadoEvento: todos los casos pasaron");
```

- [ ] **Step 2: Agregar el script npm**

En `apps/web/package.json`, dentro de `"scripts"`, agregar tras `"db:seed"`:

```json
    "test:derivar": "tsx scripts/test-derivar-estado.ts"
```

(Recordar agregar la coma al final de la línea anterior.)

- [ ] **Step 3: Ejecutar el test para verificar que falla**

Run: `npm run test:derivar -w apps/web`
Expected: FALLA con un error de módulo no encontrado / `derivarEstadoEvento is not a function` (todavía no existe `src/lib/asignaciones.ts`).

- [ ] **Step 4: Implementar `asignaciones.ts`**

Crear `apps/web/src/lib/asignaciones.ts`:

```typescript
import { EstadoAsignacion, EstadoEvento, Prisma } from "@prisma/client";

/**
 * Deriva el estado de un evento a partir de sus asignaciones.
 * Las asignaciones ABANDONADO se ignoran (no cuentan para el consenso).
 * NO devuelve CANCELADO: ese estado es terminal y se setea explícitamente
 * por el admin, nunca se deriva.
 */
export function derivarEstadoEvento(
    asignaciones: { estado: EstadoAsignacion }[]
): EstadoEvento {
    const activas = asignaciones.filter(
        (a) => a.estado !== EstadoAsignacion.ABANDONADO
    );

    if (activas.length === 0) return EstadoEvento.PENDIENTE;

    if (activas.every((a) => a.estado === EstadoAsignacion.RESUELTO)) {
        return EstadoEvento.RESUELTO;
    }

    if (
        activas.some(
            (a) =>
                a.estado === EstadoAsignacion.EN_RUTA ||
                a.estado === EstadoAsignacion.RESUELTO
        )
    ) {
        return EstadoEvento.EN_RUTA;
    }

    return EstadoEvento.ASIGNADO;
}

/**
 * Recalcula y persiste el estado del evento dentro de una transacción.
 * Lee las asignaciones, deriva el nuevo estado y, si cambió, actualiza el
 * Evento y registra EstadoHistorial + LogAuditoria.
 *
 * - No toca eventos CANCELADO (terminal).
 * - Al volver a PENDIENTE limpia assignedAt/resolvedAt.
 * - Al pasar a RESUELTO setea resolvedAt.
 * - Al asignarse por primera vez setea assignedAt.
 */
export async function recalcularEstadoEvento(
    tx: Prisma.TransactionClient,
    eventoId: string,
    usuarioId: string
): Promise<void> {
    const evento = await tx.evento.findUnique({
        where: { id: eventoId },
        select: { estado: true, assignedAt: true },
    });
    if (!evento) return;
    if (evento.estado === EstadoEvento.CANCELADO) return;

    const asignaciones = await tx.asignacionEvento.findMany({
        where: { eventoId },
        select: { estado: true },
    });

    const nuevoEstado = derivarEstadoEvento(asignaciones);
    if (nuevoEstado === evento.estado) return;

    const data: Prisma.EventoUpdateInput = { estado: nuevoEstado };

    if (nuevoEstado === EstadoEvento.PENDIENTE) {
        data.assignedAt = null;
        data.resolvedAt = null;
    } else if (
        evento.estado === EstadoEvento.PENDIENTE &&
        !evento.assignedAt
    ) {
        data.assignedAt = new Date();
    }

    if (nuevoEstado === EstadoEvento.RESUELTO) {
        data.resolvedAt = new Date();
    }

    await tx.evento.update({ where: { id: eventoId }, data });

    await tx.estadoHistorial.create({
        data: { eventoId, estado: nuevoEstado, usuarioId },
    });

    await tx.logAuditoria.create({
        data: {
            accion: "STATUS_CHANGED",
            entidad: "Evento",
            entidadId: eventoId,
            usuarioId,
            detalle: {
                estadoAnterior: evento.estado,
                nuevoEstado,
                derivado: true,
            },
        },
    });
}
```

- [ ] **Step 5: Ejecutar el test para verificar que pasa**

Run: `npm run test:derivar -w apps/web`
Expected: imprime `✓ derivarEstadoEvento: todos los casos pasaron` y termina con código 0.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/asignaciones.ts apps/web/scripts/test-derivar-estado.ts apps/web/package.json
git commit -m "feat(asignaciones): derivarEstadoEvento + recalcularEstadoEvento con test"
```

---

## Task 3: Reescribir `POST /api/internal/assign` (agente se une)

El endpoint deja de ser exclusivo: hace `upsert` de la asignación del agente y recalcula el estado del evento.

**Files:**
- Modify: `apps/web/src/app/api/internal/assign/route.ts` (reemplazo completo)

- [ ] **Step 1: Reemplazar el contenido del archivo**

Sobrescribir `apps/web/src/app/api/internal/assign/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalToken } from "@/lib/auth";
import { EstadoAsignacion, EstadoEvento } from "@prisma/client";
import { recalcularEstadoEvento } from "@/lib/asignaciones";

const ESTADOS_UNIBLES: EstadoEvento[] = [
    EstadoEvento.PENDIENTE,
    EstadoEvento.ASIGNADO,
    EstadoEvento.EN_RUTA,
];

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return NextResponse.json({ error: "Token requerido" }, { status: 401 });
        }

        const decoded = verifyInternalToken(token);
        if (!decoded) {
            return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
        }

        const { eventoId, agenteId } = await request.json();

        if (!eventoId || !agenteId) {
            return NextResponse.json(
                { error: "eventoId y agenteId requeridos" },
                { status: 400 }
            );
        }

        const evento = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { estado: true },
        });

        if (!evento) {
            return NextResponse.json({
                success: false,
                mensaje: "El evento no existe",
            });
        }

        if (!ESTADOS_UNIBLES.includes(evento.estado)) {
            return NextResponse.json({
                success: false,
                mensaje: "El evento ya no admite agentes",
            });
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.asignacionEvento.upsert({
                where: { eventoId_agenteId: { eventoId, agenteId } },
                create: {
                    eventoId,
                    agenteId,
                    estado: EstadoAsignacion.ASIGNADO,
                    resolvedAt: null,
                },
                update: {
                    estado: EstadoAsignacion.ASIGNADO,
                    resolvedAt: null,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "ASSIGNED",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: agenteId,
                    detalle: { eventoId, agenteId },
                },
            });

            await recalcularEstadoEvento(tx, eventoId, agenteId);

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignado: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error en asignación:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/internal/assign/route.ts
git commit -m "feat(api): asignacion no exclusiva en /internal/assign (upsert + recalcular)"
```

---

## Task 4: Reescribir `PATCH /api/internal/update-status` (parte del agente)

Ahora actualiza el estado de la asignación del agente (`EN_RUTA` / `RESUELTO` / `ABANDONADO`), valida la transición por agente y recalcula el evento.

**Files:**
- Modify: `apps/web/src/app/api/internal/update-status/route.ts` (reemplazo completo)

- [ ] **Step 1: Reemplazar el contenido del archivo**

Sobrescribir `apps/web/src/app/api/internal/update-status/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { EstadoAsignacion, EstadoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyInternalToken } from "@/lib/auth";
import { recalcularEstadoEvento } from "@/lib/asignaciones";

const ESTADOS_VALIDOS: EstadoAsignacion[] = [
    EstadoAsignacion.EN_RUTA,
    EstadoAsignacion.RESUELTO,
    EstadoAsignacion.ABANDONADO,
];

// Transiciones permitidas por agente: estadoActual -> estados destino válidos
const TRANSICIONES: Record<EstadoAsignacion, EstadoAsignacion[]> = {
    [EstadoAsignacion.ASIGNADO]: [
        EstadoAsignacion.EN_RUTA,
        EstadoAsignacion.ABANDONADO,
    ],
    [EstadoAsignacion.EN_RUTA]: [
        EstadoAsignacion.RESUELTO,
        EstadoAsignacion.ABANDONADO,
    ],
    [EstadoAsignacion.RESUELTO]: [],
    [EstadoAsignacion.ABANDONADO]: [],
};

export async function PATCH(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return NextResponse.json({ error: "Token requerido" }, { status: 401 });
        }

        const decoded = verifyInternalToken(token);
        if (!decoded) {
            return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
        }

        const { eventoId, agenteId, nuevoEstado } = await request.json();

        if (!eventoId || !agenteId || !nuevoEstado) {
            return NextResponse.json(
                { error: "eventoId, agenteId y nuevoEstado requeridos" },
                { status: 400 }
            );
        }

        if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
            return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
        }

        const evento = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { estado: true },
        });

        if (!evento) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        if (evento.estado === EstadoEvento.CANCELADO) {
            return NextResponse.json(
                { error: "El evento fue cancelado" },
                { status: 400 }
            );
        }

        const asignacion = await prisma.asignacionEvento.findUnique({
            where: { eventoId_agenteId: { eventoId, agenteId } },
        });

        if (!asignacion) {
            return NextResponse.json(
                { error: "No estás asignado a este evento" },
                { status: 400 }
            );
        }

        if (!TRANSICIONES[asignacion.estado].includes(nuevoEstado)) {
            return NextResponse.json(
                { error: "Transición no permitida" },
                { status: 400 }
            );
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.asignacionEvento.update({
                where: { eventoId_agenteId: { eventoId, agenteId } },
                data: {
                    estado: nuevoEstado as EstadoAsignacion,
                    resolvedAt:
                        nuevoEstado === EstadoAsignacion.RESUELTO
                            ? new Date()
                            : asignacion.resolvedAt,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "STATUS_CHANGED",
                    entidad: "AsignacionEvento",
                    entidadId: asignacion.id,
                    usuarioId: agenteId,
                    eventoId,
                    detalle: {
                        estadoAnterior: asignacion.estado,
                        nuevoEstado,
                    },
                },
            });

            await recalcularEstadoEvento(tx, eventoId, agenteId);

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignado: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error al actualizar estado:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

Nota: `LogAuditoria` admite `eventoId` (relación opcional "EventoLogs"), por eso lo incluimos para que la transición por agente quede vinculada al evento.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/internal/update-status/route.ts
git commit -m "feat(api): /internal/update-status maneja estado por agente y recalcula evento"
```

---

## Task 5: Socket-server — `api-client.ts` y `handlers.ts`

**Files:**
- Modify: `services/socket-server/src/lib/api-client.ts:84-96` (función `actualizarEstadoEvento`)
- Modify: `services/socket-server/src/socket/handlers.ts`

- [ ] **Step 1: Renombrar el campo del body en `actualizarEstadoEvento`**

En `services/socket-server/src/lib/api-client.ts`, reemplazar la función `actualizarEstadoEvento` por:

```typescript
export async function actualizarEstadoEvento(
  eventoId: string,
  nuevoEstado: string,
  agenteId: string
) {
  return callNextAPI<{ evento: unknown; success: boolean }>(
    "/api/internal/update-status",
    "PATCH",
    { eventoId, nuevoEstado, agenteId }
  );
}
```

- [ ] **Step 2: Actualizar `ESTADOS_VALIDOS` en handlers**

En `services/socket-server/src/socket/handlers.ts`, reemplazar:

```typescript
const ESTADOS_VALIDOS = ["EN_RUTA", "RESUELTO", "CANCELADO"] as const;
```

por:

```typescript
const ESTADOS_VALIDOS = ["EN_RUTA", "RESUELTO", "ABANDONADO"] as const;
```

- [ ] **Step 3: Ajustar el mensaje de error de asignación**

En `services/socket-server/src/socket/handlers.ts`, dentro del handler de `evento:asignar`, reemplazar:

```typescript
                } else {
                    socket.emit("evento:asignado-error", {
                        mensaje: "El evento ya fue asignado a otro agente",
                    });
                }
```

por:

```typescript
                } else {
                    socket.emit("evento:asignado-error", {
                        mensaje: "El evento ya no admite agentes",
                    });
                }
```

(El resto del handler de `evento:asignar` no cambia: sigue llamando `asignarEventoAtomico(eventoId, user.sub)` y emitiendo `evento:asignado-exito` + `evento:actualizado`.)

- [ ] **Step 4: Typecheck del socket-server**

Run: `npx tsc --noEmit -p services/socket-server/tsconfig.json`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add services/socket-server/src/lib/api-client.ts services/socket-server/src/socket/handlers.ts
git commit -m "feat(socket): estado por agente (ABANDONADO) y agenteId en update-status"
```

---

## Task 6: Socket-server — ruta interna `POST /internal/evento-actualizado`

Permite que las acciones del admin (vía web) se difundan en tiempo real.

**Files:**
- Modify: `services/socket-server/src/routes/internal.ts`

- [ ] **Step 1: Agregar la ruta**

En `services/socket-server/src/routes/internal.ts`, después del bloque `router.post("/internal/events", ...)`, agregar:

```typescript
router.post(
    "/internal/evento-actualizado",
    authenticateInternal,
    (req: Request, res: Response) => {
        const { evento } = req.body;

        if (!evento) {
            return res.status(400).json({ error: "Datos de evento requeridos" });
        }

        req.app.get("io").emit("evento:actualizado", { evento });

        res.json({ success: true });
    }
);
```

- [ ] **Step 2: Typecheck del socket-server**

Run: `npx tsc --noEmit -p services/socket-server/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add services/socket-server/src/routes/internal.ts
git commit -m "feat(socket): ruta interna /internal/evento-actualizado para broadcast"
```

---

## Task 7: Helper `notifyEventoActualizado` (web → socket)

**Files:**
- Create: `apps/web/src/lib/socket-notify.ts`

- [ ] **Step 1: Crear el helper**

Crear `apps/web/src/lib/socket-notify.ts`:

```typescript
import { generateInternalToken } from "@/lib/auth";

/**
 * Notifica al socket-server que un evento cambió, para que difunda
 * "evento:actualizado" a todos los clientes conectados.
 * Falla en silencio (log) para no romper la respuesta HTTP al cliente.
 */
export async function notifyEventoActualizado(evento: unknown): Promise<void> {
    try {
        const socketUrl =
            process.env.SOCKET_SERVER_INTERNAL_URL || "http://localhost:4000";
        const token = await generateInternalToken();
        await fetch(`${socketUrl}/internal/evento-actualizado`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ evento }),
        });
    } catch (error) {
        console.error("Error notificando al socket server:", error);
    }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/socket-notify.ts
git commit -m "feat(lib): helper notifyEventoActualizado para broadcast desde la web"
```

---

## Task 8: Endpoints de admin — agregar / quitar agente

**Files:**
- Create: `apps/web/src/app/api/events/[id]/asignaciones/route.ts`
- Create: `apps/web/src/app/api/events/[id]/asignaciones/[agenteId]/route.ts`

- [ ] **Step 1: Crear `POST /api/events/[id]/asignaciones`**

Crear `apps/web/src/app/api/events/[id]/asignaciones/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { EstadoAsignacion, EstadoEvento, Rol } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { recalcularEstadoEvento } from "@/lib/asignaciones";
import { notifyEventoActualizado } from "@/lib/socket-notify";

const ESTADOS_UNIBLES: EstadoEvento[] = [
    EstadoEvento.PENDIENTE,
    EstadoEvento.ASIGNADO,
    EstadoEvento.EN_RUTA,
];

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const eventoId = params.id;
        const { agenteId } = await request.json();

        if (!agenteId) {
            return NextResponse.json(
                { error: "agenteId requerido" },
                { status: 400 }
            );
        }

        const [evento, agente] = await Promise.all([
            prisma.evento.findUnique({
                where: { id: eventoId },
                select: { estado: true },
            }),
            prisma.user.findUnique({
                where: { id: agenteId },
                select: { rol: true, activo: true },
            }),
        ]);

        if (!evento) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        if (!agente || agente.rol !== Rol.AGENT || !agente.activo) {
            return NextResponse.json(
                { error: "Agente no válido" },
                { status: 400 }
            );
        }

        if (!ESTADOS_UNIBLES.includes(evento.estado)) {
            return NextResponse.json(
                { error: "El evento ya no admite agentes" },
                { status: 400 }
            );
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.asignacionEvento.upsert({
                where: { eventoId_agenteId: { eventoId, agenteId } },
                create: {
                    eventoId,
                    agenteId,
                    estado: EstadoAsignacion.ASIGNADO,
                    resolvedAt: null,
                },
                update: {
                    estado: EstadoAsignacion.ASIGNADO,
                    resolvedAt: null,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "ASSIGNED",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: auth.user.sub,
                    detalle: { eventoId, agenteId, porAdmin: true },
                },
            });

            await recalcularEstadoEvento(tx, eventoId, auth.user.sub);

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignado: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        await notifyEventoActualizado(eventoActualizado);

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error al agregar agente:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Crear `DELETE /api/events/[id]/asignaciones/[agenteId]`**

Crear `apps/web/src/app/api/events/[id]/asignaciones/[agenteId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { EstadoAsignacion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { recalcularEstadoEvento } from "@/lib/asignaciones";
import { notifyEventoActualizado } from "@/lib/socket-notify";

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string; agenteId: string } }
) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const { id: eventoId, agenteId } = params;

        const asignacion = await prisma.asignacionEvento.findUnique({
            where: { eventoId_agenteId: { eventoId, agenteId } },
        });

        if (!asignacion) {
            return NextResponse.json(
                { error: "El agente no está asignado a este evento" },
                { status: 404 }
            );
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.asignacionEvento.update({
                where: { eventoId_agenteId: { eventoId, agenteId } },
                data: { estado: EstadoAsignacion.ABANDONADO },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "UNASSIGNED",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: auth.user.sub,
                    detalle: { eventoId, agenteId, porAdmin: true },
                },
            });

            await recalcularEstadoEvento(tx, eventoId, auth.user.sub);

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignado: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        await notifyEventoActualizado(eventoActualizado);

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error al quitar agente:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/events/\[id\]/asignaciones/
git commit -m "feat(api): endpoints admin para agregar y quitar agentes de un evento"
```

---

## Task 9: `PATCH /api/events/[id]` — admin cancela el evento

**Files:**
- Modify: `apps/web/src/app/api/events/[id]/route.ts` (agregar `PATCH`, mantener `GET`)

- [ ] **Step 1: Agregar imports y el handler `PATCH`**

En `apps/web/src/app/api/events/[id]/route.ts`, reemplazar la línea de imports superior:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
```

por:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { EstadoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { requireAdmin } from "@/lib/api-auth";
import { notifyEventoActualizado } from "@/lib/socket-notify";
```

Luego, al final del archivo (después del cierre de la función `GET`), agregar:

```typescript
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const eventoId = params.id;
        const { estado } = await request.json();

        if (estado !== EstadoEvento.CANCELADO) {
            return NextResponse.json(
                { error: "Solo se permite cancelar el evento" },
                { status: 400 }
            );
        }

        const actual = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { estado: true },
        });

        if (!actual) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        if (
            actual.estado === EstadoEvento.RESUELTO ||
            actual.estado === EstadoEvento.CANCELADO
        ) {
            return NextResponse.json(
                { error: "El evento ya está finalizado" },
                { status: 400 }
            );
        }

        const eventoActualizado = await prisma.$transaction(async (tx) => {
            await tx.evento.update({
                where: { id: eventoId },
                data: { estado: EstadoEvento.CANCELADO },
            });

            await tx.estadoHistorial.create({
                data: {
                    eventoId,
                    estado: EstadoEvento.CANCELADO,
                    usuarioId: auth.user.sub,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "STATUS_CHANGED",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: auth.user.sub,
                    detalle: {
                        estadoAnterior: actual.estado,
                        nuevoEstado: EstadoEvento.CANCELADO,
                        porAdmin: true,
                    },
                },
            });

            return tx.evento.findUnique({
                where: { id: eventoId },
                include: {
                    creador: true,
                    asignado: true,
                    asignaciones: { include: { agente: true } },
                },
            });
        });

        await notifyEventoActualizado(eventoActualizado);

        return NextResponse.json({ success: true, evento: eventoActualizado });
    } catch (error) {
        console.error("Error al cancelar evento:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/events/\[id\]/route.ts
git commit -m "feat(api): PATCH /events/[id] permite al admin cancelar un evento"
```

---

## Task 10: `types/index.ts` — incluir `asignaciones` (aditivo)

**Files:**
- Modify: `apps/web/src/types/index.ts`

- [ ] **Step 1: Actualizar imports y tipos de relación**

En `apps/web/src/types/index.ts`, reemplazar la línea de import:

```typescript
import { Prisma, Rol, NivelUrgencia, EstadoEvento } from "@prisma/client";
```

por:

```typescript
import { Prisma, Rol, NivelUrgencia, EstadoEvento, EstadoAsignacion } from "@prisma/client";

export { EstadoAsignacion };
```

Reemplazar `EventoWithRelations` y `EventoWithHistorial` por (se mantiene `asignado` durante la transición):

```typescript
export type EventoWithRelations = Prisma.EventoGetPayload<{
    include: {
        creador: true;
        asignado: true;
        asignaciones: { include: { agente: true } };
    };
}>;

export type EventoWithHistorial = Prisma.EventoGetPayload<{
    include: {
        creador: true;
        asignado: true;
        asignaciones: { include: { agente: true } };
        estadosHistorial: {
            include: { usuario: true };
        };
    };
}>;
```

- [ ] **Step 2: Agregar `asignaciones` a la interfaz `Evento`**

En la interfaz `Evento`, después de la línea `asignadoId?: string;` agregar:

```typescript
  asignaciones?: Array<{
    id: string;
    agenteId: string;
    estado: EstadoAsignacion;
    agente?: { nombre: string };
  }>;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores (cambios aditivos; los consumidores siguen viendo `asignado`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/types/index.ts
git commit -m "feat(types): exponer asignaciones en EventoWithRelations/Historial"
```

---

## Task 11: Ajustar queries GET (includes y filtros)

Se agrega `asignaciones: { include: { agente: true } }` a los `include` y se cambian los filtros por `asignadoId` a filtros relacionales. Se mantiene `asignado: true` por ahora.

**Files:**
- Modify: `apps/web/src/app/api/events/route.ts` (GET: include + filtro; POST: include de la respuesta)
- Modify: `apps/web/src/app/api/events/[id]/route.ts` (GET: include)
- Modify: `apps/web/src/app/api/agent/history/route.ts`
- Modify: `apps/web/src/app/api/admin/stats/kpis/route.ts`
- Modify: `apps/web/src/app/dashboard/admin/page.tsx`
- Modify: `apps/web/src/app/dashboard/agent/page.tsx`
- Modify: `apps/web/src/app/dashboard/agent/history/page.tsx`
- Modify: `apps/web/src/app/dashboard/admin/events/page.tsx`

- [ ] **Step 1: `api/events/route.ts` — filtro `asignadoId` relacional + include**

En la función `GET`, reemplazar:

```typescript
        if (asignadoId) where.asignadoId = asignadoId;
```

por:

```typescript
        if (asignadoId) {
            where.asignaciones = {
                some: { agenteId: asignadoId, estado: { not: "ABANDONADO" } },
            };
        }
```

Y en el `findMany`, reemplazar `include: { creador: true, asignado: true },` por:

```typescript
                include: {
                    creador: true,
                    asignado: true,
                    asignaciones: { include: { agente: true } },
                },
```

- [ ] **Step 1b: `api/events/route.ts` — include de la respuesta del POST**

El `evento:nuevo` que se difunde por socket viene de la respuesta del `POST`, por lo que también debe traer `asignaciones` (si no, los clientes recibirían `asignaciones === undefined` y romperían). En la función `POST`, dentro del `prisma.evento.create`, reemplazar `include: { creador: true, asignado: true },` por:

```typescript
            include: {
                creador: true,
                asignado: true,
                asignaciones: { include: { agente: true } },
            },
```

- [ ] **Step 2: `api/events/[id]/route.ts` — include del GET**

En el `findUnique` de la función `GET`, reemplazar:

```typescript
            include: {
                creador: true,
                asignado: true,
                estadosHistorial: {
                    include: { usuario: true },
                    orderBy: { timestamp: "asc" },
                },
            },
```

por:

```typescript
            include: {
                creador: true,
                asignado: true,
                asignaciones: { include: { agente: true } },
                estadosHistorial: {
                    include: { usuario: true },
                    orderBy: { timestamp: "asc" },
                },
            },
```

- [ ] **Step 3: `api/agent/history/route.ts` — filtrar por asignación RESUELTO**

Reemplazar el `findMany` completo por:

```typescript
        const eventos = await prisma.evento.findMany({
            where: {
                asignaciones: {
                    some: {
                        agenteId: auth.user.sub,
                        estado: "RESUELTO",
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
            include: {
                creador: true,
                asignado: true,
                asignaciones: { include: { agente: true } },
            },
        });
```

- [ ] **Step 4: `api/admin/stats/kpis/route.ts` — `pendientesSinAsignar`**

Reemplazar:

```typescript
                prisma.evento.count({
                    where: {
                        estado: EstadoEvento.PENDIENTE,
                        asignadoId: null,
                    },
                }),
```

por:

```typescript
                prisma.evento.count({
                    where: { estado: EstadoEvento.PENDIENTE },
                }),
```

- [ ] **Step 5: `dashboard/admin/page.tsx` — KPI y include de recientes**

Reemplazar:

```typescript
        prisma.evento.count({
            where: {
                estado: EstadoEvento.PENDIENTE,
                asignadoId: null,
            },
        }),
```

por:

```typescript
        prisma.evento.count({
            where: { estado: EstadoEvento.PENDIENTE },
        }),
```

Y en el `findMany` de `recentEventos`, reemplazar `include: { creador: true, asignado: true },` por:

```typescript
            include: {
                creador: true,
                asignado: true,
                asignaciones: { include: { agente: true } },
            },
```

- [ ] **Step 6: `dashboard/agent/page.tsx` — query de "mis eventos"**

Reemplazar el `findMany` por:

```typescript
    const eventos = await prisma.evento.findMany({
        where: {
            asignaciones: {
                some: { agenteId: decoded.sub, estado: { not: "ABANDONADO" } },
            },
        },
        orderBy: { createdAt: "desc" },
        include: {
            creador: true,
            asignado: true,
            asignaciones: { include: { agente: true } },
        },
    });
```

- [ ] **Step 7: `dashboard/agent/history/page.tsx` — query de historial**

Reemplazar el `findMany` por:

```typescript
    const eventos = await prisma.evento.findMany({
        where: {
            asignaciones: {
                some: { agenteId: decoded.sub, estado: "RESUELTO" },
            },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: {
            creador: true,
            asignado: true,
            asignaciones: { include: { agente: true } },
        },
    });
```

El import `EstadoEvento` puede quedar sin uso en este archivo; si el typecheck lo marca, eliminarlo del import `import { EstadoEvento, Rol } from "@prisma/client";` dejando `import { Rol } from "@prisma/client";`.

- [ ] **Step 8: `dashboard/admin/events/page.tsx` — include**

Reemplazar el `findMany` por:

```typescript
    const eventos = await prisma.evento.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            creador: true,
            asignado: true,
            asignaciones: { include: { agente: true } },
        },
    });
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/api/events/route.ts apps/web/src/app/api/events/\[id\]/route.ts apps/web/src/app/api/agent/history/route.ts apps/web/src/app/api/admin/stats/kpis/route.ts apps/web/src/app/dashboard/
git commit -m "feat(api): includes y filtros relacionales por asignaciones"
```

---

## Task 12: `lib/theme.ts` — labels y variantes de `EstadoAsignacion`

**Files:**
- Modify: `apps/web/src/lib/theme.ts`

- [ ] **Step 1: Agregar import y mapas**

En `apps/web/src/lib/theme.ts`, reemplazar la primera línea:

```typescript
import { NivelUrgencia, EstadoEvento } from "@prisma/client";
```

por:

```typescript
import { NivelUrgencia, EstadoEvento, EstadoAsignacion } from "@prisma/client";
```

Y al final del archivo agregar:

```typescript
export const estadoAsignacionLabel: Record<EstadoAsignacion, string> = {
    [EstadoAsignacion.ASIGNADO]: "Asignado",
    [EstadoAsignacion.EN_RUTA]: "En ruta",
    [EstadoAsignacion.RESUELTO]: "Resuelto",
    [EstadoAsignacion.ABANDONADO]: "Abandonado",
};

export const estadoAsignacionBadgeVariant: Record<
    EstadoAsignacion,
    "default" | "secondary" | "outline" | "destructive"
> = {
    [EstadoAsignacion.ASIGNADO]: "secondary",
    [EstadoAsignacion.EN_RUTA]: "default",
    [EstadoAsignacion.RESUELTO]: "outline",
    [EstadoAsignacion.ABANDONADO]: "destructive",
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/theme.ts
git commit -m "feat(theme): labels y variantes de badge para EstadoAsignacion"
```

---

## Task 13: `EventList.tsx` — resumen de agentes asignados

**Files:**
- Modify: `apps/web/src/components/EventList.tsx`

Nota: `RecentEventsTable.tsx` no requiere cambios — delega por completo en `EventList`, así que hereda el nuevo resumen de agentes automáticamente.

- [ ] **Step 1: Agregar helper de resumen**

En `apps/web/src/components/EventList.tsx`, después de la función `formatDate` (antes de `export default function EventList`), agregar:

```typescript
function resumenAgentes(
    asignaciones: EventoWithRelations["asignaciones"]
): string {
    const activas = asignaciones.filter((a) => a.estado !== "ABANDONADO");
    if (activas.length === 0) return "—";
    const nombres = activas.map((a) => a.agente.nombre);
    if (nombres.length <= 2) return nombres.join(", ");
    return `${nombres.slice(0, 2).join(", ")} (+${nombres.length - 2})`;
}
```

- [ ] **Step 2: Usar el helper en la tabla (desktop)**

Reemplazar la celda:

```typescript
                                {!isCompact && (
                                    <TableCell className="text-muted-foreground">
                                        {evento.asignado?.nombre || "—"}
                                    </TableCell>
                                )}
```

por:

```typescript
                                {!isCompact && (
                                    <TableCell className="text-muted-foreground">
                                        {resumenAgentes(evento.asignaciones)}
                                    </TableCell>
                                )}
```

- [ ] **Step 3: Usar el helper en las cards (mobile)**

Reemplazar:

```typescript
                                <span className="text-sm">
                                    {evento.asignado?.nombre || "—"}
                                </span>
```

por:

```typescript
                                <span className="text-sm">
                                    {resumenAgentes(evento.asignaciones)}
                                </span>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EventList.tsx
git commit -m "feat(ui): EventList muestra resumen de agentes asignados"
```

---

## Task 14: `AgentDashboardClient.tsx` — disponibles, mis eventos y botones por agente

**Files:**
- Modify: `apps/web/src/components/AgentDashboardClient.tsx` (reemplazo completo)

- [ ] **Step 1: Reemplazar el componente completo**

Sobrescribir `apps/web/src/components/AgentDashboardClient.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { NivelUrgencia, EstadoAsignacion } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { urgenciaBadgeVariant, urgenciaLabel } from "@/lib/theme";
import EventNotification from "@/components/EventNotification";
import { AddressLink } from "./AddressLink";

interface Props {
    initialEventos: EventoWithRelations[];
    userId: string;
    socketUrl: string;
}

const ESTADOS_UNIBLES = ["PENDIENTE", "ASIGNADO", "EN_RUTA"];

function formatCreatedAt(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function AgentDashboardClient({
    initialEventos,
    userId,
    socketUrl,
}: Props) {
    const [eventos, setEventos] =
        useState<EventoWithRelations[]>(initialEventos);
    const [pendientes, setPendientes] = useState<EventoWithRelations[]>([]);
    const { socket, connected } = useSocket(socketUrl);

    const tieneAsignacionActiva = (e: EventoWithRelations) =>
        e.asignaciones.some(
            (a) => a.agenteId === userId && a.estado !== "ABANDONADO"
        );

    const miEstado = (e: EventoWithRelations): EstadoAsignacion | undefined =>
        e.asignaciones.find((a) => a.agenteId === userId)?.estado;

    const otrosActivos = (e: EventoWithRelations) =>
        e.asignaciones.filter(
            (a) => a.agenteId !== userId && a.estado !== "ABANDONADO"
        ).length;

    useEffect(() => {
        // "Disponibles": eventos unibles donde el agente no participa.
        Promise.all([
            fetch("/api/events?estado=PENDIENTE").then((r) => r.json()),
            fetch("/api/events?estado=ASIGNADO").then((r) => r.json()),
            fetch("/api/events?estado=EN_RUTA").then((r) => r.json()),
        ])
            .then(([p, a, e]) => {
                const todos: EventoWithRelations[] = [
                    ...(p.data || []),
                    ...(a.data || []),
                    ...(e.data || []),
                ];
                setPendientes(todos.filter((ev) => !tieneAsignacionActiva(ev)));
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleNuevo = ({ evento }: { evento: EventoWithRelations }) => {
            setPendientes((prev) => [evento, ...prev]);
        };

        const handleActualizado = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setEventos((prev) => {
                if (tieneAsignacionActiva(evento)) {
                    return prev.some((e) => e.id === evento.id)
                        ? prev.map((e) => (e.id === evento.id ? evento : e))
                        : [evento, ...prev];
                }
                return prev.filter((e) => e.id !== evento.id);
            });

            setPendientes((prev) => {
                const mostrar =
                    ESTADOS_UNIBLES.includes(evento.estado) &&
                    !tieneAsignacionActiva(evento);
                if (mostrar) {
                    return prev.some((e) => e.id === evento.id)
                        ? prev.map((e) => (e.id === evento.id ? evento : e))
                        : [evento, ...prev];
                }
                return prev.filter((e) => e.id !== evento.id);
            });
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
        };
    }, [socket, userId]);

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
                <h2 className="text-xl font-bold text-foreground">
                    Panel de Agente
                </h2>
                <div className="flex items-center gap-2">
                    <div
                        className={`h-3 w-3 rounded-full ${
                            connected
                                ? "bg-green-500 animate-pulse"
                                : "bg-destructive"
                        }`}
                    />
                    <span className="text-sm text-muted-foreground">
                        {connected ? "Conectado" : "Desconectado"}
                    </span>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                    Disponibles
                </h3>
                {pendientes.length === 0 ? (
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground text-sm">
                                No hay eventos disponibles.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {pendientes.map((evento) => (
                            <Card key={evento.id}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-foreground text-sm">
                                            {evento.titulo}
                                        </h4>
                                        <Badge
                                            variant={
                                                urgenciaBadgeVariant[
                                                    evento.nivelUrgencia as NivelUrgencia
                                                ]
                                            }
                                        >
                                            {urgenciaLabel[
                                                evento.nivelUrgencia as NivelUrgencia
                                            ] || evento.nivelUrgencia}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-1">
                                        <AddressLink
                                            direccion={evento.direccionExacta}
                                            coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                        />
                                    </p>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Por {evento.creador.nombre} · {formatCreatedAt(evento.createdAt)}
                                        {otrosActivos(evento) > 0 &&
                                            ` · ${otrosActivos(evento)} agente(s) en camino`}
                                    </p>
                                    <Button
                                        onClick={() => handleAsignar(evento.id)}
                                        className="w-full h-11 sm:h-9 text-sm"
                                    >
                                        Tomar caso
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                    Mis Eventos
                </h3>
                {eventos.length === 0 ? (
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground text-sm">
                                No tienes eventos asignados.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {eventos.map((evento) => {
                            const estadoAgente = miEstado(evento);
                            return (
                                <Card key={evento.id}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-semibold text-foreground text-sm">
                                                {evento.titulo}
                                            </h4>
                                            <Badge
                                                variant={
                                                    urgenciaBadgeVariant[
                                                        evento.nivelUrgencia as NivelUrgencia
                                                    ]
                                                }
                                            >
                                                {urgenciaLabel[
                                                    evento.nivelUrgencia as NivelUrgencia
                                                ] || evento.nivelUrgencia}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-1">
                                            <AddressLink
                                                direccion={evento.direccionExacta}
                                                coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                            />
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Por {evento.creador.nombre} · {formatCreatedAt(evento.createdAt)}
                                            {otrosActivos(evento) > 0 &&
                                                ` · Tú + ${otrosActivos(evento)} agente(s)`}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Mi estado:{" "}
                                            <span className="font-medium text-foreground">
                                                {estadoAgente}
                                            </span>
                                        </p>

                                        {estadoAgente ===
                                            EstadoAsignacion.ASIGNADO && (
                                            <Button
                                                onClick={() =>
                                                    handleCambiarEstado(
                                                        evento.id,
                                                        EstadoAsignacion.EN_RUTA
                                                    )
                                                }
                                                variant="default"
                                                className="w-full h-11 sm:h-9 text-sm bg-yellow-600 hover:bg-yellow-700"
                                            >
                                                Marcar En Ruta
                                            </Button>
                                        )}

                                        {estadoAgente ===
                                            EstadoAsignacion.EN_RUTA && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoAsignacion.RESUELTO
                                                        )
                                                    }
                                                    className="w-full h-11 sm:h-9 text-sm bg-green-600 hover:bg-green-700"
                                                >
                                                    Resolver
                                                </Button>
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoAsignacion.ABANDONADO
                                                        )
                                                    }
                                                    variant="destructive"
                                                    className="w-full h-11 sm:h-9 text-sm"
                                                >
                                                    Abandonar
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
            <EventNotification socket={socket} />
        </div>
    );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AgentDashboardClient.tsx
git commit -m "feat(ui): panel de agente con asignacion multiple y estado por agente"
```

---

## Task 15: `EventDetailModal.tsx` — sección "Agentes asignados" + controles de admin

**Files:**
- Modify: `apps/web/src/components/EventDetailModal.tsx`
- Modify: `apps/web/src/components/AdminDashboardClient.tsx` (pasar `isAdmin`)
- Modify: `apps/web/src/components/dashboard/AdminHomeClient.tsx` (pasar `isAdmin`)

- [ ] **Step 1: Reemplazar `EventDetailModal.tsx` completo**

Sobrescribir `apps/web/src/components/EventDetailModal.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { EstadoEvento, NivelUrgencia } from "@prisma/client";
import { toast } from "sonner";
import { EventoWithHistorial } from "@/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
    urgenciaBadgeVariant,
    urgenciaLabel,
    estadoBadgeVariant,
    estadoLabel,
    estadoAsignacionLabel,
    estadoAsignacionBadgeVariant,
} from "@/lib/theme";
import EventTimeline from "./EventTimeline";
import { AddressLink } from "./AddressLink";

const EventMapPreview = dynamic(
    () => import("./EventMapPreview").then((m) => m.EventMapPreview),
    { ssr: false }
);

interface AgenteOption {
    id: string;
    nombre: string;
}

interface EventDetailModalProps {
    eventoId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    refreshVersion: number;
    isAdmin?: boolean;
}

const ESTADOS_UNIBLES: string[] = ["PENDIENTE", "ASIGNADO", "EN_RUTA"];

export default function EventDetailModal({
    eventoId,
    open,
    onOpenChange,
    refreshVersion,
    isAdmin = false,
}: EventDetailModalProps) {
    const [evento, setEvento] = useState<EventoWithHistorial | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localVersion, setLocalVersion] = useState(0);
    const [agentes, setAgentes] = useState<AgenteOption[]>([]);
    const [agenteSel, setAgenteSel] = useState<string>("");
    const [accionLoading, setAccionLoading] = useState(false);

    useEffect(() => {
        if (!open || !eventoId) return;

        const controller = new AbortController();

        setLoading(true);
        setEvento(null);
        setError(null);

        fetch(`/api/events/${eventoId}`, { signal: controller.signal })
            .then((res) => {
                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error("Evento no encontrado");
                    }
                    throw new Error("Error al cargar el evento");
                }
                return res.json();
            })
            .then((data) => {
                setEvento(data.evento);
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                setError(err.message || "Error al cargar el evento");
            })
            .finally(() => {
                setLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [eventoId, open, refreshVersion, localVersion]);

    useEffect(() => {
        if (!open || !isAdmin) return;
        fetch("/api/users/agents")
            .then((res) => res.json())
            .then((data) => setAgentes(data.data || []))
            .catch(console.error);
    }, [open, isAdmin]);

    function handleOpenChange(newOpen: boolean) {
        if (!newOpen) {
            setEvento(null);
            setError(null);
            setAgenteSel("");
        }
        onOpenChange(newOpen);
    }

    const refetch = useCallback(() => setLocalVersion((v) => v + 1), []);

    const agregarAgente = async () => {
        if (!eventoId || !agenteSel) return;
        setAccionLoading(true);
        try {
            const res = await fetch(`/api/events/${eventoId}/asignaciones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agenteId: agenteSel }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Agente agregado");
            setAgenteSel("");
            refetch();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al agregar");
        } finally {
            setAccionLoading(false);
        }
    };

    const quitarAgente = async (agenteId: string) => {
        if (!eventoId) return;
        setAccionLoading(true);
        try {
            const res = await fetch(
                `/api/events/${eventoId}/asignaciones/${agenteId}`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Agente quitado");
            refetch();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al quitar");
        } finally {
            setAccionLoading(false);
        }
    };

    const cancelarEvento = async () => {
        if (!eventoId) return;
        setAccionLoading(true);
        try {
            const res = await fetch(`/api/events/${eventoId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: EstadoEvento.CANCELADO }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Evento cancelado");
            refetch();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al cancelar");
        } finally {
            setAccionLoading(false);
        }
    };

    const asignacionesActivas =
        evento?.asignaciones.filter((a) => a.estado !== "ABANDONADO") ?? [];
    const idsActivos = new Set(asignacionesActivas.map((a) => a.agenteId));
    const agentesDisponibles = agentes.filter((a) => !idsActivos.has(a.id));
    const puedeUnir = evento ? ESTADOS_UNIBLES.includes(evento.estado) : false;
    const puedeCancelar =
        evento &&
        evento.estado !== EstadoEvento.RESUELTO &&
        evento.estado !== EstadoEvento.CANCELADO;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="sr-only">
                        Detalle de evento
                    </DialogTitle>
                </DialogHeader>

                {loading && (
                    <p className="text-muted-foreground text-sm text-center py-8">
                        Cargando...
                    </p>
                )}

                {error && (
                    <p className="text-destructive text-sm text-center py-8">
                        {error}
                    </p>
                )}

                {evento && (
                    <>
                        {/* Encabezado */}
                        <div className="mb-5 pb-4 border-b">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-foreground">
                                    {evento.titulo}
                                </h3>
                                <div className="flex gap-2">
                                    <Badge
                                        variant={
                                            estadoBadgeVariant[
                                                evento.estado as EstadoEvento
                                            ]
                                        }
                                    >
                                        {estadoLabel[evento.estado as EstadoEvento]}
                                    </Badge>
                                    <Badge
                                        variant={
                                            urgenciaBadgeVariant[
                                                evento.nivelUrgencia as NivelUrgencia
                                            ]
                                        }
                                    >
                                        {urgenciaLabel[
                                            evento.nivelUrgencia as NivelUrgencia
                                        ] || evento.nivelUrgencia}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex gap-5 text-sm text-muted-foreground">
                                <AddressLink
                                    direccion={evento.direccionExacta}
                                    coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                                />
                                {evento.telefonoContacto && (
                                    <span>{evento.telefonoContacto}</span>
                                )}
                            </div>
                        </div>

                        {/* Map preview (solo si hay coordenadas) */}
                        <EventMapPreview
                            coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
                            className="mb-5"
                        />

                        {/* Agentes asignados */}
                        <div className="mb-5">
                            <h4 className="text-sm font-semibold text-foreground mb-2">
                                Agentes asignados
                            </h4>
                            {asignacionesActivas.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Sin agentes asignados.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {asignacionesActivas.map((a) => (
                                        <li
                                            key={a.id}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <span className="text-sm text-foreground">
                                                {a.agente.nombre}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={
                                                        estadoAsignacionBadgeVariant[
                                                            a.estado
                                                        ]
                                                    }
                                                >
                                                    {estadoAsignacionLabel[a.estado]}
                                                </Badge>
                                                {isAdmin && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            quitarAgente(a.agenteId)
                                                        }
                                                        disabled={accionLoading}
                                                        aria-label="Quitar agente"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {isAdmin && puedeUnir && (
                                <div className="flex gap-2 mt-3">
                                    <Select
                                        value={agenteSel}
                                        onValueChange={setAgenteSel}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Agregar agente..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agentesDisponibles.map((a) => (
                                                <SelectItem
                                                    key={a.id}
                                                    value={a.id}
                                                >
                                                    {a.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={agregarAgente}
                                        disabled={!agenteSel || accionLoading}
                                    >
                                        Agregar
                                    </Button>
                                </div>
                            )}

                            {isAdmin && puedeCancelar && (
                                <Button
                                    variant="destructive"
                                    className="w-full mt-3"
                                    onClick={cancelarEvento}
                                    disabled={accionLoading}
                                >
                                    Cancelar evento
                                </Button>
                            )}
                        </div>

                        {/* Timeline */}
                        <EventTimeline
                            historial={evento.estadosHistorial || []}
                            creacion={
                                evento.creador
                                    ? {
                                          creador: {
                                              nombre: evento.creador.nombre,
                                              rol: evento.creador.rol,
                                          },
                                          createdAt: evento.createdAt,
                                      }
                                    : undefined
                            }
                        />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Pasar `isAdmin` desde `AdminDashboardClient.tsx`**

En `apps/web/src/components/AdminDashboardClient.tsx`, en el JSX de `<EventDetailModal ... />`, agregar la prop `isAdmin`:

```typescript
            <EventDetailModal
                eventoId={selectedEventId}
                open={modalOpen}
                onOpenChange={handleModalOpenChange}
                refreshVersion={refreshVersion}
                isAdmin
            />
```

- [ ] **Step 3: Pasar `isAdmin` desde `AdminHomeClient.tsx`**

En `apps/web/src/components/dashboard/AdminHomeClient.tsx`, localizar el `<EventDetailModal ... />` (línea ~125) y agregar la prop `isAdmin` igual que en el paso anterior (mantener las props existentes que ya tenga, solo añadir `isAdmin`).

- [ ] **Step 4: Verificar que el componente Select está instalado**

Run: `ls apps/web/src/components/ui/select.tsx`
Expected: el archivo existe (ya está en el repo). Si no existiera, instalar con `npx shadcn add select` dentro de `apps/web`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/EventDetailModal.tsx apps/web/src/components/AdminDashboardClient.tsx apps/web/src/components/dashboard/AdminHomeClient.tsx
git commit -m "feat(ui): modal con agentes asignados y controles de admin (agregar/quitar/cancelar)"
```

---

## Task 16: Script de migración de datos

Backfill de `AsignacionEvento` desde `asignadoId`. Idempotente. Debe ejecutarse **mientras `asignadoId` todavía existe en el schema** (antes de Task 17).

**Files:**
- Create: `apps/web/scripts/migrate-asignaciones.ts`
- Modify: `apps/web/package.json` (script `migrate:asignaciones`)

- [ ] **Step 1: Crear el script**

Crear `apps/web/scripts/migrate-asignaciones.ts`:

```typescript
import {
    PrismaClient,
    EstadoEvento,
    EstadoAsignacion,
} from "@prisma/client";

const prisma = new PrismaClient();

function mapEstado(estado: EstadoEvento): EstadoAsignacion {
    switch (estado) {
        case EstadoEvento.EN_RUTA:
            return EstadoAsignacion.EN_RUTA;
        case EstadoEvento.RESUELTO:
            return EstadoAsignacion.RESUELTO;
        case EstadoEvento.CANCELADO:
            return EstadoAsignacion.ABANDONADO;
        default:
            // PENDIENTE (inconsistente con asignadoId) o ASIGNADO
            return EstadoAsignacion.ASIGNADO;
    }
}

async function main() {
    const eventos = await prisma.evento.findMany({
        where: { asignadoId: { not: null } },
        select: {
            id: true,
            asignadoId: true,
            estado: true,
            assignedAt: true,
            createdAt: true,
            resolvedAt: true,
        },
    });

    console.log(`Encontrados ${eventos.length} eventos con asignadoId.`);

    let creadas = 0;
    let omitidas = 0;

    for (const evento of eventos) {
        const agenteId = evento.asignadoId;
        if (!agenteId) continue;

        const existente = await prisma.asignacionEvento.findUnique({
            where: { eventoId_agenteId: { eventoId: evento.id, agenteId } },
        });

        if (existente) {
            omitidas++;
            continue;
        }

        await prisma.asignacionEvento.create({
            data: {
                eventoId: evento.id,
                agenteId,
                estado: mapEstado(evento.estado),
                assignedAt: evento.assignedAt ?? evento.createdAt,
                resolvedAt: evento.resolvedAt ?? null,
            },
        });
        creadas++;
    }

    console.log(`Asignaciones creadas: ${creadas} | omitidas (ya existían): ${omitidas}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
```

- [ ] **Step 2: Agregar el script npm**

En `apps/web/package.json`, dentro de `"scripts"`, agregar tras `"test:derivar"`:

```json
    "migrate:asignaciones": "tsx scripts/migrate-asignaciones.ts"
```

(Recordar la coma en la línea anterior.)

- [ ] **Step 3: Ejecutar la migración (requiere MongoDB con datos)**

Run: `npm run migrate:asignaciones -w apps/web`
Expected: imprime el conteo de eventos encontrados y de asignaciones creadas/omitidas, sin errores.

- [ ] **Step 4: Verificar idempotencia (segunda corrida)**

Run: `npm run migrate:asignaciones -w apps/web`
Expected: ahora todas aparecen como "omitidas (ya existían)"; creadas = 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts/migrate-asignaciones.ts apps/web/package.json
git commit -m "chore(migracion): backfill de AsignacionEvento desde asignadoId"
```

---

## Task 17: Limpieza — eliminar `asignadoId` / `asignado` del schema y del código

Ejecutar **solo después** de correr la migración (Task 16) y verificar la app en QA. Elimina los campos legados y compila sin ellos.

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `services/socket-server/prisma/schema.prisma`
- Modify: `apps/web/src/types/index.ts`
- Modify: includes en: `apps/web/src/app/api/events/route.ts`, `apps/web/src/app/api/events/[id]/route.ts`, `apps/web/src/app/api/internal/assign/route.ts`, `apps/web/src/app/api/internal/update-status/route.ts`, `apps/web/src/app/api/agent/history/route.ts`, `apps/web/src/app/dashboard/admin/page.tsx`, `apps/web/src/app/dashboard/agent/page.tsx`, `apps/web/src/app/dashboard/agent/history/page.tsx`, `apps/web/src/app/dashboard/admin/events/page.tsx`
- Create: `apps/web/scripts/unset-asignado.ts`

- [ ] **Step 1: Eliminar los campos legados de `Evento` y `User` (ambos schemas)**

En `apps/web/prisma/schema.prisma`, dentro de `model Evento`, eliminar estas tres líneas:

```prisma
  asignadoId       String?       @db.ObjectId
  asignado         User?         @relation("Asignado", fields: [asignadoId], references: [id])
```
y
```prisma
  @@index([asignadoId])
```

Dentro de `model User`, eliminar:

```prisma
  eventosAsignados Evento[] @relation("Asignado")
```

Aplicar exactamente lo mismo en `services/socket-server/prisma/schema.prisma`. Verificar que quedan idénticos:

Run: `diff apps/web/prisma/schema.prisma services/socket-server/prisma/schema.prisma && echo "IDÉNTICOS"`
Expected: `IDÉNTICOS`.

- [ ] **Step 2: Regenerar el cliente Prisma**

Run:
```bash
npm run db:push -w apps/web
npm run db:generate -w apps/web
npm run db:generate -w services/socket-server
```
Expected: sin errores.

- [ ] **Step 3: Quitar `asignado: true` de todos los `include`**

Buscar las ocurrencias:

Run: `grep -rn "asignado: true" apps/web/src`
Expected: lista de líneas en los archivos de API y dashboard.

Eliminar la línea `asignado: true,` en cada `include` listado (en `events/route.ts`, `events/[id]/route.ts`, `internal/assign/route.ts`, `internal/update-status/route.ts`, `agent/history/route.ts`, `admin/page.tsx`, `agent/page.tsx`, `agent/history/page.tsx`, `admin/events/page.tsx`). Cada `include` debe quedar como:

```typescript
include: {
    creador: true,
    asignaciones: { include: { agente: true } },
    // ...resto si lo hubiera (p. ej. estadosHistorial)
}
```

- [ ] **Step 4: Limpiar `types/index.ts`**

En `apps/web/src/types/index.ts`:

- En `EventoWithRelations` y `EventoWithHistorial`, eliminar la línea `asignado: true;`.
- En la interfaz `Evento`, eliminar la línea `asignadoId?: string;`.

- [ ] **Step 5: Verificar que no quedan referencias a `asignado`/`asignadoId`**

Run: `grep -rn "asignadoId\|\.asignado\b\|asignado: true" apps/web/src services/socket-server/src`
Expected: sin resultados (exit code 1). Si aparece alguno, eliminarlo.

- [ ] **Step 6: Crear el script de `$unset`**

Crear `apps/web/scripts/unset-asignado.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$runCommandRaw({
        update: "Evento",
        updates: [
            {
                q: { asignadoId: { $exists: true } },
                u: { $unset: { asignadoId: "" } },
                multi: true,
            },
        ],
    });
    console.log("Resultado $unset asignadoId:", JSON.stringify(result));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
```

Agregar en `apps/web/package.json` (tras `migrate:asignaciones`):

```json
    "unset:asignado": "tsx scripts/unset-asignado.ts"
```

- [ ] **Step 7: Ejecutar el `$unset`**

Run: `npm run unset:asignado -w apps/web`
Expected: imprime el resultado del comando (campo `nModified`/`modifiedCount`) sin errores.

- [ ] **Step 8: Typecheck de ambos proyectos**

Run:
```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p services/socket-server/tsconfig.json
```
Expected: ambos sin errores.

- [ ] **Step 9: Commit**

```bash
git add apps/web/prisma/schema.prisma services/socket-server/prisma/schema.prisma apps/web/src apps/web/scripts/unset-asignado.ts apps/web/package.json
git commit -m "refactor: eliminar campos legados asignadoId/asignado tras migracion"
```

---

## Task 18: QA manual de extremo a extremo

Verificación funcional con la app corriendo. No produce commits salvo correcciones.

**Setup:**

- [ ] **Step 1: Levantar el entorno**

Run: `npm run dev`
Expected: web en `:3000` y socket en `:4000` arriba. Tener tres sesiones de navegador: dos agentes (perfiles/incógnito distintos) y un admin.

- [ ] **Step 2: Recorrer el checklist del spec**

Verificar cada punto (sección "Testing" del spec):

1. Dos agentes pulsan "Tomar caso" en el mismo evento → ambos lo ven en "Mis Eventos"; el evento queda `ASIGNADO` para el admin.
2. Un agente marca "En Ruta" → el evento pasa a `EN_RUTA`; el otro sigue con su estado `ASIGNADO`.
3. Un tercer agente se une mientras está `EN_RUTA` → permitido (aparece en "Disponibles" y puede tomarlo).
4. Un agente resuelve su parte → el evento NO pasa a `RESUELTO` mientras queden agentes activos sin resolver.
5. Todos los activos resuelven → el evento pasa a `RESUELTO` y deja de admitir agentes.
6. Un agente pulsa "Abandonar" → desaparece de sus eventos; si era el último activo, el evento vuelve a `PENDIENTE` y reaparece en "Disponibles".
7. Desde el modal, el admin agrega un agente, quita un agente, y cancela un evento → estado `CANCELADO` terminal (ya no admite cambios).
8. Cada cambio anterior se refleja en tiempo real (sin recargar) en las otras sesiones.
9. El historial del agente muestra solo los eventos donde su parte quedó `RESUELTO`.
10. KPIs del admin: "Pendientes sin asignar" cuenta eventos `PENDIENTE`; "En proceso" cuenta `ASIGNADO` + `EN_RUTA`.

Expected: todos los puntos se comportan según lo descrito. Documentar cualquier desviación y corregir antes de cerrar el plan.

---

## Resumen de orden de ejecución

1. Schema aditivo (Task 1)
2. Lógica de derivación + test (Task 2)
3-4. Endpoints internos reescritos (Tasks 3-4)
5-6. Socket-server (Tasks 5-6)
7. Helper de notificación (Task 7)
8-9. Endpoints de admin (Tasks 8-9)
10-15. Tipos y frontend (Tasks 10-15)
16. Migración de datos (Task 16)
17. Limpieza de campos legados (Task 17) — **solo tras migrar y validar**
18. QA manual (Task 18)
</content>
