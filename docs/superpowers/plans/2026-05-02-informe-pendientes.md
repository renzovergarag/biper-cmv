# Informe de Funcionalidades Pendientes — VIPER CMV

> Fecha: 2026-05-02
> Basado en comparación del plan de implementación vs. código base actual.

---

## Resumen Ejecutivo

La **infraestructura base** del proyecto está construida al ~85%: monorepo, Prisma, autenticación JWT, Socket.io server y API internas funcionan. Sin embargo, **la capa de presentación (UI) y las API públicas de negocio están en estado placeholder (~15%)**. El administrador no puede crear eventos ni asignar agentes porque las páginas del dashboard son texto estático sin lógica ni componentes funcionales.

---

## Estado por Módulo

### 1. Infraestructura y Configuración

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Monorepo npm workspaces | | `package.json` root, scripts dev/build |
| Prisma schema MongoDB | | Modelos: `User`, `Evento`, `EstadoHistorial`, `LogAuditoria` |
| Seed de datos | | 3 usuarios, 5 eventos, historial y logs de prueba |
| Next.js base (web) | | Config, tailwind, layout raíz |
| Socket.io server | | Express + Socket.io con JWT middleware tipado |
| PM2 config | | `ecosystem.config.js` presente |
| Nginx config | | `nginx/biper-cmv.conf` presente |

### 2. Autenticación y Seguridad

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Login API (`POST /api/auth/login`) | | Devuelve JWT en cookie `httpOnly` |
| JWT helpers (jose) | | Generación, verificación, token interno |
| Middleware de protección | | Protege rutas `/dashboard/*` y setea headers `X-User-*` |
| Redirección por rol | | `/dashboard` redirige a `/admin` o `/agent` según rol |
| Logout | **PENDIENTE** | No hay endpoint ni UI para cerrar sesión |
| Protección por rol en subrutas | **PENDIENTE** | Un agente puede navegar manualmente a `/dashboard/admin` y ver la página (aunque no datos) |

### 3. API REST Pública (Next.js)

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| `POST /api/auth/login` | | Funcionando |
| `POST /api/internal/assign` | | Asignación atómica anti-carrera |
| `PATCH /api/internal/update-status` | | Actualización de estado con validaciones |
| `GET /api/events` | **PENDIENTE** | Listar eventos con filtros (estado, urgencia, agente) |
| `POST /api/events` | **PENDIENTE** | Crear evento (solo admin) |
| `GET /api/events/[id]` | **PENDIENTE** | Detalle de evento |
| `GET /api/users/agents` | **PENDIENTE** | Listar agentes activos para asignación |

> **Impacto:** Sin estas APIs, el frontend no tiene de dónde leer ni crear datos. Es el cuello de botella principal.

### 4. Socket.io — Backend

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Auth de conexión (JWT) | | Solo agentes (`rol === "AGENT"`) |
| Handler `evento:asignar` | | Llama a Next.js vía `/api/internal/assign` |
| Handler `evento:actualizar-estado` | | Llama a Next.js vía `/api/internal/update-status` |
| Broadcast `evento:actualizado` | | Emite a todos los clientes conectados |
| Notificación de nuevo evento | **PENDIENTE** | El socket server tiene `POST /internal/events`, pero **nadie lo llama** cuando un admin crea un evento desde Next.js |
| Broadcast a agentes cercanos | **PENDIENTE** | Actualmente emite globalmente (`io.emit`) sin filtros de geolocalización |

### 5. Dashboard Administrador (`/dashboard/admin`)

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Layout base | | Header simple, sin navegación |
| Lista de eventos | **PENDIENTE** | Página es solo texto placeholder |
| Crear evento (formulario) | **PENDIENTE** | No existe formulario ni modal |
| Asignar agente a evento | **PENDIENTE** | No hay select de agentes ni botón de asignar |
| Filtrar/buscar eventos | **PENDIENTE** | |
| Ver detalle/mapa de evento | **PENDIENTE** | No se muestran coordenadas |
| Reportería / historial | **PENDIENTE** | |
| Estadísticas en tiempo real | **PENDIENTE** | No hay conexión socket en frontend |

### 6. Dashboard Agente (`/dashboard/agent`)

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Layout base | | Header simple |
| Indicador "Conectado" | **PLACEHOLDER** | Muestra un punto verde animado, pero **no está conectado a Socket.io** |
| Conexión Socket.io client | **PENDIENTE** | No hay `socket.io-client` ni hooks de conexión en el frontend |
| Recibir notificaciones push | **PENDIENTE** | No hay listeners de `evento:nuevo` |
| Ver mis eventos asignados | **PENDIENTE** | No se consulta la API |
| Cambiar estado (En ruta / Resuelto / Cancelar) | **PENDIENTE** | No hay botones de acción |
| Vista mobile-first funcional | **PENDIENTE** | Es responsive, pero sin funcionalidad |

### 7. Frontend — Integraciones y UX

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Cliente Socket.io en React | **PENDIENTE** | `socket.io-client` no está en `package.json` de web |
| Hook de autenticación (`useAuth`) | **PENDIENTE** | El login hace redirect manual; no hay contexto de auth |
| Hook de datos (`useEventos`, `useAgentes`) | **PENDIENTE** | |
| Componentes reutilizables (tablas, modales, forms) | **PENDIENTE** | |
| Logout / menú de usuario | **PENDIENTE** | |
| Manejo de errores global | **PENDIENTE** | |
| Loading states | **PENDIENTE** | |

### 8. Flujo de Negocio — Gaps Críticos

#### 8.1 Crear evento → Notificar agentes

```
Admin crea evento en UI
    → POST /api/events (PENDIENTE)
    → Next.js guarda en MongoDB
    → ¿Notifica a Socket.io? (PENDIENTE: no hay integración)
    → Socket.io broadcast a agentes (PENDIENTE: emisor no existe)
```

**Problema:** El socket server tiene un endpoint `POST /internal/events` listo para recibir notificaciones, pero **no hay código en Next.js que lo invoque** tras la creación de un evento.

#### 8.2 Asignar evento

```
Admin asigna agente en UI (PENDIENTE: no hay UI)
    → PATCH /api/events/[id]/assign (PENDIENTE)
    → O agente pulsa "Tomar caso" vía Socket
```

Actualmente la asignación solo funciona vía Socket.io (agente iniciando), pero **no hay asignación manual por parte del admin**.

#### 8.3 Seguimiento de estado

```
Agente cambia estado en UI
    → Socket emit "evento:actualizar-estado" (backend listo, frontend no)
    → Broadcast a todos (funciona)
```

El backend está listo, pero el agente no tiene botones para disparar el evento.

---

## Tabla de Prioridades

| Prioridad | Funcionalidad | Impacto | Esfuerzo Estimado |
|-----------|--------------|---------|-------------------|
| **P0 — Crítico** | API `GET/POST /api/events` | Bloquea todo el flujo admin | Medio |
| **P0 — Crítico** | API `GET /api/users/agents` | Necesario para asignación | Bajo |
| **P0 — Crítico** | Formulario crear evento (Admin UI) | Core del negocio | Medio |
| **P0 — Crítico** | Lista de eventos en Admin | Core del negocio | Medio |
| **P1 — Alto** | Conexión Socket.io client + hook | Habilita tiempo real | Medio |
| **P1 — Alto** | Lista de eventos asignados (Agente) | Core del negocio | Medio |
| **P1 — Alto** | Botones cambiar estado (Agente) | Core del negocio | Bajo |
| **P1 — Alto** | Notificar socket al crear evento | Completa el flujo tiempo real | Bajo |
| **P2 — Medio** | Asignación manual por admin | Mejora control operativo | Medio |
| **P2 — Medio** | Logout + menú de navegación | UX básica | Bajo |
| **P2 — Medio** | Protección de rutas por rol | Seguridad | Bajo |
| **P3 — Bajo** | Mapa con coordenadas | Visualización | Medio |
| **P3 — Bajo** | Reportería / filtros avanzados | Operaciones | Alto |
| **P3 — Bajo** | Tests (unit/e2e) | Calidad | Alto |

---

## Recomendaciones Técnicas

1. **Instalar `socket.io-client`** en `apps/web` para habilitar la comunicación en tiempo real desde el frontend.
2. **Crear un `AuthContext`** en React para manejar el estado de sesión, logout y rol del usuario sin depender de redirects manuales.
3. **Crear hooks de datos** (`useEventos`, `useAgentes`) usando `useSWR` o React Query para fetching, caching y revalidación.
4. **Unificar la notificación de nuevos eventos:** al crear un evento desde `POST /api/events`, hacer un `fetch` interno al socket server (`/internal/events`) para disparar el broadcast.
5. **Agregar validación de rol en middleware** o en layouts de dashboard para evitar que agentes accedan a rutas de admin.
6. **Usar Server Components** de Next.js App Router para cargar listas de eventos en el dashboard, y Client Components solo para las partes interactivas (formularios, socket, botones).

---

## Conclusión

El proyecto tiene una **base técnica sólida** (DB, auth, socket server, API internas), pero **carece completamente de la capa de aplicación** que permite a los usuarios interactuar con el sistema. Las prioridades inmediatas son:

1. Construir las API públicas de eventos y agentes.
2. Construir el dashboard del administrador con lista de eventos y formulario de creación.
3. Conectar el dashboard del agente a Socket.io para recibir y gestionar eventos en tiempo real.

Con estas 3 piezas, la aplicación pasaría de ~20% a ~75% de funcionalidad operativa.
