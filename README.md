# viper-cmv

Sistema para gestionar eventos reportados desde distintas fuentes y avisar a los agentes comunitarios, de modo que puedan desplegarse al lugar rápidamente y quede registro de todo lo que ocurrió.

La idea es simple: cuando entra un aviso —una llamada, un reporte por redes, lo que sea— alguien lo registra en el sistema, se le asignan agentes, y ellos reciben una notificación en el teléfono con la dirección. Desde ahí el sistema sigue el evento hasta que se cierra, guardando quién hizo qué y cuándo.

## Para qué sirve

Cuando la coordinación se hace por teléfono o por grupos de mensajería, es fácil perder el hilo de quién fue a qué lugar, cuánto demoró en llegar y cómo terminó la cosa. El sistema apunta a tres cosas:

- **Avisar rápido.** El agente recibe una notificación en su teléfono apenas se le asigna un evento, sin depender de que esté mirando la pantalla.
- **Saber quién está disponible.** Quien coordina ve en tiempo real qué agentes están conectados antes de asignar.
- **Dejar registro.** Cada cambio de estado queda guardado con su hora y su responsable, así que después se puede reconstruir qué pasó.

## Cómo funciona un evento

El recorrido típico es este:

1. **Se registra el evento.** Quien coordina anota el título, de dónde viene el aviso, qué tan urgente es, la dirección y un teléfono de contacto. La dirección tiene autocompletado, así que quedan guardadas también las coordenadas.
2. **Se asignan agentes.** Uno o varios, según haga falta. En ese momento les llega la notificación al teléfono.
3. **El agente responde.** Desde su panel marca que va en camino, luego que llegó al lugar, y finalmente que el evento quedó resuelto. También puede abrir la dirección directamente en Google Maps o Apple Maps para navegar hasta allá.
4. **El evento se cierra.** Queda en el historial con toda su trazabilidad.

Los estados por los que pasa un evento son: **pendiente**, **asignado**, **en ruta**, **en el lugar**, **resuelto** y **cancelado**. Cada agente asignado tiene además su propio estado dentro del evento, porque en un mismo evento puede haber uno que ya llegó y otro que todavía va en camino.

La urgencia se clasifica en cuatro niveles: baja, media, alta y crítica.

## Quiénes usan el sistema

Hay tres tipos de usuario:

- **Agente.** Ve los eventos que le fueron asignados, actualiza su estado y consulta su historial. Es quien va a terreno.
- **Administrador.** Registra eventos, asigna agentes y hace seguimiento. Tiene un panel con indicadores, un gráfico de eventos por día y la lista de agentes conectados en ese momento. También administra las cuentas de usuario.
- **Superadministrador.** Lo mismo que el administrador. La diferencia es que solo él puede otorgarle a alguien el rol de superadministrador.

## Notificaciones en el teléfono

Las notificaciones funcionan como aplicación web instalable (PWA): el agente entra desde el navegador del teléfono, la agrega a la pantalla de inicio y desde ahí recibe los avisos como cualquier otra app, aunque no la tenga abierta.

En iPhone es necesario instalarla desde "Agregar a inicio" y tener iOS 16.4 o superior; es una restricción de Apple, no del sistema.

## Trazabilidad

Todo queda registrado:

- **Historial de estados:** cada cambio guarda quién lo hizo, a qué hora y con qué nota.
- **Registro de auditoría:** las acciones sobre eventos y usuarios quedan anotadas.
- **Eliminación lógica:** cuando se borra un evento no desaparece de la base de datos, solo se marca como eliminado junto con la persona que lo hizo.

## Tecnologías

- **Next.js 14** para la aplicación web.
- **MongoDB** como base de datos, con Prisma.
- **Socket.io** para las actualizaciones en tiempo real (eventos nuevos, cambios de estado, agentes que se conectan y desconectan).
- **Tailwind CSS** y **shadcn/ui** para la interfaz.
- **Web Push** para las notificaciones al teléfono.

Es un monorepo con dos piezas: la aplicación web (`apps/web`) y el servidor de tiempo real (`services/socket-server`).

## Levantarlo en tu máquina

Necesitas Node.js 20 o superior y Docker (para la base de datos).

**1. Instalar dependencias**

```bash
npm install
```

**2. Levantar MongoDB**

```bash
docker compose up -d
```

La base queda en el puerto `27018` de tu máquina (dentro del contenedor usa el `27017`). Dos cosas antes de que arranque:

- Necesita un archivo `mongo-keyfile` en la raíz del proyecto. No está en el repositorio por seguridad, así que hay que generarlo; debe quedar con permisos restrictivos o Mongo se niega a partir.
- La base corre como replica set (`rs0`), porque Prisma lo exige para trabajar con MongoDB. Hay que inicializarlo una vez después de levantar el contenedor.

**3. Configurar las variables de entorno**

Hay que crear tres archivos `.env`, cada uno con su ejemplo al lado:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp services/socket-server/.env.example services/socket-server/.env
```

Revisa los valores antes de seguir. Para que funcionen las notificaciones necesitas generar tus propias llaves:

```bash
npx web-push generate-vapid-keys
```

Y para el autocompletado de direcciones, una clave de Google Places.

**4. Preparar la base de datos**

```bash
npm run db:generate
npm run db:push
npm run db:seed -w apps/web
```

El último comando crea usuarios de prueba (un administrador y dos agentes) junto con algunos eventos de ejemplo. Las credenciales están en `apps/web/prisma/seed.ts`.

**5. Arrancar**

```bash
npm run dev
```

La aplicación queda en `http://localhost:3000` y el servidor de tiempo real en el `4000`.

## Estructura

```
apps/web/                 Aplicación web (Next.js)
  src/app/                Páginas y rutas de API
  src/components/         Componentes de interfaz
  prisma/schema.prisma    Modelo de datos
services/socket-server/   Servidor de tiempo real (Socket.io)
nginx/                    Configuración del servidor web
docs/                     Especificaciones y planes de implementación
```

El modelo de datos vive en `apps/web/prisma/schema.prisma`; el servidor de tiempo real tiene una copia del mismo esquema.

## Notas

- El proyecto está escrito en español: los modelos, las rutas y los mensajes usan esa convención.
- No hay tests automatizados por ahora.
- El despliegue se hace solo con GitHub Actions al integrar cambios en `main`; los procesos corren con PM2 detrás de Nginx.

Para trabajar sobre el código, `AGENTS.md` tiene las convenciones y los detalles técnicos.
