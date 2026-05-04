# Eventos en tiempo real y timeline de detalle — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar refresco en tiempo real vía Socket.io al dashboard de admin y un modal de detalle con timeline de estados al hacer clic en eventos de la tabla.

**Architecture:** Extender `AdminDashboardClient` para escuchar `evento:nuevo` y `evento:actualizado` del socket (sin modificar el socket server). Nuevo `EventDetailModal` con `EventTimeline` que consume `GET /api/events/[id]` (con un campo extra en el include de Prisma). `EventList` recibe prop `onEventClick`.

**Tech Stack:** Next.js 14 (app router), Socket.io client, shadcn/ui (Dialog, Badge), Prisma MongoDB, Tailwind CSS

---

### Task 1: Agregar tipo `EventoWithHistorial` y ajustar API

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/app/api/events/[id]/route.ts`

- [ ] **Step 1: Agregar tipo `EventoWithHistorial` en `types/index.ts`**

Agregar después de la línea 5:

```typescript
export type EventoWithHistorial = Prisma.EventoGetPayload<{
    include: {
        creador: true;
        asignado: true;
        estadosHistorial: {
            include: { usuario: true };
        };
    };
}>;
```

- [ ] **Step 2: Modificar `GET /api/events/[id]` para incluir `usuario` y ordenar `estadosHistorial`**

En `apps/web/src/app/api/events/[id]/route.ts`, cambiar el bloque `include` (líneas 24-28):

```typescript
const evento = await prisma.evento.findUnique({
    where: { id },
    include: {
        creador: true,
        asignado: true,
        estadosHistorial: {
            include: { usuario: true },
            orderBy: { timestamp: "desc" },
        },
    },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/index.ts apps/web/src/app/api/events/\[id\]/route.ts
git commit -m "feat: add EventoWithHistorial type and enrich API with usuario in historial"
```

---

### Task 2: `EventList` — agregar soporte para filas clickeables

**Files:**
- Modify: `apps/web/src/components/EventList.tsx`

- [ ] **Step 1: Agregar prop `onEventClick` y filas clickeables**

```typescript
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
                        <TableRow
                            key={evento.id}
                            className={onEventClick ? "cursor-pointer hover:bg-muted/50" : ""}
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
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/EventList.tsx
git commit -m "feat: add clickable rows and onEventClick prop to EventList"
```

---

### Task 3: Componente `EventTimeline`

**Files:**
- Create: `apps/web/src/components/EventTimeline.tsx`

- [ ] **Step 1: Crear `EventTimeline.tsx`**

```typescript
"use client";

import { EstadoEvento } from "@prisma/client";
import { estadoLabel } from "@/lib/theme";

interface EstadoHistorialEntry {
    id: string;
    estado: EstadoEvento;
    timestamp: string | Date;
    notas: string | null;
    usuario: {
        id: string;
        nombre: string;
        email: string;
        rol: string;
    };
}

interface EventTimelineProps {
    historial: EstadoHistorialEntry[];
}

const estadoDotColor: Record<EstadoEvento, string> = {
    [EstadoEvento.PENDIENTE]: "bg-gray-400",
    [EstadoEvento.ASIGNADO]: "bg-gray-500",
    [EstadoEvento.EN_RUTA]: "bg-amber-500",
    [EstadoEvento.RESUELTO]: "bg-blue-500",
    [EstadoEvento.CANCELADO]: "bg-red-500",
};

const estadoCardBg: Record<EstadoEvento, string> = {
    [EstadoEvento.PENDIENTE]: "bg-gray-50 border-gray-200",
    [EstadoEvento.ASIGNADO]: "bg-gray-100 border-gray-300",
    [EstadoEvento.EN_RUTA]: "bg-amber-50 border-amber-200",
    [EstadoEvento.RESUELTO]: "bg-blue-50 border-blue-200",
    [EstadoEvento.CANCELADO]: "bg-red-50 border-red-200",
};

function formatDateTime(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function EventTimeline({ historial }: EventTimelineProps) {
    if (historial.length === 0) {
        return (
            <p className="text-muted-foreground text-sm text-center py-6">
                Sin historial de estados.
            </p>
        );
    }

    return (
        <div className="border-l-[3px] border-primary pl-4">
            {historial.map((entry) => (
                <div
                    key={entry.id}
                    className={`relative border rounded-lg p-3 mb-3 ${
                        estadoCardBg[entry.estado]
                    }`}
                >
                    <div
                        className={`absolute w-3 h-3 rounded-full border-2 border-background -left-[22px] top-4 ${
                            estadoDotColor[entry.estado]
                        }`}
                    />
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">
                            {estadoLabel[entry.estado]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {formatDateTime(entry.timestamp)}
                        </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Por: {entry.usuario.nombre} ({entry.usuario.rol.toLowerCase()})
                    </div>
                    {entry.notas ? (
                        <div className="mt-2 text-xs text-foreground bg-background/60 rounded px-2 py-1.5">
                            {entry.notas}
                        </div>
                    ) : (
                        <div className="mt-1 text-xs text-muted-foreground/50">
                            —
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/EventTimeline.tsx
git commit -m "feat: add EventTimeline component with vertical card layout"
```

---

### Task 4: Componente `EventDetailModal`

**Files:**
- Create: `apps/web/src/components/EventDetailModal.tsx`

- [ ] **Step 1: Crear `EventDetailModal.tsx`**

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { EstadoEvento } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    urgenciaBadgeVariant,
    urgenciaLabel,
    estadoBadgeVariant,
    estadoLabel,
} from "@/lib/theme";
import EventTimeline from "./EventTimeline";

interface EventDetailModalProps {
    eventoId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    refreshVersion: number;
}

export default function EventDetailModal({
    eventoId,
    open,
    onOpenChange,
    refreshVersion,
}: EventDetailModalProps) {
    const [evento, setEvento] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open || !eventoId) return;

        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        fetch(`/api/events/${eventoId}`, { signal: controller.signal })
            .then((res) => {
                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error("Evento no encontrado");
                    }
                    throw new Error("Error al cargar el evento");
                }
                return res.json();
            })
            .then((data) => {
                setEvento(data.evento);
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                setError(err.message || "Error al cargar el evento");
            })
            .finally(() => {
                setLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [eventoId, open, refreshVersion]);

    function handleOpenChange(newOpen: boolean) {
        if (!newOpen) {
            setEvento(null);
            setError(null);
        }
        onOpenChange(newOpen);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="sr-only">
                        Detalle de evento
                    </DialogTitle>
                </DialogHeader>

                {loading && (
                    <p className="text-muted-foreground text-sm text-center py-8">
                        Cargando...
                    </p>
                )}

                {error && (
                    <p className="text-destructive text-sm text-center py-8">
                        {error}
                    </p>
                )}

                {evento && (
                    <>
                        {/* Encabezado */}
                        <div className="mb-5 pb-4 border-b">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-foreground">
                                    {evento.titulo}
                                </h3>
                                <div className="flex gap-2">
                                    <Badge
                                        variant={
                                            estadoBadgeVariant[
                                                evento.estado as EstadoEvento
                                            ]
                                        }
                                    >
                                        {estadoLabel[evento.estado]}
                                    </Badge>
                                    <Badge
                                        variant={
                                            urgenciaBadgeVariant[
                                                evento.nivelUrgencia
                                            ]
                                        }
                                    >
                                        {urgenciaLabel[evento.nivelUrgencia] ||
                                            evento.nivelUrgencia}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex gap-5 text-sm text-muted-foreground">
                                <span>
                                    {evento.direccionExacta}
                                </span>
                                {evento.telefonoContacto && (
                                    <span>{evento.telefonoContacto}</span>
                                )}
                            </div>
                        </div>

                        {/* Timeline */}
                        <EventTimeline
                            historial={evento.estadosHistorial || []}
                        />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/EventDetailModal.tsx
git commit -m "feat: add EventDetailModal with header and timeline"
```

---

### Task 5: `AdminDashboardClient` — integrar socket listeners y modal

**Files:**
- Modify: `apps/web/src/components/AdminDashboardClient.tsx`

- [ ] **Step 1: Reescribir `AdminDashboardClient.tsx`**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { Badge } from "@/components/ui/badge";
import CreateEventModal from "./CreateEventModal";
import EventList from "./EventList";
import EventDetailModal from "./EventDetailModal";

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
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const { socket, connected } = useSocket(socketUrl);

    function handleEventCreated(evento: EventoWithRelations) {
        setEventos((prev) => [evento, ...prev]);
    }

    function handleEventClick(eventoId: string) {
        setSelectedEventId(eventoId);
        setModalOpen(true);
    }

    function handleModalOpenChange(open: boolean) {
        setModalOpen(open);
        if (!open) {
            setSelectedEventId(null);
        }
    }

    useEffect(() => {
        if (!socket) return;

        const handleNuevo = ({ evento }: { evento: EventoWithRelations }) => {
            setEventos((prev) => [evento, ...prev]);
        };

        const handleActualizado = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setEventos((prev) =>
                prev.map((e) => (e.id === evento.id ? evento : e))
            );

            if (selectedEventId === evento.id) {
                setRefreshVersion((v) => v + 1);
            }
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
        };
    }, [socket, selectedEventId]);

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

            <EventList eventos={eventos} onEventClick={handleEventClick} />

            <EventDetailModal
                eventoId={selectedEventId}
                open={modalOpen}
                onOpenChange={handleModalOpenChange}
                refreshVersion={refreshVersion}
            />
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/AdminDashboardClient.tsx
git commit -m "feat: add real-time socket listeners and event detail modal to admin dashboard"
```

---

### Task 6: Verificación funcional

- [ ] **Step 1: Iniciar servicios y verificar que todo compila**

```bash
# En una terminal, iniciar Docker y los servicios
npm run dev
```

En el navegador, verificar que `http://localhost:3000/dashboard/admin` carga sin errores de compilación ni runtime.

- [ ] **Step 2: Probar refresco en tiempo real**

1. Abrir `http://localhost:3000/dashboard/admin` en Pestaña 1.
2. Abrir `http://localhost:3000/dashboard/agent` en Pestaña 2 (o ventana incógnito con otro usuario agente).
3. Como admin (P1), crear un evento.
4. Verificar que aparece en la tabla del admin y en "Disponibles" del agente.
5. Como agente (P2), hacer clic en "Tomar caso".
6. Verificar que en admin (P1) la fila cambia de "Pendiente" a "Asignado" y muestra el nombre del agente.
7. Como agente, hacer clic en "Marcar En Ruta" → "Resolver".
8. Verificar que cada cambio se refleja en admin sin recargar.

- [ ] **Step 3: Probar modal de detalle con timeline**

1. En admin, hacer clic en cualquier fila de la tabla.
2. Verificar que se abre el modal con: título, badges de estado y urgencia, dirección, teléfono.
3. Verificar que el timeline muestra las entradas de `EstadoHistorial` con punto de color, fecha, responsable y notas.
4. Cerrar el modal y verificar que vuelve a la tabla.

- [ ] **Step 4: Probar actualización en vivo del modal**

1. Abrir el modal de un evento en admin (P1).
2. Como agente (P2), cambiar el estado de ese mismo evento.
3. Verificar que el modal se actualiza automáticamente: nueva tarjeta en el timeline, badge de estado cambia.

- [ ] **Step 5: Probar casos borde**

1. Abrir modal de un evento que no tenga `EstadoHistorial`.
   - Verificar mensaje "Sin historial de estados".
2. Cerrar modal justo después de abrirlo (antes de que termine el fetch).
   - Verificar que no hay error en consola.
3. Abrir modal con el socket desconectado (parar el socket server).
   - Verificar que el modal igual carga los datos (usa REST, no socket).

- [ ] **Step 6: Commit final (si hay ajustes)**

```bash
git status
git add <archivos-modificados>
git commit -m "chore: final adjustments from testing"
```
