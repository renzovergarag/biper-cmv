# Diseño — Asignación múltiple de agentes a un evento

**Fecha:** 2026-05-14
**Estado:** Aprobado para planificación

## Contexto y problema

Hoy el sistema modela la relación evento-agente como **1:1**: `Evento` tiene un único campo
`asignadoId` y la asignación es "primero que llega gana" (atómica vía `updateMany` con
`estado: PENDIENTE`). El agente asignado controla en exclusiva las transiciones de estado
(`ASIGNADO → EN_RUTA → RESUELTO/CANCELADO`).

En la operación real es común que **más de un agente** acuda a cubrir un mismo evento. El
sistema debe pasar a una relación **1:N** (un evento, varios agentes), conservando trazabilidad
por agente y un estado coherente a nivel de evento.

## Decisiones de diseño

Definidas durante el brainstorming:

1. **Estado del evento:** único a nivel de evento, con **cierre por consenso** — el evento
   solo pasa a `RESUELTO` cuando todos los agentes activos cerraron su parte.
2. **Flujo de asignación:** auto-asignación abierta (cada agente pulsa "Tomar caso") **+**
   el admin puede agregar/quitar agentes manualmente.
3. **Ciclo por agente:** cada agente avanza su propia parte
   `ASIGNADO → EN_RUTA → RESUELTO`. "Cancelar" pasa a significar **abandonar** el evento
   (la asignación no cuenta para el consenso).
4. **Abandono total:** si todos los agentes abandonan, el evento vuelve a `PENDIENTE`. El
   admin puede forzar `CANCELADO` del evento completo en cualquier momento.
5. **Reglas de unión:** un agente puede unirse mientras el evento esté `PENDIENTE`,
   `ASIGNADO` o `EN_RUTA`. **Sin límite** de agentes por evento.

## Enfoque elegido

**Modelo de unión explícito `AsignacionEvento`** (relación N:N como colección propia).
Descartados: array de IDs en `Evento` (no modela estado/timestamps por agente) y documentos
embebidos (no indexables → consultas "eventos del agente X" se vuelven scans).

---

## Sección 1 — Modelo de datos (Prisma)

Cambios en `apps/web/prisma/schema.prisma` **y** en el schema duplicado
`services/socket-server/prisma/schema.prisma`.

### Nuevo enum

```prisma
enum EstadoAsignacion {
  ASIGNADO
  EN_RUTA
  RESUELTO
  ABANDONADO
}
```

### Nuevo modelo

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

El `@@unique([eventoId, agenteId])` garantiza que un agente tenga **una sola fila** por
evento: si abandona (`ABANDONADO`) y vuelve a unirse, se reutiliza la fila vía `upsert`.

### Cambios en `Evento`

- Se **elimina** `asignadoId`, la relación `asignado` y el `@@index([asignadoId])`.
- Se **agrega** `asignaciones AsignacionEvento[]`.
- Se conservan `estado`, `assignedAt`, `resolvedAt`. Con la nueva semántica:
  `assignedAt` = momento de la primera asignación; `resolvedAt` = momento del cierre por
  consenso.

### Cambios en `User`

- Se **reemplaza** `eventosAsignados Evento[] @relation("Asignado")` por
  `asignaciones AsignacionEvento[] @relation("AgenteAsignaciones")`.

### Sin cambios

`EstadoHistorial` y `LogAuditoria` mantienen su estructura — siguen registrando con
`usuarioId` quién realizó cada transición.

---

## Sección 2 — Lógica de estado del evento

El `estado` del `Evento` pasa a ser **derivado** de sus asignaciones activas (todas las que
no están `ABANDONADO`). Una función pura `derivarEstadoEvento(asignaciones)` centraliza la
regla y se invoca tras cada cambio de asignación.

| Condición sobre asignaciones activas (excluyendo `ABANDONADO`) | Estado del evento |
|---|---|
| No hay asignaciones activas | `PENDIENTE` |
| Hay activas, ninguna en `EN_RUTA` ni `RESUELTO` | `ASIGNADO` |
| Al menos una en `EN_RUTA` y no todas cerradas | `EN_RUTA` |
| Todas las activas en `RESUELTO` (≥1 activa) | `RESUELTO` |
| Admin fuerza cancelación | `CANCELADO` (terminal, no derivado) |

### Reglas clave

- **Unirse:** permitido si el evento está en `PENDIENTE`, `ASIGNADO` o `EN_RUTA`. Bloqueado
  en `RESUELTO` y `CANCELADO`.
- **Abandonar:** la asignación pasa a `ABANDONADO`. Si era la última activa, el evento
  vuelve a `PENDIENTE` y se limpia `assignedAt`. Un agente cuya parte ya está `RESUELTO` no
  puede abandonar.
- **Cierre por consenso:** cuando un agente marca su parte `RESUELTO`, si todas las demás
  asignaciones activas ya están `RESUELTO`, el evento pasa a `RESUELTO` y se setea
  `resolvedAt`. Las asignaciones `ABANDONADO` no cuentan.
- **`CANCELADO` (admin):** estado terminal del evento, **no derivado** — se setea
  explícitamente y "congela" el evento independientemente de sus asignaciones.
- **Transiciones por agente:** `ASIGNADO → EN_RUTA → RESUELTO`. Desde `ASIGNADO` o
  `EN_RUTA` el agente puede pasar a `ABANDONADO`. `RESUELTO` y `ABANDONADO` son terminales
  para esa asignación.

### Trazabilidad

Cada transición (de agente o de evento) se registra en `EstadoHistorial` y `LogAuditoria`
con el `usuarioId` correspondiente. Las transiciones de evento derivadas se registran con el
`usuarioId` del agente que disparó el recálculo.

### Concurrencia

La derivación corre dentro de una transacción Prisma que lee las asignaciones, recalcula y
actualiza el `Evento`, evitando carreras cuando dos agentes actúan casi simultáneamente. La
protección "primero que llega" actual desaparece (la asignación ya no es exclusiva); se
reemplaza por el `@@unique([eventoId, agenteId])`, que evita uniones duplicadas del mismo
agente.

---

## Sección 3 — Backend / API

### Nuevo módulo `apps/web/src/lib/asignaciones.ts`

Concentra:

- `derivarEstadoEvento(asignaciones)` — función pura de la Sección 2.
- `recalcularEstadoEvento(tx, eventoId)` — helper transaccional que lee las asignaciones,
  deriva el estado, actualiza el `Evento` y registra `EstadoHistorial` / `LogAuditoria`.

Todos los endpoints que tocan asignaciones reutilizan este módulo dentro de una
`prisma.$transaction`.

### Endpoints internos (socket-server → web, token interno) — se reescriben

- **`POST /api/internal/assign`** — *agente se une*. Body `{ eventoId, agenteId }`. Valida
  que el evento sea unible (`PENDIENTE` / `ASIGNADO` / `EN_RUTA`); hace `upsert` de
  `AsignacionEvento` por `(eventoId, agenteId)` a estado `ASIGNADO` (reactiva si estaba
  `ABANDONADO`); llama `recalcularEstadoEvento`. Devuelve el evento con asignaciones.
  Reemplaza el `updateMany` atómico actual.
- **`PATCH /api/internal/update-status`** — *agente cambia su propia parte*. Body
  `{ eventoId, agenteId, nuevoEstado }` con `nuevoEstado ∈ EN_RUTA | RESUELTO | ABANDONADO`.
  Valida la transición por agente, actualiza la `AsignacionEvento`, llama
  `recalcularEstadoEvento`. Devuelve el evento actualizado.

### Endpoints de admin (en `apps/web`, auth por cookie + `requireAdmin`) — nuevos

- **`POST /api/events/[id]/asignaciones`** — body `{ agenteId }`. Admin agrega un agente
  (mismo `upsert` + `recalcularEstadoEvento`).
- **`DELETE /api/events/[id]/asignaciones/[agenteId]`** — admin saca un agente (asignación
  → `ABANDONADO` + recalcular).
- **`PATCH /api/events/[id]`** — body `{ estado: "CANCELADO" }`. Admin cancela el evento
  completo (estado terminal, no derivado). El archivo `[id]/route.ts` hoy solo tiene `GET`;
  se le agrega `PATCH`.

Tras cada mutación de admin, la web notifica al socket-server para difundir el cambio en
tiempo real (ver Sección 4).

### Ajustes en endpoints existentes

- **`GET /api/events`** y **`GET /api/events/[id]`**: el `include` cambia de
  `{ creador: true, asignado: true }` a
  `{ creador: true, asignaciones: { include: { agente: true } } }`. El filtro `asignadoId`
  pasa a ser relacional:
  `asignaciones: { some: { agenteId, estado: { not: ABANDONADO } } }`.
- **`GET /api/agent/history`**: en vez de `where: { asignadoId: sub }`, consulta eventos
  donde el agente tiene una asignación en estado `RESUELTO` (su parte cerrada).
- **`POST /api/events`** (crear): sin cambios — el evento nace `PENDIENTE` sin asignaciones.
- **KPIs** (`/api/admin/stats/kpis` y `admin/page.tsx`): `pendientesSinAsignar` pasa a
  contar simplemente `estado: PENDIENTE` (que ahora ya implica sin asignaciones activas);
  `enProceso` (`ASIGNADO` / `EN_RUTA`) sin cambios.

---

## Sección 4 — Socket-server

### `socket/handlers.ts`

- **`evento:asignar`** `{ eventoId }` — sin cambios de contrato. Sigue llamando
  `asignarEventoAtomico(eventoId, user.sub)`. La asignación ya no es exclusiva: el resultado
  puede tener varios agentes. En éxito emite `evento:asignado-exito` al socket del agente y
  `evento:actualizado` a todos. El caso de error (`result.success === false`) ahora aplica
  solo si el evento no es unible (`RESUELTO` / `CANCELADO`); el mensaje cambia de "ya fue
  asignado a otro agente" a "el evento ya no admite agentes".
- **`evento:actualizar-estado`** `{ eventoId, nuevoEstado }` — ahora actualiza la **parte
  del agente**. `ESTADOS_VALIDOS` pasa a `["EN_RUTA", "RESUELTO", "ABANDONADO"]`. Llama
  `actualizarEstadoEvento(eventoId, nuevoEstado, user.sub)` y emite `evento:actualizado` a
  todos. "Abandonar" reutiliza este mismo evento de socket con `nuevoEstado: "ABANDONADO"`.

### `lib/api-client.ts`

- `asignarEventoAtomico` — sin cambios.
- `actualizarEstadoEvento` — hoy ya envía `usuarioId`; se renombra a `agenteId` en el body
  para coincidir con el endpoint reescrito `{ eventoId, nuevoEstado, agenteId }`.

### `routes/internal.ts` — nueva ruta

- **`POST /internal/evento-actualizado`** (con `authenticateInternal`), body `{ evento }`,
  hace `io.emit("evento:actualizado", { evento })`. Los endpoints de admin de la Sección 3
  la invocan con token interno tras cada mutación, igual que `POST /api/events` ya hace con
  `/internal/events`.

### Schema duplicado

`services/socket-server/prisma/schema.prisma` recibe los mismos cambios de la Sección 1.

### Tipos de socket

Los payloads de `SocketEventPayloads` no cambian de forma, pero `evento:actualizado` y
`evento:asignado-exito` ahora cargan un `Evento` con `asignaciones[]` en vez de `asignado`.

---

## Sección 5 — Frontend

### `types/index.ts`

`EventoWithRelations` y `EventoWithHistorial` cambian el `include` a
`{ creador: true, asignaciones: { include: { agente: true } } }`. La interfaz `Evento`
pierde `asignadoId?` y gana `asignaciones?`. Se exporta el enum `EstadoAsignacion`.

### `AgentDashboardClient.tsx`

- **"Disponibles"**: además de `PENDIENTE`, ahora incluye eventos `ASIGNADO` / `EN_RUTA` en
  los que el agente **no** participa (puede unirse hasta `EN_RUTA`). El fetch inicial y el
  filtrado se ajustan.
- **"Mis Eventos"**: eventos donde el agente tiene una asignación activa (no `ABANDONADO`).
  Los botones se controlan por el estado de **su propia asignación**, no el del evento:
  `ASIGNADO` → "Marcar En Ruta"; `EN_RUTA` → "Resolver" / "Abandonar" (el botón "Cancelar"
  actual pasa a ser "Abandonar" y envía `ABANDONADO`).
- `handleActualizado`: la pertenencia se evalúa con
  `asignaciones.some(a => a.agenteId === userId && a.estado !== "ABANDONADO")` en vez de
  `asignadoId === userId`.
- Cada card muestra cuántos agentes más están en el evento (p. ej. "Tú + 2 agentes").

### `EventList.tsx`

La columna/campo "Asignado a" pasa de `evento.asignado?.nombre` a un resumen de las
`asignaciones` activas: nombres concatenados o "Juan, María (+1)", "—" si no hay.

### `EventDetailModal.tsx`

Se agrega una sección **"Agentes asignados"** que lista cada agente con su estado de
asignación (badge). Para admin, esa sección incluye controles: agregar agente (select
alimentado por `/api/users/agents`), quitar agente, y un botón **"Cancelar evento"**. Estas
acciones llaman a los endpoints de admin de la Sección 3. Como el modal solo se usa hoy en
contextos de admin, se controla con una prop `isAdmin` (o detección de rol).

### `AdminDashboardClient.tsx` / `AdminHomeClient.tsx` / `RecentEventsTable.tsx`

`handleActualizado` ya opera por `id`, sin lógica de `asignadoId` — solo se benefician del
nuevo shape. `RecentEventsTable` ajusta su columna de asignado igual que `EventList`.

### `lib/theme.ts`

Se agregan `estadoAsignacionLabel` y `estadoAsignacionBadgeVariant` para los badges por
agente.

### KPIs / `KpiCards.tsx`

Sin cambios de UI; los conteos se resuelven en backend (Sección 3).

---

## Sección 6 — Migración de datos y testing

### Migración de datos existentes

Los `Evento` actuales tienen `asignadoId`. Script único e idempotente
`apps/web/scripts/migrate-asignaciones.ts` (ejecutado con `tsx` / `node`):

- Por cada `Evento` con `asignadoId != null`: crea una
  `AsignacionEvento { eventoId, agenteId: asignadoId, assignedAt, resolvedAt }` con `estado`
  mapeado desde el estado del evento:
  - `ASIGNADO → ASIGNADO`, `EN_RUTA → EN_RUTA`, `RESUELTO → RESUELTO`.
  - `CANCELADO →` el evento conserva su `estado: CANCELADO` y la asignación se crea como
    `ABANDONADO` (coherente con la nueva semántica "cancelar = abandonar").
- Eventos `PENDIENTE` sin `asignadoId` → sin asignaciones.
- Idempotente: antes de crear, verifica que no exista ya una `AsignacionEvento` para ese
  `(eventoId, agenteId)`.
- Paso final opcional: `$unset` del campo `asignadoId` en los documentos (Mongo es
  schemaless, el campo huérfano no rompe nada, pero conviene limpiarlo).

### Secuencia de despliegue segura

Evita que código y schema se desincronicen:

1. Actualizar schema agregando `EstadoAsignacion` + `AsignacionEvento` (conservando
   `asignadoId` por ahora) → `db push` + `db generate` en `apps/web` y
   `services/socket-server`.
2. Correr el script de migración (backfill).
3. Desplegar el código nuevo (ya usa `asignaciones`).
4. Quitar `asignadoId` / `asignado` del schema → `db push` + script de `$unset`.

Si se acepta una ventana de downtime corta, los pasos 1-4 pueden hacerse de corrido.

### Testing

El repo no tiene framework de tests (confirmado en `AGENTS.md`).

- **Test unitario de `derivarEstadoEvento`**: es una función pura y es el corazón de la
  lógica. Script standalone `apps/web/scripts/test-derivar-estado.ts` con asserts nativos de
  Node (`node:assert`), sin instalar framework. Casos: 0 asignaciones → `PENDIENTE`; mezcla
  `ASIGNADO` / `EN_RUTA` → `EN_RUTA`; todas `RESUELTO` → `RESUELTO`; `ABANDONADO` ignoradas;
  todas `ABANDONADO` → `PENDIENTE`.
- **Checklist de QA manual** (con `npm run dev`, dos navegadores como dos agentes + uno
  admin):
  1. Dos agentes se unen al mismo evento → ambos lo ven en "Mis Eventos", evento en
     `ASIGNADO`.
  2. Un agente marca `EN_RUTA` → evento pasa a `EN_RUTA`; el otro sigue en `ASIGNADO`.
  3. Un tercer agente se une mientras está `EN_RUTA` → permitido.
  4. Un agente resuelve su parte; el evento NO se cierra hasta que todos los activos
     resuelven.
  5. Todos resuelven → evento `RESUELTO`, `resolvedAt` seteado.
  6. Un agente abandona → desaparece de sus eventos; si era el último activo, el evento
     vuelve a `PENDIENTE`.
  7. Admin agrega y quita un agente desde el modal; admin cancela un evento → `CANCELADO`
     terminal.
  8. Todo lo anterior se refleja en tiempo real en los otros navegadores (socket).
  9. El historial del agente muestra solo sus partes `RESUELTO`.

---

## Resumen de archivos afectados

**Schema (x2):** `apps/web/prisma/schema.prisma`,
`services/socket-server/prisma/schema.prisma`

**Backend web:**
- Nuevo: `apps/web/src/lib/asignaciones.ts`
- Nuevo: `apps/web/src/app/api/events/[id]/asignaciones/route.ts`
- Nuevo: `apps/web/src/app/api/events/[id]/asignaciones/[agenteId]/route.ts`
- Modificado: `apps/web/src/app/api/internal/assign/route.ts`
- Modificado: `apps/web/src/app/api/internal/update-status/route.ts`
- Modificado: `apps/web/src/app/api/events/[id]/route.ts` (agrega `PATCH`)
- Modificado: `apps/web/src/app/api/events/route.ts`
- Modificado: `apps/web/src/app/api/agent/history/route.ts`
- Modificado: `apps/web/src/app/api/admin/stats/kpis/route.ts`
- Modificado: `apps/web/src/app/dashboard/admin/page.tsx`,
  `apps/web/src/app/dashboard/agent/page.tsx`,
  `apps/web/src/app/dashboard/agent/history/page.tsx`,
  `apps/web/src/app/dashboard/admin/events/page.tsx` (ajuste de `include`)

**Socket-server:**
- Modificado: `services/socket-server/src/socket/handlers.ts`
- Modificado: `services/socket-server/src/lib/api-client.ts`
- Modificado: `services/socket-server/src/routes/internal.ts`

**Frontend:**
- Modificado: `apps/web/src/types/index.ts`
- Modificado: `apps/web/src/components/AgentDashboardClient.tsx`
- Modificado: `apps/web/src/components/EventList.tsx`
- Modificado: `apps/web/src/components/EventDetailModal.tsx`
- Modificado: `apps/web/src/components/AdminDashboardClient.tsx`
- Modificado: `apps/web/src/components/dashboard/RecentEventsTable.tsx`
- Modificado: `apps/web/src/lib/theme.ts`

**Scripts:**
- Nuevo: `apps/web/scripts/migrate-asignaciones.ts`
- Nuevo: `apps/web/scripts/test-derivar-estado.ts`
</content>
</invoke>
