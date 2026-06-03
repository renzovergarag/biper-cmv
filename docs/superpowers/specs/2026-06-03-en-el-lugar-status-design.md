# Diseño Técnico: Incorporación del Estado "En el lugar"

Este documento detalla los cambios necesarios para incorporar el nuevo estado `"En el lugar"` al flujo de eventos y asignaciones en la aplicación. Con este cambio, el flujo de estados pasará a ser: **Pendiente $\rightarrow$ Asignado $\rightarrow$ En ruta $\rightarrow$ En el lugar $\rightarrow$ Resuelto**.

---

## 1. Cambios en Base de Datos (Prisma)

Se actualizarán los esquemas de Prisma tanto en la aplicación Web como en el Servidor de Sockets para mantener la sincronía del modelo de datos.

### Archivos a modificar:
*   [apps/web/prisma/schema.prisma](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/prisma/schema.prisma)
*   `services/socket-server/prisma/schema.prisma`

### Modificación de Enums:
1.  **`EstadoEvento`**:
    Se añade el estado `EN_EL_LUGAR`.
    ```prisma
    enum EstadoEvento {
      PENDIENTE
      ASIGNADO
      EN_RUTA
      EN_EL_LUGAR  // Nuevo
      RESUELTO
      CANCELADO
    }
    ```

2.  **`EstadoAsignacion`**:
    Se añade el estado `EN_EL_LUGAR`.
    ```prisma
    enum EstadoAsignacion {
      ASIGNADO
      EN_RUTA
      EN_EL_LUGAR  // Nuevo
      RESUELTO
      ABANDONADO
    }
    ```

---

## 2. Lógica del Backend y API

### A. Derivación del Estado del Evento
En [apps/web/src/lib/asignaciones.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/lib/asignaciones.ts), actualizaremos la función `derivarEstadoEvento` para soportar la prioridad de `EN_EL_LUGAR`:
1.  Si todas las asignaciones activas (no abandonadas) están en `RESUELTO` $\rightarrow$ `RESUELTO`.
2.  Si al menos una asignación activa está en `EN_EL_LUGAR` $\rightarrow$ `EN_EL_LUGAR`.
3.  Si al menos una asignación activa está en `EN_RUTA` o `RESUELTO` $\rightarrow$ `EN_RUTA`.
4.  Si todas las asignaciones activas están en `ASIGNADO` $\rightarrow$ `ASIGNADO`.
5.  Si no quedan asignaciones activas $\rightarrow$ `PENDIENTE`.

### B. Transición de Estados
En [apps/web/src/app/api/internal/update-status/route.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/api/internal/update-status/route.ts):
1.  `ESTADOS_VALIDOS` se ampliará para incluir `EstadoAsignacion.EN_EL_LUGAR`.
2.  La matriz `TRANSICIONES` se modificará de la siguiente manera:
    *   `[EstadoAsignacion.ASIGNADO]`: `[EstadoAsignacion.EN_RUTA, EstadoAsignacion.ABANDONADO]`
    *   `[EstadoAsignacion.EN_RUTA]`: `[EstadoAsignacion.EN_EL_LUGAR, EstadoAsignacion.ABANDONADO]` *(Cambia el destino de RESUELTO a EN_EL_LUGAR)*
    *   `[EstadoAsignacion.EN_EL_LUGAR]`: `[EstadoAsignacion.RESUELTO, EstadoAsignacion.ABANDONADO]` *(Nueva transición)*

### C. Conteo de KPIs del Dashboard
Se modificará el conteo de eventos "En proceso" en:
*   [apps/web/src/app/api/admin/stats/kpis/route.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/api/admin/stats/kpis/route.ts)
*   [apps/web/src/app/dashboard/admin/page.tsx](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/dashboard/admin/page.tsx)

El filtro `in` incluirá `EstadoEvento.EN_EL_LUGAR`:
```typescript
in: [EstadoEvento.ASIGNADO, EstadoEvento.EN_RUTA, EstadoEvento.EN_EL_LUGAR]
```

### D. Servidor de Sockets
En `services/socket-server/src/socket/handlers.ts`:
1.  Actualizar la constante `ESTADOS_VALIDOS` para incluir `"EN_EL_LUGAR"`.

### E. Eventos Unibles
En los endpoints de asignación, agregaremos `EstadoEvento.EN_EL_LUGAR` a `ESTADOS_UNIBLES` para que los agentes puedan asignarse como apoyo a un evento en progreso:
*   [apps/web/src/app/api/events/[id]/asignaciones/route.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/api/events/%5Bid%5D/asignaciones/route.ts)
*   [apps/web/src/app/api/internal/assign/route.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/api/internal/assign/route.ts)

---

## 3. Cambios en el Frontend (Interfaz de Usuario)

### A. Tema y Estilos Visuales
En [apps/web/src/lib/theme.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/lib/theme.ts):
1.  `estadoLabel`: `[EstadoEvento.EN_EL_LUGAR]: "En el lugar"`
2.  `estadoBadgeVariant`: `[EstadoEvento.EN_EL_LUGAR]: "default"`
3.  `estadoAsignacionLabel`: `[EstadoAsignacion.EN_EL_LUGAR]: "En el lugar"`
4.  `estadoAsignacionBadgeVariant`: `[EstadoAsignacion.EN_EL_LUGAR]: "default"`

### B. Panel del Agente
En [apps/web/src/components/AgentDashboardClient.tsx](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/components/AgentDashboardClient.tsx):
1.  `ESTADOS_UNIBLES`: Se añade `"EN_EL_LUGAR"`.
2.  `useEffect` de carga inicial: Añadir fetch para `EN_EL_LUGAR`.
3.  **Botones de acción según el estado de la asignación del agente (`estadoAgente`)**:
    *   Si es `ASIGNADO` $\rightarrow$ Botón `"Marcar En Ruta"` (llama a `handleCambiarEstado(evento.id, "EN_RUTA")`).
    *   Si es `EN_RUTA` $\rightarrow$ Botón `"Marcar En el lugar"` (llama a `handleCambiarEstado(evento.id, "EN_EL_LUGAR")`) y botón `"Abandonar"`.
    *   Si es `EN_EL_LUGAR` $\rightarrow$ Botón `"Resolver"` (llama a `handleCambiarEstado(evento.id, "RESUELTO")`) y botón `"Abandonar"`.

### C. Línea de Tiempo del Evento
En [apps/web/src/components/EventTimeline.tsx](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/components/EventTimeline.tsx):
1.  `estadoDotColor`: `[EstadoEvento.EN_EL_LUGAR]: "bg-emerald-500"`
2.  `estadoCardBg`: `[EstadoEvento.EN_EL_LUGAR]: "bg-emerald-50 border-emerald-200"`

### D. Modal de Detalle
En [apps/web/src/components/EventDetailModal.tsx](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/components/EventDetailModal.tsx):
1.  `ESTADOS_UNIBLES`: Se añade `"EN_EL_LUGAR"` para permitir asignar agentes de apoyo en este estado.

---

## 4. Plan de Pruebas
Actualizaremos el script de aserciones en [apps/web/scripts/test-derivar-estado.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/scripts/test-derivar-estado.ts) para añadir casos de prueba que verifiquen la correcta derivación de `EN_EL_LUGAR`.
