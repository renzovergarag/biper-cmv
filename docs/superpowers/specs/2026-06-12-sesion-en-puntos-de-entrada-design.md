# Spec: Reconocer la sesión activa en los puntos de entrada

- **Fecha:** 2026-06-12
- **Estado:** Aprobado
- **Tipo:** Mejora / corrección de UX de autenticación

## Problema

Cuando un usuario con sesión activa entra a la app, no llega a su dashboard:

- Al entrar a la raíz (`/`) ve la landing y termina en `/login` en vez de en `/dashboard`, aunque su sesión siga válida.
- Al abrir la app en una segunda pestaña (o tras cerrar y reabrir una), ve la landing/login en lugar de la sesión ya iniciada.

La causa no es pérdida de sesión. La cookie `token` se emite con `maxAge` de 7 días, `httpOnly`, `sameSite: lax`, `path: /`, por lo que **persiste al cerrar pestañas y se comparte entre pestañas**. El problema es que **solo `/dashboard` verifica la cookie**; los puntos de entrada (`/` y `/login`) la ignoran y siempre muestran la página pública.

## Objetivo

Que los puntos de entrada reconozcan una sesión activa en el servidor y redirijan a `/dashboard`, reutilizando el patrón que `/dashboard/page.tsx` ya emplea (`cookies()` → `verifyToken`). Un usuario sin sesión sigue viendo la landing en `/` y el formulario en `/login`.

## Alcance

### Incluye

- `/` (`apps/web/src/app/page.tsx`): chequeo de sesión en servidor con redirect a `/dashboard` cuando hay token válido.
- `/login` (`apps/web/src/app/login/page.tsx`): mismo chequeo; el formulario existente se extrae a un client component.

### No incluye (sin cambios)

- La cookie `token`, su emisión (`/api/auth/login`) y su expiración (JWT `exp`).
- El middleware (`apps/web/src/middleware.ts`).
- `AuthProvider` y `/api/auth/me`.
- La apariencia de la landing y del formulario de login.
- El servicio `socket-server`.

## Diseño

### Enfoque

Chequeo de sesión **en el servidor** dentro de cada punto de entrada (no middleware, no cliente). Es consistente con `/dashboard/page.tsx`, ocurre antes de enviar el HTML (sin parpadeo) y no requiere JavaScript de cliente.

### Componentes y cambios

1. **`/` — `apps/web/src/app/page.tsx`**

   Pasa a ser server component (RSC). Lógica:

   - Leer la cookie con `cookies().get("token")?.value` (de `next/headers`).
   - Si hay token, verificarlo con `verifyToken` (de `@/lib/auth`).
   - Token válido → `redirect("/dashboard")`.
   - Sin token o `verifyToken` devuelve `null` → renderizar la landing actual (logo + botón "Iniciar sesión"), sin cambios visuales.

2. **`/login` — `apps/web/src/app/login/page.tsx`**

   Hoy es client component (`"use client"`). Se separa en dos:

   - **`page.tsx` (server component):** hace el mismo chequeo de sesión. Token válido → `redirect("/dashboard")`. Si no, renderiza el formulario de login.
   - **`LoginForm.tsx` (client component):** contiene el formulario actual y toda su lógica de cliente, movido sin cambios funcionales. `page.tsx` lo importa y lo renderiza.

### Flujo de datos

```
Usuario entra a / o /login
        │
        ▼
  cookies().get("token")
        │
   ┌────┴─────┐
 válido     ausente/inválido
   │            │
   ▼            ▼
/dashboard   landing (/) o formulario (/login)
   │
   ▼
/dashboard ya enruta por rol (admin/agent)
```

`/dashboard` ya redirige a `/login` cuando no hay sesión, de modo que el ciclo queda cerrado en ambos sentidos.

### Manejo de errores y casos borde

- **Token expirado o corrupto:** `verifyToken` devuelve `null` → se trata como "sin sesión" → landing/login normal. No hay loops de redirección, porque la rama "sin sesión" nunca redirige.
- **Sin parpadeo:** el chequeo es en servidor; el redirect ocurre antes de enviar HTML.
- **Segunda pestaña:** la cookie se comparte entre pestañas; al entrar a `/` la nueva pestaña detecta la sesión y va al dashboard. Resuelto por el mismo cambio.
- **Logout:** la cookie se limpia (`maxAge: 0`); volver a `/` cae en la rama "sin sesión" → landing.

## Verificación (manual)

No hay framework de tests en el proyecto; la verificación es manual.

1. Con sesión activa, entrar a `/` → redirige a `/dashboard` (admin o agente según rol).
2. Con sesión activa, entrar a `/login` → redirige a `/dashboard`.
3. Sin sesión, entrar a `/` → se ve la landing; entrar a `/login` → se ve el formulario.
4. Login con credenciales válidas → llega a `/dashboard`.
5. Cerrar la pestaña y reabrir `/` → va directo a `/dashboard`.
6. Abrir una segunda pestaña en `/` con sesión iniciada en la primera → dashboard.
7. Logout → queda en `/login`; volver a `/` → landing (sin sesión), sin redirect a dashboard.

## Notas de despliegue

Cambio solo de código en `apps/web`. No requiere variables de entorno nuevas, ni `db:push`, ni migración de datos, ni pasos manuales en el servidor de producción.
