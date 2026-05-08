# Rediseño UI integral con shell `dashboard-01` de shadcn

**Fecha:** 2026-05-08
**Estado:** Aprobado en brainstorming, pendiente plan de implementación
**Alcance:** `apps/web` (Next.js 14) + cambios menores en `services/socket-server`

## Contexto

VIPER CMV es una app de gestión de eventos territoriales usada principalmente desde dispositivos móviles. La UI actual tiene un header simple (`Navigation.tsx` + container `max-w-7xl`) y dos roles: ADMIN (eventos, usuarios) y AGENT (mis eventos). Algunas vistas ya tienen tratamiento mobile (cards `<lg`, ej. `EventList`, `UsersPageClient`), pero no hay un shell consistente, ni dashboard de KPIs, ni navegación lateral.

Este spec define el rediseño completo: adoptar el layout `dashboard-01` de shadcn como shell, mejorar la experiencia mobile-first en todas las páginas, y construir un home con KPIs y chart para el admin. Se mantiene Tailwind 3 (sin migración a v4).

## Objetivos

1. Layout consistente y mobile-first en toda la app autenticada.
2. Home del admin con KPIs, chart y eventos recientes.
3. Login con identidad visual de Corporación Municipal Valparaíso (logo CMV).
4. Sidebar colapsable (desktop) / Sheet (mobile) con navegación por rol.
5. Cero regresión en flujos existentes (login, crear evento, asignar, cerrar).

## No-objetivos

- Migración de Tailwind v3 → v4.
- Dark mode (solo light por ahora).
- Telemetría / Sentry / tests automatizados.
- Reescribir lógica de autenticación, sockets o Prisma.
- Internacionalización (sigue solo en español).

## Decisiones clave

| Decisión | Elegido | Por qué |
|---|---|---|
| Bloque de login | `login-03` (logo arriba + card) | Identidad CMV clara, equilibrado en mobile. |
| Alcance | Rediseño completo (shell + KPIs + repaso páginas) | Pedido explícito del usuario. |
| Dark mode | No, solo light | Pedido explícito; menos QA y tokens. |
| Tailwind | Mantener v3 | Migrar a v4 toca todos los componentes ya instalados; saca foco del rediseño. |
| Estrategia | Adaptar `dashboard-01` manualmente sobre stack actual | Permite avanzar al rediseño sin migración previa. |
| Chart | Área 7d/30d (eventos creados) | El más útil para el flujo operativo. |
| Modales largos en mobile | `Drawer` (bottom sheet) | Mejor UX que dialog en pantallas chicas. |
| FAB | No | Header sticky con CTA es más predecible. |

## Arquitectura

### Estructura de archivos

```
apps/web/src/app/
  layout.tsx                   (sin cambios estructurales)
  login/page.tsx               REFACTOR: login-03 con logo CMV
  dashboard/
    layout.tsx                 REESCRITO: AppShell con sidebar + topbar
    page.tsx                   redirect según rol (sin cambios)
    admin/
      page.tsx                 NUEVO contenido: home con KPIs + chart + tabla
      events/page.tsx          MOVIDO: era admin/page.tsx (lista de eventos)
      users/page.tsx           EXISTENTE
      agents/page.tsx          NUEVO: ConnectedAgentsPanel como página
      sessions/page.tsx        NUEVO: SessionLogsTab como página
      reports/page.tsx         NUEVO: placeholder
      settings/page.tsx        NUEVO: placeholder
    agent/
      page.tsx                 EXISTENTE: mis eventos
      history/page.tsx         NUEVO
      profile/page.tsx         NUEVO

apps/web/src/components/
  app-shell/
    AppSidebar.tsx             SidebarProvider + items por rol
    SiteHeader.tsx             trigger + breadcrumb + user menu + estado socket
    NavMain.tsx                items principales
    NavUser.tsx                avatar + dropdown (perfil, logout)
    nav-config.ts              config items por rol (objeto plano)
  dashboard/
    KpiCards.tsx
    EventsAreaChart.tsx
    RecentEventsTable.tsx
  ui/                          (existentes + nuevos)
    + sidebar.tsx
    + dropdown-menu.tsx
    + breadcrumb.tsx
    + tooltip.tsx
    + chart.tsx
    + drawer.tsx
    + skeleton.tsx
    + scroll-area.tsx

apps/web/src/lib/
  api-auth.ts                  NUEVO: requireAdmin/requireAuth helpers

apps/web/src/app/api/
  admin/stats/kpis/route.ts            NUEVO
  admin/stats/events-by-day/route.ts   NUEVO
  admin/agents/online/route.ts         NUEVO
  agent/history/route.ts               NUEVO
  auth/password/route.ts               NUEVO

services/socket-server/src/
  routes/internal-agents.ts    NUEVO: /internal/agents-online
```

Archivos eliminados:
- `components/Navigation.tsx`
- `components/DashboardContent.tsx`

### Responsive

- **`< lg`** (mobile/tablet): sidebar oculta detrás de `Sheet` (off-canvas) que abre con un trigger en el topbar. Topbar muestra hamburguesa + título de página + avatar.
- **`≥ lg`**: sidebar fija a la izquierda, colapsable a icon-only. Topbar con breadcrumb + acciones.
- Estado del sidebar persistido en cookie (estándar shadcn).

### Patrones mobile transversales

- Header de página sticky (`sticky top-14`) cuando hay título + acción primaria.
- Tap targets ≥44px en `<sm` para botones primarios (`size="lg"`).
- Modales largos (`UserFormModal`, `CreateEventModal`) → `Drawer` en `<sm`.
- `EventDetailModal` se queda como Dialog (es solo lectura).

## Login

`apps/web/src/app/login/page.tsx`:

```tsx
<div className="min-h-svh flex items-center justify-center bg-muted/40 p-6">
    <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <Image
            src="/Logo BN V.jpg"
            alt="Corporación Municipal Valparaíso"
            width={180}
            height={180}
            priority
            className="h-20 sm:h-24 w-auto"
        />
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Iniciar sesión</CardTitle>
                <CardDescription>
                    Ingresa tus credenciales para acceder
                </CardDescription>
            </CardHeader>
            <CardContent>{/* form sin cambios de lógica */}</CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
            Sistema de Gestión de Eventos Territoriales
        </p>
    </div>
</div>
```

Cambios concretos:
- Logo CMV (Image de `next/image`) reemplaza `<h1>VIPER CMV</h1>`.
- `min-h-svh` para evitar el salto del viewport en mobile.
- `max-w-sm` (más compacto que `md`).
- `bg-muted/40` (alineado con el sistema de tokens del shell).
- Inputs con `autoComplete` correctos: `email` / `current-password`.
- Botón submit `size="lg"` solo en mobile.
- `toast.error()` además del banner inline en errores.

Lógica intacta: `handleSubmit`, `/api/auth/login`, cookie `token`, redirect a `/dashboard`.

## Dashboard home (admin)

`apps/web/src/app/dashboard/admin/page.tsx` deja de ser la lista de eventos y pasa a ser la nueva home.

Layout:
1. KPI cards (4): grid 2x2 mobile, 1x4 `≥md`.
2. Chart de área (alto 240px mobile, 320px desktop): toggle 7d/30d, default 7d.
3. Tabla de eventos recientes (10): cards `<lg`, `Table` shadcn `≥lg`. CTA "Ver todos" → `/dashboard/admin/events`.

### KPIs

| KPI | Query |
|---|---|
| Eventos hoy | `count WHERE createdAt >= startOfToday` |
| Pendientes sin asignar | `count WHERE estado='PENDIENTE' AND asignadoId IS NULL` |
| En proceso | `count WHERE estado='EN_PROCESO'` |
| Agentes en línea | socket-server vía `/internal/agents-online` |

Cards: label, valor grande, ícono lucide. Sin delta vs ayer en v1 (se puede agregar después).

### Chart

`EventsAreaChart` adapta `chart-area-interactive` de `dashboard-01`. Una sola serie (eventos creados), gradiente. Toggle 7d/30d. Datos del endpoint `/api/admin/stats/events-by-day?range=7|30`. Empty state si no hay datos en el rango.

### Tabla recientes

Reutiliza el patrón de `EventList` (cards `<lg`, tabla `≥lg`). Click abre `EventDetailModal` ya existente. Para evitar duplicación, extraer `variant="compact"` o subcomponente `EventCardCompact` de `EventList`.

### Tiempo real

Server component renderiza datos iniciales. Cliente wrapper (similar a `AdminDashboardClient`) escucha `evento:nuevo` / `evento:actualizado` y dispara re-fetch de KPIs (debounced 1s). `agentes:cambio` actualiza el KPI de agentes online.

## Sidebar y navegación

### ADMIN
- Dashboard (`/dashboard/admin`) — `LayoutDashboard`
- Eventos (`/dashboard/admin/events`) — `Siren`
- Usuarios (`/dashboard/admin/users`) — `Users`
- Agentes en línea (`/dashboard/admin/agents`) — `Wifi`
- Sesiones (`/dashboard/admin/sessions`) — `ScrollText`
- Reportes (`/dashboard/admin/reports`) — `BarChart3`
- Configuración (`/dashboard/admin/settings`) — `Settings`

### AGENT
- Mis eventos (`/dashboard/agent`) — `Siren`
- Historial (`/dashboard/agent/history`) — `History`
- Mi perfil (`/dashboard/agent/profile`) — `User`

`nav-config.ts` exporta una estructura `{ admin: NavItem[], agent: NavItem[] }`. `AppSidebar` recibe `user.rol` y renderiza el array correspondiente.

`SiteHeader` calcula breadcrumb desde `usePathname()` con un mapa simple `{ '/dashboard/admin': 'Dashboard', ... }`.

## Páginas dentro del shell

### `/dashboard/admin/events`
Mueve `AdminDashboardClient` actual aquí. Header "Eventos" + CTA "Crear evento" sticky en mobile. Filtros (estado, asignado, búsqueda) en una `Sheet`. Badge "Tiempo real" compacta a punto + tooltip en `<sm`.

### `/dashboard/agent`
`AgentDashboardClient` se mantiene. Header asumido por el SiteHeader. Botones de acción `size="lg"` en `<sm`.

### `/dashboard/admin/users`
`UsersPageClient` ya tiene cards `<lg`. Se mantiene. CTA "Nuevo usuario" sticky en mobile. `UserFormModal` → `Drawer` en `<sm`.

### `/dashboard/admin/agents`
`ConnectedAgentsPanel.tsx` como página standalone. Eliminar wrappers redundantes con el shell.

### `/dashboard/admin/sessions`
`SessionLogsTab.tsx` como página standalone. Si no tiene variante mobile, agregarla siguiendo el patrón de `EventList`.

### `/dashboard/admin/reports`, `/dashboard/admin/settings`
Empty state honesto: ícono lucide grande + "Próximamente".

### `/dashboard/agent/history`
Lista de eventos del agente con `estado='CERRADO'`. Reutiliza `EventList` con `readOnly`. Endpoint: `/api/agent/history`.

### `/dashboard/agent/profile`
Form simple: nombre y email read-only + botón "Cambiar contraseña" → modal con campos actual/nueva/confirmar. Endpoint: `PATCH /api/auth/password`.

## APIs nuevas

Todos los endpoints `/api/admin/*` exigen `rol=ADMIN` vía `requireAdmin(req)` (helper nuevo en `lib/api-auth.ts`).

### `GET /api/admin/stats/kpis`
```ts
{
    eventosHoy: number,
    pendientesSinAsignar: number,
    enProceso: number,
    agentesEnLinea: number
}
```
`Promise.all` de tres queries Prisma + un fetch al socket-server.

### `GET /api/admin/stats/events-by-day?range=7|30`
```ts
{ data: Array<{ date: string; count: number }> }
```
Aggregate Prisma agrupado por día (UTC). Cache: 60s en memoria del proceso.

### `GET /api/admin/agents/online`
Lista de agentes conectados desde el socket-server vía `/internal/agents-online` con token interno (mismo patrón que `/api/internal/assign`). Si el socket-server está caído, devuelve `{ count: 0, agents: [] }` con header `x-stale: true`.

### `GET /api/agent/history`
```ts
{ eventos: EventoWithRelations[] }
```
`asignadoId = decoded.sub AND estado IN ('CERRADO')`. Limitado a 100.

### `PATCH /api/auth/password`
Body: `{ currentPassword: string, newPassword: string }`. Verifica con `bcrypt.compare`, hashea con `bcrypt.hash`. `200` o `401`.

### Socket-server: `GET /internal/agents-online`
Nuevo endpoint en `services/socket-server`. Requiere token interno (`rol=INTERNAL`). Devuelve la lista de agentes con sesión socket activa.

### `lib/api-auth.ts`
Helpers que leen `X-User-Id` / `X-User-Rol` (inyectados por el middleware) y validan rol. Reemplaza la lógica duplicada en endpoints existentes.

## Tokens y theming

Mantenemos Tailwind 3, HSL legacy, base color `slate`.

Tokens nuevos en `globals.css`:
```css
:root {
    --sidebar: 0 0% 98%;
    --sidebar-foreground: 222.2 84% 4.9%;
    --sidebar-primary: 221.2 83.2% 53.3%;
    --sidebar-primary-foreground: 210 40% 98%;
    --sidebar-accent: 210 40% 94%;
    --sidebar-accent-foreground: 222.2 47.4% 11.2%;
    --sidebar-border: 214.3 31.8% 91.4%;
    --sidebar-ring: 221.2 83.2% 53.3%;
}
```

Llaves `colors.sidebar.*` en `tailwind.config.ts`. Si la CLI inserta tokens en formato OKLCH/v4 al ejecutar `shadcn add`, convertir a HSL antes de commitear.

Tipografía: `Inter` (sin cambios). Iconos: `lucide-react` (sin cambios). Paleta primaria: `221 83% 53%` (sin cambios).

Branding: logo CMV en login (~80–96px de alto). En sidebar: marca lateral compacta (~28px logo + texto "VIPER CMV").

## Dependencias

```bash
npx shadcn@latest add sidebar dropdown-menu breadcrumb tooltip chart drawer skeleton scroll-area
```

`recharts` se instala automáticamente al agregar `chart`.

Sin nuevas dependencias manuales más allá de las que arrastra shadcn.

## Estados (loading, empty, error)

### Loading
- `loading.tsx` por ruta con esqueletos (`Skeleton` de shadcn). Solo en primer load.
- Re-fetches en background (KPIs cada 30s, refresh por socket): valores cambian con transition CSS suave, sin spinner.

### Empty
Patrón consistente: ícono lucide grande, título corto, descripción breve, CTA opcional. Centrado con `min-h-[40vh]`.

| Caso | Copy |
|---|---|
| Home admin sin eventos | "No hay eventos registrados todavía" + CTA "Crear primer evento" |
| Lista filtrada vacía | "No hay eventos que coincidan" + "Limpiar filtros" |
| Lista admin vacía | "No hay eventos" + CTA "Crear evento" |
| Lista agent vacía | "Aún no tienes eventos asignados" |
| Historial agent vacío | "Aún no has cerrado eventos" |
| Agentes online vacío | "No hay agentes conectados en este momento" |
| Reports / Settings | "Próximamente" |

### Errores
- Server-side (RSC throw) → `error.tsx` por ruta. Mensaje genérico + botón "Reintentar" (`reset()`). Log a `console.error`.
- Mutaciones cliente → `toast.error()` con mensaje del backend.
- Socket caído → indicador en SiteHeader (verde/ámbar/rojo + tooltip). KPI agentes online muestra último valor con badge "no actualizado".
- Sesión expirada → `AuthProvider` limpia y redirige a `/login` con toast.

## Plan de implementación

8 fases. Commit por fase. Branch `redesign/dashboard-shell`. Sin feature flag.

1. **Infra**: `shadcn add` + tokens + smoke test.
2. **Shell**: `AppSidebar`, `SiteHeader`, `NavMain`, `NavUser`, `nav-config`. Reescribir `dashboard/layout.tsx`. Eliminar `Navigation.tsx` y `DashboardContent.tsx`.
3. **Login**: refactor con logo CMV.
4. **Mover existentes**: `admin/page.tsx` → `admin/events/page.tsx`. Crear placeholders de las nuevas rutas.
5. **Backend KPIs/chart**: `lib/api-auth.ts` + 5 endpoints + endpoint en socket-server.
6. **Home admin**: `KpiCards`, `EventsAreaChart`, `RecentEventsTable`. Reescribir `admin/page.tsx`.
7. **Mobile-first por página**: headers sticky, drawers, tap targets, loading/empty states.
8. **Pulido**: indicador socket, toasts consistentes, QA visual general.

`npm run build` debe pasar al final de cada fase.

## Testing y QA

No hay framework de tests en el repo (AGENTS.md). QA visual manual estructurado:

- **Por página**, en mobile (375px), tablet (768px), desktop (1280px) — Chrome DevTools:
    - Render no rompe.
    - Tap targets ≥44px en mobile.
    - Sin overflow horizontal.
    - Sticky headers no tapan contenido.
    - Sidebar trigger funciona en mobile, colapsable en desktop.
- **Por flujo**:
    - Admin: login → home → KPI navega → crear evento → aparece en home y lista → cerrar sesión.
    - Agent: login → mis eventos → tomar → cerrar → aparece en historial.
- **Build & typecheck**: `npm run build` final.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `shadcn add` inserta tokens v4/OKLCH y rompe theme actual | Convertir a HSL antes de commitear; smoke test en Fase 1 |
| `recharts` agrega bundle pesado | Aceptable; si crece, lazy-load del chart con `dynamic` |
| `/dashboard/admin` cambia de contenido (era lista, ahora es home) | La URL no cambia, solo el contenido. Quien tenía `/dashboard/admin` en favoritos verá la home; la lista vive ahora en `/dashboard/admin/events` (URL nueva). Cambio de comportamiento esperado, comunicado en el PR |
| Socket-server caído rompe KPI agentes online | Endpoint maneja error y devuelve `count: 0` con `x-stale` |
| `AuthProvider` cambia de contrato | No se toca; el shell solo lee `useAuth()` |

## Lo que explícitamente NO se hace

- Migración Tailwind v3 → v4.
- Dark mode.
- Tests automatizados (E2E o unitarios).
- FAB en mobile (descartado a favor de header sticky con CTA).
- Telemetría / Sentry.
- Cambio de paleta primaria.
- Reescribir lógica de auth, sockets, Prisma.
