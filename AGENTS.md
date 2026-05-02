# AGENTS.md — biper-cmv

Monorepo con npm workspaces (`apps/*`, `services/*`). Stack: Next.js 14 + Socket.io + MongoDB/Prisma.

## Estructura

- `apps/web` — Next.js (puerto 3000). Entrypoint: `src/app/page.tsx`. API routes en `src/app/api/`.
- `services/socket-server` — Express + Socket.io (puerto 4000). Entrypoint: `src/index.ts`.
- Ambos usan Prisma con el **mismo schema duplicado**. La fuente de verdad implícita es `apps/web/prisma/schema.prisma`; el socket server tiene un comentario que lo referencia.

## Comandos esenciales

```bash
# Dev (ambos servicios)
npm run dev

# Dev individual
npm run dev:web
npm run dev:socket

# Build (web primero, luego socket)
npm run build

# Prisma — se ejecuta sobre apps/web; el socket server tiene sus propios scripts db:*
npm run db:generate
npm run db:push
```

No hay tests, lint ni prettier configurados en el repo.

## Base de datos

- MongoDB 8.0.3 vía Docker Compose (`docker-compose.yml`).
- Puerto **host: 27018** mapeado a **container: 27017**.
- Requiere replica set (`rs0`) y keyfile (`mongo-keyfile`).
- `.env.example` usa `localhost:27017`, pero desde el host se debe conectar a `localhost:27018`.

## Variables de entorno

Se necesitan archivos `.env` en **tres ubicaciones**:

1. **Raíz** (`/.env`) — `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NEXT_PUBLIC_APP_URL`, `SOCKET_SERVER_URL`, `SOCKET_SERVER_INTERNAL_URL`.
2. **`apps/web/.env`** — `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SOCKET_SERVER_URL`.
3. **`services/socket-server/.env`** — `PORT`, `DATABASE_URL`, `JWT_SECRET`, `NEXT_API_URL`.

## Autenticación

- **No usa NextAuth**. JWT custom con la librería `jose` (web) y `jsonwebtoken` (socket).
- Cookie `token` para sesiones de usuario.
- Middleware (`src/middleware.ts`) protege rutas `/dashboard/*` y inyecta headers `X-User-Id` / `X-User-Rol`.
- Tokens internos (`rol: INTERNAL`) para comunicación servicio-a-servicio (expiran en 5 min).

## Arquitectura y convenciones

- **Comunicación interna**: el socket server llama a la web app vía `NEXT_API_URL` usando token interno. Endpoints: `/api/internal/assign` (POST) y `/api/internal/update-status` (PATCH).
- **Nginx** (`nginx/biper-cmv.conf`) expone web y socket.io, pero bloquea `/api/internal/` (`deny all`).
- **bcrypt** es `external` en webpack de Next.js (`next.config.mjs`). No intentar bundle.
- PM2: `ecosystem.config.js` levanta ambos servicios en producción.

## Estilo de código

- Indentación: 4 espacios.
- No usar tabulaciones (`\t`).
- Preferir `const` sobre `let`. No usar `var`.
- El proyecto está en español: modelos Prisma, enums, rutas y mensajes usan español.
