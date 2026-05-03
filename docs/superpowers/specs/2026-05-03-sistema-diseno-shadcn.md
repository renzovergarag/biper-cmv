# Sistema de Diseño — shadcn/ui

**Fecha:** 2026-05-03  
**Estado:** Aprobado  
**Paleta:** Slate + Blue | **Tipografía:** Inter | **Modo oscuro:** No

---

## 1. Objetivo

Establecer shadcn/ui como sistema de diseño único de BIPER CMV. Reemplazar componentes custom actuales (HTML + Tailwind utilitario directo) por componentes shadcn con una paleta Slate + Blue sobria y elegante, tipografía Inter, y jerarquía de color de texto consistente para máxima legibilidad.

## 2. Tema — Tokens CSS

Reemplazar `apps/web/src/app/globals.css`. Variables requeridas por shadcn/ui usando paleta Slate + Blue:

| Token | Valor HSL | Color efectivo |
|-------|-----------|---------------|
| `--background` | `0 0% 100%` | white |
| `--foreground` | `222.2 84% 4.9%` | slate-900 |
| `--card` | `0 0% 100%` | white |
| `--card-foreground` | `222.2 84% 4.9%` | slate-900 |
| `--popover` | `0 0% 100%` | white |
| `--popover-foreground` | `222.2 84% 4.9%` | slate-900 |
| `--primary` | `221.2 83.2% 53.3%` | blue-600 |
| `--primary-foreground` | `210 40% 98%` | slate-50 |
| `--secondary` | `210 40% 96.1%` | slate-100 |
| `--secondary-foreground` | `222.2 47.4% 11.2%` | slate-900 |
| `--muted` | `210 40% 96.1%` | slate-100 |
| `--muted-foreground` | `215.4 16.3% 46.9%` | slate-500 |
| `--accent` | `210 40% 96.1%` | slate-100 |
| `--accent-foreground` | `222.2 47.4% 11.2%` | slate-900 |
| `--destructive` | `0 84.2% 60.2%` | red-500 |
| `--destructive-foreground` | `210 40% 98%` | slate-50 |
| `--border` | `214.3 31.8% 91.4%` | slate-200 |
| `--input` | `214.3 31.8% 91.4%` | slate-200 |
| `--ring` | `221.2 83.2% 53.3%` | blue-600 |
| `--radius` | `0.5rem` | — |

**Sin modo oscuro.** Se omite la sección `.dark` del CSS estándar de shadcn.

## 3. Tipografía

- **Fuente:** Inter, cargada via `next/font/google` en el layout raíz
- **Variable CSS:** `--font-sans: 'Inter', sans-serif`
- **Escala tipográfica** (consistente con Tailwind defaults de shadcn):

| Elemento | Clase | Uso |
|----------|-------|-----|
| Page title | `text-2xl font-bold` | Título de página |
| Section heading | `text-lg font-semibold` | Subtítulos de sección |
| Card title | `text-base font-semibold` | Título de card |
| Body | `text-sm` | Contenido principal, datos de tabla |
| Caption | `text-xs text-muted-foreground` | Metadata, timestamps |
| Label | `text-sm font-medium` | Labels de formulario |
| Error | `text-sm text-destructive` | Mensajes de error |

## 4. Jerarquía de color de texto

Regla estricta: **nunca usar clases de color Tailwind directas** (ej. `text-gray-500`). Solo tokens semánticos de shadcn:

| Nivel | Clase | Cuándo usar |
|-------|-------|-------------|
| Texto primario | `text-foreground` | Títulos, cuerpo principal |
| Texto secundario | `text-muted-foreground` | Descripciones, timestamps, metadata |
| Texto sobre primario | `text-primary-foreground` | Texto en botones primarios, badges |
| Texto link | `text-primary` | Links y acciones clickeables |
| Texto error | `text-destructive` | Errores de validación |

## 5. Dependencias

Instalar en `apps/web`:

```
clsx, tailwind-merge         # Utilidad cn()
class-variance-authority     # Variantes de componentes
lucide-react                 # Iconos
tailwindcss-animate          # Animaciones
@fontsource/inter            # Fuente (alternativa: next/font/google)
```

## 6. Componentes shadcn a instalar

| Componente | Propósito |
|-----------|-----------|
| `button` | Acciones primarias, secundarias, destructivas |
| `input` | Campos de formulario |
| `label` | Labels de formulario |
| `card` | Tarjetas de evento, dashboards |
| `badge` | Estados de urgencia, roles, estados |
| `dialog` | Modal de creación/edición de eventos |
| `table` | Lista de eventos (admin), listado de agentes |
| `select` | Filtros y selects de formulario |
| `separator` | Divisores visuales |
| `avatar` | Identidad visual de agentes |

## 7. Tokens de urgencia — Fuente única

Archivo nuevo: `apps/web/src/lib/theme.ts`

```ts
import { NivelUrgencia } from "@prisma/client";

export const urgenciaBadgeVariant: Record<NivelUrgencia, "destructive" | "secondary" | "outline"> = {
    CRITICA: "destructive",
    ALTA: "destructive",
    MEDIA: "secondary",
    BAJA: "outline",
};

export const urgenciaBadgeLabel: Record<NivelUrgencia, string> = {
    CRITICA: "Crítica",
    ALTA: "Alta",
    MEDIA: "Media",
    BAJA: "Baja",
};
```

Esto elimina la duplicación actual en `EventList.tsx` y `AgentDashboardClient.tsx`.

## 8. Estructura de archivos resultante

```
apps/web/src/
├── app/
│   ├── globals.css              # Reemplazado: tokens CSS completos shadcn
│   ├── layout.tsx               # + Inter via next/font/google
│   ├── login/page.tsx           # Migrado: Card + Input + Label + Button
│   └── dashboard/
│       ├── layout.tsx           # Migrado: Navigation shadcn
│       ├── admin/page.tsx       # Migrado: Table + Card + Badge + Dialog
│       └── agent/page.tsx       # Migrado: Card + Badge
├── components/
│   ├── ui/                      # NUEVO: componentes shadcn
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   ├── table.tsx
│   │   ├── select.tsx
│   │   ├── separator.tsx
│   │   ├── avatar.tsx
│   │   └── label.tsx
│   ├── Navigation.tsx           # Migrado
│   ├── EventList.tsx            # Migrado
│   ├── CreateEventModal.tsx     # Reemplazado por Dialog
│   ├── AdminDashboardClient.tsx # Migrado
│   └── AgentDashboardClient.tsx # Migrado
├── lib/
│   ├── utils.ts                 # NUEVO: cn() utility
│   └── theme.ts                 # NUEVO: tokens de urgencia
└── types/
    └── index.ts                 # Sin cambios
```

## 9. Orden de implementación

| Paso | Acción |
|------|--------|
| 1 | Inicializar shadcn/ui (`npx shadcn@latest init`) + instalar dependencias |
| 2 | Reemplazar `globals.css` con tokens CSS completos + configurar Inter en layout |
| 3 | Crear `lib/utils.ts` con `cn()` |
| 4 | Instalar componentes shadcn: `button`, `input`, `label`, `card`, `badge`, `dialog`, `table`, `select`, `separator`, `avatar` |
| 5 | Crear `lib/theme.ts` con tokens de urgencia |
| 6 | Migrar `login/page.tsx` (Card + Input + Label + Button) |
| 7 | Migrar `Navigation.tsx` (Button, Avatar, Separator) |
| 8 | Migrar `EventList.tsx` (Card + Badge — usando tokens de `lib/theme.ts`) |
| 9 | Migrar `CreateEventModal.tsx` → `Dialog` con shadcn |
| 10 | Migrar `AdminDashboardClient.tsx` y `AgentDashboardClient.tsx` |

## 10. Criterios de aceptación

- [ ] `globals.css` contiene los 20+ tokens CSS de shadcn (sin `.dark`)
- [ ] Inter cargada via `next/font` y aplicada globalmente
- [ ] `lib/utils.ts` existe con `cn()` exportada
- [ ] Los 10 componentes shadcn listados existen en `components/ui/`
- [ ] `lib/theme.ts` contiene `urgenciaBadgeVariant` y `urgenciaBadgeLabel`
- [ ] Ningún archivo usa clases de color directas (`text-gray-*`, `bg-blue-*`); todo via tokens shadcn o utilidad `cn()`
- [ ] `login/page.tsx` usa `Card`, `Input`, `Label`, `Button` de shadcn
- [ ] `Navigation.tsx` usa componentes shadcn
- [ ] `CreateEventModal.tsx` reemplazado por `Dialog`
- [ ] Badges de urgencia unificados via `lib/theme.ts`
- [ ] `AdminDashboardClient.tsx` y `AgentDashboardClient.tsx` migrados
- [ ] `npm run build` compila sin errores
