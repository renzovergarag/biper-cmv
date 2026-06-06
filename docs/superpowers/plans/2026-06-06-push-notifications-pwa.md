# Notificaciones Push tipo PWA — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los agentes reciban una notificación con sonido/vibración cuando un admin crea un evento, aunque la app web esté cerrada o el celular bloqueado.

**Architecture:** Web Push estándar con VAPID auto-hospedado. El cliente registra un service worker mínimo y una suscripción push; la web app guarda las suscripciones en MongoDB (Prisma) y, al crear un evento en `POST /api/events`, hace fan-out de los push (fire-and-forget). El `socket-server` queda intacto. La app se vuelve instalable (manifest + íconos) para habilitar Web Push en iPhone.

**Tech Stack:** Next.js 14 (App Router), Prisma + MongoDB, librería `web-push`, Service Worker + Web Push API, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-06-06-push-notifications-pwa-design.md`

---

## Convenciones del repo (recordatorio para el ejecutor)

- Indentación **4 espacios**, sin tabs. Preferir `const`. Código y mensajes en **español**.
- UI con **shadcn/ui** (componentes en `src/components/ui/`).
- **No hay framework de tests** en el repo. La verificación es: `npm run build` (typecheck), scripts `tsx`, `curl`, y QA manual en dispositivos. No inventes Jest/Vitest.
- El schema Prisma vive en `apps/web/prisma/schema.prisma`; el cliente se regenera con `npm run db:generate` (desde `apps/web`) y se aplica con `npm run db:push`.
- Comandos Prisma/scripts se ejecutan desde `apps/web` salvo que se indique lo contrario.

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `apps/web/prisma/schema.prisma` | Modificar | Modelo `SuscripcionPush` + relación en `User` |
| `services/socket-server/prisma/schema.prisma` | Modificar | Espejo del modelo (convención; no se usa en runtime) |
| `apps/web/src/lib/push.ts` | Crear | Envío Web Push (sin Prisma); devuelve endpoints muertos |
| `apps/web/src/app/api/push/subscribe/route.ts` | Crear | Registrar/actualizar suscripción (upsert) |
| `apps/web/src/app/api/push/unsubscribe/route.ts` | Crear | Eliminar suscripción |
| `apps/web/src/app/api/events/route.ts` | Modificar | Fan-out push tras crear evento |
| `apps/web/public/sw.js` | Crear | Service worker: `push` + `notificationclick` |
| `apps/web/public/manifest.json` | Crear | Manifest PWA |
| `apps/web/public/icons/icon-192.png`, `icon-512.png` | Crear | Íconos de la PWA |
| `apps/web/src/app/layout.tsx` | Modificar | Enlazar manifest + metadata PWA |
| `apps/web/src/hooks/usePushSubscription.ts` | Crear | Hook: registrar SW, permiso, suscribir/desuscribir |
| `apps/web/src/components/PushNotificationsBanner.tsx` | Crear | Banner guía de habilitación |
| `apps/web/src/components/AgentDashboardClient.tsx` | Modificar | Montar el banner |
| `apps/web/scripts/send-test-push.ts` | Crear | Script de prueba end-to-end |
| `apps/web/package.json` | Modificar | Deps `web-push`/`dotenv` + script `test:push` |
| `.env.example`, `AGENTS.md` | Modificar | Documentar variables VAPID |

---

## Task 1: Modelo de datos `SuscripcionPush`

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `services/socket-server/prisma/schema.prisma`

- [ ] **Step 1: Agregar el modelo y la relación en el schema de web**

En `apps/web/prisma/schema.prisma`, dentro del `model User { ... }`, agrega esta línea junto a las otras relaciones (después de `historialEstado  EstadoHistorial[]`):

```prisma
  suscripcionesPush SuscripcionPush[] @relation("SuscripcionesPush")
```

Y al final del archivo, agrega el modelo nuevo:

```prisma
model SuscripcionPush {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  user      User     @relation("SuscripcionesPush", fields: [userId], references: [id])
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Espejar el modelo en el schema del socket-server**

Repite exactamente los mismos dos cambios (la línea en `User` y el bloque `model SuscripcionPush`) en `services/socket-server/prisma/schema.prisma`, para mantener los schemas sincronizados según la convención del repo. (El socket-server no lo lee en runtime, pero el repo mantiene los schemas espejados.)

- [ ] **Step 3: Regenerar el cliente Prisma y aplicar a la base de datos**

Run (desde `apps/web`):
```bash
npm run db:generate && npm run db:push
```
Expected: `db:generate` termina con "Generated Prisma Client". `db:push` reporta que el schema está en sync (crea la colección `SuscripcionPush` / índice único en `endpoint`). Sin errores.

- [ ] **Step 4: Verificar que el tipo existe en el cliente generado**

Run (desde `apps/web`):
```bash
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.suscripcionPush.count().then(c => { console.log('OK count=', c); return p.\$disconnect(); });"
```
Expected: imprime `OK count= 0` sin errores de tipo (confirma que el modelo se generó y la colección es consultable).

- [ ] **Step 5: Commit**

```bash
git add apps/web/prisma/schema.prisma services/socket-server/prisma/schema.prisma
git commit -m "feat(push): agregar modelo SuscripcionPush al schema Prisma

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Dependencias, claves VAPID y variables de entorno

**Files:**
- Modify: `apps/web/package.json`
- Modify: `.env.example`
- Modify: `apps/web/.env` (local, no se commitea)
- Modify: raíz `.env` (local, no se commitea)

- [ ] **Step 1: Instalar dependencias en la web app**

Run (desde `apps/web`):
```bash
npm install web-push && npm install -D dotenv @types/web-push
```
Expected: `web-push` aparece en `dependencies`; `dotenv` y `@types/web-push` en `devDependencies` de `apps/web/package.json`.

- [ ] **Step 2: Generar las claves VAPID (una sola vez)**

Run:
```bash
npx web-push generate-vapid-keys
```
Expected: imprime `Public Key:` y `Private Key:`. **Copia ambos valores** para el siguiente paso.

- [ ] **Step 3: Escribir las variables en `apps/web/.env` y en el `.env` de la raíz**

Agrega a `apps/web/.env` (reemplaza los valores por los generados):
```
VAPID_PUBLIC_KEY=<public key generada>
VAPID_PRIVATE_KEY=<private key generada>
VAPID_SUBJECT=mailto:admin@biper-cmv.cl
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<misma public key>
```
Agrega las mismas cuatro líneas al `.env` de la raíz del repo (para que ambos entornos las tengan disponibles).

- [ ] **Step 4: Documentar las variables en `.env.example`**

Agrega al final de `.env.example`:
```
# Web Push (notificaciones). Generar con: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@biper-cmv.cl
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

- [ ] **Step 5: Agregar script `test:push` a `apps/web/package.json`**

En la sección `"scripts"` de `apps/web/package.json`, agrega:
```json
    "test:push": "tsx scripts/send-test-push.ts",
```

- [ ] **Step 6: Verificar que las variables se leen**

Run (desde `apps/web`):
```bash
npx tsx -e "import 'dotenv/config'; console.log('pub?', !!process.env.VAPID_PUBLIC_KEY, 'priv?', !!process.env.VAPID_PRIVATE_KEY);"
```
Expected: `pub? true priv? true`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json package-lock.json .env.example
git commit -m "feat(push): agregar dependencia web-push y variables VAPID

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Módulo de envío `lib/push.ts`

**Files:**
- Create: `apps/web/src/lib/push.ts`

Este módulo NO importa Prisma (para que sea utilizable desde scripts `tsx` sin resolver el alias `@/`). Recibe las suscripciones como parámetro y devuelve los endpoints muertos para que el llamador los elimine.

- [ ] **Step 1: Crear `apps/web/src/lib/push.ts`**

```ts
import webpush from "web-push";

let configurado = false;

function getWebPush() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@biper-cmv.cl";

    if (!publicKey || !privateKey) {
        return null;
    }
    if (!configurado) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        configurado = true;
    }
    return webpush;
}

export interface SuscripcionPushLike {
    endpoint: string;
    p256dh: string;
    auth: string;
}

export interface EventoPushInput {
    id: string;
    titulo: string;
    direccionExacta: string;
}

// Envía el push a todas las suscripciones. Devuelve los endpoints que ya no
// existen (404/410) para que el llamador los elimine de la base de datos.
export async function enviarPushASuscripciones(
    suscripciones: SuscripcionPushLike[],
    evento: EventoPushInput
): Promise<string[]> {
    const wp = getWebPush();
    if (!wp) {
        console.warn("[push] VAPID no configurado; se omite el envío push");
        return [];
    }

    const payload = JSON.stringify({
        title: "Nuevo evento",
        body: `${evento.titulo} – ${evento.direccionExacta}`,
        eventoId: evento.id,
        url: `/dashboard/agent?evento=${evento.id}`,
    });

    const endpointsMuertos: string[] = [];

    await Promise.allSettled(
        suscripciones.map(async (sub) => {
            try {
                await wp.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    },
                    payload
                );
            } catch (err) {
                const statusCode = (err as { statusCode?: number }).statusCode;
                if (statusCode === 404 || statusCode === 410) {
                    endpointsMuertos.push(sub.endpoint);
                } else {
                    console.error(`[push] error enviando a ${sub.endpoint}:`, err);
                }
            }
        })
    );

    return endpointsMuertos;
}
```

- [ ] **Step 2: Verificar typecheck e import**

Run (desde `apps/web`):
```bash
npx tsc --noEmit
```
Expected: sin errores de tipo (puede tardar; usa el `tsconfig.json` de la web).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/push.ts
git commit -m "feat(push): agregar modulo de envio web-push

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: API routes de suscripción

**Files:**
- Create: `apps/web/src/app/api/push/subscribe/route.ts`
- Create: `apps/web/src/app/api/push/unsubscribe/route.ts`

Patrón de auth: `requireAuth` de `@/lib/api-auth` (igual que `api/agent/history`). Las rutas `/api/push/*` no pasan por el middleware (su matcher solo cubre `/api/admin`), así que la autorización se hace en el handler.

- [ ] **Step 1: Crear `subscribe/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { Rol } from "@prisma/client";
import { z } from "zod";

const subSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
    }),
});

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    if (auth.user.rol !== Rol.AGENT) {
        return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = subSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { endpoint, keys } = parsed.data;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    await prisma.suscripcionPush.upsert({
        where: { endpoint },
        create: {
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            userId: auth.user.sub,
            userAgent,
        },
        update: {
            p256dh: keys.p256dh,
            auth: keys.auth,
            userId: auth.user.sub,
            userAgent,
        },
    });

    return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Crear `unsubscribe/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

const unsubSchema = z.object({
    endpoint: z.string().url(),
});

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = unsubSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    await prisma.suscripcionPush.deleteMany({
        where: { endpoint: parsed.data.endpoint },
    });

    return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verificar que las rutas compilan y responden 401 sin sesión**

Run (desde `apps/web`, en una terminal): `npm run dev`
En otra terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/push/subscribe -H "Content-Type: application/json" -d '{}'
```
Expected: `401` (sin cookie de sesión → "No autorizado"). Detén `npm run dev` después.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/push/subscribe/route.ts apps/web/src/app/api/push/unsubscribe/route.ts
git commit -m "feat(push): agregar rutas de suscripcion y baja de push

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Service worker, manifest e íconos

**Files:**
- Create: `apps/web/public/sw.js`
- Create: `apps/web/public/manifest.json`
- Create: `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Crear `apps/web/public/sw.js`**

```js
self.addEventListener("push", (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch (e) {
        payload = { title: "Nuevo evento", body: event.data.text() };
    }

    const title = payload.title || "Nuevo evento";
    const body = payload.body || "";
    const eventoId = payload.eventoId;
    const url = payload.url || "/dashboard/agent";

    event.waitUntil(
        (async () => {
            const ventanas = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            const hayVentanaVisible = ventanas.some(
                (c) => c.visibilityState === "visible" && c.focused
            );
            // Si la app está abierta y enfocada, el modal por socket ya avisó.
            if (hayVentanaVisible) return;

            await self.registration.showNotification(title, {
                body,
                tag: eventoId || undefined,
                renotify: true,
                requireInteraction: true,
                vibrate: [400, 150, 400, 150, 400],
                icon: "/icons/icon-192.png",
                badge: "/icons/icon-192.png",
                data: { url },
            });
        })()
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url =
        (event.notification.data && event.notification.data.url) ||
        "/dashboard/agent";

    event.waitUntil(
        (async () => {
            const ventanas = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            for (const client of ventanas) {
                if ("focus" in client) {
                    await client.focus();
                    if ("navigate" in client) {
                        try {
                            await client.navigate(url);
                        } catch (e) {
                            // ignorar fallos de navegación entre orígenes
                        }
                    }
                    return;
                }
            }
            if (self.clients.openWindow) {
                await self.clients.openWindow(url);
            }
        })()
    );
});
```

- [ ] **Step 2: Crear `apps/web/public/manifest.json`**

```json
{
    "name": "VIPER CMV - Gestión de Eventos",
    "short_name": "VIPER CMV",
    "description": "Sistema de despacho y gestión de eventos territoriales",
    "start_url": "/dashboard/agent",
    "scope": "/",
    "display": "standalone",
    "background_color": "#0f172a",
    "theme_color": "#0f172a",
    "icons": [
        {
            "src": "/icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any maskable"
        },
        {
            "src": "/icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
        }
    ]
}
```

- [ ] **Step 3: Generar los íconos desde el logo existente**

Run (desde la raíz del repo):
```bash
mkdir -p apps/web/public/icons
sips -z 192 192 "apps/web/public/Logo BN Sin Fondo.png" --out apps/web/public/icons/icon-192.png
sips -z 512 512 "apps/web/public/Logo BN Sin Fondo.png" --out apps/web/public/icons/icon-512.png
```
Expected: se crean ambos PNG. **Ábrelos** y verifica que se vean bien; si el logo no es cuadrado y queda distorsionado, reemplázalos por versiones cuadradas con padding (no bloquea el resto del plan).

- [ ] **Step 4: Enlazar manifest y metadata PWA en `layout.tsx`**

En `apps/web/src/app/layout.tsx`, reemplaza el import de tipos y el bloque `metadata` por:

```ts
import type { Metadata, Viewport } from "next";
```

```ts
export const metadata: Metadata = {
    title: "VIPER CMV - Gestión de Eventos",
    description: "Sistema de despacho y gestión de eventos territoriales",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        title: "VIPER CMV",
        statusBarStyle: "black-translucent",
    },
    icons: {
        icon: "/icons/icon-192.png",
        apple: "/icons/icon-192.png",
    },
};

export const viewport: Viewport = {
    themeColor: "#0f172a",
};
```

(Mantén el resto del archivo igual: el import de `Inter`, `AuthProvider`, `Toaster` y el JSX del `RootLayout`.)

- [ ] **Step 5: Verificar build y que el manifest se sirve**

Run (desde `apps/web`): `npm run build`
Expected: build exitoso, sin errores de tipo por `Viewport`/`metadata`.

Luego `npm run dev` y en otra terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/manifest.json
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/sw.js
```
Expected: `200` y `200`. Detén `npm run dev`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/public/sw.js apps/web/public/manifest.json apps/web/public/icons apps/web/src/app/layout.tsx
git commit -m "feat(push): agregar service worker, manifest e iconos PWA

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Hook `usePushSubscription`

**Files:**
- Create: `apps/web/src/hooks/usePushSubscription.ts`

- [ ] **Step 1: Crear el hook**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type EstadoPush =
    | "cargando"
    | "no-soportado"
    | "sin-permiso"
    | "suscrito"
    | "bloqueado";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function esSoportado(): boolean {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

export function usePushSubscription() {
    const [estado, setEstado] = useState<EstadoPush>("cargando");
    const soportado = esSoportado();

    const refrescar = useCallback(async () => {
        if (!soportado) {
            setEstado("no-soportado");
            return;
        }
        if (Notification.permission === "denied") {
            setEstado("bloqueado");
            return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
            // Re-sincroniza la suscripción por si el navegador la rotó
            // (el endpoint es la clave del upsert; es idempotente).
            const json = sub.toJSON();
            await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    endpoint: json.endpoint,
                    keys: json.keys,
                }),
            }).catch(() => {});
            setEstado("suscrito");
        } else {
            setEstado("sin-permiso");
        }
    }, [soportado]);

    useEffect(() => {
        if (!soportado) {
            setEstado("no-soportado");
            return;
        }
        navigator.serviceWorker.register("/sw.js").catch(() => {});
        void refrescar();
    }, [soportado, refrescar]);

    const activar = useCallback(async () => {
        if (!soportado || !VAPID_PUBLIC_KEY) return;

        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
            setEstado(permiso === "denied" ? "bloqueado" : "sin-permiso");
            return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });

        setEstado("suscrito");
    }, [soportado]);

    const desactivar = useCallback(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
            await fetch("/api/push/unsubscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
        }
        setEstado("sin-permiso");
    }, []);

    return { estado, soportado, activar, desactivar, refrescar };
}
```

- [ ] **Step 2: Verificar typecheck**

Run (desde `apps/web`):
```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/usePushSubscription.ts
git commit -m "feat(push): agregar hook usePushSubscription

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Banner de habilitación e integración en el panel del agente

**Files:**
- Create: `apps/web/src/components/PushNotificationsBanner.tsx`
- Modify: `apps/web/src/components/AgentDashboardClient.tsx`

- [ ] **Step 1: Crear el banner**

```tsx
"use client";

import { useState } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";

function esIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function esStandalone(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean })
            .standalone === true
    );
}

export default function PushNotificationsBanner() {
    const { estado, soportado, activar } = usePushSubscription();
    const [oculto, setOculto] = useState(false);

    if (oculto || !soportado || estado === "suscrito" || estado === "cargando") {
        return null;
    }

    const iosSinInstalar = esIOS() && !esStandalone();

    return (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-start gap-2">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1">
                    {estado === "bloqueado" ? (
                        <p>
                            Las notificaciones están bloqueadas. Actívalas en
                            los ajustes de tu navegador para recibir avisos de
                            nuevos eventos.
                        </p>
                    ) : iosSinInstalar ? (
                        <p>
                            Para recibir avisos con el teléfono bloqueado: toca{" "}
                            <strong>Compartir</strong> y luego{" "}
                            <strong>Agregar a inicio</strong>. Abre la app desde
                            el ícono y activa las notificaciones.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <p>
                                Activa las notificaciones para enterarte de
                                nuevos eventos aunque tengas el teléfono
                                bloqueado.
                            </p>
                            <Button size="sm" onClick={() => void activar()}>
                                Activar notificaciones
                            </Button>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setOculto(true)}
                    aria-label="Cerrar"
                    className="text-muted-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Montar el banner en `AgentDashboardClient`**

En `apps/web/src/components/AgentDashboardClient.tsx`, agrega el import junto a los demás imports de componentes:

```ts
import PushNotificationsBanner from "@/components/PushNotificationsBanner";
```

Luego, en el JSX retornado, justo después de la apertura del contenedor raíz `<div className="mx-auto max-w-md px-4 py-6">`, agrega como primer hijo:

```tsx
            <PushNotificationsBanner />
```

- [ ] **Step 3: Verificar build**

Run (desde `apps/web`):
```bash
npm run build
```
Expected: build exitoso sin errores de tipo.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/PushNotificationsBanner.tsx apps/web/src/components/AgentDashboardClient.tsx
git commit -m "feat(push): agregar banner de habilitacion en panel del agente

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Fan-out del push al crear evento

**Files:**
- Modify: `apps/web/src/app/api/events/route.ts`

- [ ] **Step 1: Importar el módulo de push**

En `apps/web/src/app/api/events/route.ts`, agrega junto a los demás imports:

```ts
import { enviarPushASuscripciones } from "@/lib/push";
```

- [ ] **Step 2: Agregar el fan-out tras avisar al socket-server**

Dentro de `POST`, justo **después** del bloque `try { ... } catch (socketError) { ... }` que notifica al socket server y **antes** de `return NextResponse.json({ success: true, evento }, { status: 201 });`, agrega:

```ts
        // Fan-out de notificaciones push (fire-and-forget; no debe bloquear ni
        // hacer fallar la creación del evento).
        void (async () => {
            try {
                const suscripciones = await prisma.suscripcionPush.findMany();
                const muertos = await enviarPushASuscripciones(
                    suscripciones.map((s) => ({
                        endpoint: s.endpoint,
                        p256dh: s.p256dh,
                        auth: s.auth,
                    })),
                    {
                        id: evento.id,
                        titulo: evento.titulo,
                        direccionExacta: evento.direccionExacta,
                    }
                );
                if (muertos.length > 0) {
                    await prisma.suscripcionPush.deleteMany({
                        where: { endpoint: { in: muertos } },
                    });
                }
            } catch (pushError) {
                console.error("Error en fan-out push:", pushError);
            }
        })();
```

- [ ] **Step 3: Verificar build**

Run (desde `apps/web`):
```bash
npm run build
```
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/events/route.ts
git commit -m "feat(push): enviar notificaciones push al crear un evento

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Script de prueba y documentación

**Files:**
- Create: `apps/web/scripts/send-test-push.ts`
- Modify: `AGENTS.md`

- [ ] **Step 1: Crear el script de prueba**

```ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { enviarPushASuscripciones } from "../src/lib/push";

const prisma = new PrismaClient();

async function main() {
    const suscripciones = await prisma.suscripcionPush.findMany();
    console.log(`Suscripciones registradas: ${suscripciones.length}`);

    if (suscripciones.length === 0) {
        console.log(
            "No hay suscripciones. Activa las notificaciones en un dispositivo primero."
        );
        return;
    }

    const muertos = await enviarPushASuscripciones(
        suscripciones.map((s) => ({
            endpoint: s.endpoint,
            p256dh: s.p256dh,
            auth: s.auth,
        })),
        {
            id: "test",
            titulo: "Evento de prueba",
            direccionExacta: "Dirección de prueba 123",
        }
    );

    console.log(`Push enviado. Endpoints muertos eliminados: ${muertos.length}`);
    if (muertos.length > 0) {
        await prisma.suscripcionPush.deleteMany({
            where: { endpoint: { in: muertos } },
        });
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => {
        void prisma.$disconnect();
    });
```

- [ ] **Step 2: Documentar la feature en `AGENTS.md`**

En `AGENTS.md`, agrega una subsección nueva al final (antes de "Estilo de código" o como sección propia):

```markdown
## Notificaciones Push (PWA)

- Web Push con VAPID auto-hospedado (librería `web-push` en `apps/web`).
- Variables: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (en `apps/web/.env` y raíz). Generar con `npx web-push generate-vapid-keys`.
- El envío se hace en `POST /api/events` (fire-and-forget) leyendo `SuscripcionPush`.
- Service worker en `apps/web/public/sw.js`; manifest en `apps/web/public/manifest.json`.
- Probar: `npm run test:push` (desde `apps/web`).
- iPhone requiere la PWA instalada ("Agregar a inicio") + iOS 16.4+.
```

- [ ] **Step 3: Probar el script (con al menos una suscripción real registrada)**

Run (desde `apps/web`):
```bash
npm run test:push
```
Expected sin suscripciones: imprime "No hay suscripciones...". Con una suscripción real (tras activar en un dispositivo en Task 10): el dispositivo recibe la notificación de prueba.

- [ ] **Step 4: Commit**

```bash
git add apps/web/scripts/send-test-push.ts AGENTS.md
git commit -m "feat(push): agregar script de prueba y documentacion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: QA manual en dispositivos reales

No hay automatización posible para esto; es verificación manual. Requiere servir la app por **HTTPS** (Web Push y service workers exigen contexto seguro; `localhost` sirve para desarrollo en el mismo equipo, pero los teléfonos necesitan HTTPS — usar el dominio de staging/producción o un túnel como `ngrok`/`cloudflared`).

- [ ] **Step 1: Android Chrome — app cerrada / pantalla bloqueada**
  1. Inicia sesión como agente en Chrome Android sobre HTTPS.
  2. Acepta el banner → "Activar notificaciones" → concede permiso.
  3. Bloquea el teléfono.
  4. Desde otra sesión, crea un evento como admin (o corre `npm run test:push`).
  5. Verifica: llega notificación heads-up + **vibración** + persiste hasta tocarla. Al tocarla, abre el panel del agente.

- [ ] **Step 2: iPhone Safari — requiere instalación**
  1. En Safari iOS (16.4+), abre la app, toca **Compartir → Agregar a inicio**.
  2. Abre la app **desde el ícono** (modo standalone).
  3. Activa notificaciones (el banner ya no debe mostrar el texto de iOS-sin-instalar).
  4. Cierra la app y bloquea el teléfono.
  5. Crea un evento como admin. Verifica: llega banner + tono estándar.

- [ ] **Step 3: Dedup en primer plano**
  1. Con la app **abierta y enfocada** en el panel del agente, crea un evento.
  2. Verifica: aparece el modal/sonido actual por socket y **no** se duplica con una notificación push del sistema.

- [ ] **Step 4: Limpieza de suscripción expirada**
  1. En el dispositivo, desinstala/revoca permiso o borra datos del sitio.
  2. Crea un evento (o corre `npm run test:push`).
  3. Verifica en logs/DB que la suscripción muerta (404/410) se eliminó de la colección `SuscripcionPush`.

- [ ] **Step 5: Activar/desactivar desde el banner**
  - Confirma que activar registra la suscripción (aparece en DB) y que, si agregas un interruptor de baja, `desactivar()` la elimina en ambos lados. *(Nota: el interruptor en "ajustes" del agente puede añadirse reutilizando `desactivar()` del hook; no es bloqueante para la entrega central.)*

---

## Notas de alcance / pendientes conocidos

- **Interruptor de ajustes:** el hook expone `desactivar()`; queda como mejora opcional ubicar el toggle en una pantalla de ajustes del agente. No bloquea la entrega.
- **Sonido tipo alarma con app cerrada:** limitado por el navegador (ver spec). Se garantiza heads-up + vibración + persistencia en Android; tono estándar en iPhone.
- **Caché offline:** fuera de alcance; migrable a `@ducanh2912/next-pwa` después sin perder lo hecho.
```
