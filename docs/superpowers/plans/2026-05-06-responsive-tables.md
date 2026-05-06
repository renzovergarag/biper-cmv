# Tablas Responsive (Rows → Cards) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir las tablas de eventos y usuarios en cards verticales (label:valor) en dispositivos mobile/tablet (<1024px), manteniendo la tabla HTML en desktop.

**Architecture:** Renderizado dual con `hidden lg:block`/`lg:hidden` en cada componente de tabla. No se crean componentes genéricos — cada tabla maneja su propio markup de cards porque tienen renderizados específicos (badges, avatares, botones).

**Tech Stack:** React 18, Next.js 14, Tailwind CSS, shadcn/ui (Badge, Avatar, Button, Table)

---

### Task 1: EventList — Cards responsive en mobile

**Files:**
- Modify: `apps/web/src/components/EventList.tsx`

- [ ] **Step 1: Reemplazar EventList.tsx con renderizado dual**

Editar `apps/web/src/components/EventList.tsx` — reemplazar todo el contenido con:

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
    onEventClick?: (eventoId: string) => void;
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

export default function EventList({ eventos, onEventClick }: EventListProps) {
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
        <>
            {/* --- Desktop: tabla (≥1024px) --- */}
            <div className="hidden lg:block rounded-lg border bg-card text-card-foreground shadow-sm">
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
                            <TableRow
                                key={evento.id}
                                className={
                                    onEventClick
                                        ? "cursor-pointer hover:bg-muted/50"
                                        : ""
                                }
                                onClick={() => onEventClick?.(evento.id)}
                            >
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

            {/* --- Mobile/Tablet: cards (<1024px) --- */}
            <div className="lg:hidden space-y-3">
                {eventos.map((evento) => (
                    <div
                        key={evento.id}
                        className={
                            "rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-2" +
                            (onEventClick
                                ? " cursor-pointer hover:bg-muted/50"
                                : "")
                        }
                        onClick={() => onEventClick?.(evento.id)}
                    >
                        <div className="flex justify-between items-start">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Título
                            </span>
                            <span className="text-sm font-medium text-right">
                                {evento.titulo}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Origen
                            </span>
                            <span className="text-sm">{evento.origen}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Urgencia
                            </span>
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
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Estado
                            </span>
                            <span className="text-sm">
                                {estadoLabel[evento.estado]}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Asignado
                            </span>
                            <span className="text-sm">
                                {evento.asignado?.nombre || "—"}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                                Fecha
                            </span>
                            <span className="text-sm">
                                {formatDate(evento.createdAt)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build --workspace=apps/web 2>&1 | tail -10
```

Expected: Build exitoso sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/EventList.tsx
git commit -m "feat: EventList con cards responsive en mobile (<lg)"
```

---

### Task 2: UsersPageClient — Cards responsive en pestaña Usuarios

**Files:**
- Modify: `apps/web/src/components/UsersPageClient.tsx`

- [ ] **Step 1: Reemplazar la sección de tabla de usuarios con renderizado dual**

Editar `apps/web/src/components/UsersPageClient.tsx` — reemplazar el bloque de la pestaña "usuarios" (líneas 141-229, desde `{activeTab === "usuarios" ?` hasta el cierre del `)` antes de `: (`).

El bloque actual a reemplazar es:
```tsx
            {activeTab === "usuarios" ? (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">
                                    Acciones
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usuarios.map((usuario) => (
                                <TableRow key={usuario.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                    {getInitials(usuario.nombre)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium text-foreground">
                                                {usuario.nombre}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {usuario.email}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                usuario.rol === "ADMIN"
                                                    ? "default"
                                                    : "secondary"
                                            }
                                        >
                                            {usuario.rol}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                usuario.activo
                                                    ? "outline"
                                                    : "destructive"
                                            }
                                        >
                                            {usuario.activo
                                                ? "Activo"
                                                : "Inactivo"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="link"
                                            size="sm"
                                            onClick={() =>
                                                handleEdit(usuario)
                                            }
                                            className="mr-2"
                                        >
                                            Editar
                                        </Button>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            onClick={() =>
                                                handleToggleActivo(usuario)
                                            }
                                            className={
                                                usuario.activo
                                                    ? "text-destructive"
                                                    : "text-green-600"
                                            }
                                        >
                                            {usuario.activo
                                                ? "Desactivar"
                                                : "Reactivar"}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
```

Reemplazar con:

```tsx
            {activeTab === "usuarios" ? (
                <>
                    {/* --- Desktop: tabla (≥1024px) --- */}
                    <div className="hidden lg:block rounded-lg border bg-card text-card-foreground shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">
                                        Acciones
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usuarios.map((usuario) => (
                                    <TableRow key={usuario.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                        {getInitials(usuario.nombre)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium text-foreground">
                                                    {usuario.nombre}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {usuario.email}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    usuario.rol === "ADMIN"
                                                        ? "default"
                                                        : "secondary"
                                                }
                                            >
                                                {usuario.rol}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    usuario.activo
                                                        ? "outline"
                                                        : "destructive"
                                                }
                                            >
                                                {usuario.activo
                                                    ? "Activo"
                                                    : "Inactivo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="link"
                                                size="sm"
                                                onClick={() =>
                                                    handleEdit(usuario)
                                                }
                                                className="mr-2"
                                            >
                                                Editar
                                            </Button>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                onClick={() =>
                                                    handleToggleActivo(usuario)
                                                }
                                                className={
                                                    usuario.activo
                                                        ? "text-destructive"
                                                        : "text-green-600"
                                                }
                                            >
                                                {usuario.activo
                                                    ? "Desactivar"
                                                    : "Reactivar"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* --- Mobile/Tablet: cards (<1024px) --- */}
                    <div className="lg:hidden space-y-3">
                        {usuarios.map((usuario) => (
                            <div
                                key={usuario.id}
                                className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3"
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                                            {getInitials(usuario.nombre)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            {usuario.nombre}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {usuario.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">
                                        Rol
                                    </span>
                                    <Badge
                                        variant={
                                            usuario.rol === "ADMIN"
                                                ? "default"
                                                : "secondary"
                                        }
                                    >
                                        {usuario.rol}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">
                                        Estado
                                    </span>
                                    <Badge
                                        variant={
                                            usuario.activo
                                                ? "outline"
                                                : "destructive"
                                        }
                                    >
                                        {usuario.activo
                                            ? "Activo"
                                            : "Inactivo"}
                                    </Badge>
                                </div>
                                <div className="flex justify-end gap-2 pt-1 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(usuario)}
                                    >
                                        Editar
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            handleToggleActivo(usuario)
                                        }
                                        className={
                                            usuario.activo
                                                ? "text-destructive border-destructive hover:bg-destructive/10"
                                                : "text-green-600 border-green-600 hover:bg-green-50"
                                        }
                                    >
                                        {usuario.activo
                                            ? "Desactivar"
                                            : "Reactivar"}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
```

- [ ] **Step 2: Verificar build**

```bash
npm run build --workspace=apps/web 2>&1 | tail -10
```

Expected: Build exitoso sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/UsersPageClient.tsx
git commit -m "feat: UsersPageClient con cards responsive en mobile (<lg)"
```
