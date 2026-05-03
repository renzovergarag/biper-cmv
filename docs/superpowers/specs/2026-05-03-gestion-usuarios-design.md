# Especificación de Diseño: Gestión de Usuarios, Agentes Conectados y Logs de Sesión

**Fecha:** 2026-05-03  
**Enfoque:** A — Socket-driven + Prisma  
**Rol objetivo:** ADMIN

---

## 1. Objetivo

Dotar al administrador de un módulo completo para:
- Gestionar usuarios del sistema (CRUD con RBAC)
- Visualizar agentes conectados en tiempo real
- Auditar inicios y cierres de sesión de los usuarios

---

## 2. Modelo de Datos

### 2.1 Sin nuevas tablas

No se requiere migración de schema. Se reutiliza el modelo `LogAuditoria` existente.

### 2.2 Convención para logs de sesión

| Campo | Valor |
|-------|-------|
| `accion` | `LOGIN` o `LOGOUT` |
| `entidad` | `"Sesion"` |
| `entidadId` | `usuarioId` |
| `usuarioId` | ID del usuario que inicia/cierra sesión |
| `detalle` | `{ ip: string, userAgent: string }` |
| `eventoId` | `null` |

### 2.3 Trackeo de conectados (solo memoria)

El socket server mantiene un `Map<userId, AgenteConectado>` en memoria (no en BD):

```typescript
interface AgenteConectado {
    userId: string;
    email: string;
    nombre: string;
    socketId: string;
    connectedAt: Date;
}
```

---

## 3. APIs REST

Base path: `/api/admin/*` — todas requieren token de usuario con `rol: ADMIN`.

### 3.1 GET `/api/admin/users`

Lista todos los usuarios.

**Query params (opcionales):**
- `rol`: `ADMIN` | `AGENT`
- `activo`: `true` | `false`
- `search`: búsqueda por nombre o email

**Respuesta:** `{ data: User[] }` — sin campo `password`.

### 3.2 POST `/api/admin/users`

Crea un nuevo usuario.

**Body:**
```json
{
    "email": "string (único)",
    "nombre": "string",
    "password": "string (mín 6 chars)",
    "rol": "ADMIN | AGENT"
}
```

**Respuesta:** `{ usuario: User }` (201) | `{ error: string, mensaje: string }` (400/409)

### 3.3 GET `/api/admin/users/[id]`

Obtiene un usuario por ID.

**Respuesta:** `{ usuario: User }` | `{ error: string, mensaje: string }` (404)

### 3.4 PATCH `/api/admin/users/[id]`

Actualiza datos de un usuario.

**Body (todos opcionales):**
```json
{
    "email": "string",
    "nombre": "string",
    "password": "string (mín 6 chars)",
    "rol": "ADMIN | AGENT",
    "activo": "boolean"
}
```

**Respuesta:** `{ usuario: User }` | `{ error, mensaje }` (400/404)

### 3.5 DELETE `/api/admin/users/[id]`

Desactiva un usuario (soft delete: `activo = false`).

**Validaciones:**
- No se puede desactivar a sí mismo
- No se puede desactivar al último admin activo

**Respuesta:** `{ usuario: User }` | `{ error, mensaje }` (400/404)

### 3.6 GET `/api/admin/sessions`

Lista logs de sesión.

**Query params:** `usuarioId`, `fechaDesde` (ISO), `fechaHasta` (ISO), `limit` (default 50).

**Respuesta:** `{ data: LogSesion[] }` ordenado por `timestamp` descendente.

### 3.7 POST `/api/internal/session-log` (INTERNAL)

Endpoint interno para que el socket server registre LOGIN/LOGOUT.

**Headers:** `Authorization: Bearer <internal-token>`  
**Body:** `{ usuarioId: string, accion: "LOGIN" | "LOGOUT", ip: string, userAgent: string }`

**Respuesta:** `{ success: true }` | `{ error }` (401)

---

## 4. Socket Server

### 4.1 Middleware extendido

`authenticateSocket` acepta tanto `AGENT` como `ADMIN`:

```typescript
if (decoded.rol !== "AGENT" && decoded.rol !== "ADMIN") {
    return next(new Error("Acceso denegado"));
}
```

### 4.2 Trackeo de agentes

`handlers.ts` mantiene `const agentesConectados = new Map<string, AgenteConectado>()`.

**on connection (AGENT):**
1. Guardar en `agentesConectados.set(user.sub, { ... })`
2. Unir a sala `agent:${user.sub}`
3. Emitir `agentes:lista` (lista completa) a sala `admin`
4. Emitir `agentes:conectado` (solo el nuevo) a sala `admin`
5. Llamar `POST /api/internal/session-log` con `accion: LOGIN`

**on connection (ADMIN):**
1. Unir a sala `admin`
2. Emitir `agentes:lista` (snapshot actual) al admin que se conecta

**on disconnect (AGENT):**
1. Remover de `agentesConectados`
2. Emitir `agentes:desconectado { userId }` a sala `admin`
3. Llamar `POST /api/internal/session-log` con `accion: LOGOUT`

**on disconnect (ADMIN):** solo abandonar sala `admin`.

### 4.3 Eventos socket nuevos

| Evento | Dirección | Payload | Destino |
|--------|-----------|---------|---------|
| `agentes:lista` | Server → Admin | `AgenteConectado[]` | Admin que se conecta |
| `agentes:conectado` | Server → Admin | `AgenteConectado` | Sala `admin` |
| `agentes:desconectado` | Server → Admin | `{ userId }` | Sala `admin` |

---

## 5. Frontend

### 5.1 Layout del Dashboard Admin

El layout actual es un Server Component que no conoce el rol. Se crea un wrapper client component `DashboardContent` que envuelve el contenido y renderiza condicionalmente el `ConnectedAgentsPanel` según el rol obtenido de `useAuth()`:

```
<DashboardLayout>                              ← Server Component
  <Navigation />
  <DashboardContent>                           ← Client Component
    <main className="flex-1">{children}</main>
    <ConnectedAgentsPanel />                   ← se autohide si rol != ADMIN
  </DashboardContent>
</DashboardLayout>
```

`ConnectedAgentsPanel` verifica `user.rol === "ADMIN"` desde `useAuth()` y retorna `null` si no es admin, evitando lógica condicional en el layout.

### 5.2 Componentes nuevos

| Componente | Tipo | Descripción |
|------------|------|-------------|
| `DashboardContent` | Client | Wrapper que renderiza children + ConnectedAgentsPanel condicional por rol |
| `ConnectedAgentsPanel` | Client | Panel lateral con lista de agentes conectados en tiempo real |
| `UsersPageClient` | Client | Tabla CRUD + pestañas + modal crear/editar |
| `UserFormModal` | Client | Modal reutilizable para crear/editar usuario |
| `SessionLogsTab` | Client | Tabla de logs de sesión con filtros |

### 5.3 Vista de Usuarios (`/dashboard/admin/users`)

Server Component que:
1. Verifica token + rol ADMIN
2. Pasa solo `socketUrl` al client component
3. El client component carga usuarios vía `fetch(/api/admin/users)` y sesiones vía `fetch(/api/admin/sessions)`

**Pestañas:**
- **Usuarios:** tabla con columnas: avatar (iniciales), nombre, email, rol (badge), estado (activo/inactivo), acciones (editar/desactivar)
- **Logs de Sesión:** tabla con columnas: usuario, acción (LOGIN/LOGOUT), fecha, IP, user agent. Filtros por usuario y rango de fechas.

**Modal crear/editar:** formulario con nombre, email, contraseña (solo en creación, opcional en edición), selector de rol.

### 5.4 Panel de Agentes Conectados (`ConnectedAgentsPanel`)

- Se conecta a socket.io con token del admin (del contexto `useAuth`)
- Escucha `agentes:lista`, `agentes:conectado`, `agentes:desconectado`
- Renderiza lista de tarjetas con avatar (iniciales), nombre, email, "Conectado hace X min" (contador que se actualiza cada 60s)
- Si no hay conectados: mensaje "Sin agentes conectados"
- Ancho fijo ~300px, sticky, altura completa del viewport menos el header

### 5.5 Navegación

Agregar enlace "Gestión de Usuarios" en `Navigation.tsx`, visible solo para ADMIN.

---

## 6. Seguridad

- Contraseñas nunca se devuelven en respuestas API (Prisma `omit` o `select` explícito)
- Un admin no puede desactivarse/eliminarse a sí mismo
- No se puede eliminar el último admin activo del sistema
- Token INTERNAL protege el endpoint de session-log
- Rutas `/api/admin/*` protegidas por verificación de token + rol ADMIN
- El socket middleware restringe admin a sala `admin` únicamente

---

## 7. Archivos afectados

### Nuevos
- `apps/web/src/app/api/admin/users/route.ts`
- `apps/web/src/app/api/admin/users/[id]/route.ts`
- `apps/web/src/app/api/admin/sessions/route.ts`
- `apps/web/src/app/api/internal/session-log/route.ts`
- `apps/web/src/app/dashboard/admin/users/page.tsx`
- `apps/web/src/components/DashboardContent.tsx`
- `apps/web/src/components/ConnectedAgentsPanel.tsx`
- `apps/web/src/components/UserFormModal.tsx`
- `apps/web/src/components/SessionLogsTab.tsx`

### Modificados
- `apps/web/src/app/dashboard/layout.tsx` — panel lateral para admin
- `apps/web/src/components/Navigation.tsx` — enlace a gestión de usuarios
- `apps/web/src/middleware.ts` — matcher para `/api/admin/*`
- `apps/web/src/hooks/useSocket.ts` — soporte para namespace admin
- `apps/web/src/types/index.ts` — tipos `AgenteConectado`, `LogSesion`
- `services/socket-server/src/socket/middleware.ts` — aceptar ADMIN
- `services/socket-server/src/socket/handlers.ts` — trackeo agentes + eventos admin

---

## 8. Fuera de alcance

- Rate limiting
- Recuperación de contraseña / reset por email
- 2FA / MFA
- Invitación por email para nuevos usuarios
- Exportación CSV/PDF de logs
- Gráficos de actividad en dashboard
