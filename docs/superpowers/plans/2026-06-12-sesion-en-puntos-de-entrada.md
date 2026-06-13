# Reconocer la sesión activa en los puntos de entrada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `/` y `/login` reconozcan una sesión activa en el servidor y redirijan a `/dashboard`, en vez de mostrar siempre la landing/formulario aunque la cookie `token` siga válida.

**Architecture:** Chequeo de sesión en el servidor dentro de cada punto de entrada, reutilizando el patrón ya presente en `apps/web/src/app/dashboard/page.tsx` (`cookies()` → `verifyToken` → `redirect`). Sin tocar cookie, JWT, middleware, `AuthProvider` ni `/api/auth/me`. Sin cambios visuales.

**Tech Stack:** Next.js 14 (app router, RSC), TypeScript, `jose` (vía `@/lib/auth`), `next/headers`, `next/navigation`.

**Spec:** `docs/superpowers/specs/2026-06-12-sesion-en-puntos-de-entrada-design.md`

**Nota sobre verificación:** El proyecto no tiene framework de tests; la verificación es **manual** vía navegador. Usuarios de prueba: `admin@viper.cl` y `superadmin@viper.cl`, contraseña `password123`. Las pruebas se hacen contra el Mongo de **desarrollo local**, nunca producción.

---

### Task 1: Redirección a `/dashboard` desde la raíz `/`

Convertir la raíz en server component que detecte sesión activa y redirija a `/dashboard`; si no hay sesión válida, renderiza la landing actual sin cambios visuales.

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Reescribir `page.tsx` agregando el chequeo de sesión en servidor**

Reemplazar el contenido completo de `apps/web/src/app/page.tsx` por:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { verifyToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
    const token = cookies().get("token")?.value;

    if (token && (await verifyToken(token))) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-svh flex items-center justify-center bg-muted/40 p-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
                <Image
                    src="/Logo BN Sin Fondo.png"
                    alt="Corporación Municipal Valparaíso"
                    width={180}
                    height={180}
                    priority
                    className="h-24 sm:h-28 w-auto"
                />
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">
                        VIPER CMV
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Sistema de Gestión de Eventos Territoriales
                    </p>
                </div>
                <Button asChild size="lg" className="w-full">
                    <Link href="/login">Iniciar sesión</Link>
                </Button>
            </div>
        </div>
    );
}
```

Notas:
- `redirect()` lanza internamente, así que no hace falta `return` después de llamarlo.
- La rama "sin sesión" (token ausente o `verifyToken` devuelve `null`/falsy) nunca redirige, evitando loops.
- El JSX de la landing es idéntico al actual: sin cambios visuales.

- [ ] **Step 2: Verificar que compila sin errores de tipo**

Run: `npm run build --workspace=apps/web` (o el script de build del proyecto)
Expected: build exitoso, sin errores de TypeScript en `page.tsx`.

ADVERTENCIA: No ejecutar `npm run build` si hay un `npm run dev` activo — corrompe `.next` del dev server. Si el dev server está corriendo, omitir este step y validar el tipado con el chequeo del editor/`tsc --noEmit` en su lugar, o detener el dev server primero.

- [ ] **Step 3: Verificación manual en el navegador (con dev server corriendo)**

Con `npm run dev` activo:
1. Iniciar sesión con `admin@viper.cl` / `password123`.
2. En la barra de direcciones, navegar a `/` (la raíz).
   - Esperado: redirige automáticamente a `/dashboard` y de ahí a `/dashboard/admin`.
3. Cerrar sesión (logout).
4. Navegar a `/`.
   - Esperado: se ve la landing (logo VIPER CMV + botón "Iniciar sesión"), sin redirección.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: redirigir a /dashboard desde / cuando hay sesión activa"
```

---

### Task 2: Redirección a `/dashboard` desde `/login` (split server/client)

`/login` es hoy un client component. Se separa en un server component (`page.tsx`) que hace el chequeo de sesión y un client component (`LoginForm.tsx`) con el formulario actual sin cambios funcionales.

**Files:**
- Create: `apps/web/src/app/login/LoginForm.tsx`
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Crear `LoginForm.tsx` con el formulario actual**

Crear `apps/web/src/app/login/LoginForm.tsx` con el contenido del client component actual (mismo código, ahora exportado como `LoginForm`):

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

export default function LoginForm() {
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
                    src="/Logo BN Sin Fondo.png"
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

- [ ] **Step 2: Reescribir `page.tsx` como server component con el chequeo de sesión**

Reemplazar el contenido completo de `apps/web/src/app/login/page.tsx` por:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
    const token = cookies().get("token")?.value;

    if (token && (await verifyToken(token))) {
        redirect("/dashboard");
    }

    return <LoginForm />;
}
```

- [ ] **Step 3: Verificar que compila sin errores de tipo**

Run: `npm run build --workspace=apps/web` (o el script de build del proyecto)
Expected: build exitoso, sin errores de TypeScript en `login/page.tsx` ni `login/LoginForm.tsx`.

ADVERTENCIA: No ejecutar `npm run build` con un `npm run dev` activo (corrompe `.next`). Si el dev server está corriendo, validar el tipado con el editor/`tsc --noEmit` o detener el dev server primero.

- [ ] **Step 4: Verificación manual en el navegador (con dev server corriendo)**

Con `npm run dev` activo:
1. Sin sesión, navegar a `/login`.
   - Esperado: se ve el formulario de login igual que antes.
2. Iniciar sesión con `admin@viper.cl` / `password123`.
   - Esperado: llega a `/dashboard` (luego `/dashboard/admin`).
3. Con la sesión activa, navegar manualmente a `/login`.
   - Esperado: redirige automáticamente a `/dashboard`, no muestra el formulario.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/login/page.tsx apps/web/src/app/login/LoginForm.tsx
git commit -m "feat: redirigir a /dashboard desde /login cuando hay sesión activa"
```

---

### Task 3: Verificación integral del flujo

Validar end-to-end los escenarios del spec, incluyendo cierre/reapertura de pestaña y segunda pestaña.

**Files:** (ninguno — solo verificación manual)

- [ ] **Step 1: Escenario "cerrar y reabrir pestaña"**

Con `npm run dev` activo:
1. Iniciar sesión con `admin@viper.cl` / `password123` → llega a `/dashboard/admin`.
2. Cerrar la pestaña del navegador.
3. Abrir una pestaña nueva y entrar a la raíz `/`.
   - Esperado: redirige directo a `/dashboard/admin` (la cookie de 7 días persiste).

- [ ] **Step 2: Escenario "segunda pestaña"**

1. En la pestaña 1, con sesión activa.
2. Abrir una pestaña 2 y entrar a `/`.
   - Esperado: la pestaña 2 redirige a `/dashboard/admin` sin pedir login.

- [ ] **Step 3: Escenario "sin sesión"**

1. Hacer logout.
2. Entrar a `/` → esperado: landing (sin redirección a dashboard).
3. Entrar a `/login` → esperado: formulario (sin redirección a dashboard).

- [ ] **Step 4: Escenario "rol agente"**

1. Iniciar sesión con un usuario de rol AGENT.
2. Entrar a `/`.
   - Esperado: redirige a `/dashboard` y de ahí a `/dashboard/agent` (el ruteo por rol lo resuelve `/dashboard`, sin cambios).

- [ ] **Step 5: Confirmación final**

Confirmar que los 7 puntos de verificación del spec (`docs/superpowers/specs/2026-06-12-sesion-en-puntos-de-entrada-design.md`, sección "Verificación") pasan. No se requiere commit (no hubo cambios de código en esta tarea).
