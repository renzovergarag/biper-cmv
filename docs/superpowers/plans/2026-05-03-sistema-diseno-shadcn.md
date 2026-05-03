# Sistema de Diseño shadcn/ui — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar BIPER CMV a shadcn/ui con paleta Slate+Blue, tipografía Inter, y jerarquía de color de texto consistente.

**Architecture:** Inicializar shadcn/ui sobre el proyecto Next.js existente, reemplazar `globals.css` con los tokens CSS de la paleta Slate+Blue, instalar 10 componentes shadcn via CLI, crear un archivo central de tokens de urgencia en `lib/theme.ts`, y migrar progresivamente cada componente custom a shadcn.

**Tech Stack:** Next.js 14, Tailwind CSS 3.4, shadcn/ui (latest), Inter font (next/font/google), lucide-react, class-variance-authority, clsx, tailwind-merge, tailwindcss-animate.

---

### Task 1: Inicializar shadcn/ui e instalar dependencias

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Inicializar shadcn/ui**

Ejecutar desde `apps/web/`:

```bash
npx shadcn@latest init -d
```

Esto crea `components.json`, `src/lib/utils.ts`, modifica `tailwind.config.ts` y `globals.css`, e instala las dependencias base (`clsx`, `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`, `lucide-react`).

- [ ] **Step 2: Verificar que las dependencias se instalaron**

```bash
cd apps/web && npx shadcn@latest init -d
```

Expected: `components.json` creado, `node_modules` contiene `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`.

- [ ] **Step 3: Modificar `tailwind.config.ts` para quitar darkMode (solo tema claro)**

Leer el archivo `apps/web/tailwind.config.ts`. Reemplazar su contenido:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                chart: {
                    "1": "hsl(var(--chart-1))",
                    "2": "hsl(var(--chart-2))",
                    "3": "hsl(var(--chart-3))",
                    "4": "hsl(var(--chart-4))",
                    "5": "hsl(var(--chart-5))",
                },
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 4: Reemplazar `globals.css` con tokens Slate+Blue**

Reemplazar el contenido de `apps/web/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :root {
        --background: 0 0% 100%;
        --foreground: 222.2 84% 4.9%;
        --card: 0 0% 100%;
        --card-foreground: 222.2 84% 4.9%;
        --popover: 0 0% 100%;
        --popover-foreground: 222.2 84% 4.9%;
        --primary: 221.2 83.2% 53.3%;
        --primary-foreground: 210 40% 98%;
        --secondary: 210 40% 96.1%;
        --secondary-foreground: 222.2 47.4% 11.2%;
        --muted: 210 40% 96.1%;
        --muted-foreground: 215.4 16.3% 46.9%;
        --accent: 210 40% 96.1%;
        --accent-foreground: 222.2 47.4% 11.2%;
        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 210 40% 98%;
        --border: 214.3 31.8% 91.4%;
        --input: 214.3 31.8% 91.4%;
        --ring: 221.2 83.2% 53.3%;
        --radius: 0.5rem;
        --chart-1: 12 76% 61%;
        --chart-2: 173 58% 39%;
        --chart-3: 197 37% 24%;
        --chart-4: 43 74% 66%;
        --chart-5: 27 87% 67%;
    }
}

@layer base {
    * {
        @apply border-border;
    }
    body {
        @apply bg-background text-foreground;
        font-family: Arial, Helvetica, sans-serif;
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/components.json apps/web/src/lib/utils.ts apps/web/tailwind.config.ts apps/web/src/app/globals.css
git commit -m "feat: inicializar shadcn/ui con paleta Slate+Blue"
```

---

### Task 2: Configurar tipografía Inter

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Modificar layout.tsx para cargar Inter via next/font**

Reemplazar el contenido de `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "BIPER CMV - Gestión de Eventos",
    description: "Sistema de despacho y gestión de eventos territoriales",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body className={`${inter.className} antialiased`}>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
```

- [ ] **Step 2: Quitar font-family del body en globals.css**

En `apps/web/src/app/globals.css`, reemplazar el bloque `body`:

```css
    body {
        @apply bg-background text-foreground;
    }
```

(Quitar la línea `font-family: Arial, Helvetica, sans-serif;`)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css
git commit -m "feat: configurar tipografía Inter via next/font"
```

---

### Task 3: Instalar componentes shadcn/ui

**Files:**
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/label.tsx`
- Create: `apps/web/src/components/ui/card.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/table.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/separator.tsx`
- Create: `apps/web/src/components/ui/avatar.tsx`

- [ ] **Step 1: Instalar todos los componentes shadcn**

Ejecutar desde `apps/web/`:

```bash
npx shadcn@latest add button input label card badge dialog table select separator avatar
```

- [ ] **Step 2: Verificar que los archivos se crearon**

```bash
ls apps/web/src/components/ui/
```

Expected: `button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `table.tsx`, `select.tsx`, `separator.tsx`, `avatar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/
git commit -m "feat: instalar componentes shadcn (button, input, label, card, badge, dialog, table, select, separator, avatar)"
```

---

### Task 4: Crear tokens de urgencia centralizados

**Files:**
- Create: `apps/web/src/lib/theme.ts`

- [ ] **Step 1: Crear lib/theme.ts con tokens de urgencia y estado**

Crear `apps/web/src/lib/theme.ts` con el siguiente contenido:

```ts
import { NivelUrgencia, EstadoEvento } from "@prisma/client";

export const urgenciaBadgeVariant: Record<
    NivelUrgencia,
    "destructive" | "secondary" | "outline"
> = {
    [NivelUrgencia.CRITICA]: "destructive",
    [NivelUrgencia.ALTA]: "destructive",
    [NivelUrgencia.MEDIA]: "secondary",
    [NivelUrgencia.BAJA]: "outline",
};

export const urgenciaLabel: Record<NivelUrgencia, string> = {
    [NivelUrgencia.CRITICA]: "Crítica",
    [NivelUrgencia.ALTA]: "Alta",
    [NivelUrgencia.MEDIA]: "Media",
    [NivelUrgencia.BAJA]: "Baja",
};

export const estadoLabel: Record<EstadoEvento, string> = {
    [EstadoEvento.PENDIENTE]: "Pendiente",
    [EstadoEvento.ASIGNADO]: "Asignado",
    [EstadoEvento.EN_RUTA]: "En ruta",
    [EstadoEvento.RESUELTO]: "Resuelto",
    [EstadoEvento.CANCELADO]: "Cancelado",
};

export const estadoBadgeVariant: Record<
    EstadoEvento,
    "default" | "secondary" | "outline" | "destructive"
> = {
    [EstadoEvento.PENDIENTE]: "secondary",
    [EstadoEvento.ASIGNADO]: "default",
    [EstadoEvento.EN_RUTA]: "default",
    [EstadoEvento.RESUELTO]: "outline",
    [EstadoEvento.CANCELADO]: "destructive",
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/theme.ts
git commit -m "feat: centralizar tokens de urgencia y estado en lib/theme.ts"
```

---

### Task 5: Migrar página de login

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Reemplazar login/page.tsx con componentes shadcn**

Reemplazar el contenido de `apps/web/src/app/login/page.tsx`:

```tsx
"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
                setError(data.error || "Error al iniciar sesión");
                setLoading(false);
                return;
            }

            window.location.href = "/dashboard";
        } catch {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-secondary/50 px-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-foreground">
                        BIPER CMV
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Sistema de Gestión de Eventos Territoriales
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Iniciar Sesión</CardTitle>
                        <CardDescription>
                            Ingresa tus credenciales para acceder
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
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
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@biper.cl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input
                                    id="password"
                                    type="password"
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
                            >
                                {loading
                                    ? "Iniciando sesión..."
                                    : "Iniciar Sesión"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/login/page.tsx
git commit -m "feat: migrar login a shadcn (Card, Input, Label, Button)"
```

---

### Task 6: Migrar Navigation

**Files:**
- Modify: `apps/web/src/components/Navigation.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`

- [ ] **Step 1: Reemplazar Navigation.tsx con componentes shadcn**

Reemplazar el contenido de `apps/web/src/components/Navigation.tsx`:

```tsx
"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LogOut } from "lucide-react";

export default function Navigation() {
    const { user, logout, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    return (
        <header className="border-b bg-background">
            <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
                <h1 className="text-xl font-semibold text-foreground">
                    BIPER CMV
                </h1>
                {user && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {user.nombre}
                            </span>
                            <Badge variant="secondary">{user.rol}</Badge>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={logout}
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Cerrar sesión
                        </Button>
                    </div>
                )}
            </div>
        </header>
    );
}
```

- [ ] **Step 2: Migrar dashboard/layout.tsx**

Reemplazar el contenido de `apps/web/src/app/dashboard/layout.tsx`:

```tsx
import Navigation from "@/components/Navigation";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-secondary/30">
            <Navigation />
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Navigation.tsx apps/web/src/app/dashboard/layout.tsx
git commit -m "feat: migrar Navigation y dashboard layout a shadcn (Button, Badge, Separator)"
```

---

### Task 7: Migrar EventList (tabla de eventos)

**Files:**
- Modify: `apps/web/src/components/EventList.tsx`

- [ ] **Step 1: Reemplazar EventList.tsx con Table y Badge de shadcn**

Reemplazar el contenido de `apps/web/src/components/EventList.tsx`:

```tsx
"use client";

import { EventoWithRelations } from "@/types";
import { NivelUrgencia } from "@prisma/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    urgenciaBadgeVariant,
    urgenciaLabel,
    estadoLabel,
} from "@/lib/theme";

interface EventListProps {
    eventos: EventoWithRelations[];
}

function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function EventList({ eventos }: EventListProps) {
    if (eventos.length === 0) {
        return (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center">
                <p className="text-muted-foreground">
                    No hay eventos registrados.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Urgencia</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Asignado a</TableHead>
                        <TableHead>Fecha</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {eventos.map((evento) => (
                        <TableRow key={evento.id}>
                            <TableCell className="font-medium">
                                {evento.titulo}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {evento.origen}
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant={
                                        urgenciaBadgeVariant[
                                            evento.nivelUrgencia as NivelUrgencia
                                        ]
                                    }
                                >
                                    {urgenciaLabel[
                                        evento.nivelUrgencia as NivelUrgencia
                                    ] || evento.nivelUrgencia}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {estadoLabel[evento.estado]}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {evento.asignado?.nombre || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDate(evento.createdAt)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/EventList.tsx
git commit -m "feat: migrar EventList a shadcn (Table, Badge) usando tokens centralizados"
```

---

### Task 8: Migrar CreateEventModal → Dialog

**Files:**
- Modify: `apps/web/src/components/CreateEventModal.tsx`

- [ ] **Step 1: Reemplazar CreateEventModal.tsx con Dialog de shadcn**

Reemplazar el contenido de `apps/web/src/components/CreateEventModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { NivelUrgencia } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { urgenciaLabel } from "@/lib/theme";

interface CreateEventModalProps {
    onEventCreated: (evento: any) => void;
}

export default function CreateEventModal({
    onEventCreated,
}: CreateEventModalProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        titulo: "",
        origen: "",
        nivelUrgencia: NivelUrgencia.BAJA,
        direccionExacta: "",
        telefonoContacto: "",
        latitud: "",
        longitud: "",
    });

    function resetForm() {
        setForm({
            titulo: "",
            origen: "",
            nivelUrgencia: NivelUrgencia.BAJA,
            direccionExacta: "",
            telefonoContacto: "",
            latitud: "",
            longitud: "",
        });
        setError(null);
    }

    function handleOpenChange(isOpen: boolean) {
        setOpen(isOpen);
        if (!isOpen) {
            resetForm();
        }
    }

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement>
    ) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    function handleUrgenciaChange(value: string) {
        setForm((prev) => ({
            ...prev,
            nivelUrgencia: value as NivelUrgencia,
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const coordenadas =
            form.latitud && form.longitud
                ? {
                      lat: parseFloat(form.latitud),
                      lng: parseFloat(form.longitud),
                  }
                : undefined;

        try {
            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    titulo: form.titulo,
                    origen: form.origen,
                    nivelUrgencia: form.nivelUrgencia,
                    direccionExacta: form.direccionExacta,
                    telefonoContacto:
                        form.telefonoContacto || undefined,
                    coordenadas,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(
                    data.error ||
                        "Error al crear el evento. Inténtalo de nuevo."
                );
                return;
            }

            onEventCreated(data.evento);
            setOpen(false);
            resetForm();
        } catch {
            setError("Error de red. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Evento
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Crear nuevo evento</DialogTitle>
                    <DialogDescription>
                        Completa los datos del evento para registrarlo en el
                        sistema.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="titulo">Título</Label>
                        <Input
                            id="titulo"
                            name="titulo"
                            value={form.titulo}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="origen">Origen</Label>
                        <Input
                            id="origen"
                            name="origen"
                            value={form.origen}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nivelUrgencia">
                            Nivel de Urgencia
                        </Label>
                        <Select
                            value={form.nivelUrgencia}
                            onValueChange={handleUrgenciaChange}
                        >
                            <SelectTrigger id="nivelUrgencia">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(NivelUrgencia).map((nivel) => (
                                    <SelectItem key={nivel} value={nivel}>
                                        {urgenciaLabel[nivel]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="direccionExacta">
                            Dirección Exacta
                        </Label>
                        <Input
                            id="direccionExacta"
                            name="direccionExacta"
                            value={form.direccionExacta}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="telefonoContacto">
                            Teléfono de Contacto
                        </Label>
                        <Input
                            id="telefonoContacto"
                            name="telefonoContacto"
                            type="tel"
                            value={form.telefonoContacto}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="latitud">Latitud</Label>
                            <Input
                                id="latitud"
                                name="latitud"
                                type="number"
                                step="any"
                                value={form.latitud}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="longitud">Longitud</Label>
                            <Input
                                id="longitud"
                                name="longitud"
                                type="number"
                                step="any"
                                value={form.longitud}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creando..." : "Crear Evento"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/CreateEventModal.tsx
git commit -m "feat: migrar CreateEventModal a shadcn Dialog con Select"
```

---

### Task 9: Migrar AdminDashboardClient y AgentDashboardClient

**Files:**
- Modify: `apps/web/src/components/AdminDashboardClient.tsx`
- Modify: `apps/web/src/components/AgentDashboardClient.tsx`

- [ ] **Step 1: Reemplazar AdminDashboardClient.tsx con Badge de shadcn**

Reemplazar el contenido de `apps/web/src/components/AdminDashboardClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { Badge } from "@/components/ui/badge";
import CreateEventModal from "./CreateEventModal";
import EventList from "./EventList";

interface AdminDashboardClientProps {
    initialEventos: EventoWithRelations[];
    socketUrl: string;
}

export default function AdminDashboardClient({
    initialEventos,
    socketUrl,
}: AdminDashboardClientProps) {
    const [eventos, setEventos] =
        useState<EventoWithRelations[]>(initialEventos);
    const { connected } = useSocket(socketUrl);

    function handleEventCreated(evento: EventoWithRelations) {
        setEventos((prev) => [evento, ...prev]);
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">
                        Panel de Administración
                    </h2>
                    {connected && (
                        <Badge
                            variant="outline"
                            className="gap-1.5 border-green-300 text-green-700"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Tiempo real conectado
                        </Badge>
                    )}
                </div>
                <CreateEventModal onEventCreated={handleEventCreated} />
            </div>

            <EventList eventos={eventos} />
        </div>
    );
}
```

- [ ] **Step 2: Reemplazar AgentDashboardClient.tsx con Badge y Button de shadcn**

Reemplazar el contenido de `apps/web/src/components/AgentDashboardClient.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { NivelUrgencia, EstadoEvento } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { urgenciaBadgeVariant, urgenciaLabel } from "@/lib/theme";

interface Props {
    initialEventos: EventoWithRelations[];
    userId: string;
    socketUrl: string;
}

export default function AgentDashboardClient({
    initialEventos,
    userId,
    socketUrl,
}: Props) {
    const [eventos, setEventos] =
        useState<EventoWithRelations[]>(initialEventos);
    const [pendientes, setPendientes] = useState<EventoWithRelations[]>([]);
    const { socket, connected } = useSocket(socketUrl);

    useEffect(() => {
        fetch("/api/events?estado=PENDIENTE")
            .then((res) => res.json())
            .then((data) => setPendientes(data.data || []))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleNuevo = ({ evento }: { evento: EventoWithRelations }) => {
            setPendientes((prev) => [evento, ...prev]);
        };

        const handleActualizado = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setEventos((prev) =>
                prev.map((e) => (e.id === evento.id ? evento : e))
            );
            setPendientes((prev) =>
                prev.filter((e) => e.id !== evento.id)
            );
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
        };
    }, [socket]);

    const handleAsignar = (eventoId: string) => {
        if (!socket) return;
        socket.emit("evento:asignar", { eventoId });
    };

    const handleCambiarEstado = (eventoId: string, nuevoEstado: string) => {
        if (!socket) return;
        socket.emit("evento:actualizar-estado", { eventoId, nuevoEstado });
    };

    return (
        <div className="mx-auto max-w-md px-4 py-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-foreground">
                    Panel de Agente
                </h2>
                <div className="flex items-center gap-2">
                    <div
                        className={`h-3 w-3 rounded-full ${
                            connected
                                ? "bg-green-500 animate-pulse"
                                : "bg-destructive"
                        }`}
                    />
                    <span className="text-sm text-muted-foreground">
                        {connected ? "Conectado" : "Desconectado"}
                    </span>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                    Disponibles
                </h3>
                {pendientes.length === 0 ? (
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground text-sm">
                                No hay eventos disponibles.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {pendientes.map((evento) => (
                            <Card key={evento.id}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-foreground text-sm">
                                            {evento.titulo}
                                        </h4>
                                        <Badge
                                            variant={
                                                urgenciaBadgeVariant[
                                                    evento.nivelUrgencia as NivelUrgencia
                                                ]
                                            }
                                        >
                                            {urgenciaLabel[
                                                evento.nivelUrgencia as NivelUrgencia
                                            ] || evento.nivelUrgencia}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        {evento.direccionExacta}
                                    </p>
                                    <Button
                                        onClick={() =>
                                            handleAsignar(evento.id)
                                        }
                                        className="w-full"
                                        size="sm"
                                    >
                                        Tomar caso
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                    Mis Eventos
                </h3>
                {eventos.length === 0 ? (
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground text-sm">
                                No tienes eventos asignados.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {eventos.map((evento) => (
                            <Card key={evento.id}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-foreground text-sm">
                                            {evento.titulo}
                                        </h4>
                                        <Badge
                                            variant={
                                                urgenciaBadgeVariant[
                                                    evento.nivelUrgencia as NivelUrgencia
                                                ]
                                            }
                                        >
                                            {urgenciaLabel[
                                                evento.nivelUrgencia as NivelUrgencia
                                            ] || evento.nivelUrgencia}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-1">
                                        {evento.direccionExacta}
                                    </p>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Estado:{" "}
                                        <span className="font-medium text-foreground">
                                            {evento.estado}
                                        </span>
                                    </p>

                                    {evento.estado ===
                                        EstadoEvento.ASIGNADO &&
                                        evento.asignadoId === userId && (
                                            <Button
                                                onClick={() =>
                                                    handleCambiarEstado(
                                                        evento.id,
                                                        EstadoEvento.EN_RUTA
                                                    )
                                                }
                                                variant="default"
                                                className="w-full bg-yellow-600 hover:bg-yellow-700"
                                                size="sm"
                                            >
                                                Marcar En Ruta
                                            </Button>
                                        )}

                                    {evento.estado ===
                                        EstadoEvento.EN_RUTA &&
                                        evento.asignadoId === userId && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoEvento.RESUELTO
                                                        )
                                                    }
                                                    className="w-full bg-green-600 hover:bg-green-700"
                                                    size="sm"
                                                >
                                                    Resolver
                                                </Button>
                                                <Button
                                                    onClick={() =>
                                                        handleCambiarEstado(
                                                            evento.id,
                                                            EstadoEvento.CANCELADO
                                                        )
                                                    }
                                                    variant="destructive"
                                                    size="sm"
                                                    className="w-full"
                                                >
                                                    Cancelar
                                                </Button>
                                            </div>
                                        )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AdminDashboardClient.tsx apps/web/src/components/AgentDashboardClient.tsx
git commit -m "feat: migrar AdminDashboard y AgentDashboard a shadcn (Badge, Card, Button)"
```

---

### Task 10: Migrar página de inicio (landing)

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Reemplazar page.tsx con colores semánticos**

Reemplazar el contenido de `apps/web/src/app/page.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-secondary/50">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                    BIPER CMV
                </h1>
                <p className="text-lg text-muted-foreground">
                    Sistema de Gestión de Eventos Territoriales
                </p>
                <div className="mt-8">
                    <Button asChild>
                        <Link href="/login">Iniciar Sesión</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: migrar landing page a shadcn (Button)"
```

---

### Task 11: Verificar build

- [ ] **Step 1: Ejecutar build para verificar que todo compila**

```bash
cd apps/web && npm run build
```

Expected: build exitosamente sin errores de TypeScript ni de Tailwind.

- [ ] **Step 2: Si hay errores, corregirlos y re-ejecutar build**

Revisar errores comunes:
- `Cannot find module '@/components/ui/*'` → verificar que el componente se instaló correctamente
- `Property 'xxx' does not exist...` → verificar tipos en `theme.ts` e imports
- Tailwind utility no generada → verificar `tailwind.config.ts` content paths

- [ ] **Step 3: Commit final**

```bash
git add -A && git commit -m "chore: correcciones finales de build"
```
