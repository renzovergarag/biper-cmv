# Direcciones clicables a Maps/Waze + autocompletado limitado a Gran Valparaíso

**Fecha:** 2026-05-08
**Estado:** Borrador para review
**Autor:** Renzo Vergara

## Resumen

Mejorar la UX de los agentes comunitarios al atender eventos:

1. Hacer que cada dirección de evento sea clicable y abra la app de mapas preferida (Google Maps, Waze, Apple Maps) con la navegación ya iniciada.
2. Agregar autocompletado de direcciones en el formulario de creación de eventos, restringido al área del Gran Valparaíso (Valparaíso, Viña del Mar, Concón, Quilpué, Villa Alemana). El autocompletado popula `coordenadas` automáticamente para que el deep-link sea máximamente preciso.

El cambio es aditivo: no rompe eventos existentes ni el flujo actual de creación.

## Motivación

Los agentes comunitarios se trasladan al lugar de los eventos. Hoy la dirección está como texto plano en el detalle y notificaciones; copiarla y pegarla en una app de mapas tiene fricción y es propenso a errores. Adicionalmente, el formulario actual pide lat/lng como inputs numéricos manuales — virtualmente nadie los llena, así que la mayoría de los eventos quedan sin coordenadas exactas.

## Decisiones tomadas

| Decisión | Elegido | Razón |
|---|---|---|
| Proveedor de geocoding | Google Places API (New) | Mejor cobertura de calles y POIs en Chile |
| Integración del proveedor | Backend proxy (`/api/places/*`) | API key server-only; permite cache y rate-limit; empata con patrón actual del repo |
| Modo del campo dirección | Autocomplete + texto libre como fallback | No bloquea al agente si una calle no aparece en Google |
| Acción al click en dirección | Selector Maps / Waze / Apple Maps | Respeta preferencia personal de cada agente |
| Vistas con dirección clicable | Detalle + Listado/cards + Dashboard | Permite arrancar navegación desde cualquier punto |
| Área geográfica | Gran Valparaíso (rectángulo) | Donde realmente operan los agentes |

## Arquitectura

```
┌─ Browser ──────────────────────────────────────┐
│                                                │
│  CreateEventModal                              │
│  └── <AddressAutocomplete>  ◄── nuevo widget   │
│        debounce 300ms                          │
│        ├──► GET /api/places/autocomplete?q=…   │
│        └──► GET /api/places/details?placeId=…  │
│                                                │
│  EventDetailModal / EventList / Dashboard      │
│  └── <AddressLink direccion lat lng>           │
│        on click ──► <MapsActionSheet>          │
│                       Google Maps              │
│                       Waze                     │
│                       Apple Maps (iOS only)    │
└────────────────────────────────────────────────┘
                       │
                       ▼  (server-only)
┌─ Next.js API ──────────────────────────────────┐
│  /api/places/autocomplete   (proxy + cache)    │
│  /api/places/details        (proxy + cache)    │
│       │                                        │
│       │  GOOGLE_PLACES_API_KEY (env)           │
│       ▼                                        │
└─ places.googleapis.com ────────────────────────┘
```

### Piezas nuevas

1. **`src/app/api/places/autocomplete/route.ts`** — route handler GET. Valida query, llama al helper, retorna sugerencias.
2. **`src/app/api/places/details/route.ts`** — route handler GET. Valida placeId, llama al helper, retorna `{ description, lat, lng, comuna }`.
3. **`src/lib/places.ts`** — wrapper sobre Places API (New) REST. Cache LRU en memoria.
4. **`src/lib/maps-deeplink.ts`** — pure functions que construyen URLs de deep-link.
5. **`src/components/AddressAutocomplete.tsx`** — input combobox con sugerencias.
6. **`src/components/AddressLink.tsx`** — botón con estilo de link que dispara el action sheet.
7. **`src/components/MapsActionSheet.tsx`** — sheet/dropdown shadcn con las opciones de app.

### Piezas modificadas

- **`src/components/CreateEventModal.tsx`** — reemplaza el `<Input>` de dirección por `<AddressAutocomplete>`. Elimina los inputs manuales de lat/lng (se llenan automáticamente desde el autocomplete; el modelo soporta seguir creando con `coordenadas: null`).
- **`src/components/EventDetailModal.tsx`** — reemplaza el `<span>` con la dirección por `<AddressLink>`.
- **`src/components/EventList.tsx`** — agrega la dirección a las cards mobile y a la tabla desktop, usando `<AddressLink>`. Como `RecentEventsTable.tsx` y otros widgets del dashboard delegan en `EventList`, esta modificación los cubre automáticamente. Verificar caso por caso si algún widget renderiza eventos sin pasar por `EventList`; de existir, agregar `<AddressLink>` allí también.
- **`.env.example`** — agrega `GOOGLE_PLACES_API_KEY`.

### Lo que NO cambia

- Modelo Prisma `Evento` (ya tiene `direccionExacta` y `coordenadas: Json?`).
- Estado del form (sigue con `useState`, no se migra a react-hook-form).
- Validación: la dirección sigue siendo string requerido.
- `EventNotification`: se decidió no incluirlo en el alcance del link clicable.

## Componentes y contratos

### `<AddressAutocomplete>`

```tsx
<AddressAutocomplete
  value={direccionExacta}
  onChange={(text) => setDireccionExacta(text)}
  onSelect={(place) => {
    setDireccionExacta(place.description);
    setCoordenadas({ lat: place.lat, lng: place.lng });
  }}
/>
```

Comportamiento:

- Input shadcn con dropdown de sugerencias debajo.
- Debounce 300 ms antes de llamar `/api/places/autocomplete`.
- Mientras escribe: muestra hasta 5 sugerencias con `MapPin` + texto principal + texto secundario (comuna).
- Si selecciona: hace fetch a `/api/places/details`, llena `coordenadas`, cierra el dropdown.
- Si no selecciona y sigue tipeando: `onChange` mantiene el texto libre, `coordenadas` queda en el último valor (o vacío).
- Mobile-first: dropdown de ancho completo, ítems con `min-h-12` para touch.
- Estados: loading (spinner pequeño), empty (`Sin resultados — puedes dejarlo como texto libre`), error (silencioso, fallback a texto libre).
- Genera un `sessionToken` (UUID v4) al montar y lo manda en ambos endpoints — Google factura como una sola sesión cuando el token está presente en autocomplete + details.

### `<AddressLink>`

```tsx
<AddressLink
  direccion={evento.direccionExacta}
  coordenadas={evento.coordenadas}
  className="..."
/>
```

- Renderiza la dirección como `<button>` con estilo de link (subrayado al hover, `text-primary`, icono `MapPin` antes del texto).
- Al click: abre `MapsActionSheet`. Si no se renderiza el sheet, fallback directo a Google Maps.
- En desktop usa `DropdownMenu` shadcn. En mobile (<640px) usa `Sheet` (bottom sheet), coherente con el `Drawer` del form.
- Si `direccion` está vacía → no renderiza nada.

### `<MapsActionSheet>`

```tsx
<MapsActionSheet
  direccion={...}
  coordenadas={...}
  open
  onOpenChange={...}
/>
```

Items:

1. **Google Maps** — siempre visible
2. **Waze** — siempre visible
3. **Apple Maps** — solo si `navigator.userAgent` matchea iOS/macOS
4. **Cancelar**

Cada item llama a `buildDeepLink(provider, direccion, coordenadas)` y abre con `window.open(url, "_blank", "noopener")`. Si `window.open` retorna `null`, hace fallback a `location.href = url`.

### Endpoints

```
GET /api/places/autocomplete?q={text}&sessionToken={uuid}
→ 200 { suggestions: [{ placeId, description, mainText, secondaryText }] }
→ 400 si q < 3 chars o vacío
→ 429 si rate limit
→ 503 si Google falla
```

```
GET /api/places/details?placeId={id}&sessionToken={uuid}
→ 200 { description, lat, lng, comuna }
→ 400 si placeId ausente
→ 404 si placeId inválido
→ 429 si rate limit
→ 503 si Google falla
```

## Helpers, restricción geográfica y cache

### `src/lib/places.ts`

Usa la **Places API (New)** de Google sobre `https://places.googleapis.com/v1/...`. Dos funciones puras:

```ts
export async function autocomplete(
  input: string,
  sessionToken: string
): Promise<Suggestion[]>

export async function placeDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetails>
```

Restricción a Gran Valparaíso vía `locationRestriction.rectangle`:

```ts
const GRAN_VALPARAISO_BOUNDS = {
  rectangle: {
    low:  { latitude: -33.10, longitude: -71.66 },
    high: { latitude: -32.90, longitude: -71.30 },
  },
};
```

Con `locationRestriction` (no `locationBias`), Google devuelve **solo** lugares dentro del rectángulo.

Filtros adicionales en el body del request:

- `includedRegionCodes: ["cl"]`
- `includedPrimaryTypes: ["street_address","route","premise","subpremise","point_of_interest"]`
- `languageCode: "es"`
- `regionCode: "cl"`

### `src/lib/maps-deeplink.ts`

```ts
export type Provider = "google" | "waze" | "apple";

export function buildDeepLink(
  provider: Provider,
  direccion: string,
  coordenadas?: { lat: number; lng: number }
): string;
```

Lógica:

```ts
const hasCoords =
  coordenadas &&
  Number.isFinite(coordenadas.lat) &&
  Number.isFinite(coordenadas.lng);
const q = encodeURIComponent(direccion);

switch (provider) {
  case "google":
    return hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`;
  case "waze":
    return hasCoords
      ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://waze.com/ul?q=${q}&navigate=yes`;
  case "apple":
    return hasCoords
      ? `https://maps.apple.com/?daddr=${lat},${lng}`
      : `https://maps.apple.com/?q=${q}`;
}
```

Con coordenadas usamos URLs de **direcciones** (navegación desde la ubicación del usuario), no de búsqueda — un tap → ya está navegando.

### Cache en memoria

Lib `lru-cache` (npm). Dos caches en `places.ts`:

| Cache | Key | TTL | Tamaño |
|---|---|---|---|
| Autocomplete | `${input.toLowerCase()}` | 5 min | 200 entradas |
| Details | `placeId` | 24 h | 500 entradas |

Vive en memoria del proceso Node (no compartido entre instancias). Suficiente para una app single-instance; reduce en 60-80% el costo en uso típico (mismos términos repetidos).

### Variables de entorno

Agregar a `.env.example`:

```
# Google Places API (server-only — NUNCA exponer al cliente)
GOOGLE_PLACES_API_KEY=
```

## Operación: garantizar costo cero en GCP

El tier gratuito de Google Maps Platform cambió en marzo 2025 (de un crédito mensual de USD 200 a cuotas por SKU). Para una app de uso moderado, el costo esperado es USD 0/mes, pero **no asumirlo** — protegerlo técnicamente:

1. **Cuota dura (hard quota)** en GCP en la API Places (New), p. ej. 1000 requests/día. Si se alcanza, los requests fallan en lugar de cobrarse. Es la única garantía técnica de costo cero.
2. **Alerta de presupuesto en USD 1/mes**. Si en cualquier momento aparece un cobro, llega un mail en cuanto pase el primer dólar.
3. **Restricciones de la API key**:
   - API: solo Places API (New) habilitada.
   - Aplicación: HTTP referrer al dominio de prod y/o IP del servidor.
4. **Verificar pricing vigente** en la página oficial de Google Maps Platform antes del lanzamiento, ya que el modelo puede haber cambiado.
5. **Habilitar billing**: aunque el uso esté dentro del free tier, GCP exige tarjeta asociada.

Estos pasos quedan documentados en el plan de implementación como parte del setup pre-merge.

## Manejo de errores y casos límite

### Autocomplete

| Caso | Comportamiento |
|---|---|
| Input < 3 caracteres | No se llama a la API. Dropdown oculto. |
| Sin resultados | Dropdown muestra `Sin resultados — puedes dejarlo como texto libre`. Input editable. |
| Google 4xx (cuota, key inválida) | Backend loggea con detalle. Frontend recibe 503 y oculta el dropdown silenciosamente. |
| Google 5xx o timeout | Backend hace 2 reintentos con 300 ms backoff, luego 503. Frontend silencioso, fallback a texto libre. |
| Sin red | `fetch` falla; dropdown vacío con mismo mensaje de fallback. |
| `sessionToken` ausente | Backend lo genera para esa request, loggea warning. |
| `q` vacío o solo espacios | Backend retorna 400 sin llamar a Google. |

**Principio rector**: el autocomplete es una mejora, no un blocker. Cualquier falla → degrada a texto libre, nunca rompe el flujo de creación.

### Deep-link

| Caso | Comportamiento |
|---|---|
| Sin lat/lng (texto libre) | Cae a búsqueda por texto en cada provider. Sigue funcionando, menos preciso. |
| `direccion` vacío Y sin coords | `<AddressLink>` retorna `null`. |
| lat/lng inválidos (NaN, fuera de rango) | `Number.isFinite()` los detecta y cae a búsqueda por texto. |
| `window.open` bloqueado | Fallback a `location.href = url`. |
| Apple Maps en Android | Item no se muestra (UA sniff). |
| Waze no instalada en mobile | El link `https://waze.com/ul` redirige al store; lo maneja Waze. |

### Form

| Caso | Comportamiento |
|---|---|
| Selección del autocomplete + edición posterior del texto | `coordenadas` se mantiene. Se muestra badge sutil `📍 Ubicación seleccionada — editar dirección no actualiza el pin`. |
| Usuario borra todo el input | `coordenadas` se limpia. |
| Submit sin haber seleccionado del autocomplete | OK, se guarda como texto libre sin coords. El deep-link después funciona por búsqueda de texto. |

### Rate limiting

- Proxy backend con rate-limit por IP: **60 req/min** en autocomplete, **20 req/min** en details. Si se excede, 429.
- Implementación: in-memory `Map<ip, { count, resetAt }>`. Suficiente para single-instance; migrar a Redis si se escala horizontalmente.
- Cualquier 429 se loggea para detectar abuso temprano.

### Accesibilidad

- `<AddressAutocomplete>` con ARIA `combobox` (role, aria-expanded, aria-controls, aria-activedescendant).
- Teclado: ↑/↓ mover, Enter seleccionar, Esc cerrar.
- `<AddressLink>` es `<button>` con `aria-label="Abrir {direccion} en una app de mapas"`.
- `<MapsActionSheet>`: items son botones; el sheet atrapa focus y se cierra con Esc.

## Testing

### Unit tests

| Archivo | Cobertura |
|---|---|
| `src/lib/maps-deeplink.test.ts` | Matriz provider × (con coords / sin coords / coords inválidas). Snapshot de URLs. Encoding de espacios y tildes. |
| `src/lib/places.test.ts` | Mock de fetch a Google: parseo OK, manejo de 4xx/5xx/timeout/retry. Verifica `locationRestriction` y `sessionToken` en el body. |
| `src/app/api/places/autocomplete/route.test.ts` | Validación de query (q < 3, vacío). Rate limit. Fallback a 503. |
| `src/app/api/places/details/route.test.ts` | Validación de placeId. Cache hit no llama a Google. |

### Component tests (React Testing Library)

| Archivo | Cobertura |
|---|---|
| `src/components/AddressAutocomplete.test.tsx` | Debounce funciona. Selección dispara `onSelect` con lat/lng. Texto libre sin selección dispara solo `onChange`. Teclado. Estado "sin resultados". |
| `src/components/AddressLink.test.tsx` | Click abre el sheet. No renderiza si dirección vacía. Click en cada item construye URL correcta. iOS muestra Apple Maps; Android no. |

### E2E manual checklist (mobile real)

- [ ] Crear evento desde mobile, escribir "Errázuriz" → ver sugerencias filtradas a Gran Valparaíso.
- [ ] Seleccionar una sugerencia → confirmar que `coordenadas` se guarda.
- [ ] Crear evento con dirección que NO existe en Google → confirmar que se guarda como texto libre.
- [ ] En el detalle del evento creado, tocar la dirección → action sheet aparece.
- [ ] Tocar "Google Maps" → abre la app nativa con navegación iniciada.
- [ ] Tocar "Waze" → abre Waze (si está instalado) con navegación.
- [ ] En desktop (Chrome), click en dirección → dropdown menu (no sheet) aparece.
- [ ] Repetir con un evento sin coordenadas (texto libre) → el deep-link cae a búsqueda y aún así abre la app.
- [ ] Probar con red lenta / sin red → autocomplete falla silenciosamente, form sigue usable.

## Rollout

Una sola fase. No hay flag ni gradualidad: el cambio es aditivo y revertible vía git.

### Pre-merge checklist

1. Crear API key en GCP, restringirla por IP/dominio (ver sección "Operación: garantizar costo cero").
2. **Configurar cuota dura** en la API y **alerta de presupuesto USD 1/mes**.
3. Agregar `GOOGLE_PLACES_API_KEY` al entorno de prod.
4. Habilitar billing en GCP.
5. Smoke test en staging con la key real antes de merge.

### Eventos preexistentes

Tienen `coordenadas: null`. La feature funciona igual — el `<AddressLink>` cae al deep-link por búsqueda. No requiere migración.

### Métricas de éxito (a 2 semanas post-deploy)

- % de eventos creados con `coordenadas != null` (objetivo: > 70%).
- Reportes cualitativos de los agentes: ¿el flujo "ver evento → tocar dirección → llegar al lugar" se siente más rápido?
- Costo Google Places mensual (objetivo: USD 0).

## Fuera de alcance

Cosas explícitamente excluidas de este spec, para que no se cuelen en la implementación:

- Edición de eventos existentes (no hay form de edición hoy; si aparece, reusará `<AddressAutocomplete>`).
- Mini-mapa con pin arrastrable para afinar la ubicación (descartado en brainstorming por complejidad).
- Setting por usuario para preferencia de app de mapas (se descartó en favor del action sheet).
- Hacer la dirección clicable en `EventNotification` (se decidió no incluirlo).
- Migrar el form de eventos a react-hook-form.
- Cache distribuido (Redis) — la cache in-memory es suficiente mientras la app sea single-instance.
