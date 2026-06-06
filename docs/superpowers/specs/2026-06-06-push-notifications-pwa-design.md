# Notificaciones Push tipo app nativa (PWA) — Diseño

**Fecha:** 2026-06-06
**Estado:** Aprobado para planificación

## Problema

Los agentes usan la app web principalmente desde el celular y en movimiento. Cuando dejan el teléfono inactivo/bloqueado en el bolsillo, el sistema operativo móvil suspende la pestaña del navegador: mata la conexión WebSocket de Socket.io y el `AudioContext`, y la API `new Notification()` deja de funcionar porque requiere la página viva. Resultado: cuando un administrador crea un evento, el agente **no recibe ningún aviso ni sonido** y no se entera.

El objetivo es que la app web se comporte casi como una app nativa: que el agente reciba una notificación con sonido/vibración cuando un admin crea un evento, **aunque la app esté cerrada o el teléfono bloqueado**.

## Decisiones de alcance (acordadas)

- **Dispositivos:** mezcla Android + iPhone. Se debe soportar iOS, lo que obliga a: app instalada en la pantalla de inicio ("Agregar a inicio") y iOS 16.4+. En Android es más flexible.
- **Sonido/alerta:** opción reforzada en Android (alta prioridad + vibración insistente + persistente) y estándar en iPhone. Ver "Realidad del sonido" abajo.
- **Eventos que disparan push:** solo **eventos nuevos** (admin crea evento) → push a todos los agentes con suscripción. (Asignaciones y cambios de estado quedan fuera de esta versión.)
- **Onboarding:** banner guía no bloqueante en el panel del agente + interruptor en ajustes. No se obliga.
- **Entrega:** Web Push estándar con **VAPID auto-hospedado** (librería `web-push`). Sin terceros (no FCM SDK, no Firebase).
- **Service worker:** escrito a mano (mínimo), sin `next-pwa`. Sin caché offline en esta versión.

## Arquitectura y flujo de datos

Se reutiliza el flujo actual de creación de eventos y se añade un canal de entrega "push" en paralelo al socket existente.

```
Admin crea evento
   └─ POST /api/events (web)  ── escribe en MongoDB
        ├─ POST → socket-server /internal/events
        │     └─ io.emit("evento:nuevo")        → clientes con app ABIERTA (modal rico actual, sin cambios)
        └─ [NUEVO] fan-out Web Push (fire-and-forget) → TODOS los agentes con suscripción (app cerrada/bloqueada)
              └─ servicio push del navegador (FCM/Apple/Mozilla)
                   └─ Service Worker del agente → muestra notificación + vibración
```

### División de responsabilidades

- **Envío del push:** vive en la **web app**, dentro de `POST /api/events`, tras crear el evento y avisar al socket-server. Decisión basada en un hallazgo de la base de código: el `socket-server` **no instancia `PrismaClient` en runtime** — está desacoplado de la DB y solo habla con ella vía la API web (`api-client.ts`). Poner el fan-out en web es consistente con "web es dueña de la base de datos": el route ya creó el evento con Prisma y ya tiene acceso a las suscripciones. El envío es **fire-and-forget** (no bloquea ni puede hacer fallar la creación del evento). La librería `web-push` y la **clave VAPID privada** viven en la web app. El `socket-server` queda **intacto**.
- **Registro/baja de suscripciones:** API routes en **web**, autenticadas por la cookie JWT (`/api/push/subscribe`, `/api/push/unsubscribe`), porque el cliente habla con la web app y `nginx` bloquea las rutas internas del socket-server.
- **Clave VAPID pública:** se expone al cliente vía `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (mismo valor que la pública; no es secreto).

## Modelo de datos

Cada dispositivo de un agente genera una suscripción push con un `endpoint` único. Un agente puede tener varios dispositivos → varias filas.

```prisma
model SuscripcionPush {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  user      User     @relation("SuscripcionesPush", fields: [userId], references: [id])
  endpoint  String   @unique          // URL del push service; identifica el dispositivo
  p256dh    String                    // clave pública de cifrado del cliente
  auth      String                    // secreto de autenticación del cliente
  userAgent String?                   // diagnóstico (qué dispositivo)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Relación inversa en `User`:

```prisma
suscripcionesPush SuscripcionPush[] @relation("SuscripcionesPush")
```

- `endpoint @unique` permite hacer **upsert** (re-suscribir el mismo dispositivo no duplica).
- El modelo se agrega a `apps/web/prisma/schema.prisma` (donde sí se usa Prisma en runtime) y se regenera el cliente. El schema del socket-server se mantiene espejado por convención del repo, pero el socket-server **no** lee este modelo en runtime.

## Cliente: Service Worker, manifest y onboarding

### Service worker (`apps/web/public/sw.js`, mínimo)

- **`push`:** parsea el payload `{ title, body, eventoId, url }` y llama `self.registration.showNotification` con:
  - `tag: eventoId` (colapsa duplicados del mismo evento),
  - `requireInteraction: true` (persistente hasta atender — Android),
  - `vibrate` con patrón insistente (lo controlamos nosotros),
  - `data.url`, `icon`, `badge`.
- **`notificationclick`:** enfoca una ventana existente de la app o abre una nueva en `data.url` (panel del agente con el evento).
- **Dedup foreground:** antes de mostrar, hace `clients.matchAll({ type: 'window' })`; si hay una ventana **visible/enfocada**, **no** muestra la notificación push (el modal por socket ya cubrió ese caso).
- **`pushsubscriptionchange`:** re-suscribe y re-registra cuando el navegador rota la suscripción.

### Manifest (`apps/web/public/manifest.json`)

- `name`, `short_name`, `display: standalone`, `start_url`, `theme_color`, `background_color`.
- **Íconos 192×192 y 512×512 (maskable)** derivados del logo existente en `public/`.
- Se enlaza en el `<head>` del layout raíz (`apps/web/src/app/layout.tsx`) junto con los meta tags de PWA, para habilitar "Agregar a inicio" en iOS.

### Onboarding / habilitación

- **Hook `usePushSubscription`:** registra el SW, pide permiso de notificaciones, hace `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` y envía la suscripción a `POST /api/push/subscribe`. Expone estado: `no-soportado | sin-permiso | suscrito | bloqueado`.
- **Banner guía** (no bloqueante) en `AgentDashboardClient`, visible cuando el agente no está suscrito:
  - **iPhone no instalado** (`display-mode: standalone` / `navigator.standalone` falso): instrucciones "Compartir → Agregar a inicio" (iOS solo permite push con la PWA instalada).
  - **Permiso denegado:** cómo reactivarlo en ajustes del navegador.
  - **Listo:** botón "Activar notificaciones".
- **Interruptor en ajustes:** activar/desactivar. Desactivar = `POST /api/push/unsubscribe` + `subscription.unsubscribe()` en el cliente.

## Servidor: VAPID y envío del push

- **Dependencia:** `web-push` en `apps/web`.
- **Config VAPID** desde env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:...`), inicializada en un módulo `lib/push.ts` de la web app.
- En `POST /api/events`, tras crear el evento y avisar al socket-server, fan-out push **fire-and-forget** (no se hace `await` que pueda bloquear/fallar la respuesta):
  1. `prisma.suscripcionPush.findMany()`.
  2. Por cada suscripción, `webpush.sendNotification(sub, JSON.stringify(payload))` con payload:
     `{ title: "Nuevo evento", body: "<titulo> – <direccionExacta>", eventoId, url: "/dashboard/agent?evento=<id>" }`.
  3. Envíos en paralelo con `Promise.allSettled`.
- **API routes en web** (middleware JWT, solo rol `AGENT`):
  - `POST /api/push/subscribe` → upsert por `endpoint`.
  - `POST /api/push/unsubscribe` → borra por `endpoint`.

## Realidad del sonido (límite técnico asumido)

Con Web Push y la app **cerrada**, el navegador en Android **no permite que el sitio defina por código un sonido propio tipo alarma**; usa el canal de notificaciones que el navegador asigna al sitio. Lo que **sí** se garantiza con la app cerrada:

- Notificación **heads-up de alta prioridad** (comportamiento por defecto del Web Push en Android).
- **Vibración insistente** con patrón propio (controlado por nosotros).
- **Persistente** hasta atender (`requireInteraction`).
- El **sonido de notificación del dispositivo** (no silencioso).
- Opcional: **guía única** para que el agente suba/cambie el sonido del canal del sitio en Ajustes de Android (única vía real para un "tono alarma").

Con la app **abierta** se mantiene la alarma fuerte actual de 4.5s (Web Audio). En **iPhone**: banner + tono estándar + vibración del sistema (iOS ignora `vibrate` y `requireInteraction`; no admite sonidos personalizados ni "alertas críticas" para web).

## Manejo de errores y limpieza

- Al enviar, si `web-push` responde **404/410 (Gone)** → suscripción expirada/revocada → **se elimina** de Mongo automáticamente. Otros errores se loguean sin romper el resto del fan-out.
- Cliente: ante cambio de suscripción (`pushsubscriptionchange` o re-chequeo al abrir la app) → re-suscribe y re-registra.
- El fan-out **nunca** hace fallar la creación del evento: corre desacoplado; los errores quedan en logs.

## Configuración (env) y claves

- Generar una vez: `npx web-push generate-vapid-keys`.
- **apps/web/.env** (y raíz): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, y `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= public key, expuesta al cliente).
- Actualizar `.env.example` y la sección de variables de `AGENTS.md`.

## Pruebas

No hay framework de tests en el repo; el énfasis es QA manual en dispositivos reales.

- **Script** `apps/web/scripts/send-test-push.ts`: dispara un push de prueba a un agente para validar end-to-end sin crear eventos reales.
- **Checklist de QA manual:**
  - Android Chrome, app cerrada / pantalla bloqueada → llega heads-up + vibración + persistente.
  - iPhone Safari instalado (iOS 16.4+), app cerrada → llega banner + sonido estándar.
  - App en primer plano → no se duplica (modal por socket, sin push visible).
  - Suscripción expirada → se limpia de Mongo al enviar.
  - Activar/desactivar desde el interruptor de ajustes funciona en ambos sentidos.

## Fuera de alcance (esta versión)

- Push por asignaciones dirigidas o cambios de estado.
- Caché offline / funcionamiento sin conexión (migrable a `@ducanh2912/next-pwa` después sin perder lo hecho).
- Sonido alarma personalizado garantizado con la app cerrada (límite del navegador).
- FCM/Firebase u otros proveedores externos.
```
