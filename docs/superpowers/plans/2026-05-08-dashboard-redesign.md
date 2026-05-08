# Rediseño UI con shell `dashboard-01` — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adoptar el layout `dashboard-01` de shadcn como shell mobile-first de toda la app autenticada, refactorizar el login con identidad CMV, construir un home de KPIs/chart para admin, y dejar todas las páginas existentes coherentes dentro del nuevo shell.

**Architecture:** Sin migrar Tailwind (queda en v3, HSL legacy). Instalamos las primitivas shadcn faltantes (sidebar, dropdown-menu, breadcrumb, tooltip, chart, drawer, skeleton, scroll-area), construimos `AppSidebar` + `SiteHeader` siguiendo la estructura de `dashboard-01` adaptada a nuestros tokens, y reescribimos `dashboard/layout.tsx` como `SidebarProvider` + `AppSidebar` + `SidebarInset(SiteHeader + children)`. La sidebar muestra ítems por rol (`ADMIN`/`AGENT`) desde un `nav-config.ts` plano. La home admin pasa de ser la lista de eventos a una pantalla con 4 KPI cards, un chart de área 7d/30d (recharts vía shadcn `chart`), y una tabla de eventos recientes que reusa el patrón de `EventList`. Endpoints nuevos en `apps/web/src/app/api/admin/stats/*`, `agent/history`, `auth/password`. El socket-server expone `/internal/agents-online` extrayendo el `Map<string, AgenteConectado>` de `socket/handlers.ts` a un módulo compartido `socket/agents-state.ts`.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS 3, shadcn/ui (slate, HSL), Prisma + MongoDB, Express + Socket.io (services/socket-server), `jose` (JWT web) + `jsonwebtoken` (JWT socket), `bcrypt`, `recharts` (vía shadcn chart), `lucide-react`, `sonner` (toasts), `next-themes` (instalado pero no usado — light only).

**Spec:** `docs/superpowers/specs/2026-05-08-dashboard-redesign-design.md`

**Branch:** `redesign/dashboard-shell` desde `main`. Commits en español.

**Convenciones del repo:** indentación 4 espacios, no tabs, `const` sobre `let`, modelos/enums/rutas/mensajes en español. Sin tests automatizados — la verificación es `npm run build` + smoke visual en `npm run dev:web`.

---

## Antes de empezar

- [ ] **Step 0.1: Crear branch**

```bash
git checkout main
git pull
git checkout -b redesign/dashboard-shell
```

- [ ] **Step 0.2: Verificar baseline limpia**

```bash
npm run build
```

Esperado: build pasa sin errores. Si falla, **detente** y arregla antes de seguir — no queremos errores acumulados con el rediseño.

---

## Fase 1 — Infraestructura: dependencias y tokens

### Task 1.1: Instalar componentes shadcn faltantes

**Files:**
- Modify: `apps/web/components.json` (la CLI puede tocar nada o agregar campos)
- Create (la CLI): `apps/web/src/components/ui/sidebar.tsx`
- Create (la CLI): `apps/web/src/components/ui/dropdown-menu.tsx`
- Create (la CLI): `apps/web/src/components/ui/breadcrumb.tsx`
- Create (la CLI): `apps/web/src/components/ui/tooltip.tsx`
- Create (la CLI): `apps/web/src/components/ui/chart.tsx`
- Create (la CLI): `apps/web/src/components/ui/drawer.tsx`
- Create (la CLI): `apps/web/src/components/ui/skeleton.tsx`
- Create (la CLI): `apps/web/src/components/ui/scroll-area.tsx`
- Modify (la CLI): `apps/web/package.json` (agrega deps: `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, `@radix-ui/react-scroll-area`, `cmdk`, `vaul`, `recharts`, `react-day-picker`)
- Modify (la CLI puede tocar): `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts`

- [ ] **Step 1: Ejecutar `shadcn add` desde `apps/web`**

```bash
cd apps/web
npx shadcn@latest add sidebar dropdown-menu breadcrumb tooltip chart drawer skeleton scroll-area
```

Si la CLI pregunta por overwrites, responder **no** para no sobreescribir componentes ya instalados (`button`, `card`, etc.).

- [ ] **Step 2: Validar formato de tokens en `globals.css`**

Si la CLI insertó tokens en formato OKLCH/v4 (líneas como `--background: oklch(...)` o `@theme inline`), revertirlos a HSL.

Lee `apps/web/src/app/globals.css`. El formato esperado es el HSL legacy (lo que ya existe), por ejemplo:

```css
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
```

Si la CLI insertó algo en OKLCH, sustitúyelo por el HSL equivalente (los valores HSL ya existían en el archivo antes — restaurarlos). Si solo agregó nuevos tokens en HSL, déjalo como está.

- [ ] **Step 3: Validar `tailwind.config.ts`**

Confirmar que la CLI no removió la sección `colors` existente. Las llaves ya presentes (`background`, `foreground`, `card`, `primary`, etc.) deben permanecer intactas.

- [ ] **Step 4: Verificar deps instaladas**

```bash
cd /Users/renzovergara/Documents/Dev/Proyectos/biper-cmv
npm install
```

Esperado: instala las nuevas deps que la CLI agregó al `package.json` de `apps/web` (`recharts`, `@radix-ui/react-dropdown-menu`, etc.).

- [ ] **Step 5: Build smoke test**

```bash
npm run build
```

Esperado: build pasa. Si falla por imports rotos en los nuevos `ui/*.tsx`, revisar que la CLI haya escrito los archivos correctamente.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components.json apps/web/src/components/ui/ apps/web/src/app/globals.css apps/web/tailwind.config.ts apps/web/package.json package-lock.json
git commit -m "chore: instalar componentes shadcn (sidebar, drawer, chart, etc.)"
```

---

### Task 1.2: Agregar tokens de sidebar

**Files:**
- Modify: `apps/web/src/app/globals.css` (agregar bloque `--sidebar-*`)
- Modify: `apps/web/tailwind.config.ts` (agregar `colors.sidebar.*`)

- [ ] **Step 1: Agregar variables CSS en `globals.css`**

Edit `apps/web/src/app/globals.css`. Dentro del bloque `:root { ... }` (después del último `--chart-5`), agregar:

```css
--sidebar: 0 0% 98%;
--sidebar-foreground: 222.2 84% 4.9%;
--sidebar-primary: 221.2 83.2% 53.3%;
--sidebar-primary-foreground: 210 40% 98%;
--sidebar-accent: 210 40% 94%;
--sidebar-accent-foreground: 222.2 47.4% 11.2%;
--sidebar-border: 214.3 31.8% 91.4%;
--sidebar-ring: 221.2 83.2% 53.3%;
```

Si la CLI ya insertó tokens `--sidebar-*` en otro formato, reemplazarlos por estos valores HSL.

- [ ] **Step 2: Agregar `colors.sidebar` en `tailwind.config.ts`**

Edit `apps/web/tailwind.config.ts`. Dentro de `theme.extend.colors`, después de la llave `chart`, agregar:

```ts
sidebar: {
    DEFAULT: "hsl(var(--sidebar))",
    foreground: "hsl(var(--sidebar-foreground))",
    primary: "hsl(var(--sidebar-primary))",
    "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
    accent: "hsl(var(--sidebar-accent))",
    "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
    border: "hsl(var(--sidebar-border))",
    ring: "hsl(var(--sidebar-ring))",
},
```

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa. Si `sidebar.tsx` (instalado por shadcn) referencia clases como `bg-sidebar`, ahora deben resolver.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/tailwind.config.ts
git commit -m "feat: agregar tokens de sidebar (HSL light)"
```

---

## Fase 2 — Shell: AppSidebar, SiteHeader, layout reescrito

### Task 2.1: Crear `nav-config.ts`

**Files:**
- Create: `apps/web/src/components/app-shell/nav-config.ts`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/app-shell/nav-config.ts` con:

```ts
import {
    LayoutDashboard,
    Siren,
    Users,
    Wifi,
    ScrollText,
    BarChart3,
    Settings,
    History,
    User,
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
}

export interface NavConfig {
    admin: NavItem[];
    agent: NavItem[];
}

export const navConfig: NavConfig = {
    admin: [
        { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
        { label: "Eventos", href: "/dashboard/admin/events", icon: Siren },
        { label: "Usuarios", href: "/dashboard/admin/users", icon: Users },
        { label: "Agentes en línea", href: "/dashboard/admin/agents", icon: Wifi },
        { label: "Sesiones", href: "/dashboard/admin/sessions", icon: ScrollText },
        { label: "Reportes", href: "/dashboard/admin/reports", icon: BarChart3 },
        { label: "Configuración", href: "/dashboard/admin/settings", icon: Settings },
    ],
    agent: [
        { label: "Mis eventos", href: "/dashboard/agent", icon: Siren },
        { label: "Historial", href: "/dashboard/agent/history", icon: History },
        { label: "Mi perfil", href: "/dashboard/agent/profile", icon: User },
    ],
};

export const breadcrumbLabels: Record<string, string> = {
    "/dashboard/admin": "Dashboard",
    "/dashboard/admin/events": "Eventos",
    "/dashboard/admin/users": "Usuarios",
    "/dashboard/admin/agents": "Agentes en línea",
    "/dashboard/admin/sessions": "Sesiones",
    "/dashboard/admin/reports": "Reportes",
    "/dashboard/admin/settings": "Configuración",
    "/dashboard/agent": "Mis eventos",
    "/dashboard/agent/history": "Historial",
    "/dashboard/agent/profile": "Mi perfil",
};
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa (solo agrega un módulo, ningún consumidor todavía).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app-shell/nav-config.ts
git commit -m "feat(shell): nav-config con items por rol y breadcrumb labels"
```

---

### Task 2.2: Crear `NavMain.tsx`

**Files:**
- Create: `apps/web/src/components/app-shell/NavMain.tsx`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/app-shell/NavMain.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { NavItem } from "./nav-config";

interface NavMainProps {
    items: NavItem[];
}

export default function NavMain({ items }: NavMainProps) {
    const pathname = usePathname();

    return (
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/dashboard/admin" &&
                                pathname.startsWith(item.href));
                        return (
                            <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive}
                                    tooltip={item.label}
                                >
                                    <Link href={item.href}>
                                        <Icon className="h-4 w-4" />
                                        <span>{item.label}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
```

Nota: la lógica `pathname === item.href || pathname.startsWith(item.href)` evita que "Dashboard" (`/dashboard/admin`) quede activa cuando el usuario está en `/dashboard/admin/events` (porque el segundo path *comienza con* el primero). Por eso la condición excluye explícitamente `/dashboard/admin` para el `startsWith`.

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app-shell/NavMain.tsx
git commit -m "feat(shell): NavMain con items activos por pathname"
```

---

### Task 2.3: Crear `NavUser.tsx`

**Files:**
- Create: `apps/web/src/components/app-shell/NavUser.tsx`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/app-shell/NavUser.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";

function initials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function NavUser() {
    const { user, logout } = useAuth();
    const { isMobile } = useSidebar();

    if (!user) return null;

    const profileHref =
        user.rol === "AGENT" ? "/dashboard/agent/profile" : null;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent"
                        >
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarFallback className="rounded-lg">
                                    {initials(user.nombre)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">
                                    {user.nombre}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {user.email}
                                </span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                    >
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold">
                                    {user.nombre}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {user.email}
                                </span>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {profileHref && (
                            <DropdownMenuItem asChild>
                                <Link href={profileHref}>
                                    <UserRound className="mr-2 h-4 w-4" />
                                    Mi perfil
                                </Link>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Cerrar sesión
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app-shell/NavUser.tsx
git commit -m "feat(shell): NavUser con avatar, perfil y logout"
```

---

### Task 2.4: Crear `AppSidebar.tsx`

**Files:**
- Create: `apps/web/src/components/app-shell/AppSidebar.tsx`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/app-shell/AppSidebar.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";
import NavMain from "./NavMain";
import NavUser from "./NavUser";
import { navConfig } from "./nav-config";

export default function AppSidebar() {
    const { user, isLoading } = useAuth();

    if (isLoading || !user) return null;

    const items =
        user.rol === "ADMIN" ? navConfig.admin : navConfig.agent;
    const homeHref =
        user.rol === "ADMIN" ? "/dashboard/admin" : "/dashboard/agent";

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg">
                            <Link
                                href={homeHref}
                                className="flex items-center gap-2"
                            >
                                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary/5">
                                    <Image
                                        src="/Logo BN V.jpg"
                                        alt="CMV"
                                        width={28}
                                        height={28}
                                        className="h-7 w-auto"
                                    />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        VIPER CMV
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        Corp. Municipal
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={items} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app-shell/AppSidebar.tsx
git commit -m "feat(shell): AppSidebar con logo CMV y navegación por rol"
```

---

### Task 2.5: Crear `SiteHeader.tsx`

**Files:**
- Create: `apps/web/src/components/app-shell/SiteHeader.tsx`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/app-shell/SiteHeader.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { breadcrumbLabels } from "./nav-config";

function pageTitle(pathname: string): string {
    if (breadcrumbLabels[pathname]) return breadcrumbLabels[pathname];

    // Buscar el match más específico (más segmentos coincidentes)
    const match = Object.keys(breadcrumbLabels)
        .filter((key) => pathname.startsWith(key))
        .sort((a, b) => b.length - a.length)[0];

    return match ? breadcrumbLabels[match] : "Dashboard";
}

export default function SiteHeader() {
    const pathname = usePathname();
    const title = pageTitle(pathname);

    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 sticky top-0 z-30">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbPage>{title}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
        </header>
    );
}
```

Nota: por ahora el header tiene solo trigger + breadcrumb. El indicador de socket lo agregamos en Fase 8 (Task 8.1).

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app-shell/SiteHeader.tsx
git commit -m "feat(shell): SiteHeader con sidebar trigger y breadcrumb"
```

---

### Task 2.6: Reescribir `dashboard/layout.tsx`

**Files:**
- Modify: `apps/web/src/app/dashboard/layout.tsx`

- [ ] **Step 1: Reemplazar contenido completo**

Sobreescribir `apps/web/src/app/dashboard/layout.tsx` con:

```tsx
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-shell/AppSidebar";
import SiteHeader from "@/components/app-shell/SiteHeader";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(shell): reescribir dashboard/layout con SidebarProvider + SidebarInset"
```

---

### Task 2.7: Eliminar `Navigation.tsx` y `DashboardContent.tsx`

**Files:**
- Delete: `apps/web/src/components/Navigation.tsx`
- Delete: `apps/web/src/components/DashboardContent.tsx`

- [ ] **Step 1: Verificar que no haya imports activos**

```bash
grep -rn "from \"@/components/Navigation\"" apps/web/src
grep -rn "from \"@/components/DashboardContent\"" apps/web/src
grep -rn "from '@/components/Navigation'" apps/web/src
grep -rn "from '@/components/DashboardContent'" apps/web/src
```

Esperado: ningún resultado (el `dashboard/layout.tsx` reescrito ya no los importa, y eran los únicos consumidores).

- [ ] **Step 2: Borrar archivos**

```bash
rm apps/web/src/components/Navigation.tsx
rm apps/web/src/components/DashboardContent.tsx
```

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/components/
git commit -m "chore: eliminar Navigation.tsx y DashboardContent.tsx (absorbidos por shell)"
```

---

### Task 2.8: Smoke test del shell en `npm run dev`

**Files:** ninguno (solo verificación manual)

- [ ] **Step 1: Levantar dev server**

```bash
npm run dev:web
```

Abrir `http://localhost:3000`.

- [ ] **Step 2: Verificar checklist visual**

- Login con un usuario admin existente.
- Tras login, ves la sidebar con: logo CMV miniatura + "VIPER CMV", items (Dashboard, Eventos, Usuarios, Agentes, Sesiones, Reportes, Configuración), avatar abajo.
- Click en items navega — Eventos, Usuarios, Agentes, Sesiones, Reportes, Configuración tirarán 404 todavía (los creamos en Fase 4); Dashboard sigue mostrando lo que mostraba antes (la lista de eventos, hasta Fase 6).
- En desktop, click en el header del sidebar (botón colapsar) → la sidebar se reduce a icon-only.
- En mobile (DevTools, ancho 375px) → la sidebar desaparece, aparece el botón hamburguesa en el `SiteHeader`. Click abre la sidebar como Sheet.
- El logout (desde el avatar en el sidebar footer) funciona.

Si algo de esto falla, **detente** y arregla antes de seguir. No avanzar a Fase 3 con shell roto.

- [ ] **Step 3: Detener dev server**

`Ctrl+C` en la terminal donde corre `npm run dev:web`.

---

## Fase 3 — Login

### Task 3.1: Refactor `login/page.tsx` con logo CMV y `login-03`

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Reemplazar contenido completo**

Sobreescribir `apps/web/src/app/login/page.tsx` con:

```tsx
"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                const msg = data.error || "Error al iniciar sesión";
                setError(msg);
                toast.error(msg);
                setLoading(false);
                return;
            }

            window.location.href = "/dashboard";
        } catch {
            const msg = "Error de conexión";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-svh flex items-center justify-center bg-muted/40 p-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-6">
                <Image
                    src="/Logo BN V.jpg"
                    alt="Corporación Municipal Valparaíso"
                    width={180}
                    height={180}
                    priority
                    className="h-20 sm:h-24 w-auto"
                />
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Iniciar sesión</CardTitle>
                        <CardDescription>
                            Ingresa tus credenciales para acceder
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) =>
                                        setEmail(e.target.value)
                                    }
                                    placeholder="admin@viper.cl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">
                                    Contraseña
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="••••••••"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full"
                                size="lg"
                            >
                                {loading
                                    ? "Iniciando sesión..."
                                    : "Iniciar sesión"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground text-center">
                    Sistema de Gestión de Eventos Territoriales
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Smoke visual**

```bash
npm run dev:web
```

Abrir `http://localhost:3000/login`. Verificar:
- Logo CMV se muestra arriba (~80px en mobile, ~96px en `≥sm`).
- Card centrada con título "Iniciar sesión".
- En mobile (375px), botón es de tamaño `lg`, no se desborda.
- Login funciona end-to-end.
- Si meto credenciales malas, sale toast de error además del banner.

Detener dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/login/page.tsx
git commit -m "feat(login): refactor con logo CMV (login-03 layout)"
```

---

## Fase 4 — Mover existentes y crear placeholders

### Task 4.1: Mover lista de eventos a `/dashboard/admin/events`

**Files:**
- Create: `apps/web/src/app/dashboard/admin/events/page.tsx` (con el contenido del actual `admin/page.tsx`)

Nota: el actual `admin/page.tsx` queda igual hasta Fase 6 (cuando lo reemplazamos por la home). Es decir, durante las fases 4 y 5 ambos `/dashboard/admin` y `/dashboard/admin/events` muestran lo mismo (la lista). Eso es intencional: evita romper navegación intermedia.

- [ ] **Step 1: Crear directorio y copiar archivo**

```bash
mkdir -p apps/web/src/app/dashboard/admin/events
cp apps/web/src/app/dashboard/admin/page.tsx apps/web/src/app/dashboard/admin/events/page.tsx
```

- [ ] **Step 2: Renombrar la función exportada**

Edit `apps/web/src/app/dashboard/admin/events/page.tsx`. Cambiar:

```tsx
export default async function AdminDashboardPage() {
```

por:

```tsx
export default async function AdminEventsPage() {
```

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa. Hay dos páginas con el mismo contenido temporalmente.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/admin/events/page.tsx
git commit -m "feat(routes): mover lista de eventos a /dashboard/admin/events"
```

---

### Task 4.2: Crear placeholders admin (agents, sessions, reports, settings)

**Files:**
- Create: `apps/web/src/app/dashboard/admin/agents/page.tsx`
- Create: `apps/web/src/app/dashboard/admin/sessions/page.tsx`
- Create: `apps/web/src/app/dashboard/admin/reports/page.tsx`
- Create: `apps/web/src/app/dashboard/admin/settings/page.tsx`
- Create: `apps/web/src/components/EmptyState.tsx`

- [ ] **Step 1: Crear `EmptyState` reusable**

Crear `apps/web/src/components/EmptyState.tsx`:

```tsx
import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}

export default function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center text-center min-h-[40vh] gap-3">
            <Icon className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-sm">
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}
```

- [ ] **Step 2: Crear `agents/page.tsx`**

Crear `apps/web/src/app/dashboard/admin/agents/page.tsx`:

```tsx
import ConnectedAgentsPanel from "@/components/ConnectedAgentsPanel";

export default function AdminAgentsPage() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Agentes en línea</h1>
                <p className="text-sm text-muted-foreground">
                    Lista de agentes con sesión activa
                </p>
            </div>
            <ConnectedAgentsPanel />
        </div>
    );
}
```

Nota: `ConnectedAgentsPanel` actualmente renderiza un FAB en mobile y un sidebar inline en desktop, ambos pensados para uso embebido. En Task 7.7 lo refactorizaremos para que tenga una variante `standalone` sin FAB. Por ahora se ve raro pero funciona.

- [ ] **Step 3: Crear `sessions/page.tsx`**

Crear `apps/web/src/app/dashboard/admin/sessions/page.tsx`:

```tsx
import SessionLogsTab from "@/components/SessionLogsTab";

export default function AdminSessionsPage() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Sesiones</h1>
                <p className="text-sm text-muted-foreground">
                    Registro de inicios y cierres de sesión
                </p>
            </div>
            <SessionLogsTab />
        </div>
    );
}
```

- [ ] **Step 4: Crear `reports/page.tsx`**

Crear `apps/web/src/app/dashboard/admin/reports/page.tsx`:

```tsx
import { BarChart3 } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function AdminReportsPage() {
    return (
        <EmptyState
            icon={BarChart3}
            title="Reportes"
            description="Próximamente"
        />
    );
}
```

- [ ] **Step 5: Crear `settings/page.tsx`**

Crear `apps/web/src/app/dashboard/admin/settings/page.tsx`:

```tsx
import { Settings as SettingsIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function AdminSettingsPage() {
    return (
        <EmptyState
            icon={SettingsIcon}
            title="Configuración"
            description="Próximamente"
        />
    );
}
```

- [ ] **Step 6: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/EmptyState.tsx apps/web/src/app/dashboard/admin/agents apps/web/src/app/dashboard/admin/sessions apps/web/src/app/dashboard/admin/reports apps/web/src/app/dashboard/admin/settings
git commit -m "feat(routes): páginas admin placeholder (agents, sessions, reports, settings)"
```

---

### Task 4.3: Crear placeholders agent (history, profile)

**Files:**
- Create: `apps/web/src/app/dashboard/agent/history/page.tsx`
- Create: `apps/web/src/app/dashboard/agent/profile/page.tsx`

Por ahora son páginas de stub que verifican rol y muestran un placeholder. La data real la agregamos cuando creemos los endpoints en Fase 5 y los wireamos en Fase 7.

- [ ] **Step 1: Crear `history/page.tsx`**

Crear `apps/web/src/app/dashboard/agent/history/page.tsx`:

```tsx
import { History } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function AgentHistoryPage() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Historial</h1>
                <p className="text-sm text-muted-foreground">
                    Eventos resueltos o cancelados
                </p>
            </div>
            <EmptyState
                icon={History}
                title="Aún no has cerrado eventos"
            />
        </div>
    );
}
```

- [ ] **Step 2: Crear `profile/page.tsx`**

Crear `apps/web/src/app/dashboard/agent/profile/page.tsx`:

```tsx
import { User as UserIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function AgentProfilePage() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Mi perfil</h1>
                <p className="text-sm text-muted-foreground">
                    Datos de tu cuenta
                </p>
            </div>
            <EmptyState
                icon={UserIcon}
                title="Próximamente"
                description="Aquí podrás ver tus datos y cambiar tu contraseña"
            />
        </div>
    );
}
```

Estas páginas se reemplazarán por implementaciones reales en Tasks 7.8 y 7.9.

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/agent
git commit -m "feat(routes): páginas agent placeholder (history, profile)"
```

---

## Fase 5 — Backend: helpers, endpoints y socket-server

### Task 5.1: Crear `lib/api-auth.ts`

**Files:**
- Create: `apps/web/src/lib/api-auth.ts`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/lib/api-auth.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Rol } from "@prisma/client";
import { verifyToken, type JWTPayload } from "@/lib/auth";

export interface AuthOk {
    ok: true;
    user: JWTPayload;
}

export interface AuthFail {
    ok: false;
    response: NextResponse;
}

export type AuthResult = AuthOk | AuthFail;

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
    const token = request.cookies.get("token")?.value;
    if (!token) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "No autorizado" },
                { status: 401 }
            ),
        };
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Token inválido" },
                { status: 401 }
            ),
        };
    }

    return { ok: true, user: decoded };
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
    const result = await requireAuth(request);
    if (!result.ok) return result;

    if (result.user.rol !== Rol.ADMIN) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Acceso denegado" },
                { status: 403 }
            ),
        };
    }

    return result;
}
```

Patrón de uso en endpoints:

```ts
const auth = await requireAdmin(request);
if (!auth.ok) return auth.response;
// auth.user disponible aquí
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api-auth.ts
git commit -m "feat(lib): api-auth con requireAuth/requireAdmin (lee cookie + verifica JWT)"
```

---

### Task 5.2: Endpoint `/api/admin/stats/kpis`

**Files:**
- Create: `apps/web/src/app/api/admin/stats/kpis/route.ts`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/app/api/admin/stats/kpis/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { EstadoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { generateInternalToken } from "@/lib/auth";

interface AgentsOnlineResponse {
    count: number;
    agents: Array<{
        userId: string;
        email: string;
        nombre: string;
        connectedAt: string;
    }>;
}

async function fetchAgentsOnline(): Promise<{
    count: number;
    stale: boolean;
}> {
    try {
        const socketUrl =
            process.env.SOCKET_SERVER_INTERNAL_URL ||
            process.env.SOCKET_SERVER_URL ||
            "http://localhost:4000";
        const token = await generateInternalToken();
        const res = await fetch(`${socketUrl}/internal/agents-online`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        if (!res.ok) {
            return { count: 0, stale: true };
        }
        const data = (await res.json()) as AgentsOnlineResponse;
        return { count: data.count ?? 0, stale: false };
    } catch (err) {
        console.error("[stats/kpis] fetch agents-online failed:", err);
        return { count: 0, stale: true };
    }
}

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [eventosHoy, pendientesSinAsignar, enProceso, agentes] =
            await Promise.all([
                prisma.evento.count({
                    where: { createdAt: { gte: startOfToday } },
                }),
                prisma.evento.count({
                    where: {
                        estado: EstadoEvento.PENDIENTE,
                        asignadoId: null,
                    },
                }),
                prisma.evento.count({
                    where: {
                        estado: {
                            in: [
                                EstadoEvento.ASIGNADO,
                                EstadoEvento.EN_RUTA,
                            ],
                        },
                    },
                }),
                fetchAgentsOnline(),
            ]);

        const response = NextResponse.json({
            eventosHoy,
            pendientesSinAsignar,
            enProceso,
            agentesEnLinea: agentes.count,
        });
        if (agentes.stale) {
            response.headers.set("x-stale", "agents-online");
        }
        return response;
    } catch (err) {
        console.error("[stats/kpis] error:", err);
        return NextResponse.json(
            { error: "Error al calcular KPIs" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Smoke con curl (requiere socket-server caído todavía — eso es lo esperado)**

```bash
npm run dev:web
```

En otra terminal, login con un admin (capturar la cookie `token`):

```bash
COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email_admin>","password":"<pass>"}' \
  | grep -i "^set-cookie:" | head -n1 | sed 's/Set-Cookie: //I' | cut -d';' -f1)
curl -s -H "Cookie: $COOKIE" http://localhost:3000/api/admin/stats/kpis | jq
```

Esperado: JSON con `eventosHoy`, `pendientesSinAsignar`, `enProceso` correctos. `agentesEnLinea: 0` y header `x-stale: agents-online` (porque el endpoint del socket-server todavía no existe).

Detener dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/admin/stats/kpis/route.ts
git commit -m "feat(api): /api/admin/stats/kpis con count+fetch agentes online"
```

---

### Task 5.3: Endpoint `/api/admin/stats/events-by-day`

**Files:**
- Create: `apps/web/src/app/api/admin/stats/events-by-day/route.ts`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/app/api/admin/stats/events-by-day/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

type CacheEntry = {
    expiresAt: number;
    data: { date: string; count: number }[];
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function startOfDayUTC(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function buildSeries(
    eventos: { createdAt: Date }[],
    days: number
): { date: string; count: number }[] {
    const today = startOfDayUTC(new Date());
    const series: { date: string; count: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const day = new Date(today);
        day.setUTCDate(day.getUTCDate() - i);
        series.push({ date: isoDate(day), count: 0 });
    }

    const indexByDate = new Map(series.map((s, i) => [s.date, i]));

    for (const e of eventos) {
        const key = isoDate(startOfDayUTC(e.createdAt));
        const idx = indexByDate.get(key);
        if (idx !== undefined) series[idx].count += 1;
    }

    return series;
}

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const rangeRaw = url.searchParams.get("range");
    const days =
        rangeRaw === "30" ? 30 : rangeRaw === "7" ? 7 : 7;
    const cacheKey = `events-by-day:${days}`;

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json({ data: cached.data });
    }

    try {
        const since = startOfDayUTC(new Date());
        since.setUTCDate(since.getUTCDate() - (days - 1));

        const eventos = await prisma.evento.findMany({
            where: { createdAt: { gte: since } },
            select: { createdAt: true },
        });

        const data = buildSeries(eventos, days);
        cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data });

        return NextResponse.json({ data });
    } catch (err) {
        console.error("[stats/events-by-day] error:", err);
        return NextResponse.json(
            { error: "Error al construir serie" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Smoke con curl**

```bash
npm run dev:web
```

(Reusar `$COOKIE` de Task 5.2 si la sesión sigue válida; sino re-loguear.)

```bash
curl -s -H "Cookie: $COOKIE" "http://localhost:3000/api/admin/stats/events-by-day?range=7" | jq
```

Esperado: `{ "data": [ { "date": "2026-05-02", "count": N }, ..., { "date": "2026-05-08", "count": N } ] }` con 7 elementos.

Detener dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/admin/stats/events-by-day/route.ts
git commit -m "feat(api): /api/admin/stats/events-by-day con cache 60s"
```

---

### Task 5.4: Extraer estado de agentes a módulo compartido en socket-server

**Files:**
- Create: `services/socket-server/src/socket/agents-state.ts`
- Modify: `services/socket-server/src/socket/handlers.ts`

- [ ] **Step 1: Crear `agents-state.ts`**

Crear `services/socket-server/src/socket/agents-state.ts`:

```ts
export interface AgenteConectado {
    userId: string;
    email: string;
    nombre: string;
    socketId: string;
    connectedAt: string;
}

const agentesConectados = new Map<string, AgenteConectado>();

export function setAgent(agent: AgenteConectado): void {
    agentesConectados.set(agent.userId, agent);
}

export function removeAgent(userId: string): void {
    agentesConectados.delete(userId);
}

export function listAgents(): AgenteConectado[] {
    return Array.from(agentesConectados.values());
}

export function countAgents(): number {
    return agentesConectados.size;
}
```

- [ ] **Step 2: Refactorizar `handlers.ts` para usar el módulo**

Edit `services/socket-server/src/socket/handlers.ts`:

Reemplazar las líneas 6-14 (declaración del `interface AgenteConectado` y `const agentesConectados = new Map(...)`) por un import:

```ts
import {
    type AgenteConectado,
    setAgent,
    removeAgent,
    listAgents,
} from "./agents-state.js";
```

Reemplazar los usos:
- Línea ~54: `socket.emit("agentes:lista", Array.from(agentesConectados.values()));`
  → `socket.emit("agentes:lista", listAgents());`
- Línea ~76: `agentesConectados.set(user.sub, agente);`
  → `setAgent(agente);`
- Línea ~154: `agentesConectados.delete(user.sub);`
  → `removeAgent(user.sub);`

Resultado verificable: en `handlers.ts` no debe quedar referencia directa a `agentesConectados` (la variable local).

- [ ] **Step 3: Build socket-server**

```bash
cd services/socket-server
npm run build
cd /Users/renzovergara/Documents/Dev/Proyectos/biper-cmv
```

Esperado: build pasa.

- [ ] **Step 4: Commit**

```bash
git add services/socket-server/src/socket/agents-state.ts services/socket-server/src/socket/handlers.ts
git commit -m "refactor(socket): extraer agentesConectados a agents-state.ts"
```

---

### Task 5.5: Endpoint `/internal/agents-online` en socket-server

**Files:**
- Modify: `services/socket-server/src/routes/internal.ts`

- [ ] **Step 1: Agregar la ruta**

Edit `services/socket-server/src/routes/internal.ts`. Después de la ruta `/internal/health` (antes del `export default router`), agregar:

```ts
import { listAgents, countAgents } from "../socket/agents-state.js";
```

(en la sección de imports al inicio del archivo).

Y agregar la ruta:

```ts
router.get(
    "/internal/agents-online",
    authenticateInternal,
    (_req: Request, res: Response) => {
        res.json({
            count: countAgents(),
            agents: listAgents().map((a) => ({
                userId: a.userId,
                email: a.email,
                nombre: a.nombre,
                connectedAt: a.connectedAt,
            })),
        });
    }
);
```

- [ ] **Step 2: Build socket-server**

```bash
cd services/socket-server
npm run build
cd /Users/renzovergara/Documents/Dev/Proyectos/biper-cmv
```

Esperado: build pasa.

- [ ] **Step 3: Smoke con curl**

Levantar el socket-server:

```bash
npm run dev:socket
```

En otra terminal, generar un token interno (ad-hoc con node):

```bash
cd apps/web
node -e "
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });
const token = jwt.sign({ rol: 'INTERNAL', sub: 'internal' }, process.env.JWT_SECRET, { expiresIn: '5m' });
console.log(token);
"
```

(Si tu `.env` no está en `apps/web/.env`, ajusta la ruta. La idea es generar un JWT con `rol: INTERNAL` para probar manualmente.)

Llamar al endpoint:

```bash
curl -s -H "Authorization: Bearer <token>" http://localhost:4000/internal/agents-online | jq
```

Esperado: `{ "count": 0, "agents": [] }` (sin agentes conectados aún).

Detener `npm run dev:socket`.

- [ ] **Step 4: Commit**

```bash
git add services/socket-server/src/routes/internal.ts
git commit -m "feat(socket): GET /internal/agents-online (count + lista)"
```

---

### Task 5.6: Endpoint `/api/admin/agents/online`

**Files:**
- Create: `apps/web/src/app/api/admin/agents/online/route.ts`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/app/api/admin/agents/online/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { generateInternalToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const socketUrl =
            process.env.SOCKET_SERVER_INTERNAL_URL ||
            process.env.SOCKET_SERVER_URL ||
            "http://localhost:4000";
        const token = await generateInternalToken();

        const res = await fetch(`${socketUrl}/internal/agents-online`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (!res.ok) {
            const fallback = NextResponse.json({ count: 0, agents: [] });
            fallback.headers.set("x-stale", "agents-online");
            return fallback;
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("[admin/agents/online] error:", err);
        const fallback = NextResponse.json({ count: 0, agents: [] });
        fallback.headers.set("x-stale", "agents-online");
        return fallback;
    }
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Smoke con curl** (con web + socket-server corriendo)

```bash
npm run dev
```

En otra terminal:

```bash
curl -s -H "Cookie: $COOKIE" http://localhost:3000/api/admin/agents/online | jq
```

Esperado: `{ "count": 0, "agents": [] }` (sin agentes loggeados aún por socket).

Detener `npm run dev`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/admin/agents/online/route.ts
git commit -m "feat(api): /api/admin/agents/online (proxy al socket-server)"
```

---

### Task 5.7: Endpoint `/api/agent/history`

**Files:**
- Create: `apps/web/src/app/api/agent/history/route.ts`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/app/api/agent/history/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { EstadoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    try {
        const eventos = await prisma.evento.findMany({
            where: {
                asignadoId: auth.user.sub,
                estado: {
                    in: [EstadoEvento.RESUELTO, EstadoEvento.CANCELADO],
                },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
            include: { creador: true, asignado: true },
        });

        return NextResponse.json({ eventos });
    } catch (err) {
        console.error("[agent/history] error:", err);
        return NextResponse.json(
            { error: "Error al cargar historial" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Smoke con curl** (con web corriendo, login con un agent)

```bash
npm run dev:web
```

```bash
COOKIE_AGENT=$(curl -s -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email_agent>","password":"<pass>"}' \
  | grep -i "^set-cookie:" | head -n1 | sed 's/Set-Cookie: //I' | cut -d';' -f1)
curl -s -H "Cookie: $COOKIE_AGENT" http://localhost:3000/api/agent/history | jq
```

Esperado: `{ "eventos": [...] }` (lista posiblemente vacía si el agent no tiene eventos cerrados).

Detener dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/agent/history/route.ts
git commit -m "feat(api): /api/agent/history (eventos resueltos/cancelados del agente)"
```

---

### Task 5.8: Endpoint `PATCH /api/auth/password`

**Files:**
- Create: `apps/web/src/app/api/auth/password/route.ts`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/app/api/auth/password/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const schema = z.object({
    currentPassword: z.string().min(1, "Contraseña actual requerida"),
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function PATCH(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "Datos inválidos",
                    details: parsed.error.errors,
                },
                { status: 400 }
            );
        }

        const { currentPassword, newPassword } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { id: auth.user.sub },
        });
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no encontrado" },
                { status: 404 }
            );
        }

        const valid = await verifyPassword(currentPassword, user.password);
        if (!valid) {
            return NextResponse.json(
                { error: "Contraseña actual incorrecta" },
                { status: 401 }
            );
        }

        const hashed = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[auth/password] error:", err);
        return NextResponse.json(
            { error: "Error al cambiar contraseña" },
            { status: 500 }
        );
    }
}
```

Nota: este archivo usa `hashPassword` y `verifyPassword` desde `@/lib/password`. Verifica que existan ambas (al menos `verifyPassword` se usa en login). Si solo existe `verifyPassword`, agregar:

```ts
// en @/lib/password
import bcrypt from "bcrypt";
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}
```

- [ ] **Step 2: Verificar que `hashPassword` exista**

```bash
grep -n "hashPassword" apps/web/src/lib/password.ts
```

Si no existe, agregarla al archivo (usando bcrypt como en el login). Si existe, continuar.

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/auth/password/route.ts apps/web/src/lib/password.ts
git commit -m "feat(api): PATCH /api/auth/password con verify+hash bcrypt"
```

---

## Fase 6 — Home admin: KPIs, chart, tabla recientes

### Task 6.1: Refactorizar `EventList` para soportar variante compacta

**Files:**
- Modify: `apps/web/src/components/EventList.tsx`

Objetivo: agregar prop `variant?: "default" | "compact"`. La variante compact omite columnas/filas menos importantes para uso en el home admin (espacio limitado en la card de "eventos recientes"). En `default` (todo lo actual) se mantiene idéntico.

- [ ] **Step 1: Editar `EventList.tsx`**

Actualizar la firma del componente y la prop:

```tsx
interface EventListProps {
    eventos: EventoWithRelations[];
    onEventClick?: (eventoId: string) => void;
    variant?: "default" | "compact";
}

export default function EventList({
    eventos,
    onEventClick,
    variant = "default",
}: EventListProps) {
```

En la variante compact:
- En desktop (`hidden lg:block`), reducir a 4 columnas: Título, Urgencia, Estado, Fecha (omitir Origen y Asignado).
- En mobile (`lg:hidden`), reducir a 3 filas por card: Título, Urgencia, Estado (omitir Origen, Asignado, Fecha).

Implementación: dentro del componente, antes de retornar:

```tsx
const isCompact = variant === "compact";
```

Y wrapping cada fila/columna opcional con `{!isCompact && (...)}`. Las columnas/filas que se mantienen en compact: Título, Urgencia, Estado, Fecha (en desktop solamente).

Ejemplo concreto del header de la tabla `≥lg`:

```tsx
<TableRow>
    <TableHead>Título</TableHead>
    {!isCompact && <TableHead>Origen</TableHead>}
    <TableHead>Urgencia</TableHead>
    <TableHead>Estado</TableHead>
    {!isCompact && <TableHead>Asignado a</TableHead>}
    <TableHead>Fecha</TableHead>
</TableRow>
```

Y en cada fila (`<TableRow>` interna) envolver las celdas correspondientes con el mismo guard `{!isCompact && ...}`.

En la sección mobile (cards), envolver los bloques `<div className="flex justify-between...">` de Origen, Asignado y Fecha con `{!isCompact && (...)}`. La fila Fecha puede mantenerse incluso en compact si quieres (visible para tener contexto temporal); decisión: omitir Fecha en mobile compact, mantener Título/Urgencia/Estado solo.

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa. Los consumidores existentes (que no pasan `variant`) reciben `default`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/EventList.tsx
git commit -m "refactor(EventList): agregar variant='compact' para uso en home"
```

---

### Task 6.2: Crear `KpiCards.tsx`

**Files:**
- Create: `apps/web/src/components/dashboard/KpiCards.tsx`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/dashboard/KpiCards.tsx`:

```tsx
"use client";

import { Calendar, AlertCircle, Activity, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface Kpis {
    eventosHoy: number;
    pendientesSinAsignar: number;
    enProceso: number;
    agentesEnLinea: number;
}

interface KpiCardsProps {
    kpis: Kpis;
    agentesStale?: boolean;
}

export default function KpiCards({ kpis, agentesStale }: KpiCardsProps) {
    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
                label="Eventos hoy"
                value={kpis.eventosHoy}
                icon={Calendar}
            />
            <KpiCard
                label="Pendientes sin asignar"
                value={kpis.pendientesSinAsignar}
                icon={AlertCircle}
            />
            <KpiCard
                label="En proceso"
                value={kpis.enProceso}
                icon={Activity}
            />
            <KpiCard
                label="Agentes en línea"
                value={kpis.agentesEnLinea}
                icon={Wifi}
                hint={agentesStale ? "no actualizado" : undefined}
            />
        </div>
    );
}

interface KpiCardProps {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    hint?: string;
}

function KpiCard({ label, value, icon: Icon, hint }: KpiCardProps) {
    return (
        <Card>
            <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {label}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold tabular-nums transition-all">
                    {value}
                </div>
                {hint && (
                    <span className="text-[10px] text-muted-foreground italic">
                        {hint}
                    </span>
                )}
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/KpiCards.tsx
git commit -m "feat(dashboard): KpiCards con 4 cards y estado stale"
```

---

### Task 6.3: Crear `EventsAreaChart.tsx`

**Files:**
- Create: `apps/web/src/components/dashboard/EventsAreaChart.tsx`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/dashboard/EventsAreaChart.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

type Range = "7" | "30";

const chartConfig = {
    count: {
        label: "Eventos",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig;

interface EventsAreaChartProps {
    initialData: { date: string; count: number }[];
    initialRange?: Range;
}

function formatLabel(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
    });
}

export default function EventsAreaChart({
    initialData,
    initialRange = "7",
}: EventsAreaChartProps) {
    const [range, setRange] = useState<Range>(initialRange);
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (range === initialRange) return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/admin/stats/events-by-day?range=${range}`)
            .then((r) => r.json())
            .then((json) => {
                if (!cancelled && Array.isArray(json.data)) {
                    setData(json.data);
                }
            })
            .catch((err) => {
                console.error("Error fetching chart data:", err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [range, initialRange]);

    const isEmpty = data.every((d) => d.count === 0);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                    <CardTitle className="text-base">
                        Eventos creados
                    </CardTitle>
                    <CardDescription>
                        Últimos {range} días
                    </CardDescription>
                </div>
                <div className="flex gap-1">
                    <Button
                        variant={range === "7" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRange("7")}
                    >
                        7d
                    </Button>
                    <Button
                        variant={range === "30" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRange("30")}
                    >
                        30d
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
                {isEmpty && !loading ? (
                    <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                        Aún no hay eventos en este rango
                    </div>
                ) : (
                    <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-[240px] sm:h-[320px] w-full"
                    >
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient
                                    id="fillCount"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--color-count)"
                                        stopOpacity={0.8}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--color-count)"
                                        stopOpacity={0.05}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={formatLabel}
                                minTickGap={20}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        labelFormatter={(v) =>
                                            formatLabel(v as string)
                                        }
                                        indicator="dot"
                                    />
                                }
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="var(--color-count)"
                                fill="url(#fillCount)"
                                strokeWidth={2}
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/EventsAreaChart.tsx
git commit -m "feat(dashboard): EventsAreaChart con toggle 7d/30d y empty state"
```

---

### Task 6.4: Crear `RecentEventsTable.tsx`

**Files:**
- Create: `apps/web/src/components/dashboard/RecentEventsTable.tsx`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/dashboard/RecentEventsTable.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import EventList from "@/components/EventList";
import type { EventoWithRelations } from "@/types";

interface RecentEventsTableProps {
    eventos: EventoWithRelations[];
    onEventClick?: (eventoId: string) => void;
}

export default function RecentEventsTable({
    eventos,
    onEventClick,
}: RecentEventsTableProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                    Eventos recientes
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/admin/events">
                        Ver todos
                        <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <EventList
                    eventos={eventos}
                    onEventClick={onEventClick}
                    variant="compact"
                />
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/RecentEventsTable.tsx
git commit -m "feat(dashboard): RecentEventsTable reusando EventList compact"
```

---

### Task 6.5: Crear `AdminHomeClient.tsx`

**Files:**
- Create: `apps/web/src/components/dashboard/AdminHomeClient.tsx`

- [ ] **Step 1: Crear archivo**

Crear `apps/web/src/components/dashboard/AdminHomeClient.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import KpiCards, { type Kpis } from "./KpiCards";
import EventsAreaChart from "./EventsAreaChart";
import RecentEventsTable from "./RecentEventsTable";
import EventDetailModal from "@/components/EventDetailModal";
import type { EventoWithRelations } from "@/types";

interface AdminHomeClientProps {
    initialKpis: Kpis;
    initialAgentesStale: boolean;
    initialChartData: { date: string; count: number }[];
    initialRecentEventos: EventoWithRelations[];
    socketUrl: string;
}

export default function AdminHomeClient({
    initialKpis,
    initialAgentesStale,
    initialChartData,
    initialRecentEventos,
    socketUrl,
}: AdminHomeClientProps) {
    const [kpis, setKpis] = useState<Kpis>(initialKpis);
    const [agentesStale, setAgentesStale] = useState(initialAgentesStale);
    const [recent, setRecent] = useState(initialRecentEventos);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(
        null
    );
    const [modalOpen, setModalOpen] = useState(false);
    const { socket } = useSocket(socketUrl);
    const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refetchKpis = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/stats/kpis", {
                cache: "no-store",
            });
            if (!res.ok) return;
            const data = (await res.json()) as Kpis;
            setKpis(data);
            setAgentesStale(res.headers.get("x-stale") === "agents-online");
        } catch (err) {
            console.error("refetchKpis:", err);
        }
    }, []);

    const scheduleRefetch = useCallback(() => {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(refetchKpis, 1000);
    }, [refetchKpis]);

    useEffect(() => {
        if (!socket) return;

        const handleNuevo = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setRecent((prev) => [evento, ...prev].slice(0, 10));
            scheduleRefetch();
        };

        const handleActualizado = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setRecent((prev) =>
                prev.map((e) => (e.id === evento.id ? evento : e))
            );
            scheduleRefetch();
        };

        const handleAgentesCambio = () => {
            scheduleRefetch();
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);
        socket.on("agentes:conectado", handleAgentesCambio);
        socket.on("agentes:desconectado", handleAgentesCambio);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
            socket.off("agentes:conectado", handleAgentesCambio);
            socket.off("agentes:desconectado", handleAgentesCambio);
            if (refetchTimer.current) clearTimeout(refetchTimer.current);
        };
    }, [socket, scheduleRefetch]);

    useEffect(() => {
        const interval = setInterval(refetchKpis, 30_000);
        return () => clearInterval(interval);
    }, [refetchKpis]);

    function handleEventClick(eventoId: string) {
        setSelectedEventId(eventoId);
        setModalOpen(true);
    }

    function handleModalOpenChange(open: boolean) {
        setModalOpen(open);
        if (!open) setSelectedEventId(null);
    }

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                    Resumen de operación en tiempo real
                </p>
            </div>
            <KpiCards kpis={kpis} agentesStale={agentesStale} />
            <EventsAreaChart initialData={initialChartData} />
            <RecentEventsTable
                eventos={recent}
                onEventClick={handleEventClick}
            />
            <EventDetailModal
                eventoId={selectedEventId}
                open={modalOpen}
                onOpenChange={handleModalOpenChange}
                refreshVersion={0}
            />
        </div>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/AdminHomeClient.tsx
git commit -m "feat(dashboard): AdminHomeClient con re-fetch debounced y socket subscriptions"
```

---

### Task 6.6: Reescribir `dashboard/admin/page.tsx`

**Files:**
- Modify: `apps/web/src/app/dashboard/admin/page.tsx`

- [ ] **Step 1: Reemplazar contenido completo**

Sobreescribir `apps/web/src/app/dashboard/admin/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EstadoEvento, Rol } from "@prisma/client";
import { verifyToken, generateInternalToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminHomeClient from "@/components/dashboard/AdminHomeClient";

interface AgentsOnlineResponse {
    count: number;
}

async function fetchAgentsOnline(): Promise<{
    count: number;
    stale: boolean;
}> {
    try {
        const socketUrl =
            process.env.SOCKET_SERVER_INTERNAL_URL ||
            process.env.SOCKET_SERVER_URL ||
            "http://localhost:4000";
        const token = await generateInternalToken();
        const res = await fetch(`${socketUrl}/internal/agents-online`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        if (!res.ok) return { count: 0, stale: true };
        const data = (await res.json()) as AgentsOnlineResponse;
        return { count: data.count ?? 0, stale: false };
    } catch {
        return { count: 0, stale: true };
    }
}

function startOfDayUTC(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

async function fetchChartData(days: number) {
    const since = startOfDayUTC(new Date());
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const eventos = await prisma.evento.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
    });

    const today = startOfDayUTC(new Date());
    const series: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const day = new Date(today);
        day.setUTCDate(day.getUTCDate() - i);
        series.push({ date: isoDate(day), count: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.date, i]));
    for (const e of eventos) {
        const key = isoDate(startOfDayUTC(e.createdAt));
        const i = idx.get(key);
        if (i !== undefined) series[i].count += 1;
    }
    return series;
}

export default async function AdminDashboardPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.ADMIN) {
        redirect("/dashboard/agent");
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
        eventosHoy,
        pendientesSinAsignar,
        enProceso,
        agentes,
        chartData,
        recentEventos,
    ] = await Promise.all([
        prisma.evento.count({
            where: { createdAt: { gte: startOfToday } },
        }),
        prisma.evento.count({
            where: {
                estado: EstadoEvento.PENDIENTE,
                asignadoId: null,
            },
        }),
        prisma.evento.count({
            where: {
                estado: {
                    in: [EstadoEvento.ASIGNADO, EstadoEvento.EN_RUTA],
                },
            },
        }),
        fetchAgentsOnline(),
        fetchChartData(7),
        prisma.evento.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { creador: true, asignado: true },
        }),
    ]);

    const socketUrl =
        process.env.SOCKET_SERVER_URL || "http://localhost:4000";

    return (
        <AdminHomeClient
            initialKpis={{
                eventosHoy,
                pendientesSinAsignar,
                enProceso,
                agentesEnLinea: agentes.count,
            }}
            initialAgentesStale={agentes.stale}
            initialChartData={chartData}
            initialRecentEventos={recentEventos}
            socketUrl={socketUrl}
        />
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Smoke visual**

```bash
npm run dev
```

Login como admin, ir a `/dashboard/admin`. Verificar:
- 4 KPI cards con números coherentes (no NaN, no undefined).
- Chart de área se renderiza (con línea ascendente o plana).
- Tabla "Eventos recientes" muestra hasta 10 eventos.
- Click en un evento abre `EventDetailModal`.
- Toggle 7d/30d en el chart funciona y vuelve a fetchear.
- En mobile (375px): KPI cards en grid 2x2; chart 240px de alto; tabla cambia a cards.

Detener dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/admin/page.tsx
git commit -m "feat(dashboard): home admin con KPIs, chart y eventos recientes"
```

---

## Fase 7 — Mobile-first por página

### Task 7.1: Header sticky con CTA en `/admin/events` y `/admin/users`

**Files:**
- Modify: `apps/web/src/components/AdminDashboardClient.tsx`
- Modify: `apps/web/src/components/UsersPageClient.tsx`

- [ ] **Step 1: Modificar `AdminDashboardClient.tsx`**

El header actual está en las líneas ~74-91 (`<div className="flex items-center justify-between mb-6">`). Reemplazar por:

```tsx
<div className="sticky top-14 z-20 -mx-4 lg:-mx-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
    <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-xl font-bold truncate">Eventos</h2>
            {connected && (
                <Badge
                    variant="outline"
                    className="hidden sm:inline-flex gap-1.5 border-green-300 text-green-700"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Tiempo real
                </Badge>
            )}
            {connected && (
                <span className="sm:hidden h-2 w-2 rounded-full bg-green-500" title="Tiempo real conectado" />
            )}
        </div>
        <CreateEventModal onEventCreated={handleEventCreated} />
    </div>
</div>
```

Notas:
- Eliminar el `<h2>Panel de Administración</h2>` original (lo reemplaza el SiteHeader breadcrumb + este header de "Eventos").
- `top-14` corresponde al alto del SiteHeader (`h-14`).
- `-mx-4 lg:-mx-6` cancela el padding del wrapper de `dashboard/layout.tsx` para que el header sticky vaya de borde a borde.

- [ ] **Step 2: Modificar `UsersPageClient.tsx`**

Encontrar el header actual (debería tener título "Usuarios" + botón "Nuevo usuario"). Aplicar el mismo patrón:

```tsx
<div className="sticky top-14 z-20 -mx-4 lg:-mx-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
    <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Usuarios</h2>
        {/* aquí va el botón "Nuevo usuario" o lo que sea el CTA primario */}
    </div>
</div>
```

(Adaptar al CTA real que tenga `UsersPageClient`.)

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 4: Smoke visual**

`npm run dev:web`. Ir a `/dashboard/admin/events` y `/dashboard/admin/users`. Scrollear: el header de página queda sticky justo debajo del SiteHeader. En mobile el header se ve compacto, sin desbordes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/AdminDashboardClient.tsx apps/web/src/components/UsersPageClient.tsx
git commit -m "feat(mobile): header sticky con CTA en eventos y usuarios"
```

---

### Task 7.2: Migrar `UserFormModal` a `Drawer` en mobile

**Files:**
- Modify: `apps/web/src/components/UserFormModal.tsx`

Patrón: en `<sm` usar `Drawer` (de `@/components/ui/drawer`), en `≥sm` mantener `Dialog`. Hook simple para detectar mobile vía CSS:

- [ ] **Step 1: Crear hook `useMediaQuery`**

Crear `apps/web/src/hooks/useMediaQuery.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(query);
        setMatches(mql.matches);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [query]);

    return matches;
}
```

- [ ] **Step 2: Modificar `UserFormModal.tsx`**

Leer el archivo completo primero. Identificar la estructura: probablemente tiene un `<Dialog>` envolviendo un `<DialogContent>` con `<DialogHeader>` + form + `<DialogFooter>`. Refactorizar para condicional:

```tsx
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
} from "@/components/ui/drawer";

// dentro del componente:
const isMobile = useMediaQuery("(max-width: 639px)");

// luego, render condicional:
if (isMobile) {
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>{/* título */}</DrawerTitle>
                    <DrawerDescription>{/* desc */}</DrawerDescription>
                </DrawerHeader>
                <div className="px-4">{/* form fields */}</div>
                <DrawerFooter>{/* botones */}</DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>{/* original sin cambios */}</DialogContent>
    </Dialog>
);
```

Extraer el contenido del form (fields + submit logic) a una función interna `function FormFields() { return (...) }` para no duplicar JSX entre Dialog y Drawer.

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 4: Smoke visual mobile**

`npm run dev:web`. En DevTools (375px), abrir el modal de "Nuevo usuario" o "Editar usuario". Debe abrir como bottom sheet (no como dialog centrado).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useMediaQuery.ts apps/web/src/components/UserFormModal.tsx
git commit -m "feat(mobile): UserFormModal como Drawer en <sm"
```

---

### Task 7.3: Migrar `CreateEventModal` a `Drawer` en mobile

**Files:**
- Modify: `apps/web/src/components/CreateEventModal.tsx`

- [ ] **Step 1: Aplicar el mismo patrón que Task 7.2**

Leer `CreateEventModal.tsx`. Aplicar la misma estrategia: extraer fields a una función interna, renderizar Drawer en mobile y Dialog en desktop.

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Smoke visual mobile**

`npm run dev:web`. En DevTools (375px), abrir el modal "Crear evento". Debe abrir como bottom sheet.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/CreateEventModal.tsx
git commit -m "feat(mobile): CreateEventModal como Drawer en <sm"
```

---

### Task 7.4: Tap targets ≥44px en botones primarios mobile

**Files:**
- Modify: archivos identificados en step 1

- [ ] **Step 1: Identificar botones primarios mobile**

Botones de acción en flujos críticos. Buscar:

```bash
grep -rn 'size="sm"' apps/web/src/components/AgentDashboardClient.tsx apps/web/src/components/EventDetailModal.tsx apps/web/src/components/EventTimeline.tsx
```

Lista de los botones de acción del agent (asignar evento, actualizar estado, cerrar evento).

- [ ] **Step 2: Aplicar `size="lg"` solo en mobile**

Para cada botón identificado, reemplazar `size="sm"` (o sin size) por:

```tsx
className="h-11 sm:h-9 ..."
```

O equivalentemente: usar el size grande por defecto y reducirlo en `sm:` con utility classes. La meta: ≥44px de alto en `<sm`.

Ejemplo:

```tsx
<Button
    onClick={...}
    size="default"
    className="h-11 sm:h-9 text-sm"
>
    Tomar evento
</Button>
```

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/AgentDashboardClient.tsx apps/web/src/components/EventDetailModal.tsx apps/web/src/components/EventTimeline.tsx
git commit -m "feat(mobile): aumentar tap targets de botones de acción a ≥44px en <sm"
```

---

### Task 7.5: Loading states (`loading.tsx`)

**Files:**
- Create: `apps/web/src/app/dashboard/admin/loading.tsx`
- Create: `apps/web/src/app/dashboard/admin/events/loading.tsx`
- Create: `apps/web/src/app/dashboard/admin/users/loading.tsx`
- Create: `apps/web/src/app/dashboard/agent/loading.tsx`

- [ ] **Step 1: Loading del home admin**

Crear `apps/web/src/app/dashboard/admin/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminHomeLoading() {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4 space-y-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-8 w-12" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[240px] sm:h-[320px] w-full" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 2: Loading de listas (eventos/usuarios)**

Crear `apps/web/src/app/dashboard/admin/events/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminEventsLoading() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        </div>
    );
}
```

Crear `apps/web/src/app/dashboard/admin/users/loading.tsx` con el mismo contenido (lista de filas skeleton).

- [ ] **Step 3: Loading del agent home**

Crear `apps/web/src/app/dashboard/agent/loading.tsx` con el mismo patrón de lista skeleton.

- [ ] **Step 4: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/admin/loading.tsx apps/web/src/app/dashboard/admin/events/loading.tsx apps/web/src/app/dashboard/admin/users/loading.tsx apps/web/src/app/dashboard/agent/loading.tsx
git commit -m "feat(loading): skeletons por ruta para home admin, eventos, usuarios y agent"
```

---

### Task 7.6: Empty states consistentes

**Files:**
- Modify: `apps/web/src/components/EventList.tsx`

- [ ] **Step 1: Reemplazar el empty state actual**

Edit `apps/web/src/components/EventList.tsx`. El bloque actual (líneas ~37-45):

```tsx
if (eventos.length === 0) {
    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center">
            <p className="text-muted-foreground">
                No hay eventos registrados.
            </p>
        </div>
    );
}
```

Reemplazar por uso de `EmptyState`:

```tsx
import EmptyState from "@/components/EmptyState";
import { Siren } from "lucide-react";
// ...
if (eventos.length === 0) {
    return (
        <EmptyState
            icon={Siren}
            title="No hay eventos"
            description="Aún no se han registrado eventos en este listado"
        />
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/EventList.tsx
git commit -m "feat(empty): EventList usa EmptyState consistente"
```

---

### Task 7.7: Refactorizar `ConnectedAgentsPanel` para variante standalone

**Files:**
- Modify: `apps/web/src/components/ConnectedAgentsPanel.tsx`
- Modify: `apps/web/src/app/dashboard/admin/agents/page.tsx`

Objetivo: extraer `AgentList` como subcomponente exportado y reusar en la página standalone sin FAB. El componente actual sigue funcionando como estaba (FAB + sidebar inline) para usos embebidos si los hay.

- [ ] **Step 1: Extraer y exportar `AgentList`**

Edit `ConnectedAgentsPanel.tsx`. La función `AgentList` (líneas ~18-55) ya existe pero no se exporta. Agregar `export`:

```tsx
export function AgentList({ agentes }: { agentes: AgenteConectado[] }) {
    // ... cuerpo sin cambios
}
```

- [ ] **Step 2: Crear hook compartido para suscribirse a agentes**

Para no duplicar la lógica de socket entre `ConnectedAgentsPanel` y la página standalone, extraer un hook. Crear `apps/web/src/hooks/useConnectedAgents.ts`:

```ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { AgenteConectado } from "@/types";

export function useConnectedAgents(): AgenteConectado[] {
    const { token, isLoading } = useAuth();
    const [agentes, setAgentes] = useState<AgenteConectado[]>([]);

    const connect = useCallback(() => {
        if (!token) return undefined;
        const socketUrl =
            process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        const s = io(socketUrl, { auth: { token } });

        s.on("agentes:lista", (data: AgenteConectado[]) =>
            setAgentes(data)
        );
        s.on("agentes:conectado", (data: AgenteConectado) => {
            setAgentes((prev) => {
                const filtered = prev.filter(
                    (a) => a.userId !== data.userId
                );
                return [...filtered, data];
            });
        });
        s.on("agentes:desconectado", (data: { userId: string }) => {
            setAgentes((prev) =>
                prev.filter((a) => a.userId !== data.userId)
            );
        });

        return s;
    }, [token]);

    useEffect(() => {
        if (isLoading) return;
        const s = connect();
        return () => {
            s?.disconnect();
        };
    }, [isLoading, connect]);

    return agentes;
}
```

- [ ] **Step 3: Refactorizar `ConnectedAgentsPanel` para usar el hook**

Reemplazar la lógica de socket interna por el hook:

```tsx
import { useConnectedAgents } from "@/hooks/useConnectedAgents";
// ...
export default function ConnectedAgentsPanel() {
    const { user, isLoading } = useAuth();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const agentes = useConnectedAgents();
    // ... resto idéntico
}
```

- [ ] **Step 4: Reescribir `agents/page.tsx`**

Sobreescribir `apps/web/src/app/dashboard/admin/agents/page.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { AgentList } from "@/components/ConnectedAgentsPanel";
import { useConnectedAgents } from "@/hooks/useConnectedAgents";

export default function AdminAgentsPage() {
    const agentes = useConnectedAgents();

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Agentes en línea</h1>
                <p className="text-sm text-muted-foreground">
                    {agentes.length === 0
                        ? "Sin agentes conectados"
                        : `${agentes.length} agente${agentes.length === 1 ? "" : "s"} conectado${agentes.length === 1 ? "" : "s"}`}
                </p>
            </div>
            {agentes.length === 0 ? (
                <EmptyState
                    icon={Wifi}
                    title="No hay agentes conectados en este momento"
                />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            Conectados ahora
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AgentList agentes={agentes} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
```

- [ ] **Step 5: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 6: Smoke visual**

`npm run dev`. Login como admin, ir a `/dashboard/admin/agents`. Debe mostrar la página standalone (sin FAB). Si hay agentes conectados (loguear con un agent en otro browser), aparecen en la lista.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ConnectedAgentsPanel.tsx apps/web/src/hooks/useConnectedAgents.ts apps/web/src/app/dashboard/admin/agents/page.tsx
git commit -m "refactor(agents): extraer hook useConnectedAgents y página standalone"
```

---

### Task 7.8: Implementar `agent/history/page.tsx`

**Files:**
- Modify: `apps/web/src/app/dashboard/agent/history/page.tsx`

- [ ] **Step 1: Reescribir página**

Sobreescribir `apps/web/src/app/dashboard/agent/history/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EstadoEvento, Rol } from "@prisma/client";
import { History } from "lucide-react";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EventList from "@/components/EventList";
import EmptyState from "@/components/EmptyState";

export default async function AgentHistoryPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.AGENT) {
        redirect("/dashboard");
    }

    const eventos = await prisma.evento.findMany({
        where: {
            asignadoId: decoded.sub,
            estado: {
                in: [EstadoEvento.RESUELTO, EstadoEvento.CANCELADO],
            },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: { creador: true, asignado: true },
    });

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Historial</h1>
                <p className="text-sm text-muted-foreground">
                    Eventos resueltos o cancelados
                </p>
            </div>
            {eventos.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="Aún no has cerrado eventos"
                />
            ) : (
                <EventList eventos={eventos} />
            )}
        </div>
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/agent/history/page.tsx
git commit -m "feat(agent): página de historial con eventos resueltos/cancelados"
```

---

### Task 7.9: Implementar `agent/profile/page.tsx` con cambio de contraseña

**Files:**
- Create: `apps/web/src/components/ChangePasswordModal.tsx`
- Modify: `apps/web/src/app/dashboard/agent/profile/page.tsx`

- [ ] **Step 1: Crear `ChangePasswordModal.tsx`**

Crear `apps/web/src/components/ChangePasswordModal.tsx`:

```tsx
"use client";

import { useState, FormEvent } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordModal() {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (next !== confirm) {
            toast.error("Las contraseñas no coinciden");
            return;
        }
        if (next.length < 8) {
            toast.error("La nueva contraseña debe tener al menos 8 caracteres");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/auth/password", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: current,
                    newPassword: next,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Error al cambiar contraseña");
                return;
            }
            toast.success("Contraseña actualizada");
            setOpen(false);
            setCurrent("");
            setNext("");
            setConfirm("");
        } catch {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">Cambiar contraseña</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cambiar contraseña</DialogTitle>
                    <DialogDescription>
                        Ingresa tu contraseña actual y la nueva
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current">Contraseña actual</Label>
                        <Input
                            id="current"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="next">Nueva contraseña</Label>
                        <Input
                            id="next"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                            value={next}
                            onChange={(e) => setNext(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm">Confirmar nueva</Label>
                        <Input
                            id="confirm"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Guardando..." : "Cambiar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Reescribir `profile/page.tsx`**

Sobreescribir `apps/web/src/app/dashboard/agent/profile/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Rol } from "@prisma/client";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import ChangePasswordModal from "@/components/ChangePasswordModal";

export default async function AgentProfilePage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.AGENT) {
        redirect("/dashboard");
    }

    const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { nombre: true, email: true },
    });
    if (!user) redirect("/login");

    return (
        <div className="space-y-4 max-w-lg">
            <div>
                <h1 className="text-2xl font-bold">Mi perfil</h1>
                <p className="text-sm text-muted-foreground">
                    Datos de tu cuenta
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Información</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                            Nombre
                        </Label>
                        <p className="text-sm">{user.nombre}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                            Email
                        </Label>
                        <p className="text-sm">{user.email}</p>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Seguridad</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChangePasswordModal />
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 4: Smoke visual**

`npm run dev`. Login como agent, ir a `/dashboard/agent/profile`. Verificar:
- Nombre y email se muestran read-only.
- Click en "Cambiar contraseña" abre modal.
- Formulario valida coincidencia y largo mínimo.
- POST con datos válidos cierra modal y muestra toast de éxito.
- POST con contraseña actual incorrecta muestra toast de error.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ChangePasswordModal.tsx apps/web/src/app/dashboard/agent/profile/page.tsx
git commit -m "feat(agent): página de perfil con cambio de contraseña"
```

---

## Fase 8 — Pulido

### Task 8.1: Indicador de socket en `SiteHeader`

**Files:**
- Modify: `apps/web/src/components/app-shell/SiteHeader.tsx`
- Create: `apps/web/src/components/app-shell/SocketStatus.tsx`

- [ ] **Step 1: Crear `SocketStatus.tsx`**

Crear `apps/web/src/components/app-shell/SocketStatus.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/providers/AuthProvider";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type Status = "connected" | "connecting" | "disconnected";

const statusInfo: Record<Status, { color: string; label: string }> = {
    connected: { color: "bg-green-500", label: "Tiempo real conectado" },
    connecting: { color: "bg-amber-500", label: "Reconectando…" },
    disconnected: { color: "bg-red-500", label: "Sin conexión" },
};

export default function SocketStatus() {
    const { token, isLoading } = useAuth();
    const [status, setStatus] = useState<Status>("connecting");

    useEffect(() => {
        if (isLoading || !token) return;
        const socketUrl =
            process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        const s: Socket = io(socketUrl, { auth: { token } });

        s.on("connect", () => setStatus("connected"));
        s.on("disconnect", () => setStatus("disconnected"));
        s.io.on("reconnect_attempt", () => setStatus("connecting"));
        s.io.on("error", () => setStatus("disconnected"));

        return () => {
            s.disconnect();
        };
    }, [token, isLoading]);

    if (isLoading || !token) return null;

    const info = statusInfo[status];

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className="flex h-2 w-2 rounded-full mr-2"
                        aria-label={info.label}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${info.color}`}
                        />
                    </span>
                </TooltipTrigger>
                <TooltipContent>{info.label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
```

- [ ] **Step 2: Agregar `SocketStatus` al `SiteHeader`**

Edit `apps/web/src/components/app-shell/SiteHeader.tsx`. Importar y agregar al final del header (alineado a la derecha con `ml-auto`):

```tsx
import SocketStatus from "./SocketStatus";
// ...
return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 sticky top-0 z-30">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto">
            <SocketStatus />
        </div>
    </header>
);
```

- [ ] **Step 3: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 4: Smoke visual**

`npm run dev`. Login. Verificar:
- Punto verde a la derecha del header con tooltip "Tiempo real conectado".
- Detener `npm run dev:socket` (en otra terminal): después de unos segundos el punto cambia a ámbar/rojo.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-shell/SocketStatus.tsx apps/web/src/components/app-shell/SiteHeader.tsx
git commit -m "feat(shell): indicador de estado de conexión socket en SiteHeader"
```

---

### Task 8.2: Manejar sesión expirada con toast

**Files:**
- Modify: `apps/web/src/components/providers/AuthProvider.tsx`

- [ ] **Step 1: Mostrar toast en logout / 401**

Edit `AuthProvider.tsx`. Modificar `fetchMe`:

```tsx
import { toast } from "sonner";
// ...
useEffect(() => {
    async function fetchMe() {
        try {
            const res = await fetch("/api/auth/me");
            if (res.status === 401) {
                setUser(null);
                setToken(null);
                if (window.location.pathname.startsWith("/dashboard")) {
                    toast.error("Tu sesión expiró");
                    router.push("/login");
                }
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                setToken(data.token);
            } else {
                setUser(null);
                setToken(null);
            }
        } catch {
            setUser(null);
            setToken(null);
        } finally {
            setIsLoading(false);
        }
    }
    fetchMe();
}, [router]);
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/providers/AuthProvider.tsx
git commit -m "feat(auth): toast cuando la sesión expira y estamos en /dashboard"
```

---

### Task 8.3: Error boundary por ruta

**Files:**
- Create: `apps/web/src/app/dashboard/error.tsx`

- [ ] **Step 1: Crear `error.tsx`**

Crear `apps/web/src/app/dashboard/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[dashboard error]", error);
    }, [error]);

    return (
        <EmptyState
            icon={AlertTriangle}
            title="No pudimos cargar esta sección"
            description="Algo salió mal. Intenta de nuevo."
            action={
                <Button onClick={reset} className="mt-2">
                    Reintentar
                </Button>
            }
        />
    );
}
```

- [ ] **Step 2: Build smoke test**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/error.tsx
git commit -m "feat(error): boundary genérico para /dashboard/*"
```

---

### Task 8.4: QA visual final

**Files:** ninguno (checklist manual)

- [ ] **Step 1: Build de producción**

```bash
npm run build
```

Esperado: build pasa.

- [ ] **Step 2: Levantar dev**

```bash
npm run dev
```

- [ ] **Step 3: Checklist por viewport**

Para cada viewport (375px, 768px, 1280px) en Chrome DevTools, verificar:

- [ ] Login: logo CMV visible, card centrada, sin overflow horizontal.
- [ ] Sidebar: trigger funciona; en mobile abre como Sheet; en desktop colapsa a icon-only.
- [ ] `/dashboard/admin` (home): 4 KPIs con valores, chart se renderiza, tabla recientes con 10 filas (cards en `<lg`, tabla en `≥lg`).
- [ ] `/dashboard/admin/events`: header sticky, lista responsive, click en evento abre modal, "Crear evento" en mobile abre Drawer.
- [ ] `/dashboard/admin/users`: header sticky, lista responsive, "Nuevo usuario" en mobile abre Drawer.
- [ ] `/dashboard/admin/agents`: lista de agentes (vacía si nadie está conectado, con cards si hay).
- [ ] `/dashboard/admin/sessions`: SessionLogsTab carga sin errores.
- [ ] `/dashboard/admin/reports`, `/dashboard/admin/settings`: empty state "Próximamente".
- [ ] `/dashboard/agent`: lista de eventos asignados, botones de acción ≥44px en mobile.
- [ ] `/dashboard/agent/history`: empty state si no hay cerrados, lista si los hay.
- [ ] `/dashboard/agent/profile`: nombre/email + cambio de contraseña que funciona end-to-end.
- [ ] Indicador socket (punto verde/ámbar/rojo) responde a apagar/prender el socket-server.
- [ ] Logout funciona desde el avatar del sidebar footer.
- [ ] Tap targets ≥44px en botones primarios mobile (medir con DevTools).
- [ ] Sin overflow horizontal en ninguna página.

- [ ] **Step 4: Detener dev**

`Ctrl+C`.

- [ ] **Step 5: Push de la branch**

```bash
git push -u origin redesign/dashboard-shell
```

- [ ] **Step 6: Crear PR (manual)**

```bash
gh pr create --title "Rediseño UI integral con shell dashboard-01" --body "$(cat <<'EOF'
## Summary
- Adopta el shell sidebar+topbar de shadcn `dashboard-01` como layout autenticado.
- Login con identidad CMV (logo + login-03 layout).
- Home admin con 4 KPIs, chart de área 7d/30d y tabla de eventos recientes.
- Sidebar por rol; nuevas páginas: agents, sessions, reports, settings (admin) y history, profile (agent).
- Mobile-first: headers sticky, drawers para modales largos, tap targets ≥44px.
- Endpoints nuevos: `/api/admin/stats/*`, `/api/admin/agents/online`, `/api/agent/history`, `PATCH /api/auth/password`, `/internal/agents-online` en socket-server.

## Cambio relevante de comportamiento
- `/dashboard/admin` ya **no** es la lista de eventos (eso vive ahora en `/dashboard/admin/events`); ahora muestra el dashboard de KPIs.

## Test plan
- [ ] Login admin → home con KPIs cargados → click en chart toggles 7d/30d
- [ ] Click "Ver todos" → /admin/events
- [ ] Crear evento → aparece en home y en /admin/events; KPI "Eventos hoy" se incrementa
- [ ] Login agent → mis eventos → tomar un evento → cerrar
- [ ] Cambiar contraseña en /agent/profile
- [ ] Sidebar colapsa a icon-only en desktop, Sheet en mobile
- [ ] Indicador socket: prender/apagar dev:socket cambia el color
- [ ] Verificar mobile (375px), tablet (768px), desktop (1280px) sin overflow

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review (ya ejecutada por el escritor del plan)

Cobertura del spec verificada sección a sección:
- ✅ Login con logo CMV → Task 3.1
- ✅ Shell con sidebar/topbar → Tasks 2.1 a 2.6
- ✅ Estructura de archivos → Tasks 4.1 a 4.3, 6.6, 7.7 a 7.9
- ✅ Sidebar por rol → Task 2.1 (`nav-config.ts`)
- ✅ Breadcrumb del SiteHeader → Task 2.5 + `breadcrumbLabels` en 2.1
- ✅ Tokens HSL extendidos → Task 1.2
- ✅ Componentes shadcn nuevos → Task 1.1
- ✅ KPIs admin → Tasks 5.2, 6.2, 6.6
- ✅ Chart área 7d/30d → Tasks 5.3, 6.3
- ✅ Tabla recientes → Tasks 6.1, 6.4
- ✅ Tiempo real (re-fetch debounced) → Task 6.5
- ✅ Endpoints `/api/admin/stats/*`, `agent/history`, `auth/password`, `agents/online` → Tasks 5.2, 5.3, 5.6, 5.7, 5.8
- ✅ Endpoint socket `/internal/agents-online` → Tasks 5.4, 5.5
- ✅ `lib/api-auth.ts` (requireAdmin/requireAuth) → Task 5.1
- ✅ Modales → Drawer en mobile → Tasks 7.2, 7.3
- ✅ Headers sticky con CTA → Task 7.1
- ✅ Tap targets ≥44px → Task 7.4
- ✅ Loading states → Task 7.5
- ✅ Empty states → Task 7.6 + `EmptyState` en 4.2
- ✅ Indicador socket → Task 8.1
- ✅ Error boundary → Task 8.3
- ✅ Sesión expirada → Task 8.2
- ✅ Eliminación de Navigation/DashboardContent → Task 2.7
- ✅ Estados Prisma reales (PENDIENTE/ASIGNADO/EN_RUTA/RESUELTO/CANCELADO) — el plan los usa correctamente; `EN_PROCESO` del spec se mapea a `ASIGNADO + EN_RUTA`, `CERRADO` a `RESUELTO + CANCELADO`.

Sin placeholders ("TODO", "TBD", "fill in", "similar to Task N", "add appropriate error handling"). Todos los pasos contienen el código concreto a aplicar o el comando exacto a ejecutar.

Consistencia de tipos verificada: `Kpis` se exporta desde `KpiCards.tsx` y se importa en `AdminHomeClient.tsx`. `NavItem` y `NavConfig` se exportan desde `nav-config.ts`. `AgenteConectado` se mantiene unificada entre web (`@/types`) y socket-server (`socket/agents-state.ts`) — ambos describen la misma forma. `EventoWithRelations` viene de `@/types` y se usa consistentemente.
