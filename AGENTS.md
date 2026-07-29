# AGENTS.md — viper-cmv

Monorepo con npm workspaces (`apps/*`, `services/*`). Stack: Next.js 14 + Socket.io + MongoDB/Prisma.

## Estructura

- `apps/web` — Next.js (puerto 3000 en dev, **3001 en producción**). Entrypoint: `src/app/page.tsx`. API routes en `src/app/api/`.
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

**En desarrollo:**

- MongoDB 8.0.3 vía Docker Compose (`docker-compose.yml`).
- Puerto **host: 27018** mapeado a **container: 27017**.
- Requiere replica set (`rs0`) y keyfile (`mongo-keyfile`).
- `.env.example` usa `localhost:27017`, pero desde el host se debe conectar a `localhost:27018`.

**En producción:** no se usa Docker. MongoDB corre como servicio nativo (`mongod.service`) escuchando en el **27017**, y ese es el puerto del `DATABASE_URL` desplegado.

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
- **Nginx** (`nginx/viper-cmv.conf`) expone web y socket.io, pero bloquea `/api/internal/` (`deny all`).
- **bcrypt** es `external` en webpack de Next.js (`next.config.mjs`). No intentar bundle.
- PM2: `ecosystem.config.js` levanta ambos servicios en producción (ver sección siguiente).

## Producción

Verificado el 29-jul-2026. Si vas a diagnosticar una caída, esto es lo que necesitas:

- **URL:** `https://viper.cmvalparaiso.cl` — VPS Ubuntu, acceso por SSH.
- **El código NO está en `/var/www/viper-cmv`.** Esa carpeta solo contiene el `actions-runner` de GitHub Actions. El deploy vive en el workspace del runner:
  `/var/www/viper-cmv/actions-runner/_work/viper-cmv/viper-cmv/`
  El workflow usa `actions/checkout` sobre un runner self-hosted, así que el código queda donde el runner lo descarga, no en una ruta propia.
- **Puertos:** `viper-web` en **3001** (no 3000) y `viper-socket` en **4000**. El 3000 lo ocupa **otro proyecto** alojado en el mismo VPS, que comparte el mismo PM2 del usuario de deploy. Un 502 en viper se diagnostica mirando el 3001.
- **Nginx:** el vhost activo (`/etc/nginx/sites-enabled/viper-cmv`) deriva de `nginx/viper-cmv.conf` pero no es idéntico — Certbot le inyectó la configuración SSL al emitir el certificado. No sobrescribir el del servidor con el del repo sin revisar esa diferencia.
- **PM2:** corre bajo `pm2-renzo.service` (`ExecStart=pm2 resurrect`, `ExecStop=pm2 kill`). La lista de procesos a resucitar vive en `~/.pm2/dump.pm2` y **solo se actualiza con `pm2 save`**. Si el dump no incluye `viper-web` y `viper-socket`, la app no vuelve tras un reinicio del servidor aunque todo lo demás esté bien — eso causó la caída del 29-jul-2026. El workflow de deploy corre `pm2 save` para mantenerlo sincronizado.
- **Actualizaciones automáticas:** `apt-daily-upgrade` está activo. Una actualización de paquetes base (glibc, por ejemplo) reinicia servicios, incluido PM2. El deploy debe tolerar reinicios no anunciados.

## UI / Front-end

- **Usar shadcn/ui** para componentes de la interfaz en `apps/web`.
- Los componentes se instalan en `src/components/ui/` vía `npx shadcn add <componente>`.
- Tailwind CSS ya está configurado (`tailwind.config.ts`).

## Estilo de código

- Indentación: 4 espacios.
- No usar tabulaciones (`\t`).
- Preferir `const` sobre `let`. No usar `var`.
- El proyecto está en español: modelos Prisma, enums, rutas y mensajes usan español.

## Notificaciones Push (PWA)

- Web Push con VAPID auto-hospedado (librería `web-push` en `apps/web`).
- Variables: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (en `apps/web/.env` y raíz). Generar con `npx web-push generate-vapid-keys`.
- El envío se hace en `POST /api/events` (fire-and-forget) leyendo `SuscripcionPush`.
- Service worker en `apps/web/public/sw.js`; manifest en `apps/web/public/manifest.json`.
- Probar: `npm run test:push` (desde `apps/web`).
- iPhone requiere la PWA instalada ("Agregar a inicio") + iOS 16.4+.
