# Responsive Connected Agents Panel — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer el panel de agentes conectados responsive: en desktop (≥1024px) se mantiene inline a la derecha; en mobile/tablet se colapsa en un FAB flotante que abre un Bottom Sheet.

**Architecture:** `ConnectedAgentsPanel` renderiza ambos modos simultáneamente (inline + FAB/Sheet) usando Tailwind `lg:` para visibilidad condicional. El estado de socket y agentes se mantiene en un solo lugar. `DashboardContent` recibe un ajuste mínimo de layout.

**Tech Stack:** React 18, Next.js 14, Tailwind CSS, shadcn/ui (Sheet), Socket.io client, lucide-react (icons)

---

### Task 1: Instalar componente Sheet de shadcn/ui

**Files:**
- Create: `apps/web/src/components/ui/sheet.tsx` (generado por shadcn)

- [ ] **Step 1: Instalar Sheet vía shadcn CLI**

```bash
npx shadcn add sheet
```

Expected: Se crea `apps/web/src/components/ui/sheet.tsx` y se instala `@radix-ui/react-dialog` como dependencia.

- [ ] **Step 2: Verificar que el archivo se creó correctamente**

```bash
ls -la apps/web/src/components/ui/sheet.tsx
```

Expected: Archivo existe con >0 bytes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/sheet.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat: instalar shadcn Sheet para bottom sheet responsive"
```

---

### Task 2: Refactorizar ConnectedAgentsPanel para responsive

**Files:**
- Modify: `apps/web/src/components/ConnectedAgentsPanel.tsx` (completo)

- [ ] **Step 1: Reemplazar ConnectedAgentsPanel con la versión responsive**

Eliminar el contenido actual de `apps/web/src/components/ConnectedAgentsPanel.tsx` y reemplazar con:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { io, Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { AgenteConectado } from "@/types";

function AgentList({ agentes }: { agentes: AgenteConectado[] }) {
    if (agentes.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-4">
                Sin agentes conectados
            </p>
        );
    }

    return (
        <ul className="space-y-2">
            {agentes.map((agente) => (
                <li
                    key={agente.userId}
                    className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent transition-colors"
                >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {agente.nombre
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                            {agente.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {agente.email}
                        </p>
                    </div>
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                </li>
            ))}
        </ul>
    );
}

export default function ConnectedAgentsPanel() {
    const { user, token, isLoading } = useAuth();
    const [agentes, setAgentes] = useState<AgenteConectado[]>([]);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const connectSocket = useCallback(() => {
        if (!token) return undefined;

        const socketUrl =
            process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        const s = io(socketUrl, { auth: { token } });

        s.on("connect", () => {
            s.on("agentes:lista", (data: AgenteConectado[]) => {
                setAgentes(data);
            });

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
        });

        return s;
    }, [token]);

    useEffect(() => {
        if (isLoading) return;
        const s = connectSocket();
        return () => {
            s?.disconnect();
        };
    }, [isLoading, connectSocket]);

    if (isLoading) return null;
    if (user?.rol !== "ADMIN") return null;

    return (
        <>
            {/* --- Desktop: panel inline (≥1024px) --- */}
            <aside className="w-72 flex-shrink-0 hidden lg:block">
                <Card className="sticky top-6">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            Agentes Conectados
                            <span className="ml-auto text-xs font-normal text-muted-foreground">
                                {agentes.length}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AgentList agentes={agentes} />
                    </CardContent>
                </Card>
            </aside>

            {/* --- Mobile/Tablet: FAB flotante + Bottom Sheet (<1024px) --- */}
            <div className="lg:hidden">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button
                            size="icon"
                            className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
                            aria-label="Ver agentes conectados"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lucide lucide-users"
                            >
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 shadow-sm">
                                {agentes.length}
                            </span>
                            {agentes.length > 0 && (
                                <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="bottom"
                        className="max-h-[70vh] rounded-t-2xl px-4 pb-8"
                    >
                        {/* Drag handle visual */}
                        <div className="flex justify-center pt-2 pb-4">
                            <div className="w-10 h-1 rounded-full bg-border" />
                        </div>
                        <SheetHeader className="text-left mb-4">
                            <SheetTitle className="text-base flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                                Agentes Conectados
                                <span className="ml-auto text-sm font-normal text-muted-foreground">
                                    {agentes.length}
                                </span>
                            </SheetTitle>
                        </SheetHeader>
                        <AgentList agentes={agentes} />
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npm run build --workspace=apps/web 2>&1 | tail -20
```

Expected: Build exitoso sin errores de TypeScript ni ESLint.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ConnectedAgentsPanel.tsx
git commit -m "feat: refactorizar ConnectedAgentsPanel con soporte responsive (FAB + Bottom Sheet en mobile)"
```

---

### Task 3: Ajustar DashboardContent para layout responsive

**Files:**
- Modify: `apps/web/src/components/DashboardContent.tsx` (completo)

- [ ] **Step 1: Actualizar DashboardContent**

Reemplazar el contenido de `apps/web/src/components/DashboardContent.tsx` con:

```tsx
"use client";

import ConnectedAgentsPanel from "@/components/ConnectedAgentsPanel";

export default function DashboardContent({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex gap-6">
            <main className="flex-1 min-w-0">{children}</main>
            <ConnectedAgentsPanel />
        </div>
    );
}
```

El archivo no cambia en estructura — `ConnectedAgentsPanel` ahora maneja internamente la visibilidad condicional con `hidden lg:block` y `lg:hidden`.

- [ ] **Step 2: Verificar build**

```bash
npm run build --workspace=apps/web 2>&1 | tail -20
```

Expected: Build exitoso.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/DashboardContent.tsx
git commit -m "feat: DashboardContent mantiene layout flex, delegando responsive a ConnectedAgentsPanel"
```
