# viper-cmv

Sistema para gestionar eventos reportados desde distintas fuentes y avisar a los agentes comunitarios, de modo que puedan desplegarse al lugar con rapidez y quede constancia de cada etapa de la atención.

El funcionamiento es directo: cuando llega un aviso —una llamada telefónica, un reporte por redes sociales u otra vía—, quien coordina lo registra en el sistema y asigna a los agentes que corresponda. Ellos reciben una notificación en el teléfono con la dirección del lugar. A partir de ahí el sistema acompaña el evento hasta su cierre, registrando los tiempos y los responsables de cada etapa.

## Para qué sirve

Cuando la coordinación se apoya únicamente en llamadas o grupos de mensajería, resulta difícil mantener el registro de quién acudió a cada lugar, cuánto demoró en llegar y en qué momento se dio por cerrada la atención. El sistema atiende tres necesidades:

- **Avisar con rapidez.** El agente recibe una notificación en su teléfono apenas se le asigna un evento, sin necesidad de estar pendiente de la pantalla.
- **Conocer la disponibilidad.** Quien coordina ve en tiempo real qué agentes están conectados antes de asignar.
- **Dejar constancia.** Cada cambio de estado queda asociado a su hora y a la persona responsable, lo que permite reconstruir después la secuencia de la atención.

## El recorrido de un evento

1. **Registro.** Quien coordina ingresa el título, la procedencia del aviso, el nivel de urgencia, la dirección y un teléfono de contacto. La dirección cuenta con autocompletado, de modo que también quedan almacenadas las coordenadas.
2. **Asignación.** Se designa a uno o más agentes según lo requiera la situación. En ese momento reciben la notificación en el teléfono.
3. **Respuesta en terreno.** El agente confirma que va en camino y luego que llegó al lugar. Desde la misma ficha puede abrir la dirección en Google Maps o Apple Maps para dirigirse hasta allí.
4. **Cierre.** El agente marca el evento como resuelto y este pasa al historial.

Los estados por los que atraviesa un evento son **pendiente**, **asignado**, **en ruta**, **en el lugar**, **resuelto** y **cancelado**. Cada agente asignado mantiene además su propio estado dentro del evento, ya que en una misma atención puede haber uno que ya llegó y otro que aún se desplaza.

El nivel de urgencia se clasifica en cuatro categorías: baja, media, alta y crítica.

## Alcance del registro

Conviene precisar qué registra el sistema y qué no.

Lo que el agente marca son **hitos**: que tomó el caso, que va en camino, que llegó al lugar y que lo cerró. De cada uno queda la hora y la identidad de quien lo realizó, lo que permite medir tiempos de respuesta y saber quién atendió cada evento.

**El detalle de lo ocurrido entre la llegada y el cierre no se consigna en esta aplicación.** El sistema no es el lugar donde se documenta cómo se resolvió la situación en terreno, qué gestiones se hicieron ni con quién se habló. Su propósito es la coordinación y el seguimiento del despliegue, no el informe de la atención.

Junto con los hitos, el sistema conserva un registro de auditoría de las acciones realizadas sobre eventos y usuarios. Los eventos eliminados no se borran de la base de datos: quedan marcados como tales, junto con la persona que efectuó la eliminación.

## Quiénes lo utilizan

- **Agente.** Consulta los eventos que le fueron asignados, actualiza su estado y revisa su historial. Es quien acude a terreno.
- **Administrador.** Registra eventos, asigna agentes y realiza el seguimiento. Dispone de un panel con indicadores, un gráfico de eventos por día y la lista de agentes conectados en ese momento. También administra las cuentas de usuario.
- **Superadministrador.** Cuenta con las mismas atribuciones del administrador. La diferencia es que solo él puede otorgar a otra persona el rol de superadministrador.

## Notificaciones en el teléfono

Las notificaciones se apoyan en una aplicación web instalable (PWA): el agente ingresa desde el navegador del teléfono, la agrega a la pantalla de inicio y desde ese momento recibe los avisos como los de cualquier otra aplicación, aunque no la tenga abierta.

En iPhone es necesario instalarla mediante la opción "Agregar a inicio" y contar con iOS 16.4 o superior. Se trata de una restricción de Apple, no del sistema.

## Tecnologías

- **Next.js 14** para la aplicación web.
- **MongoDB** como base de datos, con Prisma.
- **Socket.io** para las actualizaciones en tiempo real: eventos nuevos, cambios de estado y agentes que se conectan o desconectan.
- **Tailwind CSS** y **shadcn/ui** para la interfaz.
- **Web Push** para las notificaciones al teléfono.

El repositorio es un monorepo con dos componentes: la aplicación web (`apps/web`) y el servidor de tiempo real (`services/socket-server`).

## Instalación para desarrollo

Requiere Node.js 20 o superior y Docker para la base de datos.

**1. Instalar las dependencias**

```bash
npm install
```

**2. Levantar MongoDB**

```bash
docker compose up -d
```

La base de datos queda disponible en el puerto `27018` del equipo, mapeado al `27017` del contenedor. Antes de iniciarla conviene considerar dos requisitos:

- Necesita un archivo `mongo-keyfile` en la raíz del proyecto. Por seguridad no se incluye en el repositorio, de modo que hay que generarlo; debe quedar con permisos restrictivos o MongoDB no iniciará.
- La base opera como replica set (`rs0`), condición que Prisma exige para trabajar con MongoDB. Es necesario inicializarlo una vez, después de levantar el contenedor.

**3. Configurar las variables de entorno**

Se requieren tres archivos `.env`, cada uno con su ejemplo correspondiente:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp services/socket-server/.env.example services/socket-server/.env
```

Conviene revisar los valores antes de continuar. Para habilitar las notificaciones hay que generar un par de llaves propio:

```bash
npx web-push generate-vapid-keys
```

El autocompletado de direcciones, por su parte, requiere una clave de Google Places.

**4. Preparar la base de datos**

```bash
npm run db:generate
npm run db:push
npm run db:seed -w apps/web
```

El último comando crea usuarios de prueba —un administrador y dos agentes— junto con algunos eventos de ejemplo. Las credenciales correspondientes están en `apps/web/prisma/seed.ts`.

**5. Iniciar la aplicación**

```bash
npm run dev
```

La aplicación queda disponible en `http://localhost:3000` y el servidor de tiempo real en el puerto `4000`.

## Estructura del repositorio

```
apps/web/                 Aplicación web (Next.js)
  src/app/                Páginas y rutas de API
  src/components/         Componentes de interfaz
  prisma/schema.prisma    Modelo de datos
services/socket-server/   Servidor de tiempo real (Socket.io)
nginx/                    Configuración del servidor web
docs/                     Especificaciones y planes de implementación
```

El modelo de datos reside en `apps/web/prisma/schema.prisma`; el servidor de tiempo real mantiene una copia del mismo esquema.

## Consideraciones

- El proyecto está escrito en español: los modelos, las rutas y los mensajes siguen esa convención.
- Por ahora no cuenta con pruebas automatizadas.
- El despliegue se realiza mediante GitHub Actions al integrar cambios en `main`; los procesos se ejecutan con PM2 detrás de Nginx.

Para trabajar sobre el código, `AGENTS.md` reúne las convenciones y los detalles técnicos.
