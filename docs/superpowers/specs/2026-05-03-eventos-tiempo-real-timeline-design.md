# Eventos en tiempo real y timeline de detalle

**Fecha:** 2026-05-03
**Estado:** Diseño aprobado
**Ramas afectadas:** `apps/web`, `services/socket-server` (sin cambios)

---

## Objetivo

Dos mejoras al módulo de eventos de viper-cmv:

1. **Refresco en tiempo real para admin**: que la tabla de eventos del dashboard de admin refleje automáticamente los cambios que hacen los agentes (asignar, cambiar estado).
2. **Modal de detalle con timeline**: al hacer clic en una fila de la tabla del admin, abrir un modal que muestre el historial de estados del evento al estilo seguimiento de paquetes.

---

## Decisiones de diseño

| Decisión | Opción elegida |
|---|---|
| Mecanismo de refresco | Socket.io (no polling) |
| Modal: acciones | Solo lectura |
| Layout del timeline | Vertical con tarjetas (punto de color + tarjeta por estado) |
| Encabezado del modal | Básico: título, estado, urgencia, dirección |
| Modal abierto + update en tiempo real | Actualizar modal en vivo (re-fetch silencioso) |

---

## Arquitectura

### Componentes modificados

| Componente | Cambio |
|---|---|
| `AdminDashboardClient.tsx` | Suscribirse a `evento:actualizado` y `evento:nuevo`. Manejar estado `selectedEventId`. Pasar callback de refresco al modal. |
| `EventList.tsx` | Agregar prop `onEventClick(eventId: string)`. Filas clickeables con `cursor-pointer` y hover `bg-muted`. |

### Componentes nuevos

| Componente | Responsabilidad |
|---|---|
| `EventDetailModal.tsx` | Dialog de shadcn/ui. Al abrirse hace `fetch` a `GET /api/events/[id]`. Escucha actualizaciones vía callback del padre para re-fetch silencioso. Renderiza encabezado + `EventTimeline`. |
| `EventTimeline.tsx` | Recibe `EstadoHistorial[]` (ordenados desc por timestamp). Renderiza timeline vertical con tarjetas. |

### Sin cambios

- **Socket server** (`services/socket-server`): ya emite `evento:actualizado` a todos (`io.emit`). No se modifica.
- **API `/api/events/[id]`**: ya devuelve `estadosHistorial`. Solo se agrega `include: { usuario: true }` y `orderBy: { timestamp: "desc" }` al include anidado.
- **API interna `/api/internal/assign`** y **`/api/internal/update-status`**: ya persisten `EstadoHistorial` con `usuarioId`. No se modifican.
- **Modelo Prisma**: `EstadoHistorial` ya tiene relación `usuario`. No se modifica el schema.

---

## Flujo de datos

### Refresco en tiempo real (tabla admin)

```
Agente ejecuta acción (asignar / cambiar estado)
  → socket.emit("evento:actualizar-estado", { eventoId, nuevoEstado })
    → Socket server → HTTP PATCH /api/internal/update-status
      → Next.js actualiza DB, crea EstadoHistorial
    → Socket server emite io.emit("evento:actualizado", payload)
    ├─ AdminDashboardClient: actualiza evento en tabla (in-place, reemplazo por objeto completo)
    └─ AgentDashboardClient: refresca listas
```

El `AdminDashboardClient` escucha dos eventos (ambos con payload `{ evento: EventoWithRelations }`):

- `evento:actualizado` → reemplaza la fila completa por el `evento` recibido (match por `evento.id`).
- `evento:nuevo` → agrega el nuevo evento al principio de la lista.

### Refresco en tiempo real (modal abierto)

Cuando `AdminDashboardClient` recibe `evento:actualizado` con un `eventoId` que coincide con `selectedEventId`:

1. Dispara un re-fetch de `GET /api/events/[id]`.
2. El modal re-renderiza el timeline con los nuevos datos (nueva tarjeta al tope, badge de estado actualizado).
3. Sin spinner ni indicador de carga visible (actualización silenciosa).

### Apertura del modal

```
Usuario hace clic en fila de EventList
  → EventList llama a onEventClick(eventoId)
    → AdminDashboardClient: setSelectedEventId(eventoId)
      → EventDetailModal se monta con eventoId
        → useEffect: fetch GET /api/events/[id]
          → Renderiza encabezado + EventTimeline
```

---

## Diseño del EventDetailModal

### Encabezado

- Título del evento (texto grande)
- Badge de estado (color semántico)
- Badge de nivel de urgencia (color semántico)
- Dirección con ícono de ubicación
- Teléfono con ícono de teléfono

### Timeline (EventTimeline)

- Línea vertical a la izquierda (3px, color primary).
- Cada entrada es una **tarjeta** con:
  - Punto circular a la izquierda (sobre la línea), color según estado:
    - `PENDIENTE` → gray
    - `ASIGNADO` → gray-medium
    - `EN_RUTA` → amber
    - `RESUELTO` → blue
    - `CANCELADO` → red
  - Estado (texto destacado)
  - Fecha y hora (dd/MM/yyyy HH:mm)
  - Nombre y rol del responsable
  - Nota del agente (si existe en `EstadoHistorial.notas`, solo para RESUELTO y CANCELADO)
- Orden descendente por timestamp (más reciente arriba).

### Comportamiento

- Al abrirse: fetch a `GET /api/events/[id]`.
- Si el modal está abierto y llega `evento:actualizado` con mismo `eventoId`: re-fetch silencioso.
- Si se cierra el modal antes de que termine el fetch inicial: abortar request (useEffect cleanup con `AbortController`).
- Si el fetch falla: toast de error y cerrar modal.
- Si el evento no existe (404): mostrar "Evento no encontrado" dentro del modal.

---

## Casos borde

| Escenario | Comportamiento |
|---|---|
| Modal abierto y socket se desconecta | El modal sigue mostrando datos cargados. Sin bloqueo. Al reconectar, retoma escucha. |
| Modal abierto, evento cancelado vía socket | Re-fetch automático. Aparece tarjeta "Cancelado" en timeline. Badge cambia. |
| Admin cierra modal mientras llega update | `selectedEventId` ya es `null`, se ignora el evento. |
| Clic rápido abrir/cerrar modal | Cada apertura hace fetch. Si se cierra antes de respuesta, se aborta (AbortController). |
| Sin `EstadoHistorial` para el evento | Timeline muestra mensaje "Sin historial de estados". |
| Fila clickeable en tabla | `cursor-pointer` + hover `bg-muted`. La fila entera es clickeable. |

---

## API — cambio único

### `GET /api/events/[id]`

Agregar `include` anidado y orden en `estadosHistorial`:

```typescript
const evento = await prisma.evento.findUnique({
    where: { id },
    include: {
        creador: true,
        asignado: true,
        estadosHistorial: {
            include: { usuario: true },
            orderBy: { timestamp: "desc" },
        },
    },
});
```

---

## Testing manual

| # | Escenario | Verificación |
|---|---|---|
| 1 | Admin crea evento | Aparece en tabla admin y en "Disponibles" del agente (en tiempo real). |
| 2 | Agente toma caso | En admin, la fila cambia de "Pendiente" a "Asignado" y muestra nombre del agente. |
| 3 | Agente cambia a En Ruta → Resolver | Tabla admin refleja cada cambio de estado en tiempo real. |
| 4 | Admin abre modal de detalle, agente cambia estado | Modal se actualiza solo: nueva tarjeta en timeline, badge cambia. |
| 5 | Cerrar modal, verificar tabla | La tabla refleja el último estado correctamente. |
| 6 | Abrir modal de evento sin historial | Muestra "Sin historial de estados". |

---

## Fuera de alcance

- Asignación manual de eventos desde el admin (el admin no asigna, solo ve).
- Filtros, búsqueda o paginación en la tabla de eventos.
- Notificaciones push o sonidos en actualizaciones.
- Cambios en el dashboard del agente (ya funciona con `evento:actualizado`).
