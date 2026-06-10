# Eliminación lógica de eventos (soft delete) por superadmin

**Fecha:** 2026-06-09
**Estado:** Aprobado para implementación

## Resumen

Permitir que un nuevo rol `SUPERADMIN` elimine eventos de forma **lógica**: tras
eliminarse, el evento desaparece de todas las vistas normales pero persiste en la
base de datos. La eliminación es una acción independiente del estado del evento
(se puede eliminar en cualquier `estado`) y queda registrada en `LogAuditoria`.

El rol `SUPERADMIN` hereda todos los privilegios de `ADMIN` y suma dos acciones
exclusivas: eliminar eventos y promover a otros usuarios a `SUPERADMIN`.

## Decisiones de diseño

- **Soft delete mediante marca temporal** (`eliminadoAt DateTime?`): `null` = activo,
  con fecha = eliminado. Es el idioma estándar de soft-delete y deja la metadata de
  borrado en el propio registro. Se descartó:
  - un flag booleano `eliminado` (menos expresivo, no guarda el "cuándo");
  - un nuevo valor `ELIMINADO` en el enum `estado` (rompe la independencia entre
    eliminar y estado).
- **Sin recuperación desde la UI** (solo auditoría): no hay papelera ni restaurar.
  Si se necesita rescatar un evento, es trabajo manual en BD. La trazabilidad queda
  en `LogAuditoria` y en `eliminadoPorId`/`eliminadoAt` del registro.
- **`SUPERADMIN ⊇ ADMIN`:** todos los chequeos genéricos de "es admin" aceptan ambos
  roles; solo las dos acciones privilegiadas exigen `SUPERADMIN` estricto.
- **Bootstrap manual:** el primer superadmin se crea manualmente en BD. No hay seed
  automático. A partir de ahí, la promoción se hace desde la UI (solo un superadmin
  puede promover a otro superadmin).

## 1. Modelo de datos

Cambios en `apps/web/prisma/schema.prisma`:

```prisma
enum Rol {
  ADMIN
  AGENT
  SUPERADMIN   // nuevo
}

model Evento {
  // ... campos existentes ...
  eliminadoAt    DateTime?   // null = activo; con fecha = eliminado
  eliminadoPor   User?       @relation("EventosEliminados", fields: [eliminadoPorId], references: [id])
  eliminadoPorId String?     @db.ObjectId

  // ... relaciones existentes ...
  @@index([eliminadoAt])     // filtrar eliminados eficientemente
}
```

- `eliminadoAt`: marca temporal del borrado lógico. `null` = visible.
- `eliminadoPorId`: referencia al superadmin que lo eliminó (redundante con el log,
  pero deja la metadata en el propio registro).
- Nuevo índice `@@index([eliminadoAt])` para que filtrar `eliminadoAt: null` sea
  eficiente.
- El modelo `User` recibe el lado inverso de la relación `EventosEliminados`
  (`eventosEliminados Evento[] @relation("EventosEliminados")`).

## 2. Autorización y rol `SUPERADMIN`

El sistema hoy chequea literalmente `rol === ADMIN` en varios puntos. Como un
superadmin debe poder hacer todo lo que hace un admin, se trata `SUPERADMIN` como
"admin o más".

**a) Helpers de autorización (`apps/web/src/lib/api-auth.ts`)**
- `requireAdmin()` pasa a aceptar `ADMIN` **o** `SUPERADMIN`. Así toda la
  funcionalidad admin existente queda disponible para superadmin sin tocar cada ruta.
- Se agrega `requireSuperAdmin()` que exige `rol === SUPERADMIN`. Lo usan solo los
  endpoints de eliminar evento y de asignar el rol superadmin.

**b) Middleware (`apps/web/src/middleware.ts`)**
- La regla que protege `/api/admin/*` y `/dashboard/admin` se ajusta para permitir
  `ADMIN` **o** `SUPERADMIN` (hoy redirige a quien no sea exactamente `ADMIN`).

**c) `verifyAdmin()` (`apps/web/src/lib/admin-auth.ts`)**
- Se actualiza igual que `requireAdmin` para aceptar ambos roles, manteniendo
  coherencia.

**d) Bootstrap del primer superadmin**
- Se crea manualmente en BD. No hay seed automático.

Principio central: en todos los chequeos genéricos de "es admin" entran `ADMIN` y
`SUPERADMIN`; solo las dos acciones privilegiadas (eliminar evento, promover a
superadmin) exigen `SUPERADMIN` estricto.

## 3. API — endpoint de eliminación

**Nuevo método `DELETE /api/events/[id]`** en
`apps/web/src/app/api/events/[id]/route.ts` (junto al `GET` y `PATCH` existentes).

- **Autorización:** `requireSuperAdmin()` (estricto).
- **Validaciones:**
  - El evento existe → si no, `404`.
  - El evento no está ya eliminado (`eliminadoAt === null`) → si ya lo estaba, `409`.
  - Sin restricción de estado: se puede eliminar en cualquier `estado`.
- **Efecto (una transacción):**
  1. `prisma.evento.update` → `eliminadoAt = now()`, `eliminadoPorId = <superadmin>`.
  2. Crea registro en `LogAuditoria` con `accion: "EVENTO_ELIMINADO"`,
     `entidad: "Evento"`, `entidadId`, `usuarioId`, y `detalle` (estado al momento de
     borrar, título).
- **Respuesta:** `200` con `{ ok: true }`.
- **Tiempo real:** emite por socket `evento:eliminado` con el `id`, para que los
  dashboards abiertos lo quiten de la lista al instante (igual que hoy con
  `evento:actualizado`).

**Filtrado en lecturas existentes:**
- `GET /api/events` y la carga server-side de `/dashboard/admin/events` agregan
  `where: { eliminadoAt: null }` por defecto, para que los eventos eliminados
  desaparezcan de todas las vistas normales.
- `GET /api/events/[id]` de un evento eliminado → `404` (se comporta como si no
  existiera para la UI normal). El acceso a eliminados queda solo a nivel BD/log.

## 4. UI

**a) Eliminar evento — `apps/web/src/components/EventDetailModal.tsx`**
- Botón **"Eliminar evento"** (estilo destructivo, ícono papelera), visible solo si
  el usuario es superadmin. El modal recibe una prop nueva `isSuperAdmin` (hoy ya
  recibe `isAdmin`).
- Al hacer clic → **diálogo de confirmación** (`AlertDialog` de shadcn) advirtiendo
  que la acción oculta el evento de forma permanente desde la UI. Confirmar → llama
  `DELETE /api/events/[id]`.
- Éxito → cierra el modal, toast "Evento eliminado", y el evento se quita de la lista
  (estado local + socket `evento:eliminado`).
- El botón aparece junto a las acciones admin actuales (asignar/cancelar), separado
  visualmente por ser la acción más destructiva.

**b) Asignar rol `SUPERADMIN` — gestión de usuarios**
- El selector de rol del formulario de usuario incluye `SUPERADMIN` como opción solo
  cuando el usuario autenticado es superadmin (un admin común no ve esa opción).
- El backend (`PATCH /api/admin/users/[id]` y creación) valida con
  `requireSuperAdmin()` cuando el rol a asignar es `SUPERADMIN`. Aunque alguien
  manipule el request, un admin no puede promover a superadmin.

**c) Propagación de `isSuperAdmin`**
- `AdminDashboardClient` y la página `/dashboard/admin/events` ya conocen el rol del
  usuario (del JWT). Se deriva `isSuperAdmin = user.rol === "SUPERADMIN"` y se pasa
  hacia `EventDetailModal`.

## 5. Testing

**a) Tests de API (backend)**
- `DELETE /api/events/[id]`:
  - Superadmin elimina un evento → `200`; el evento queda con `eliminadoAt` seteado y
    `eliminadoPorId` correcto.
  - Se crea el registro en `LogAuditoria` con `accion: "EVENTO_ELIMINADO"`.
  - Admin común → `403`.
  - Agente → `403`.
  - Evento inexistente → `404`.
  - Evento ya eliminado → `409`.
  - Eliminar funciona en cualquier estado (PENDIENTE, RESUELTO, CANCELADO, etc.).
- `GET /api/events` y carga server-side: un evento eliminado no aparece en los
  resultados (`eliminadoAt: null` aplicado).
- `GET /api/events/[id]` de un evento eliminado → `404`.
- Asignación de rol: admin común intentando promover a `SUPERADMIN` → `403`;
  superadmin → `200`.

**b) Tests de autorización**
- `requireAdmin()` acepta `ADMIN` y `SUPERADMIN`; rechaza `AGENT`.
- `requireSuperAdmin()` acepta solo `SUPERADMIN`; rechaza `ADMIN` y `AGENT`.

**c) UI (si el repo tiene tests de componentes)**
- El botón "Eliminar evento" solo se renderiza con `isSuperAdmin`.
- La opción de rol `SUPERADMIN` en gestión de usuarios solo aparece para superadmin.
- Seguir el patrón de testing existente del repo.

## Archivos afectados (referencia)

| Archivo | Cambio |
|---|---|
| `apps/web/prisma/schema.prisma` | Rol `SUPERADMIN`, campos `eliminadoAt`/`eliminadoPorId`, índice, relación inversa en `User` |
| `apps/web/src/lib/api-auth.ts` | `requireAdmin` acepta ambos roles; nuevo `requireSuperAdmin` |
| `apps/web/src/lib/admin-auth.ts` | `verifyAdmin` acepta ambos roles |
| `apps/web/src/middleware.ts` | Permitir `ADMIN`/`SUPERADMIN` en rutas admin |
| `apps/web/src/app/api/events/[id]/route.ts` | Nuevo `DELETE`; `GET` devuelve 404 si eliminado |
| `apps/web/src/app/api/events/route.ts` | Filtrar `eliminadoAt: null` |
| `apps/web/src/app/dashboard/admin/events/page.tsx` | Filtrar `eliminadoAt: null` |
| `apps/web/src/app/api/admin/users/[id]/route.ts` | Validar `requireSuperAdmin` al asignar rol SUPERADMIN |
| `apps/web/src/components/EventDetailModal.tsx` | Botón eliminar + confirmación + prop `isSuperAdmin` |
| `apps/web/src/components/AdminDashboardClient.tsx` | Derivar/propagar `isSuperAdmin`; manejar socket `evento:eliminado` |
| Gestión de usuarios (UI) | Opción de rol `SUPERADMIN` visible solo para superadmin |
