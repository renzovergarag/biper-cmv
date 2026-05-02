# SPEC: Sistema de Despacho y Gestión de Eventos Territoriales en Tiempo Real

**Fecha:** 2026-05-02
**Proyecto:** biper-cmv

---

## 1. Arquitectura General

### 1.1 Monorepo Structure

```
biper-cmv/
├── apps/
│   └── web/                        # Next.js 14+ (App Router)
│       ├── src/
│       │   ├── app/                # Rutas App Router
│       │   ├── components/         # Componentes React
│       │   ├── lib/                # Utils, Prisma client, auth
│       │   ├── actions/            # Server Actions
│       │   └── types/              # Tipos compartidos
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
├── services/
│   └── socket-server/              # Microservicio Socket.io
│       ├── src/
│       │   ├── index.ts            # Entry point
│       │   ├── socket/             # Handlers de eventos socket
│       │   ├── routes/             # REST endpoints internos
│       │   └── lib/                # JWT validation, emit helpers
│       ├── prisma/
│       │   └── schema.prisma       # Copia del schema
│       └── package.json
├── package.json                    # Workspace root (npm workspaces)
└── docs/
    └── specs/
```

### 1.2 Communication Pattern

- **Next.js → Socket Server:** REST HTTP POST a endpoint interno `/internal/events`
- **Socket Server → Agentes:** Socket.io broadcast
- **Auth:** JWT con secret compartido

---

## 2. Modelos de Base de Datos (Prisma Schema)

### 2.1 Enums

| Enum | Valores |
|------|---------|
| `Rol` | ADMIN, AGENT |
| `NivelUrgencia` | BAJA, MEDIA, ALTA, CRITICA |
| `EstadoEvento` | PENDIENTE, ASIGNADO, EN_RUTA, RESUELTO, CANCELADO |

### 2.2 Models

**User**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String @id | MongoDB ObjectId |
| email | String @unique | |
| password | String | Hash bcrypt |
| nombre | String | |
| rol | Rol | ADMIN o AGENT |
| activo | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Evento**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String @id | MongoDB ObjectId |
| titulo | String | |
| origen | String | teléfono, radio, rrss |
| nivelUrgencia | NivelUrgencia | |
| direccionExacta | String | |
| coordenadas | Json? | { lat, lng } opcional |
| telefonoContacto | String? | Opcional |
| estado | EstadoEvento | @default(PENDIENTE) |
| creadorId | String @db.ObjectId | FK → User |
| asignadoId | String? @db.ObjectId | FK → User |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| assignedAt | DateTime? | |
| resolvedAt | DateTime? | |

**EstadoHistorial**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String @id | |
| eventoId | String @db.ObjectId | FK → Evento |
| estado | EstadoEvento | |
| usuarioId | String @db.ObjectId | |
| timestamp | DateTime | @default(now()) |
| notas | String? | |

**LogAuditoria**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String @id | |
| accion | String | CREATED, ASSIGNED, STATUS_CHANGED, RESUELTO, CANCELLED |
| entidad | String | Evento, User |
| entidadId | String @db.ObjectId | |
| usuarioId | String @db.ObjectId | |
| detalle | Json? | { estadoAnterior, estadoNuevo } |
| timestamp | DateTime | @default(now()) |

### 2.3 Índices

- Evento: `estado`, `creadorId`, `asignadoId`, `nivelUrgencia`, `createdAt`
- LogAuditoria: `[entidad, entidadId]`, `usuarioId`, `timestamp`, `accion`

---

## 3. Flujo de Comunicación

### 3.1 Creación de Evento (Admin)

```
1. Admin completa formulario en Next.js
2. Server Action valida y guarda en MongoDB via Prisma
3. Next.js ejecuta HTTP POST a /internal/events del Socket Server
4. Socket Server valida JWT interno
5. Socket Server emite broadcast 'evento:nuevo' a todos los Agentes conectados
6. Agentes reciben el evento en tiempo real (notificación visual/audio)
```

### 3.2 Auto-Asignación (Agente)

```
1. Agente toca "Asignarme" en su app mobile
2. Socket Client emite 'evento:asignar' con { eventoId }
3. Socket Server recibe y llama a HTTP POST /internal/assign
4. Next.js ejecuta findOneAndUpdate con filtro { _id: eventoId, estado: 'PENDIENTE' }
5. Si éxito: actualiza estado, retorna evento asignado
6. Si falla (otro agente llegó primero): retorna error EVENTO_NO_DISPONIBLE
7. Socket Server broadcasta 'evento:actualizado' a todos los clientes
8. Agente que perdió la carrera recibe notificación de que el evento ya no está disponible
```

### 3.3 Actualización de Estado (Agente)

```
1. Agente marca "En Ruta" o "Resuelto"
2. Socket Client emite 'evento:actualizar-estado' con { eventoId, nuevoEstado }
3. Socket Server llama a Next.js /internal/update-status
4. Next.js actualiza estado y crea registro en EstadoHistorial
5. Se registra en LogAuditoria
6. Socket Server broadcasta 'evento:actualizado' a todos
```

---

## 4. Autenticación y Autorización (RBAC)

### 4.1 JWT Structure

```typescript
interface JWTPayload {
  sub: string;      // userId
  email: string;
  rol: 'ADMIN' | 'AGENT';
  iat: number;
  exp: number;
}
```

### 4.2 Middleware de Autenticación

| Ruta | Método | Auth | Rol |
|------|--------|------|-----|
| `/api/auth/login` | POST | None | - |
| `/api/auth/register` | POST | None | - |
| `/api/events` | GET | JWT | ADMIN |
| `/api/events` | POST | JWT | ADMIN |
| `/api/events/[id]` | GET | JWT | ADMIN, AGENT (owner or assigned) |
| `/api/events/[id]/assign` | POST | JWT | AGENT |
| `/api/events/[id]/status` | PATCH | JWT | AGENT (assigned) |
| `/internal/*` | ALL | Internal JWT | Internal |

### 4.3 Validación de Agentes en Socket

```typescript
// Socket Server: validar JWT en handshake
socket.on('connect', (socket) => {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.rol !== 'AGENT') {
    socket.disconnect();
  }
});
```

---

## 5. Prevención de Condición de Carrera

### 5.1 Operación Atómica de Auto-Asignación

```typescript
// Prisma (MongoDB): findOneAndUpdate atómico
const evento = await prisma.evento.findOneAndUpdate(
  {
    where: { id: eventoId },
    data: {
      estado: 'ASIGNADO',
      asignadoId: agenteId,
      assignedAt: new Date()
    }
  },
  {
    // Filtro atómico: solo actualiza si estado actual es PENDIENTE
    // Equivalente a: { estado: { $eq: 'PENDIENTE' } }
  }
);

// En Prisma MongoDB, usar filter en update
await prisma.evento.updateMany({
  where: {
    id: eventoId,
    estado: 'PENDIENTE'  // CONDICIÓN ATÓMICA
  },
  data: {
    estado: 'ASIGNADO',
    asignadoId: agenteId,
    assignedAt: new Date()
  }
});
```

---

## 6. Stack Tecnológico

| Componente | Herramienta | Versión |
|------------|-------------|---------|
| Runtime | Node.js | 20 LTS |
| Web Framework | Next.js | 14+ |
| UI | React | 18 |
| Styling | Tailwind CSS | 3.4 |
| Components | shadcn/ui | latest |
| Database | MongoDB | 7 |
| ORM | Prisma | 5+ |
| Socket Server | Socket.io | 4+ |
| Socket Server HTTP | Express | 4 |
| Auth | JWT (jsonwebtoken) | 9 |
| Deploy Web | PM2 | 2 |
| Deploy Socket | PM2 | 2 |
| Web Server | Nginx | latest |

---

## 7. Endpoints Internos (Socket Server ↔ Next.js)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/internal/events` | POST | Crear nuevo evento (Next.js → Socket Server) |
| `/internal/assign` | POST | Auto-asignación atómica |
| `/internal/update-status` | PATCH | Actualizar estado de evento |
| `/internal/health` | GET | Health check |

---

## 8. Próximos Pasos

1. Inicializar monorepo con npm workspaces
2. Crear proyecto Next.js con Prisma
3. Crear Socket Server con Express + Socket.io
4. Implementar modelos Prisma
5. Implementar autenticación JWT
6. Implementar Server Actions y API routes
7. Implementar Socket handlers
8. Implementar UI Admin y Agent
9. Configurar Nginx y PM2