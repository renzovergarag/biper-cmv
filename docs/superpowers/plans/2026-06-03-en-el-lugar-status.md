# Incorporación del Estado "En el lugar" - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar el estado "En el lugar" (`EN_EL_LUGAR`) en el flujo de asignaciones y eventos de la aplicación, permitiendo una transición ordenada desde "En ruta" hasta "Resuelto".

**Architecture:** Modificaremos los esquemas de Prisma compartidos (Web y Socket Server) para añadir el nuevo enum, actualizaremos la API de cambios de estado y las reglas de derivación de estado del evento en el backend, y adaptaremos el panel de agentes y el panel del administrador en el frontend para reflejar este nuevo estado y sus respectivas acciones.

**Tech Stack:** Next.js 14, React, Prisma, MongoDB, Socket.io, TypeScript

---

### Task 1: Modificación de Esquemas Prisma y Generación de Clientes

**Files:**
- Modify: [apps/web/prisma/schema.prisma](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/prisma/schema.prisma)
- Modify: `services/socket-server/prisma/schema.prisma`

- [ ] **Step 1: Modificar enums de Prisma en apps/web**
  Añadir `EN_EL_LUGAR` en los enums `EstadoEvento` y `EstadoAsignacion` del archivo `apps/web/prisma/schema.prisma`.
  ```prisma
  enum EstadoEvento {
    PENDIENTE
    ASIGNADO
    EN_RUTA
    EN_EL_LUGAR
    RESUELTO
    CANCELADO
  }

  enum EstadoAsignacion {
    ASIGNADO
    EN_RUTA
    EN_EL_LUGAR
    RESUELTO
    ABANDONADO
  }
  ```

- [ ] **Step 2: Modificar enums de Prisma en services/socket-server**
  Copiar los mismos enums actualizados a `services/socket-server/prisma/schema.prisma`.

- [ ] **Step 3: Regenerar Prisma Client y actualizar DB local**
  Correr en la raíz del proyecto para actualizar el cliente y sincronizar con MongoDB:
  Run: `npm run db:generate && npm run db:push`
  Expected: Prisma Client generado exitosamente y cambios de esquema aplicados a la base de datos MongoDB sin pérdida de datos.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/prisma/schema.prisma services/socket-server/prisma/schema.prisma
  git commit -m "db: incorporar estado EN_EL_LUGAR a esquemas prisma"
  ```

---

### Task 2: Modificación de Lógica de Negocio y Backend en la Web App

**Files:**
- Modify: [apps/web/src/lib/asignaciones.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/lib/asignaciones.ts)
- Modify: [apps/web/src/app/api/internal/update-status/route.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/api/internal/update-status/route.ts)
- Modify: [apps/web/src/app/api/events/[id]/asignaciones/route.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/api/events/%5Bid%5D/asignaciones/route.ts)
- Modify: [apps/web/src/app/api/internal/assign/route.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/api/internal/assign/route.ts)
- Modify: [apps/web/src/app/api/admin/stats/kpis/route.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/api/admin/stats/kpis/route.ts)
- Modify: [apps/web/src/app/dashboard/admin/page.tsx](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/app/dashboard/admin/page.tsx)

- [ ] **Step 1: Actualizar la función derivarEstadoEvento**
  Modificar `apps/web/src/lib/asignaciones.ts` para que la derivación funcione de la siguiente manera:
  ```typescript
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

      if (activas.some((a) => a.estado === EstadoAsignacion.EN_EL_LUGAR)) {
          return EstadoEvento.EN_EL_LUGAR;
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
  ```

- [ ] **Step 2: Actualizar transiciones válidas en la API de actualización de estado**
  Modificar `apps/web/src/app/api/internal/update-status/route.ts` para que las transiciones de agente soporten `EN_EL_LUGAR`:
  ```typescript
  const ESTADOS_VALIDOS: EstadoAsignacion[] = [
      EstadoAsignacion.EN_RUTA,
      EstadoAsignacion.EN_EL_LUGAR,
      EstadoAsignacion.RESUELTO,
      EstadoAsignacion.ABANDONADO,
  ];

  const TRANSICIONES: Record<EstadoAsignacion, EstadoAsignacion[]> = {
      [EstadoAsignacion.ASIGNADO]: [
          EstadoAsignacion.EN_RUTA,
          EstadoAsignacion.ABANDONADO,
      ],
      [EstadoAsignacion.EN_RUTA]: [
          EstadoAsignacion.EN_EL_LUGAR,
          EstadoAsignacion.ABANDONADO,
      ],
      [EstadoAsignacion.EN_EL_LUGAR]: [
          EstadoAsignacion.RESUELTO,
          EstadoAsignacion.ABANDONADO,
      ],
      [EstadoAsignacion.RESUELTO]: [],
      [EstadoAsignacion.ABANDONADO]: [],
  };
  ```

- [ ] **Step 3: Actualizar ESTADOS_UNIBLES en la API de asignaciones**
  Modificar `apps/web/src/app/api/events/[id]/asignaciones/route.ts` para incluir `EN_EL_LUGAR` en `ESTADOS_UNIBLES`:
  ```typescript
  const ESTADOS_UNIBLES: EstadoEvento[] = [
      EstadoEvento.PENDIENTE,
      EstadoEvento.ASIGNADO,
      EstadoEvento.EN_RUTA,
      EstadoEvento.EN_EL_LUGAR,
  ];
  ```

- [ ] **Step 4: Actualizar ESTADOS_UNIBLES en la API interna de asignaciones**
  Modificar `apps/web/src/app/api/internal/assign/route.ts` para incluir `EN_EL_LUGAR` en `ESTADOS_UNIBLES`:
  ```typescript
  const ESTADOS_UNIBLES: EstadoEvento[] = [
      EstadoEvento.PENDIENTE,
      EstadoEvento.ASIGNADO,
      EstadoEvento.EN_RUTA,
      EstadoEvento.EN_EL_LUGAR,
  ];
  ```

- [ ] **Step 5: Incluir EN_EL_LUGAR en eventos "enProceso" de KPIs y Página de Administración**
  Modificar `apps/web/src/app/api/admin/stats/kpis/route.ts` y `apps/web/src/app/dashboard/admin/page.tsx` para contar `EN_EL_LUGAR` como evento "en proceso":
  ```typescript
  estado: {
      in: [
          EstadoEvento.ASIGNADO,
          EstadoEvento.EN_RUTA,
          EstadoEvento.EN_EL_LUGAR,
      ],
  },
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add apps/web/src/lib/asignaciones.ts apps/web/src/app/api/
  git add apps/web/src/app/dashboard/admin/page.tsx
  git commit -m "backend: implementar derivaciones, transiciones y APIs para EN_EL_LUGAR"
  ```

---

### Task 3: Modificación del Socket Server

**Files:**
- Modify: `services/socket-server/src/socket/handlers.ts`

- [ ] **Step 1: Actualizar estados válidos del socket**
  Modificar la constante `ESTADOS_VALIDOS` en `services/socket-server/src/socket/handlers.ts` para incluir `"EN_EL_LUGAR"`:
  ```typescript
  const ESTADOS_VALIDOS = ["EN_RUTA", "EN_EL_LUGAR", "RESUELTO", "ABANDONADO"] as const;
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add services/socket-server/src/socket/handlers.ts
  git commit -m "socket-server: agregar EN_EL_LUGAR a estados validos de actualizacion"
  ```

---

### Task 4: Modificaciones en Interfaz de Usuario y Componentes Frontend

**Files:**
- Modify: [apps/web/src/lib/theme.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/lib/theme.ts)
- Modify: [apps/web/src/components/AgentDashboardClient.tsx](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/components/AgentDashboardClient.tsx)
- Modify: [apps/web/src/components/EventTimeline.tsx](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/components/EventTimeline.tsx)
- Modify: [apps/web/src/components/EventDetailModal.tsx](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/src/components/EventDetailModal.tsx)

- [ ] **Step 1: Actualizar etiquetas de estado en el tema**
  Modificar `apps/web/src/lib/theme.ts` para incluir las etiquetas y variantes de badge de `EN_EL_LUGAR`:
  ```typescript
  export const estadoLabel: Record<EstadoEvento, string> = {
      [EstadoEvento.PENDIENTE]: "Pendiente",
      [EstadoEvento.ASIGNADO]: "Asignado",
      [EstadoEvento.EN_RUTA]: "En ruta",
      [EstadoEvento.EN_EL_LUGAR]: "En el lugar",
      [EstadoEvento.RESUELTO]: "Resuelto",
      [EstadoEvento.CANCELADO]: "Cancelado",
  };

  export const estadoBadgeVariant: Record<
      EstadoEvento,
      "default" | "secondary" | "outline" | "destructive"
  > = {
      [EstadoEvento.PENDIENTE]: "secondary",
      [EstadoEvento.ASIGNADO]: "default",
      [EstadoEvento.EN_RUTA]: "default",
      [EstadoEvento.EN_EL_LUGAR]: "default",
      [EstadoEvento.RESUELTO]: "outline",
      [EstadoEvento.CANCELADO]: "destructive",
  };

  export const estadoAsignacionLabel: Record<EstadoAsignacion, string> = {
      [EstadoAsignacion.ASIGNADO]: "Asignado",
      [EstadoAsignacion.EN_RUTA]: "En ruta",
      [EstadoAsignacion.EN_EL_LUGAR]: "En el lugar",
      [EstadoAsignacion.RESUELTO]: "Resuelto",
      [EstadoAsignacion.ABANDONADO]: "Abandonado",
  };

  export const estadoAsignacionBadgeVariant: Record<
      EstadoAsignacion,
      "default" | "secondary" | "outline" | "destructive"
  > = {
      [EstadoAsignacion.ASIGNADO]: "secondary",
      [EstadoAsignacion.EN_RUTA]: "default",
      [EstadoAsignacion.EN_EL_LUGAR]: "default",
      [EstadoAsignacion.RESUELTO]: "outline",
      [EstadoAsignacion.ABANDONADO]: "destructive",
  };
  ```

- [ ] **Step 2: Actualizar el Dashboard del Agente**
  Modificar `apps/web/src/components/AgentDashboardClient.tsx`:
  - Agregar `"EN_EL_LUGAR"` a `ESTADOS_UNIBLES`.
  - Cargar eventos en `EN_EL_LUGAR` en el hook `useEffect` inicial.
  - Modificar el renderizado condicional de botones para las transiciones del agente:
  ```typescript
  // Alrededor de la linea 256 en adelante:
  {estadoAgente === EstadoAsignacion.ASIGNADO && (
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

  {estadoAgente === EstadoAsignacion.EN_RUTA && (
      <div className="grid grid-cols-2 gap-2">
          <Button
              onClick={() =>
                  handleCambiarEstado(
                      evento.id,
                      EstadoAsignacion.EN_EL_LUGAR
                  )
              }
              className="w-full h-11 sm:h-9 text-sm bg-teal-600 hover:bg-teal-700"
          >
              Llegué al lugar
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

  {estadoAgente === EstadoAsignacion.EN_EL_LUGAR && (
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
  ```

- [ ] **Step 3: Actualizar la Línea de Tiempo del Evento**
  Modificar `apps/web/src/components/EventTimeline.tsx` para incluir los colores y fondos de `EN_EL_LUGAR`:
  ```typescript
  const estadoDotColor: Record<EstadoEvento, string> = {
      [EstadoEvento.PENDIENTE]: "bg-gray-400",
      [EstadoEvento.ASIGNADO]: "bg-gray-500",
      [EstadoEvento.EN_RUTA]: "bg-amber-500",
      [EstadoEvento.EN_EL_LUGAR]: "bg-emerald-500",
      [EstadoEvento.RESUELTO]: "bg-blue-500",
      [EstadoEvento.CANCELADO]: "bg-red-500",
  };

  const estadoCardBg: Record<EstadoEvento, string> = {
      [EstadoEvento.PENDIENTE]: "bg-gray-50 border-gray-200",
      [EstadoEvento.ASIGNADO]: "bg-gray-100 border-gray-300",
      [EstadoEvento.EN_RUTA]: "bg-amber-50 border-amber-200",
      [EstadoEvento.EN_EL_LUGAR]: "bg-emerald-50 border-emerald-200",
      [EstadoEvento.RESUELTO]: "bg-blue-50 border-blue-200",
      [EstadoEvento.CANCELADO]: "bg-red-50 border-red-200",
  };
  ```

- [ ] **Step 4: Actualizar estados unibles en el Modal de Detalle**
  Modificar `apps/web/src/components/EventDetailModal.tsx` para agregar `"EN_EL_LUGAR"` a la lista `ESTADOS_UNIBLES` en la línea 53.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/src/lib/theme.ts apps/web/src/components/
  git commit -m "frontend: incorporar soporte visual e interacciones para EN_EL_LUGAR"
  ```

---

### Task 5: Actualización del Script de Pruebas y Validación Final

**Files:**
- Modify: [apps/web/scripts/test-derivar-estado.ts](file:///Users/renzovergara/Documents/Dev/Proyectos/biper-cmv/apps/web/scripts/test-derivar-estado.ts)

- [ ] **Step 1: Modificar assertions del test**
  Añadir aserciones específicas para verificar el comportamiento de `EN_EL_LUGAR` en `apps/web/scripts/test-derivar-estado.ts`:
  ```typescript
  // Mezcla EN_RUTA + EN_EL_LUGAR -> EN_EL_LUGAR
  assert.equal(
      derivarEstadoEvento([{ estado: A.EN_RUTA }, { estado: A.EN_EL_LUGAR }]),
      E.EN_EL_LUGAR
  );

  // Mezcla RESUELTO + EN_EL_LUGAR -> EN_EL_LUGAR
  assert.equal(
      derivarEstadoEvento([{ estado: A.RESUELTO }, { estado: A.EN_EL_LUGAR }]),
      E.EN_EL_LUGAR
  );

  // Mezcla ASIGNADO + EN_EL_LUGAR -> EN_EL_LUGAR
  assert.equal(
      derivarEstadoEvento([{ estado: A.ASIGNADO }, { estado: A.EN_EL_LUGAR }]),
      E.EN_EL_LUGAR
  );
  ```

- [ ] **Step 2: Ejecutar las pruebas**
  Run: `npx tsx apps/web/scripts/test-derivar-estado.ts`
  Expected: ✓ derivarEstadoEvento: todos los casos pasaron

- [ ] **Step 3: Commit**
  ```bash
  git add apps/web/scripts/test-derivar-estado.ts
  git commit -m "test: actualizar aserciones de derivacion con EN_EL_LUGAR y ejecutar test"
  ```
