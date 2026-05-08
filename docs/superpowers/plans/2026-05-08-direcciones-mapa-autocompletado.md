# Direcciones clicables a Maps/Waze + autocomplete Gran Valparaíso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que los agentes comunitarios toquen una dirección de evento para abrir Google Maps / Waze / Apple Maps con la navegación iniciada, y autocompletar direcciones en el formulario de creación restringido al área del Gran Valparaíso.

**Architecture:** Backend proxy en Next.js (`/api/places/*`) que envuelve Google Places API (New) con cache LRU y rate-limit; tres componentes nuevos en el frontend (`AddressAutocomplete`, `AddressLink`, `MapsActionSheet`) + dos helpers puros (`maps-deeplink.ts`, `places.ts`); modificaciones aditivas a `CreateEventModal`, `EventDetailModal` y `EventList`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, shadcn/ui, Tailwind, Prisma + MongoDB, Google Places API (New), `lru-cache`, `cmdk` (vía shadcn `command`).

**Spec:** `docs/superpowers/specs/2026-05-08-direcciones-mapa-autocompletado-design.md`

**Testing strategy:** Sin tests automatizados (no hay framework configurado en el repo). Validación manual con `curl` para endpoints, smoke en dev server para componentes, checklist E2E al final.

---

## File Structure

Todas las rutas son relativas a `apps/web/`.

### Crear

| Path | Responsabilidad |
|---|---|
| `src/lib/maps-deeplink.ts` | Pure functions que construyen URLs para Google Maps / Waze / Apple Maps a partir de dirección + coords opcionales. |
| `src/lib/rate-limit.ts` | Helper in-memory `Map<ip, { count, resetAt }>` con función `checkRateLimit(ip, key, limit, windowMs)`. Compartido entre los dos endpoints. |
| `src/lib/places.ts` | Wrapper sobre Google Places API (New). Exporta `autocomplete`, `placeDetails` y los tipos `Suggestion`, `PlaceDetails`. Cache LRU interno. |
| `src/app/api/places/autocomplete/route.ts` | Route handler GET. Valida query, aplica rate-limit, llama a `places.autocomplete`. |
| `src/app/api/places/details/route.ts` | Route handler GET. Valida query, aplica rate-limit, llama a `places.placeDetails`. |
| `src/components/MapsActionSheet.tsx` | Sheet (mobile) o DropdownMenu (desktop) con opciones Google Maps / Waze / Apple Maps. |
| `src/components/AddressLink.tsx` | Botón con estilo de link que abre `MapsActionSheet`. Recibe `direccion` y `coordenadas?`. |
| `src/components/AddressAutocomplete.tsx` | Input combobox con debounce, llama a los endpoints `/api/places/*`. |

### Modificar

| Path | Cambio |
|---|---|
| `.env.example` | Agregar `GOOGLE_PLACES_API_KEY=`. |
| `src/components/CreateEventModal.tsx` | Reemplazar `<Input>` de dirección por `<AddressAutocomplete>`; eliminar inputs manuales de lat/lng. |
| `src/components/EventDetailModal.tsx` | Reemplazar `<span>` que muestra la dirección por `<AddressLink>`. |
| `src/components/EventList.tsx` | Agregar la dirección a la tabla desktop y a las cards mobile, usando `<AddressLink>`. |

### NO se modifica

- `prisma/schema.prisma` — el modelo ya tiene `direccionExacta` y `coordenadas: Json?`.
- `src/types/index.ts` — la interfaz `Evento` ya está alineada.
- `src/components/EventNotification.tsx` — fuera de alcance por decisión explícita en el spec.

---

## Task 0: Dependencias y configuración base

**Files:**
- Modify: `apps/web/package.json` (vía npm install)
- Add shadcn components: `popover`, `command`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Instalar `lru-cache`**

```bash
cd apps/web && npm install lru-cache@^11.0.0
```

Expected: package.json gana `"lru-cache": "^11.0.0"` en dependencies. `package-lock.json` se actualiza.

- [ ] **Step 2: Agregar shadcn components `popover` y `command`**

```bash
cd apps/web && npx shadcn@latest add popover command
```

Expected: se crean `apps/web/src/components/ui/popover.tsx` y `apps/web/src/components/ui/command.tsx`. La CLI agrega `cmdk` y `@radix-ui/react-popover` a `package.json`. Si pregunta por overrides, responder "no".

- [ ] **Step 3: Agregar variable de entorno**

Editar `apps/web/.env.example` y agregar al final:

```
# Google Places API (server-only — NUNCA exponer al cliente)
GOOGLE_PLACES_API_KEY=
```

- [ ] **Step 4: Verificar que el dev server arranca**

```bash
cd apps/web && npm run dev
```

Expected: arranca sin errores de import o de tipo. Detener con Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/components/ui/popover.tsx apps/web/src/components/ui/command.tsx apps/web/.env.example
git commit -m "chore(deps): lru-cache + shadcn popover/command para autocomplete de direcciones"
```

---

## Task 1: Helper de deep-link (`maps-deeplink.ts`)

**Files:**
- Create: `apps/web/src/lib/maps-deeplink.ts`

- [ ] **Step 1: Crear el helper**

Crear `apps/web/src/lib/maps-deeplink.ts` con el contenido completo:

```ts
export type MapProvider = "google" | "waze" | "apple";

export interface Coords {
  lat: number;
  lng: number;
}

export function hasValidCoords(coords?: Coords | null): coords is Coords {
  return (
    !!coords &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180
  );
}

export function buildDeepLink(
  provider: MapProvider,
  direccion: string,
  coordenadas?: Coords | null
): string {
  const q = encodeURIComponent(direccion.trim());
  const useCoords = hasValidCoords(coordenadas);
  const lat = useCoords ? coordenadas!.lat : null;
  const lng = useCoords ? coordenadas!.lng : null;

  switch (provider) {
    case "google":
      return useCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    case "waze":
      return useCoords
        ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://waze.com/ul?q=${q}&navigate=yes`;
    case "apple":
      return useCoords
        ? `https://maps.apple.com/?daddr=${lat},${lng}`
        : `https://maps.apple.com/?q=${q}`;
  }
}

export function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Smoke test manual en consola Node**

```bash
cd apps/web && node --input-type=module -e "
import('./src/lib/maps-deeplink.ts').catch(() => {
  // tsx workaround
});
"
```

Si lo anterior falla por extensión `.ts`, usar tsx:

```bash
cd apps/web && npx tsx -e "
import { buildDeepLink } from './src/lib/maps-deeplink';
console.log(buildDeepLink('google', 'Avenida Errázuriz 1234, Valparaíso'));
console.log(buildDeepLink('google', 'Avenida Errázuriz 1234', { lat: -33.045, lng: -71.62 }));
console.log(buildDeepLink('waze', 'X', { lat: -33.045, lng: -71.62 }));
console.log(buildDeepLink('apple', 'X', { lat: -33.045, lng: -71.62 }));
console.log(buildDeepLink('google', 'X', { lat: NaN, lng: 0 }));
"
```

Expected output:
```
https://www.google.com/maps/search/?api=1&query=Avenida%20Err%C3%A1zuriz%201234%2C%20Valpara%C3%ADso
https://www.google.com/maps/dir/?api=1&destination=-33.045,-71.62
https://waze.com/ul?ll=-33.045,-71.62&navigate=yes
https://maps.apple.com/?daddr=-33.045,-71.62
https://www.google.com/maps/search/?api=1&query=X
```

(El último cae a query porque `lat: NaN` falla `hasValidCoords`.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/maps-deeplink.ts
git commit -m "feat(maps): helper buildDeepLink para Google Maps/Waze/Apple Maps"
```

---

## Task 2: Helper de rate-limit (`rate-limit.ts`)

**Files:**
- Create: `apps/web/src/lib/rate-limit.ts`

- [ ] **Step 1: Crear el helper**

Crear `apps/web/src/lib/rate-limit.ts`:

```ts
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  ip: string,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucketKey = `${key}:${ip}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/rate-limit.ts
git commit -m "feat(api): helper checkRateLimit in-memory por IP"
```

---

## Task 3: Wrapper de Google Places API (`places.ts`)

**Files:**
- Create: `apps/web/src/lib/places.ts`

- [ ] **Step 1: Crear el wrapper**

Crear `apps/web/src/lib/places.ts`:

```ts
import { LRUCache } from "lru-cache";

const PLACES_BASE = "https://places.googleapis.com/v1";

const GRAN_VALPARAISO_RECTANGLE = {
  low: { latitude: -33.10, longitude: -71.66 },
  high: { latitude: -32.90, longitude: -71.30 },
};

const INCLUDED_PRIMARY_TYPES = [
  "street_address",
  "route",
  "premise",
  "subpremise",
  "point_of_interest",
];

export interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  description: string;
  lat: number;
  lng: number;
  comuna: string | null;
}

export class PlacesError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "PlacesError";
  }
}

const autocompleteCache = new LRUCache<string, Suggestion[]>({
  max: 200,
  ttl: 1000 * 60 * 5, // 5 min
});

const detailsCache = new LRUCache<string, PlaceDetails>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24, // 24 h
});

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new PlacesError("GOOGLE_PLACES_API_KEY no configurada", 500);
  }
  return key;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && i < retries) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
    }
  }
  throw lastErr ?? new PlacesError("fetch failed", 503);
}

export async function autocomplete(
  input: string,
  sessionToken: string
): Promise<Suggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = autocompleteCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const body = {
    input: trimmed,
    languageCode: "es",
    regionCode: "cl",
    includedRegionCodes: ["cl"],
    includedPrimaryTypes: INCLUDED_PRIMARY_TYPES,
    locationRestriction: { rectangle: GRAN_VALPARAISO_RECTANGLE },
    sessionToken,
  };

  const res = await fetchWithRetry(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[places.autocomplete] Google error", res.status, text);
    throw new PlacesError(`Google ${res.status}`, 503);
  }

  const json = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId: string;
        text: { text: string };
        structuredFormat?: {
          mainText?: { text: string };
          secondaryText?: { text: string };
        };
      };
    }>;
  };

  const suggestions: Suggestion[] = (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 5)
    .map((p) => ({
      placeId: p.placeId,
      description: p.text?.text ?? "",
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
    }));

  autocompleteCache.set(cacheKey, suggestions);
  return suggestions;
}

export async function placeDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetails> {
  if (!placeId) throw new PlacesError("placeId requerido", 400);

  const cached = detailsCache.get(placeId);
  if (cached) return cached;

  const apiKey = getApiKey();
  const url = new URL(`${PLACES_BASE}/places/${placeId}`);
  url.searchParams.set("sessionToken", sessionToken);
  url.searchParams.set("languageCode", "es");
  url.searchParams.set("regionCode", "cl");

  const res = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
  });

  if (res.status === 404) throw new PlacesError("placeId no encontrado", 404);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[places.placeDetails] Google error", res.status, text);
    throw new PlacesError(`Google ${res.status}`, 503);
  }

  const json = (await res.json()) as {
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    addressComponents?: Array<{
      longText: string;
      shortText: string;
      types: string[];
    }>;
  };

  if (!json.location) throw new PlacesError("respuesta sin location", 503);

  const comuna =
    json.addressComponents?.find((c) =>
      c.types.includes("locality") || c.types.includes("administrative_area_level_3")
    )?.longText ?? null;

  const details: PlaceDetails = {
    description: json.formattedAddress ?? "",
    lat: json.location.latitude,
    lng: json.location.longitude,
    comuna,
  };

  detailsCache.set(placeId, details);
  return details;
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/places.ts
git commit -m "feat(places): wrapper de Google Places API New con cache LRU"
```

---

## Task 4: Endpoint `/api/places/autocomplete`

**Files:**
- Create: `apps/web/src/app/api/places/autocomplete/route.ts`

- [ ] **Step 1: Crear el route handler**

Crear `apps/web/src/app/api/places/autocomplete/route.ts`:

```ts
import { NextResponse } from "next/server";
import { autocomplete, PlacesError } from "@/lib/places";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "places-autocomplete", 60, 60_000);
  if (!rl.allowed) {
    console.warn("[places/autocomplete] rate-limited", ip);
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const sessionToken = url.searchParams.get("sessionToken") ?? "";

  if (q.length < 3) {
    return NextResponse.json({ error: "q_too_short" }, { status: 400 });
  }

  if (!sessionToken) {
    console.warn("[places/autocomplete] missing sessionToken");
  }

  try {
    const suggestions = await autocomplete(q, sessionToken || crypto.randomUUID());
    return NextResponse.json({ suggestions });
  } catch (err) {
    const status = err instanceof PlacesError ? err.status : 503;
    console.error("[places/autocomplete] error", err);
    return NextResponse.json({ error: "places_failed" }, { status });
  }
}
```

- [ ] **Step 2: Verificar tipos y arrancar dev**

```bash
cd apps/web && npx tsc --noEmit && npm run dev
```

Expected: el server arranca sin errores. Mantener corriendo.

- [ ] **Step 3: Smoke test con curl (sin API key — debe dar 503)**

En otra terminal:

```bash
curl -i "http://localhost:3000/api/places/autocomplete?q=Errazuriz&sessionToken=test-1"
```

Expected: HTTP/1.1 503 (porque `GOOGLE_PLACES_API_KEY` no está seteada). Body: `{"error":"places_failed"}`. Los logs del dev server muestran `GOOGLE_PLACES_API_KEY no configurada`.

- [ ] **Step 4: Smoke test con `q` corto**

```bash
curl -i "http://localhost:3000/api/places/autocomplete?q=ab&sessionToken=test-1"
```

Expected: HTTP/1.1 400, body `{"error":"q_too_short"}`.

- [ ] **Step 5: Si tienes una API key real para dev, probarla**

Crear `apps/web/.env.local` (si no existe) y agregar:

```
GOOGLE_PLACES_API_KEY=<tu-key-de-dev>
```

Reiniciar el dev server. Repetir Step 3:

```bash
curl -i "http://localhost:3000/api/places/autocomplete?q=Errazuriz&sessionToken=test-1"
```

Expected: HTTP/1.1 200, body con `{"suggestions":[...]}` con resultados de Valparaíso/Viña.

Si NO tienes API key todavía, saltar este step — la validación real ocurrirá en Task 12 (setup GCP).

- [ ] **Step 6: Detener dev server y commit**

Ctrl+C en el dev server.

```bash
git add apps/web/src/app/api/places/autocomplete/route.ts
git commit -m "feat(api): endpoint /api/places/autocomplete con rate-limit"
```

---

## Task 5: Endpoint `/api/places/details`

**Files:**
- Create: `apps/web/src/app/api/places/details/route.ts`

- [ ] **Step 1: Crear el route handler**

Crear `apps/web/src/app/api/places/details/route.ts`:

```ts
import { NextResponse } from "next/server";
import { placeDetails, PlacesError } from "@/lib/places";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "places-details", 20, 60_000);
  if (!rl.allowed) {
    console.warn("[places/details] rate-limited", ip);
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const url = new URL(req.url);
  const placeId = url.searchParams.get("placeId")?.trim() ?? "";
  const sessionToken = url.searchParams.get("sessionToken") ?? "";

  if (!placeId) {
    return NextResponse.json({ error: "placeId_required" }, { status: 400 });
  }

  if (!sessionToken) {
    console.warn("[places/details] missing sessionToken");
  }

  try {
    const details = await placeDetails(placeId, sessionToken || crypto.randomUUID());
    return NextResponse.json(details);
  } catch (err) {
    const status = err instanceof PlacesError ? err.status : 503;
    console.error("[places/details] error", err);
    return NextResponse.json(
      { error: status === 404 ? "place_not_found" : "places_failed" },
      { status }
    );
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Smoke test (placeId vacío)**

Arrancar dev server y en otra terminal:

```bash
curl -i "http://localhost:3000/api/places/details?placeId=&sessionToken=test-1"
```

Expected: HTTP/1.1 400, body `{"error":"placeId_required"}`.

- [ ] **Step 4: Detener dev server y commit**

```bash
git add apps/web/src/app/api/places/details/route.ts
git commit -m "feat(api): endpoint /api/places/details con rate-limit"
```

---

## Task 6: Componente `<MapsActionSheet>`

**Files:**
- Create: `apps/web/src/components/MapsActionSheet.tsx`

- [ ] **Step 1: Crear el componente**

Crear `apps/web/src/components/MapsActionSheet.tsx`:

```tsx
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { buildDeepLink, isAppleDevice, type Coords } from "@/lib/maps-deeplink";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direccion: string;
  coordenadas?: Coords | null;
}

function openExternal(url: string) {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
}

export function MapsActionSheet({ open, onOpenChange, direccion, coordenadas }: Props) {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const showApple = isAppleDevice();

  const handleClick = (provider: "google" | "waze" | "apple") => {
    openExternal(buildDeepLink(provider, direccion, coordenadas));
    onOpenChange(false);
  };

  // Render como Sheet (bottom drawer) en mobile, Sheet right en desktop
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Abrir dirección en…</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start h-12"
            onClick={() => handleClick("google")}
          >
            Google Maps
          </Button>
          <Button
            variant="outline"
            className="justify-start h-12"
            onClick={() => handleClick("waze")}
          >
            Waze
          </Button>
          {showApple && (
            <Button
              variant="outline"
              className="justify-start h-12"
              onClick={() => handleClick("apple")}
            >
              Apple Maps
            </Button>
          )}
          <Button
            variant="ghost"
            className="justify-start h-12 mt-2"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/MapsActionSheet.tsx
git commit -m "feat(ui): MapsActionSheet con opciones Google/Waze/Apple"
```

---

## Task 7: Componente `<AddressLink>`

**Files:**
- Create: `apps/web/src/components/AddressLink.tsx`

- [ ] **Step 1: Crear el componente**

Crear `apps/web/src/components/AddressLink.tsx`:

```tsx
"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapsActionSheet } from "./MapsActionSheet";
import type { Coords } from "@/lib/maps-deeplink";

interface Props {
  direccion: string;
  coordenadas?: Coords | null;
  className?: string;
  showIcon?: boolean;
}

export function AddressLink({
  direccion,
  coordenadas,
  className,
  showIcon = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const trimmed = direccion?.trim() ?? "";
  if (!trimmed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Abrir ${trimmed} en una app de mapas`}
        className={cn(
          "inline-flex items-center gap-1 text-left text-primary hover:underline focus:underline focus:outline-none",
          className
        )}
      >
        {showIcon && <MapPin className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="truncate">{trimmed}</span>
      </button>
      <MapsActionSheet
        open={open}
        onOpenChange={setOpen}
        direccion={trimmed}
        coordenadas={coordenadas}
      />
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AddressLink.tsx
git commit -m "feat(ui): AddressLink — link clicable que dispara MapsActionSheet"
```

---

## Task 8: Componente `<AddressAutocomplete>`

**Files:**
- Create: `apps/web/src/components/AddressAutocomplete.tsx`

- [ ] **Step 1: Crear el componente**

Crear `apps/web/src/components/AddressAutocomplete.tsx`:

```tsx
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface SelectedPlace {
  placeId: string;
  description: string;
  lat: number;
  lng: number;
  comuna: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: SelectedPlace) => void;
  onClearCoords?: () => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onClearCoords,
  placeholder = "Calle, número, comuna…",
  required,
  className,
  id,
}: Props) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const sessionToken = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36)),
    []
  );

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [empty, setEmpty] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  // Cerrar al click fuera
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Fetch al cambiar value
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = value.trim();
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([]);
      setEmpty(false);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setEmpty(false);
      try {
        const res = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(trimmed)}&sessionToken=${sessionToken}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) {
          setSuggestions([]);
          setOpen(false);
          return;
        }
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions);
        setEmpty(data.suggestions.length === 0);
        setOpen(true);
        setHighlight(0);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, sessionToken]);

  async function handleSelect(s: Suggestion) {
    justSelectedRef.current = true;
    onChange(s.description);
    setOpen(false);
    setSuggestions([]);
    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(s.placeId)}&sessionToken=${sessionToken}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as SelectedPlace & { description: string };
      onSelect({
        placeId: s.placeId,
        description: data.description || s.description,
        lat: data.lat,
        lng: data.lng,
        comuna: data.comuna,
      });
    } catch {
      // silencioso — fallback a texto libre
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          id={id ?? inputId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (onClearCoords) onClearCoords();
          }}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && suggestions.length > 0 ? `${listboxId}-${highlight}` : undefined}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-auto"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex items-start gap-2 px-3 py-2 cursor-pointer min-h-12",
                i === highlight && "bg-accent"
              )}
            >
              <MapPin className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.mainText}</div>
                {s.secondaryText && (
                  <div className="truncate text-xs text-muted-foreground">{s.secondaryText}</div>
                )}
              </div>
            </li>
          ))}
          {empty && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Sin resultados — puedes dejarlo como texto libre
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AddressAutocomplete.tsx
git commit -m "feat(ui): AddressAutocomplete con debounce y combobox accesible"
```

---

## Task 9: Integrar `<AddressAutocomplete>` en `CreateEventModal`

**Files:**
- Modify: `apps/web/src/components/CreateEventModal.tsx`

- [ ] **Step 1: Leer el archivo actual**

```bash
cd apps/web && cat src/components/CreateEventModal.tsx | head -260
```

Foco en:
- El `useState` que maneja `direccionExacta`, `latitud`, `longitud` (líneas ~39-55).
- El bloque `<Input>` de dirección (líneas ~184-191).
- El bloque `grid grid-cols-2` de lat/lng (líneas ~205-215).
- El handler de submit que arma `coordenadas: { lat, lng }` (líneas ~96-102).

- [ ] **Step 2: Reemplazar el bloque de dirección**

En `CreateEventModal.tsx`:

1. Importar el componente al inicio del archivo:

```tsx
import { AddressAutocomplete } from "./AddressAutocomplete";
```

2. Reemplazar el state actual de `latitud`/`longitud` (que probablemente son `string` o `number`) por un único state de coordenadas:

```tsx
// ANTES (aprox):
// const [latitud, setLatitud] = useState("");
// const [longitud, setLongitud] = useState("");

// DESPUÉS:
const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
const [coordsFromAutocomplete, setCoordsFromAutocomplete] = useState(false);
```

3. Reemplazar el bloque `<Input>` de dirección por:

```tsx
<div className="space-y-1">
  <label htmlFor="evento-direccion" className="text-sm font-medium">
    Dirección <span className="text-destructive">*</span>
  </label>
  <AddressAutocomplete
    id="evento-direccion"
    value={direccionExacta}
    onChange={(v) => {
      setDireccionExacta(v);
      // Si edita el texto después de seleccionar, conservamos las coords
      // pero marcamos que ya no vienen "frescas" del autocomplete
    }}
    onSelect={(place) => {
      setDireccionExacta(place.description);
      setCoordenadas({ lat: place.lat, lng: place.lng });
      setCoordsFromAutocomplete(true);
    }}
    onClearCoords={() => {
      // Si el usuario borra todo, limpiamos coords
      if (direccionExacta.trim().length === 0) {
        setCoordenadas(null);
        setCoordsFromAutocomplete(false);
      }
    }}
    required
  />
  {coordsFromAutocomplete && coordenadas && (
    <p className="text-xs text-muted-foreground">
      📍 Ubicación seleccionada — editar la dirección no actualiza el pin
    </p>
  )}
</div>
```

4. **Eliminar completamente** el bloque `grid grid-cols-2` con los inputs de `latitud` y `longitud`. El usuario ya no los ingresa manualmente.

5. Actualizar el handler de submit para usar `coordenadas` directamente:

```tsx
// ANTES (aprox):
// const coordenadas = latitud && longitud
//   ? { lat: parseFloat(latitud), lng: parseFloat(longitud) }
//   : undefined;

// DESPUÉS:
// `coordenadas` ya es el state — usarlo tal cual en el body del POST.
// Si es null, no incluir la propiedad o enviar null (el modelo permite Json?).
```

Ajustar el `body` del fetch a `/api/events`:

```tsx
body: JSON.stringify({
  // ...otros campos
  direccionExacta,
  coordenadas: coordenadas ?? null,
}),
```

6. Asegurarse que el reset del form (al cerrar/abrir modal) limpie también `coordenadas` y `coordsFromAutocomplete`.

- [ ] **Step 3: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores. Si hay errores en otros componentes que pasaban props relacionadas, ajustar.

- [ ] **Step 4: Smoke test en el dev server**

```bash
cd apps/web && npm run dev
```

Abrir `http://localhost:3000/admin/events` (o la ruta correspondiente). Abrir el modal de crear evento.

Verificaciones:
- El campo "Dirección" muestra el `AddressAutocomplete`.
- Los inputs de "Latitud" y "Longitud" ya no existen.
- Al escribir 3+ chars, sale un dropdown con sugerencias (si hay `GOOGLE_PLACES_API_KEY` en `.env.local`).
- Sin API key: el dropdown no aparece pero el form sigue funcionando con texto libre.
- Submit funciona en ambos casos (con y sin coords).

Detener dev server con Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CreateEventModal.tsx
git commit -m "feat(eventos): autocomplete de dirección en CreateEventModal, eliminar inputs lat/lng manuales"
```

---

## Task 10: Integrar `<AddressLink>` en `EventDetailModal`

**Files:**
- Modify: `apps/web/src/components/EventDetailModal.tsx`

- [ ] **Step 1: Leer el archivo y localizar el render de la dirección**

```bash
cd apps/web && grep -n "direccionExacta" src/components/EventDetailModal.tsx
```

Esperado: una línea ~139 con `<span>{evento.direccionExacta}</span>` o similar.

- [ ] **Step 2: Reemplazar el span por `<AddressLink>`**

Importar al inicio:

```tsx
import { AddressLink } from "./AddressLink";
```

Reemplazar la línea (mantener el icono `MapPin` que ya esté afuera):

```tsx
// ANTES:
// <span>{evento.direccionExacta}</span>

// DESPUÉS:
<AddressLink
  direccion={evento.direccionExacta}
  coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
  showIcon={false}  // si el wrapper ya tiene un MapPin afuera
/>
```

Si el wrapper externo NO tiene su propio icono, usar `showIcon={true}` (o omitir el prop).

- [ ] **Step 3: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores. Si TypeScript no permite el cast de `evento.coordenadas` (que es `Json` en Prisma), ajustar el tipo en `src/types/index.ts` o castear con un helper local.

- [ ] **Step 4: Smoke en dev server**

```bash
cd apps/web && npm run dev
```

Abrir el modal de detalle de algún evento existente. Click en la dirección → debería aparecer el sheet/dropdown con Google Maps / Waze / Apple Maps. Click en cada uno abre la URL correcta en una pestaña nueva.

Detener dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EventDetailModal.tsx
git commit -m "feat(eventos): dirección clicable en EventDetailModal"
```

---

## Task 11: Integrar `<AddressLink>` en `EventList` (cards mobile + tabla desktop)

**Files:**
- Modify: `apps/web/src/components/EventList.tsx`

- [ ] **Step 1: Localizar la tabla desktop y las cards mobile**

```bash
cd apps/web && grep -n "lg:hidden\|hidden lg:" src/components/EventList.tsx
```

La estructura típica:
- Bloque `hidden lg:block` → tabla desktop (líneas ~63-110).
- Bloque `lg:hidden` → cards mobile (líneas ~121-194).

Ninguno de los dos muestra hoy `direccionExacta`.

- [ ] **Step 2: Agregar la dirección a las cards mobile**

Importar al inicio:

```tsx
import { AddressLink } from "./AddressLink";
```

En el bloque de cards mobile, dentro de cada `<Card>`, agregar después del título / origen y antes del estado/asignado:

```tsx
{evento.direccionExacta && (
  <div className="mt-1 text-sm">
    <AddressLink
      direccion={evento.direccionExacta}
      coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
      className="text-sm"
    />
  </div>
)}
```

- [ ] **Step 3: Agregar la dirección a la tabla desktop**

Tres opciones, elegir UNA según lo que se vea mejor en la UI actual:

**Opción A — columna nueva** (preferir si la tabla tiene espacio): agregar `<TableHead>Dirección</TableHead>` en el header y una `<TableCell>` con `<AddressLink>` en el body.

**Opción B — debajo del título**: en la celda del título, agregar la dirección en una segunda línea más pequeña:

```tsx
<TableCell>
  <div className="font-medium">{evento.titulo}</div>
  {evento.direccionExacta && (
    <AddressLink
      direccion={evento.direccionExacta}
      coordenadas={evento.coordenadas as { lat: number; lng: number } | null | undefined}
      className="text-xs text-muted-foreground"
    />
  )}
</TableCell>
```

**Opción C — tooltip**: dejar la tabla como está y mostrar la dirección al hover. Solo si el espacio horizontal es crítico.

Recomendado: **Opción B** — no requiere recolumnado y es coherente con cómo se muestra la info densa en tablas.

- [ ] **Step 4: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Smoke en dev server**

```bash
cd apps/web && npm run dev
```

Verificaciones:
- Listado de eventos en mobile (<1024px): cada card muestra la dirección clicable.
- Listado en desktop: la tabla muestra la dirección debajo del título (Opción B).
- Click en una dirección abre el sheet/dropdown.
- Verificar también en el dashboard que `RecentEventsTable` herede el cambio (no debería requerir modificación, ya que delega en `EventList`).

Detener dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/EventList.tsx
git commit -m "feat(eventos): mostrar dirección clicable en EventList (cards y tabla)"
```

---

## Task 12: Setup operacional en GCP (manual)

Este task NO escribe código. Es un checklist operacional que debe completarse antes de desplegar a producción. Ejecutar en orden, en la consola de Google Cloud Platform.

- [ ] **Step 1: Crear proyecto GCP (si no existe)**

Ir a https://console.cloud.google.com → crear proyecto `biper-cmv-prod` (o reusar uno existente).

- [ ] **Step 2: Habilitar Places API (New)**

`APIs & Services` → `Library` → buscar "Places API (New)" → `Enable`.

**No habilitar** la "Places API" antigua (legacy) — usamos la New.

- [ ] **Step 3: Habilitar Billing**

`Billing` → vincular cuenta de pago. Aunque el uso esperado esté dentro del free tier, GCP exige tarjeta asociada.

- [ ] **Step 4: Crear API key**

`APIs & Services` → `Credentials` → `Create Credentials` → `API key`. Renombrarla a `biper-cmv-places-prod`.

- [ ] **Step 5: Restringir la API key**

En la key recién creada:

- **Application restrictions**: elegir `HTTP referrers (web sites)` y agregar el dominio de prod (`https://<dominio-prod>/*`). En staging, agregar también el dominio de staging.
  - Si se llama desde el server (que es nuestro caso), alternativamente usar `IP addresses` con la IP del servidor.
- **API restrictions**: `Restrict key` → seleccionar **solo** "Places API (New)".

Guardar.

- [ ] **Step 6: Configurar cuota dura (hard quota)**

`APIs & Services` → `Places API (New)` → `Quotas & System Limits` → buscar la métrica de requests por día → editar el límite a **1000 requests/día** (o el número que prefieras).

Esto **garantiza** que si hay un bug o abuso, los requests fallan en lugar de cobrarse. Es la única protección técnica de costo cero.

- [ ] **Step 7: Configurar alerta de presupuesto**

`Billing` → `Budgets & alerts` → `Create budget`:
- Scope: este proyecto
- Amount: USD 1
- Alerts: 50%, 90%, 100% por email

Si en cualquier momento aparece un cobro, llega un mail desde el primer dólar.

- [ ] **Step 8: Agregar la key al entorno de producción**

En el sistema de deploy (Vercel, Railway, VPS, etc.), agregar la variable `GOOGLE_PLACES_API_KEY` con el valor de la key creada.

**Nunca** commitear la key al repo. **Nunca** prefijarla con `NEXT_PUBLIC_`.

- [ ] **Step 9: Smoke test en staging**

Desplegar la rama a staging. Abrir el modal de crear evento, escribir 3+ chars de una calle de Valparaíso. Verificar que aparecen sugerencias.

- [ ] **Step 10: Documentar la rotación de keys**

En `docs/` o donde corresponda, dejar una nota corta sobre:
- Dónde está la key (GCP project, key name).
- Cómo rotarla (crear nueva, cambiar en deploy, esperar 24h, eliminar la vieja).
- A quién contactar (owner del proyecto GCP).

---

## Task 13: Validación E2E manual

Una vez completados los tasks 0-12 y desplegado el feature en staging o prod, ejecutar este checklist en un dispositivo móvil real (idealmente uno Android y uno iOS):

- [ ] Crear evento desde mobile, escribir "Errázuriz" → ver al menos 3 sugerencias del Gran Valparaíso.
- [ ] Confirmar que **NO aparecen** resultados de fuera del área (Santiago, Concepción, etc.).
- [ ] Seleccionar una sugerencia → confirmar que se cierra el dropdown y la dirección queda completa en el input.
- [ ] Submit del form → en la base de datos (revisar con `npx prisma studio` o equivalente), confirmar que `coordenadas` está poblado con `{lat, lng}` numéricos.
- [ ] Crear otro evento con dirección que no exista en Google ("Casa de la abuela 123") → submit → confirmar que se guarda con `coordenadas: null`.
- [ ] En el detalle del evento creado con coords, tocar la dirección → action sheet aparece con Google Maps, Waze y (en iOS) Apple Maps.
- [ ] Tocar "Google Maps" → abre la app nativa con navegación iniciada hacia las coords.
- [ ] Tocar "Waze" → abre Waze (si está instalado) con navegación. Si no está instalado, redirige al store.
- [ ] En el detalle del evento creado SIN coords, tocar la dirección → action sheet aparece. Tocar "Google Maps" → abre la app con búsqueda por texto (no navegación directa).
- [ ] En desktop (Chrome), abrir el detalle, click en dirección → aparece el panel lateral (sheet right). Las opciones funcionan abriendo URLs en pestaña nueva.
- [ ] En el listado de eventos mobile, cada card muestra la dirección clicable.
- [ ] En el listado desktop (tabla), la dirección aparece debajo del título y es clicable.
- [ ] En el dashboard, los eventos recientes también muestran la dirección clicable.
- [ ] Probar con red lenta (DevTools → Network → Slow 3G) → el autocomplete sigue funcionando, debounce no genera flicker.
- [ ] Probar sin red → el dropdown no aparece, el form sigue siendo usable como texto libre.
- [ ] Probar el `429`: hacer >60 requests/min al endpoint manualmente con curl → recibir `429`.

---

## Self-review

Cobertura del spec, sección por sección:

- ✅ **Resumen** → cubierto por Tasks 9-11 (autocomplete + AddressLink en 3 vistas).
- ✅ **Decisiones tomadas** → todas reflejadas en el plan (proveedor, proxy, fallback, selector, alcance, área).
- ✅ **Arquitectura: piezas nuevas** → Tasks 1, 2, 3, 4, 5, 6, 7, 8.
- ✅ **Arquitectura: piezas modificadas** → Tasks 0 (.env), 9, 10, 11.
- ✅ **`<AddressAutocomplete>`** → Task 8.
- ✅ **`<AddressLink>`** → Task 7.
- ✅ **`<MapsActionSheet>`** → Task 6.
- ✅ **Endpoints** → Tasks 4 y 5.
- ✅ **`places.ts`** → Task 3.
- ✅ **`maps-deeplink.ts`** → Task 1.
- ✅ **Cache LRU** → incluido en Task 3.
- ✅ **Variables de entorno** → Task 0.
- ✅ **Operación: garantizar costo cero** → Task 12.
- ✅ **Manejo de errores** → cubierto en cada task (autocomplete silencioso, fallback de `window.open`, validación de query, rate-limit).
- ✅ **Rate limiting** → Task 2 (helper) + Tasks 4, 5 (uso).
- ✅ **Accesibilidad** → ARIA en Tasks 7 y 8.
- ✅ **Pre-merge checklist** → Task 12.
- ✅ **E2E manual checklist** → Task 13.
- ✅ **Métricas de éxito** → mencionadas en Task 13 (verificar coordenadas en DB).

Sin placeholders, sin "TODO", todas las funciones referenciadas están definidas en algún task. Tipos consistentes (`Coords` se exporta desde `maps-deeplink.ts` y se reutiliza en `MapsActionSheet`, `AddressLink`).
