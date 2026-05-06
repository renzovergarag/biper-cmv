# Tablas Responsive (Rows → Cards en Mobile) — Diseño

**Fecha:** 2026-05-06
**Estado:** Aprobado

## Problema

En dispositivos mobile/tablet (< 1024px), las tablas de eventos y usuarios tienen 5-6 columnas que no caben horizontalmente, forzando scroll o truncamiento. La experiencia es pobre.

## Solución

Implementar renderizado dual en cada componente de tabla:

| Breakpoint | Comportamiento |
|---|---|
| **≥ 1024px (lg)** | Tabla HTML normal (comportamiento actual) |
| **< 1024px** | Cards verticales con formato label:valor, una por fila |

### Tablas afectadas

| Componente | Columnas | Elementos especiales |
|---|---|---|
| **EventList** | Título, Origen, Urgencia (badge), Estado, Asignado, Fecha | Badge de urgencia, filas clickeables |
| **UsersPageClient** (tab Usuarios) | Usuario (avatar+nombre), Email, Rol (badge), Estado (badge), Acciones (botones) | Avatar, badges, botones Editar/Activar |

### Estructura de cards

Formato label:valor con separación clara entre campos:

```html
<!-- EventList card -->
<div class="rounded-lg border bg-card p-4 space-y-2">
    <div class="flex justify-between">
        <span class="text-xs text-muted-foreground">Título</span>
        <span class="text-sm font-medium text-right">Árbol caído en vía pública</span>
    </div>
    <div class="flex justify-between">
        <span class="text-xs text-muted-foreground">Origen</span>
        <span class="text-sm">teléfono</span>
    </div>
    <div class="flex justify-between items-center">
        <span class="text-xs text-muted-foreground">Urgencia</span>
        <Badge variant="...">Alta</Badge>
    </div>
    <!-- ... -->
</div>
```

Cada card representa una fila de la tabla. Las cards se apilan verticalmente con `space-y-3`.

### Implementación

En cada componente, se duplica el renderizado:

- **Desktop (≥lg):** `div className="hidden lg:block"` con la tabla actual
- **Mobile (<lg):** `div className="lg:hidden space-y-3"` con las cards

Ambos modos iteran sobre los mismos datos (`eventos` / `usuarios`). No se duplica lógica, solo markup.

### Archivos a modificar

| Archivo | Acción |
|---|---|
| `components/EventList.tsx` | Agregar renderizado de cards para mobile. Misma data, dual markup. |
| `components/UsersPageClient.tsx` | Agregar renderizado de cards en la pestaña Usuarios para mobile. |

### No se modifica

- `components/ui/table.tsx` — se sigue usando para desktop
- `AdminDashboardClient.tsx` — solo consume EventList, sin cambios
- `SessionLogsTab.tsx` — fuera del alcance
- Badge, Avatar, Button — se reutilizan en las cards

### Edge Cases

| Caso | Comportamiento |
|---|---|
| Tabla vacía (0 eventos) | Card única con mensaje "No hay eventos registrados" |
| Filas clickeables (EventList) | La card entera es clickeable, igual que la fila en desktop |
| Acciones (UsersPageClient) | Botones Editar/Activar se muestran al final de la card |
| Resize de ventana | CSS puro con `hidden lg:block` / `lg:hidden`, sin JS |
