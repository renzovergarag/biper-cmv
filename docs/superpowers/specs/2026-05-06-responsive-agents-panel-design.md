# Responsive Connected Agents Panel — Diseño

**Fecha:** 2026-05-06
**Estado:** Aprobado

## Problema

En dispositivos mobile (< 1024px), el panel lateral `ConnectedAgentsPanel` de 288px (`w-72`) compite con el contenido principal en un layout `flex` horizontal, consumiendo ~75% del viewport en teléfonos de ~375px. La tabla de eventos y demás contenido quedan ilegibles.

En desktop (≥1024px) el layout funciona correctamente.

## Solución

Implementar un diseño responsive con dos modos:

| Breakpoint | Comportamiento |
|---|---|
| **≥ 1024px (lg)** | Panel inline a la derecha — mismo comportamiento actual |
| **< 1024px** | Panel oculto. FAB flotante con badge del contador. Tap abre un Bottom Sheet. |

### Componentes

#### 1. Sheet de shadcn/ui (`components/ui/sheet.tsx`)
- Nuevo componente instalado vía `npx shadcn add sheet`
- Configurado con `side="bottom"` para el modo mobile
- Soporta swipe down y tap fuera para cerrar

#### 2. ConnectedAgentsPanel (`components/ConnectedAgentsPanel.tsx`) — Refactor
- Extraer el contenido de la lista de agentes a un subcomponente interno `AgentList` reutilizable
- Recibir prop `variant: "inline" | "sheet"` para controlar el wrapper (Card sticky vs contenido plano)
- La lógica de socket y estado se mantiene exactamente igual
- Solo ADMIN ve este componente (comportamiento existente, `if (user?.rol !== "ADMIN") return null`)

#### 3. DashboardContent (`components/DashboardContent.tsx`) — Refactor
- Layout responsive: `flex-col` por defecto, `lg:flex-row lg:gap-6`
- En ≥lg: renderiza `ConnectedAgentsPanel variant="inline"` a la derecha
- En <lg: oculta el panel inline, renderiza:
  - **FAB** (`fixed bottom-4 right-4`): botón circular con badge del contador de agentes. Visible solo en `<lg` (`lg:hidden`). Muestra "0" cuando no hay agentes.
  - **Sheet** (shadcn): contiene `ConnectedAgentsPanel variant="sheet"`. Se abre/cierra con estado local `isSheetOpen`.

### Data Flow

Sin cambios en la capa de socket:
- `ConnectedAgentsPanel` se monta siempre (en ambos modos)
- Escucha los mismos eventos: `agentes:lista`, `agentes:conectado`, `agentes:desconectado`
- El FAB lee `agentes.length` del mismo estado para el badge
- La diferencia es puramente de presentación: dónde se renderiza visualmente

### Edge Cases

| Caso | Comportamiento |
|---|---|
| 0 agentes conectados | FAB visible con badge "0" |
| 1 agente conectado | FAB con badge "1", Sheet muestra lista con 1 agente |
| N agentes conectados/desconectan en tiempo real | Se actualiza dentro del Sheet abierto, igual que ahora |
| Usuario no ADMIN | No se renderiza nada (comportamiento existente) |
| Desktop ≥1024px | Comportamiento idéntico al actual |
| Resize de ventana cruzando breakpoint | El componente responde vía CSS (Tailwind responsive classes) + estado de Sheet se cierra automáticamente al cruzar a desktop |

### Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `components/ui/sheet.tsx` | Nuevo | Instalar `npx shadcn add sheet` |
| `components/ConnectedAgentsPanel.tsx` | Modificar | Extraer `AgentList`, aceptar prop `variant` |
| `components/DashboardContent.tsx` | Modificar | Layout responsive, FAB, integración Sheet |

### No se modifica

- `services/socket-server/` — sin cambios
- `apps/web/src/hooks/useSocket.ts` — sin cambios
- `Navigation.tsx` — sin cambios
- Cualquier otro componente del dashboard
