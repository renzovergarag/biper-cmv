# Eliminación lógica de eventos (soft delete) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un rol nuevo `SUPERADMIN` elimine eventos de forma lógica (quedan ocultos de todas las vistas pero persisten en BD), con registro en auditoría.

**Architecture:** Soft delete mediante `eliminadoAt`/`eliminadoPorId` en `Evento`. Rol nuevo `SUPERADMIN` que hereda todos los privilegios de `ADMIN` (los chequeos genéricos aceptan ambos) y suma dos acciones exclusivas (eliminar eventos, asignar el rol superadmin) protegidas con un helper estricto. Las lecturas filtran `eliminadoAt: null`; un endpoint `DELETE /api/events/[id]` marca el borrado y notifica por socket `evento:eliminado` para que las listas abiertas lo quiten en tiempo real.

**Tech Stack:** Next.js 14 (app router), TypeScript, Prisma 5 + MongoDB, Socket.io (servicio aparte), shadcn/ui, Tailwind, Zod, JWT (jose). Sin framework de tests: la verificación de cada tarea es manual (typecheck + `curl` + navegador).

**Spec de referencia:** `docs/superpowers/specs/2026-06-09-eliminacion-logica-eventos-design.md`

---

## Convenciones de verificación

- **Typecheck:** `npm run build:web` compila y typechequea. Para iteración rápida puedes usar `npx tsc --noEmit -p apps/web` desde la raíz.
- **Levantar todo (web + socket):** `npm run dev` desde la raíz (web en `http://localhost:3000`, socket en `http://localhost:4000`).
- **Token por `curl`:** la cookie `token` es `httpOnly`, así que se usa un cookie jar. Login (ajusta credenciales reales de tu BD):
  ```bash
  # Guarda la cookie de sesión en cookies-super.txt
  curl -s -c cookies-super.txt -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"super@ejemplo.cl","password":"TU_PASSWORD"}'
  ```
  Luego reusa con `-b cookies-super.txt` en las llamadas siguientes. Crea jars separados (`cookies-admin.txt`, `cookies-agent.txt`) para probar cada rol.

---

## Task 1: Schema — rol `SUPERADMIN` y campos de soft delete en `Evento`

**Files:**
- Modify: `apps/web/prisma/schema.prisma` (enum `Rol` ~línea 30, model `User` ~líneas 40-56, model `Evento` ~líneas 58-85)

- [ ] **Step 1: Agregar `SUPERADMIN` al enum `Rol`**

Localiza el enum `Rol` y déjalo así:

```prisma
enum Rol {
  ADMIN
  AGENT
  SUPERADMIN
}
```

- [ ] **Step 2: Agregar la relación inversa en `User`**

En el model `User`, junto a las otras relaciones (después de `eventosCreados`), agrega:

```prisma
  eventosEliminados Evento[] @relation("EventosEliminados")
```

- [ ] **Step 3: Agregar campos de soft delete e índice en `Evento`**

En el model `Evento`, agrega los tres campos (después de `resolvedAt`) y el índice (junto a los `@@index` existentes):

```prisma
  eliminadoAt      DateTime?
  eliminadoPor     User?     @relation("EventosEliminados", fields: [eliminadoPorId], references: [id])
  eliminadoPorId   String?   @db.ObjectId
```

```prisma
  @@index([eliminadoAt])
```

- [ ] **Step 4: Regenerar cliente Prisma y sincronizar BD**

Run: `npm run db:push && npm run db:generate`
Expected: `db push` aplica el schema a MongoDB sin error y `generate` imprime "Generated Prisma Client". Como es soft delete aditivo, no hay pérdida de datos.

- [ ] **Step 5: Verificar que el tipo `Rol` incluye `SUPERADMIN`**

Run: `npx tsc --noEmit -p apps/web`
Expected: compila sin errores (el cliente regenerado ya conoce `Rol.SUPERADMIN`, `eliminadoAt`, etc.).

- [ ] **Step 6: Commit**

```bash
git add apps/web/prisma/schema.prisma
git commit -m "feat(schema): rol SUPERADMIN y soft delete en Evento"
```

---

## Task 2: Autorización — `requireAdmin` acepta superadmin + `requireSuperAdmin`

**Files:**
- Modify: `apps/web/src/lib/api-auth.ts:43-58`
- Modify: `apps/web/src/lib/admin-auth.ts:11`

- [ ] **Step 1: Ampliar `requireAdmin` para aceptar `ADMIN` o `SUPERADMIN`**

Reemplaza la función `requireAdmin` (líneas 43-58) por:

```typescript
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
    const result = await requireAuth(request);
    if (!result.ok) return result;

    if (result.user.rol !== Rol.ADMIN && result.user.rol !== Rol.SUPERADMIN) {
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
```

- [ ] **Step 2: Agregar `requireSuperAdmin` (estricto)**

Justo debajo de `requireAdmin`, en el mismo archivo, agrega:

```typescript
export async function requireSuperAdmin(
    request: NextRequest
): Promise<AuthResult> {
    const result = await requireAuth(request);
    if (!result.ok) return result;

    if (result.user.rol !== Rol.SUPERADMIN) {
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
```

- [ ] **Step 3: Ampliar `verifyAdmin` para aceptar ambos roles**

En `apps/web/src/lib/admin-auth.ts`, reemplaza la línea 11:

```typescript
    if (!decoded || decoded.rol !== Rol.ADMIN) return null;
```

por:

```typescript
    if (
        !decoded ||
        (decoded.rol !== Rol.ADMIN && decoded.rol !== Rol.SUPERADMIN)
    )
        return null;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/web`
Expected: compila sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api-auth.ts apps/web/src/lib/admin-auth.ts
git commit -m "feat(auth): SUPERADMIN hereda admin y helper requireSuperAdmin"
```

---

## Task 3: Acceso — middleware y guards de páginas admin aceptan superadmin

**Files:**
- Modify: `apps/web/src/middleware.ts:20-30`
- Modify: `apps/web/src/app/dashboard/admin/events/page.tsx:18`
- Modify: `apps/web/src/app/dashboard/admin/users/page.tsx:14`

- [ ] **Step 1: Middleware — permitir `SUPERADMIN` en `/dashboard/admin`**

En `apps/web/src/middleware.ts`, reemplaza el bloque de la línea 20:

```typescript
    if (pathname.startsWith("/dashboard/admin") && decoded.rol !== Rol.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard/agent", request.url));
    }
```

por:

```typescript
    if (
        pathname.startsWith("/dashboard/admin") &&
        decoded.rol !== Rol.ADMIN &&
        decoded.rol !== Rol.SUPERADMIN
    ) {
        return NextResponse.redirect(new URL("/dashboard/agent", request.url));
    }
```

- [ ] **Step 2: Middleware — permitir `SUPERADMIN` en `/api/admin`**

En el mismo archivo, reemplaza el bloque de la línea 28:

```typescript
    if (pathname.startsWith("/api/admin") && decoded.rol !== Rol.ADMIN) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
```

por:

```typescript
    if (
        pathname.startsWith("/api/admin") &&
        decoded.rol !== Rol.ADMIN &&
        decoded.rol !== Rol.SUPERADMIN
    ) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
```

(La regla de `/dashboard/agent` en la línea 24 no cambia: un superadmin que entre ahí es redirigido a `/dashboard/admin`, que es lo deseado.)

- [ ] **Step 3: Guard de la página de eventos admin**

En `apps/web/src/app/dashboard/admin/events/page.tsx`, reemplaza la línea 18:

```typescript
    if (!decoded || decoded.rol !== Rol.ADMIN) {
```

por:

```typescript
    if (
        !decoded ||
        (decoded.rol !== Rol.ADMIN && decoded.rol !== Rol.SUPERADMIN)
    ) {
```

- [ ] **Step 4: Guard de la página de usuarios admin**

En `apps/web/src/app/dashboard/admin/users/page.tsx`, reemplaza la línea 14:

```typescript
    if (!decoded || decoded.rol !== Rol.ADMIN) redirect("/dashboard");
```

por:

```typescript
    if (
        !decoded ||
        (decoded.rol !== Rol.ADMIN && decoded.rol !== Rol.SUPERADMIN)
    )
        redirect("/dashboard");
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/web`
Expected: compila sin errores.

- [ ] **Step 6: Verificación manual en navegador**

Con un usuario `SUPERADMIN` (creado manualmente en BD) inicia sesión y visita `http://localhost:3000/dashboard/admin/events` y `/dashboard/admin/users`.
Expected: ambas cargan (no redirige a `/dashboard/agent`).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/app/dashboard/admin/events/page.tsx apps/web/src/app/dashboard/admin/users/page.tsx
git commit -m "feat(access): superadmin accede a rutas y páginas de admin"
```

---

## Task 4: Endpoint `DELETE /api/events/[id]` + helper de notificación + GET 404

**Files:**
- Modify: `apps/web/src/lib/socket-notify.ts` (agregar helper al final)
- Modify: `apps/web/src/app/api/events/[id]/route.ts:1-6` (imports), `:37-42` (GET 404), agregar `DELETE`

- [ ] **Step 1: Agregar `notifyEventoEliminado` en `socket-notify.ts`**

Al final de `apps/web/src/lib/socket-notify.ts`, agrega:

```typescript
/**
 * Notifica al socket-server que un evento fue eliminado lógicamente, para que
 * difunda "evento:eliminado" y los clientes lo quiten de sus listas.
 * Falla en silencio (log) para no romper la respuesta HTTP al cliente.
 */
export async function notifyEventoEliminado(eventoId: string): Promise<void> {
    try {
        const socketUrl =
            process.env.SOCKET_SERVER_INTERNAL_URL || "http://localhost:4000";
        const token = await generateInternalToken();
        await fetch(`${socketUrl}/internal/evento-eliminado`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id: eventoId }),
        });
    } catch (error) {
        console.error("Error notificando eliminación al socket server:", error);
    }
}
```

- [ ] **Step 2: Actualizar imports en `route.ts`**

En `apps/web/src/app/api/events/[id]/route.ts`, líneas 5-6, reemplaza:

```typescript
import { requireAdmin } from "@/lib/api-auth";
import { notifyEventoActualizado } from "@/lib/socket-notify";
```

por:

```typescript
import { requireAdmin, requireSuperAdmin } from "@/lib/api-auth";
import {
    notifyEventoActualizado,
    notifyEventoEliminado,
} from "@/lib/socket-notify";
```

- [ ] **Step 3: GET devuelve 404 si el evento está eliminado**

En el mismo archivo, reemplaza el bloque de la línea 37:

```typescript
        if (!evento) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }
```

por:

```typescript
        if (!evento || evento.eliminadoAt) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }
```

- [ ] **Step 4: Agregar el handler `DELETE`**

Al final del archivo (después del `PATCH`), agrega:

```typescript
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const eventoId = params.id;

        const actual = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { estado: true, titulo: true, eliminadoAt: true },
        });

        if (!actual) {
            return NextResponse.json(
                { error: "Evento no encontrado" },
                { status: 404 }
            );
        }

        if (actual.eliminadoAt) {
            return NextResponse.json(
                { error: "El evento ya fue eliminado" },
                { status: 409 }
            );
        }

        await prisma.$transaction(async (tx) => {
            await tx.evento.update({
                where: { id: eventoId },
                data: {
                    eliminadoAt: new Date(),
                    eliminadoPorId: auth.user.sub,
                },
            });

            await tx.logAuditoria.create({
                data: {
                    accion: "EVENTO_ELIMINADO",
                    entidad: "Evento",
                    entidadId: eventoId,
                    usuarioId: auth.user.sub,
                    eventoId,
                    detalle: {
                        titulo: actual.titulo,
                        estadoAlEliminar: actual.estado,
                    },
                },
            });
        });

        await notifyEventoEliminado(eventoId);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error al eliminar evento:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/web`
Expected: compila sin errores.

- [ ] **Step 6: Verificación manual con `curl` (autorización y efecto)**

Necesitas un `eventoId` real y los cookie jars de Task 3 (super/admin/agent). Con la app corriendo (`npm run dev`):

```bash
# Superadmin elimina -> 200 {"ok":true}
curl -s -b cookies-super.txt -X DELETE http://localhost:3000/api/events/EVENTO_ID

# Repetir la misma llamada -> 409 (ya eliminado)
curl -s -b cookies-super.txt -X DELETE http://localhost:3000/api/events/EVENTO_ID

# Admin común -> 403
curl -s -b cookies-admin.txt -X DELETE http://localhost:3000/api/events/OTRO_EVENTO_ID

# Agente -> 403
curl -s -b cookies-agent.txt -X DELETE http://localhost:3000/api/events/OTRO_EVENTO_ID

# ID inexistente (ObjectId válido pero sin doc) -> 404
curl -s -b cookies-super.txt -X DELETE http://localhost:3000/api/events/000000000000000000000000

# GET del evento eliminado -> 404
curl -s -b cookies-super.txt http://localhost:3000/api/events/EVENTO_ID
```
Expected: los códigos y cuerpos indicados arriba. Verifica además en MongoDB que el evento tiene `eliminadoAt` y `eliminadoPorId` seteados y que existe un `LogAuditoria` con `accion: "EVENTO_ELIMINADO"`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/socket-notify.ts apps/web/src/app/api/events/[id]/route.ts
git commit -m "feat(api): DELETE soft delete de evento (superadmin) + GET 404 si eliminado"
```

---

## Task 5: Filtrar eventos eliminados en las lecturas

**Files:**
- Modify: `apps/web/src/app/api/events/route.ts:37` (where del GET)
- Modify: `apps/web/src/app/dashboard/admin/events/page.tsx:22-25` (findMany server-side)

- [ ] **Step 1: Filtrar en `GET /api/events`**

En `apps/web/src/app/api/events/route.ts`, línea 37, reemplaza:

```typescript
        const where: Prisma.EventoWhereInput = {};
```

por:

```typescript
        const where: Prisma.EventoWhereInput = { eliminadoAt: null };
```

- [ ] **Step 2: Filtrar en la carga server-side del dashboard admin**

En `apps/web/src/app/dashboard/admin/events/page.tsx`, reemplaza el `findMany` (líneas 22-25):

```typescript
    const eventos = await prisma.evento.findMany({
        orderBy: { createdAt: "desc" },
        include: { creador: true, asignaciones: { include: { agente: true } } },
    });
```

por:

```typescript
    const eventos = await prisma.evento.findMany({
        where: { eliminadoAt: null },
        orderBy: { createdAt: "desc" },
        include: { creador: true, asignaciones: { include: { agente: true } } },
    });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/web`
Expected: compila sin errores.

- [ ] **Step 4: Verificación manual con `curl` y navegador**

```bash
# La lista NO debe incluir el evento eliminado en Task 4
curl -s -b cookies-super.txt "http://localhost:3000/api/events?limit=100" | grep EVENTO_ID
```
Expected: sin coincidencias (vacío). En el navegador, recarga `/dashboard/admin/events`: el evento eliminado no aparece en la tabla.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/events/route.ts apps/web/src/app/dashboard/admin/events/page.tsx
git commit -m "feat(api): ocultar eventos eliminados de listados y dashboard"
```

---

## Task 6: Tiempo real — `evento:eliminado` (socket-server + cliente)

**Files:**
- Modify: `services/socket-server/src/routes/internal.ts` (agregar ruta después de `/internal/evento-actualizado`)
- Modify: `apps/web/src/components/AdminDashboardClient.tsx:43-71` (handler de socket)

- [ ] **Step 1: Ruta interna que emite `evento:eliminado`**

En `services/socket-server/src/routes/internal.ts`, después del bloque `/internal/evento-actualizado` (línea 50) y antes de `/internal/health`, agrega:

```typescript
router.post(
    "/internal/evento-eliminado",
    authenticateInternal,
    (req: Request, res: Response) => {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ error: "ID de evento requerido" });
        }

        req.app.get("io").emit("evento:eliminado", { id });

        res.json({ success: true });
    }
);
```

- [ ] **Step 2: Cliente — quitar de la lista al recibir `evento:eliminado`**

En `apps/web/src/components/AdminDashboardClient.tsx`, dentro del `useEffect` del socket, agrega el handler junto a los existentes. Reemplaza el bloque de las líneas 64-70:

```typescript
        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
        };
```

por:

```typescript
        const handleEliminado = ({ id }: { id: string }) => {
            setEventos((prev) => prev.filter((e) => e.id !== id));
            if (selectedEventId === id) {
                setModalOpen(false);
                setSelectedEventId(null);
            }
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);
        socket.on("evento:eliminado", handleEliminado);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
            socket.off("evento:eliminado", handleEliminado);
        };
```

- [ ] **Step 3: Typecheck (web + socket)**

Run: `npx tsc --noEmit -p apps/web && npm run build:socket`
Expected: ambos compilan sin errores.

- [ ] **Step 4: Verificación manual en navegador (tiempo real)**

Con `npm run dev` corriendo, abre `/dashboard/admin/events` en dos pestañas (sesión superadmin). En una, elimina un evento vía `curl` (Task 4 Step 6) o por la UI (Task 7).
Expected: el evento desaparece de la tabla en **ambas** pestañas sin recargar.

- [ ] **Step 5: Commit**

```bash
git add services/socket-server/src/routes/internal.ts apps/web/src/components/AdminDashboardClient.tsx
git commit -m "feat(realtime): difundir evento:eliminado y quitarlo de la lista"
```

---

## Task 7: UI — botón "Eliminar evento" con confirmación (solo superadmin)

**Files:**
- Create: `apps/web/src/components/ui/alert-dialog.tsx` (vía shadcn CLI)
- Modify: `apps/web/src/app/dashboard/admin/events/page.tsx` (pasar `isSuperAdmin`)
- Modify: `apps/web/src/components/AdminDashboardClient.tsx` (prop `isSuperAdmin` → modal)
- Modify: `apps/web/src/components/EventDetailModal.tsx` (prop, función eliminar, botón + AlertDialog)

- [ ] **Step 1: Instalar el componente `alert-dialog` de shadcn**

Run (desde `apps/web`): `npx shadcn@latest add alert-dialog`
Expected: crea `apps/web/src/components/ui/alert-dialog.tsx`. Si la CLI pregunta por sobrescribir algo ya existente, responde "no".

Verifica que existe:
Run: `ls apps/web/src/components/ui/alert-dialog.tsx`
Expected: la ruta existe.

- [ ] **Step 2: `EventDetailModal` — agregar prop `isSuperAdmin`**

En `apps/web/src/components/EventDetailModal.tsx`, en la interfaz `EventDetailModalProps` (líneas 45-51), agrega la prop:

```typescript
interface EventDetailModalProps {
    eventoId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    refreshVersion: number;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
}
```

Y en la desestructuración de props (líneas 55-61), agrega `isSuperAdmin = false`:

```typescript
export default function EventDetailModal({
    eventoId,
    open,
    onOpenChange,
    refreshVersion,
    isAdmin = false,
    isSuperAdmin = false,
}: EventDetailModalProps) {
```

- [ ] **Step 3: Importar los componentes de `AlertDialog`**

En el mismo archivo, después del import del `Button` (línea 22), agrega:

```typescript
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
```

- [ ] **Step 4: Agregar la función `eliminarEvento`**

En el mismo archivo, justo después de la función `cancelarEvento` (después de la línea 182), agrega:

```typescript
    const eliminarEvento = async () => {
        if (!eventoId) return;
        setAccionLoading(true);
        try {
            const res = await fetch(`/api/events/${eventoId}`, {
                method: "DELETE",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Evento eliminado");
            onOpenChange(false);
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Error al eliminar"
            );
        } finally {
            setAccionLoading(false);
        }
    };
```

(Al cerrar el modal, el evento se quita de la lista vía el socket `evento:eliminado` de Task 6.)

- [ ] **Step 5: Agregar el botón con confirmación**

En el mismo archivo, justo después del bloque del botón "Cancelar evento" (después de la línea 349, el cierre `)}` del bloque `{isAdmin && puedeCancelar && (...)}`) y antes del cierre `</div>` de la sección de agentes, agrega:

```tsx
                            {isSuperAdmin && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            className="w-full mt-2"
                                            disabled={accionLoading}
                                        >
                                            Eliminar evento
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                ¿Eliminar este evento?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                El evento se ocultará de todas
                                                las vistas de forma permanente.
                                                La acción queda registrada en la
                                                auditoría y no se puede deshacer
                                                desde la interfaz.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                Cancelar
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={eliminarEvento}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Eliminar
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
```

(El botón aparece sin importar el `estado` del evento: un superadmin puede eliminar en cualquier estado.)

- [ ] **Step 6: `AdminDashboardClient` — recibir y propagar `isSuperAdmin`**

En `apps/web/src/components/AdminDashboardClient.tsx`, amplía la interfaz de props (líneas 11-14):

```typescript
interface AdminDashboardClientProps {
    initialEventos: EventoWithRelations[];
    socketUrl: string;
    isSuperAdmin?: boolean;
}
```

La desestructuración (líneas 16-19):

```typescript
export default function AdminDashboardClient({
    initialEventos,
    socketUrl,
    isSuperAdmin = false,
}: AdminDashboardClientProps) {
```

Y pásalo al modal (líneas 101-107), agregando `isSuperAdmin={isSuperAdmin}`:

```tsx
            <EventDetailModal
                eventoId={selectedEventId}
                open={modalOpen}
                onOpenChange={handleModalOpenChange}
                refreshVersion={refreshVersion}
                isAdmin
                isSuperAdmin={isSuperAdmin}
            />
```

- [ ] **Step 7: Página de eventos admin — calcular y pasar `isSuperAdmin`**

En `apps/web/src/app/dashboard/admin/events/page.tsx`, reemplaza el `return` (líneas 30-35):

```tsx
    return (
        <AdminDashboardClient
            initialEventos={eventos}
            socketUrl={socketUrl}
        />
    );
```

por:

```tsx
    return (
        <AdminDashboardClient
            initialEventos={eventos}
            socketUrl={socketUrl}
            isSuperAdmin={decoded.rol === Rol.SUPERADMIN}
        />
    );
```

(`Rol` ya está importado en este archivo.)

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit -p apps/web`
Expected: compila sin errores.

- [ ] **Step 9: Verificación manual en navegador**

Con `npm run dev`:
1. Sesión **superadmin** → abre un evento en `/dashboard/admin/events`. Aparece el botón rojo "Eliminar evento". Click → diálogo de confirmación. Confirma → toast "Evento eliminado", el modal se cierra y el evento desaparece de la tabla.
2. Sesión **admin común** → abre un evento. **No** aparece el botón "Eliminar evento" (sí los de asignar/cancelar).

Expected: comportamiento descrito.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/ui/alert-dialog.tsx apps/web/src/components/EventDetailModal.tsx apps/web/src/components/AdminDashboardClient.tsx apps/web/src/app/dashboard/admin/events/page.tsx
git commit -m "feat(ui): botón eliminar evento con confirmación para superadmin"
```

---

## Task 8: Asignación del rol `SUPERADMIN` desde gestión de usuarios

**Files:**
- Modify: `apps/web/src/app/api/admin/users/route.ts:101-106` (guard en POST)
- Modify: `apps/web/src/app/api/admin/users/[id]/route.ts:114-140` (guard en PATCH)
- Modify: `apps/web/src/app/dashboard/admin/users/page.tsx` (pasar `isSuperAdmin`)
- Modify: `apps/web/src/components/UsersPageClient.tsx` (prop → modal)
- Modify: `apps/web/src/components/UserFormModal.tsx` (prop + opción de rol)

- [ ] **Step 1: Backend POST — solo superadmin puede crear un `SUPERADMIN`**

En `apps/web/src/app/api/admin/users/route.ts`, reemplaza el bloque de validación de rol (líneas 101-106):

```typescript
        if (!Object.values(Rol).includes(rol)) {
            return NextResponse.json(
                { error: "Rol inválido. Use ADMIN o AGENT" },
                { status: 400 }
            );
        }
```

por:

```typescript
        if (!Object.values(Rol).includes(rol)) {
            return NextResponse.json(
                { error: "Rol inválido. Use ADMIN, AGENT o SUPERADMIN" },
                { status: 400 }
            );
        }

        if (rol === Rol.SUPERADMIN && admin.rol !== Rol.SUPERADMIN) {
            return NextResponse.json(
                { error: "Solo un superadmin puede asignar el rol SUPERADMIN" },
                { status: 403 }
            );
        }
```

(`admin` es el `JWTPayload` devuelto por `verifyAdmin` e incluye `.rol`.)

- [ ] **Step 2: Backend PATCH — solo superadmin puede asignar `SUPERADMIN`**

En `apps/web/src/app/api/admin/users/[id]/route.ts`, dentro del bloque `if (body.rol !== undefined) {` reemplaza la validación de rol inválido (líneas 115-120):

```typescript
            if (!Object.values(Rol).includes(body.rol)) {
                return NextResponse.json(
                    { error: "Rol inválido. Use ADMIN o AGENT" },
                    { status: 400 }
                );
            }
```

por:

```typescript
            if (!Object.values(Rol).includes(body.rol)) {
                return NextResponse.json(
                    { error: "Rol inválido. Use ADMIN, AGENT o SUPERADMIN" },
                    { status: 400 }
                );
            }

            if (body.rol === Rol.SUPERADMIN && admin.rol !== Rol.SUPERADMIN) {
                return NextResponse.json(
                    {
                        error: "Solo un superadmin puede asignar el rol SUPERADMIN",
                    },
                    { status: 403 }
                );
            }
```

- [ ] **Step 3: `UserFormModal` — prop `isSuperAdmin` y opción de rol**

En `apps/web/src/components/UserFormModal.tsx`, localiza la interfaz de props del componente (donde se declaran `isOpen`, `onClose`, `onSave`, `usuario`) y agrega `isSuperAdmin?: boolean;`. Luego agrégalo a la desestructuración de props del componente con default `= false`.

Después, en el `SelectContent` del rol (líneas 162-165), reemplaza:

```tsx
                    <SelectContent>
                        <SelectItem value="AGENT">Agente</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
```

por:

```tsx
                    <SelectContent>
                        <SelectItem value="AGENT">Agente</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        {isSuperAdmin && (
                            <SelectItem value="SUPERADMIN">
                                Superadmin
                            </SelectItem>
                        )}
                    </SelectContent>
```

- [ ] **Step 4: `UsersPageClient` — recibir y propagar `isSuperAdmin`**

En `apps/web/src/components/UsersPageClient.tsx`:
1. Agrega una prop `isSuperAdmin?: boolean` a la interfaz de props del componente (si el componente no declara interfaz de props, agrégala: `export default function UsersPageClient({ isSuperAdmin = false }: { isSuperAdmin?: boolean })`).
2. Pásala al `UserFormModal` (líneas 286-291):

```tsx
            <UserFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={fetchUsuarios}
                usuario={editingUser}
                isSuperAdmin={isSuperAdmin}
            />
```

- [ ] **Step 5: Página de usuarios — calcular y pasar `isSuperAdmin`**

En `apps/web/src/app/dashboard/admin/users/page.tsx`, reemplaza la línea 16:

```tsx
    return <UsersPageClient />;
```

por:

```tsx
    return <UsersPageClient isSuperAdmin={decoded.rol === Rol.SUPERADMIN} />;
```

(`Rol` ya está importado en este archivo.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p apps/web`
Expected: compila sin errores.

- [ ] **Step 7: Verificación manual (backend con `curl`)**

```bash
# Admin común intenta promover a SUPERADMIN -> 403
curl -s -b cookies-admin.txt -X PATCH http://localhost:3000/api/admin/users/USER_ID \
  -H "Content-Type: application/json" -d '{"rol":"SUPERADMIN"}'

# Superadmin promueve a SUPERADMIN -> 200
curl -s -b cookies-super.txt -X PATCH http://localhost:3000/api/admin/users/USER_ID \
  -H "Content-Type: application/json" -d '{"rol":"SUPERADMIN"}'
```
Expected: 403 con el mensaje "Solo un superadmin..." en el primero; 200 con el usuario actualizado en el segundo.

- [ ] **Step 8: Verificación manual (UI)**

1. Sesión **superadmin** → `/dashboard/admin/users` → "Editar" un usuario → el selector de Rol incluye "Superadmin".
2. Sesión **admin común** → mismo flujo → el selector **no** incluye "Superadmin".

Expected: comportamiento descrito.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/api/admin/users/route.ts apps/web/src/app/api/admin/users/[id]/route.ts apps/web/src/app/dashboard/admin/users/page.tsx apps/web/src/components/UsersPageClient.tsx apps/web/src/components/UserFormModal.tsx
git commit -m "feat(users): asignar rol SUPERADMIN solo por superadmin (API + UI)"
```

---

## Cierre

- [ ] **Build final completo**

Run: `npm run build`
Expected: web y socket-server compilan sin errores.

- [ ] **Repaso de cobertura vs. spec**

Confirma manualmente el flujo end-to-end con sesión superadmin: eliminar un evento desde la UI, verlo desaparecer en tiempo real en otra pestaña, confirmar que no vuelve tras recargar, y que existe el `LogAuditoria` correspondiente. Confirma que un admin común no ve el botón eliminar ni la opción de rol superadmin.
