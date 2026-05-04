# Spec: Procedimiento de Despliegue en VPS Ubuntu

**Fecha:** 2026-05-04
**Scope:** Definir el flujo completo de CI/CD y despliegue para el monorepo `biper-cmv` (Next.js + Socket.io + MongoDB) en un VPS Ubuntu sin Docker.

---

## 1. Contexto y Arquitectura

- **Monorepo:** npm workspaces (`apps/web`, `services/socket-server`).
- **Base de datos:** MongoDB con autenticación, ya instalado y corriendo en el VPS (sin Docker).
- **Servidor web:** Nginx (ya instalado).
- **Administración de procesos:** PM2.
- **Subdominio:** `viper.cmvalparaiso.cl` con HTTPS vía Let's Encrypt (Certbot).
- **CI/CD:** GitHub Actions con workflow en `.github/workflows/deploy.yml`.

### Servicios y Puertos

| Servicio | Puerto | Proceso PM2 |
|----------|--------|-------------|
| Next.js (Web) | 3000 | `viper-web` |
| Socket.io (Server) | 4000 | `viper-socket` |

---

## 2. Decisiones Clave

### 2.1. Build en el VPS (Opción A)

El runner de GitHub solo orquesta. El build completo (`npm install`, `prisma generate`, `npm run build`) se ejecuta **directamente en el VPS** después de un `git pull`.

**Rationale:**
- El proyecto usa `bcrypt` (binario nativo). Compilar en el VPS evita incompatibilidades de arquitectura entre runner y servidor.
- Prisma Client también es específico de la plataforma.
- Aprovecha la caché de `node_modules` existente en el VPS.

### 2.2. Generación de `.env` desde GitHub Secrets

El workflow de GitHub Actions genera automáticamente los tres archivos `.env` (raíz, `apps/web`, `services/socket-server`) en cada deploy a partir de los secrets del repositorio.

**Rationale:**
- Garantiza que el VPS siempre tenga las variables correctas y actualizadas.
- Facilita la rotación de secrets sin necesidad de conectarse manualmente al VPS.

### 2.3. Conexión GitHub → VPS vía SSH

Se utiliza la acción `appleboy/ssh-action@v1.2.0` (o tag estable equivalente) para que el runner ejecute comandos remotos en el VPS.

**Rationale:**
- Estándar de facto para deploys por SSH en GitHub Actions.
- No requiere exponer webhooks en el VPS.
- Se usa una versión taggeada para evitar cambios inesperados en `master`.

---

## 3. Configuración Inicial del VPS (One-Time Setup)

### 3.1. Pre-requisitos

- Ubuntu 20.04/22.04/24.04
- Node.js 20+ y npm instalados.
- Nginx instalado y corriendo.
- MongoDB instalado, corriendo y con autenticación habilitada.
- PM2 instalado globalmente (`npm install -g pm2`).
- Git instalado.

### 3.2. Clonar el repositorio

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/<usuario>/biper-cmv.git viper-cmv
sudo chown -R $USER:$USER /var/www/viper-cmv
cd viper-cmv
```

### 3.3. Configurar Nginx

1. Copiar el archivo de configuración del repo al directorio de Nginx:
   ```bash
   sudo cp /var/www/viper-cmv/nginx/viper-cmv.conf /etc/nginx/sites-available/viper-cmv
   sudo ln -sf /etc/nginx/sites-available/viper-cmv /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   ```

2. Validar y recargar:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### 3.4. SSL con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d viper.cmvalparaiso.cl
# Seleccionar redirect de HTTP a HTTPS cuando se solicite.
```

### 3.5. Configurar PM2

```bash
cd /var/www/viper-cmv
pm2 start ecosystem.config.js
pm2 startup
# Ejecutar el comando que sugiere PM2 (systemd).
pm2 save
```

### 3.6. Clave SSH para GitHub Actions

1. En una máquina local o en el VPS, generar una clave SSH (sin passphrase, o con passphrase manejada por ssh-agent):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
   ```

2. Agregar la clave pública al `authorized_keys` del usuario en el VPS:
   ```bash
   cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
   ```

3. Copiar el contenido de la clave **privada** (`~/.ssh/github_actions_deploy`) al secret `VPS_SSH_KEY` en GitHub.

---

## 4. Archivos a Crear/Modificar en el Repo

### 4.1. `.github/workflows/deploy.yml`

Workflow que se ejecuta en `push` a `main` o en `merge` de un PR a `main`.

Pasos principales:
1. Conectar por SSH al VPS.
2. Ejecutar `git pull origin main`.
3. Generar los tres archivos `.env` desde los secrets.
4. `npm install`.
5. `npm run db:generate`.
6. `npm run build`.
7. `pm2 startOrRestart ecosystem.config.js`.

### 4.2. `ecosystem.config.js`

Ajustar:
- Nombres de los procesos: `viper-web` y `viper-socket`.
- Paths (`cwd`) relativos al directorio del repo en el VPS.
- Variables de entorno base (`NODE_ENV: production`).

### 4.3. `nginx/viper-cmv.conf`

Configuración de nginx:
- `server_name viper.cmvalparaiso.cl;`
- Proxy a `localhost:3000` para el tráfico web (`/`).
- Proxy a `localhost:4000` para `/socket.io/` con headers de WebSocket upgrade.
- Bloqueo explícito de `/api/internal/` (`deny all;`).
- Bloque SSL en puerto 443 (gestionado por Certbot, pero la base debe estar en el repo).

### 4.4. `apps/web/.env`, `services/socket-server/.env`, `.env` (root)

Estos archivos no se commitean. El workflow los genera en el VPS.

---

## 5. Variables de Entorno en Producción

### 5.1. Root `.env`

```
DATABASE_URL="mongodb://<user>:<pass>@localhost:27017/biper-cmv?authSource=admin"
JWT_SECRET="<string-seguro-aleatorio>"
JWT_EXPIRES_IN="7d"
NEXT_PUBLIC_APP_URL="https://viper.cmvalparaiso.cl"
SOCKET_SERVER_URL="https://viper.cmvalparaiso.cl"
SOCKET_SERVER_INTERNAL_URL="http://localhost:4000"
```

### 5.2. `apps/web/.env`

```
DATABASE_URL="mongodb://<user>:<pass>@localhost:27017/biper-cmv?authSource=admin"
JWT_SECRET="<string-seguro-aleatorio>"
JWT_EXPIRES_IN="7d"
NEXT_PUBLIC_APP_URL="https://viper.cmvalparaiso.cl"
SOCKET_SERVER_URL="https://viper.cmvalparaiso.cl"
```

### 5.3. `services/socket-server/.env`

```
PORT=4000
DATABASE_URL="mongodb://<user>:<pass>@localhost:27017/biper-cmv?authSource=admin"
JWT_SECRET="<string-seguro-aleatorio>"
NEXT_API_URL="http://localhost:3000"
```

---

## 6. Secrets de GitHub Requeridos

| Secret | Descripción |
|--------|-------------|
| `VPS_HOST` | IP pública o dominio del VPS (ej. `viper.cmvalparaiso.cl`). |
| `VPS_USER` | Usuario SSH del VPS (ej. `ubuntu`, `deploy`). |
| `VPS_SSH_KEY` | Clave privada SSH completa (ED25519 o RSA) para conexión sin contraseña. |
| `DATABASE_URL` | URL de conexión a MongoDB con credenciales y `authSource=admin`. |
| `JWT_SECRET` | Secreto para la firma de tokens JWT. Mínimo 32 caracteres aleatorios. |
| `JWT_EXPIRES_IN` | Tiempo de expiración del token JWT (ej. `7d`, `24h`). |

---

## 7. Flujo de Deploy (CI/CD)

```
[Push/Merge a main]
         │
         ▼
[GitHub Actions: Deploy Workflow]
         │
         ▼
[Conexión SSH al VPS]
         │
         ▼
[git pull origin main]
         │
         ▼
[Generar archivos .env desde secrets]
         │
         ▼
[npm install (workspaces)]
         │
         ▼
[npm run db:generate]
         │
         ▼
[npm run build (web + socket)]
         │
         ▼
[pm2 startOrRestart ecosystem.config.js]
         │
         ▼
[Nginx sirve el tráfico HTTPS]
```

---

## 8. Rollback y Troubleshooting

- **Rollback rápido:** En el VPS, ejecutar manualmente `git checkout <commit-anterior>` y `pm2 restart all`.
- **Ver logs:** `pm2 logs viper-web` / `pm2 logs viper-socket`.
- **Verificar nginx:** `sudo nginx -t && sudo systemctl reload nginx`.
- **Problemas de build:** Ejecutar `npm run build` manualmente en el VPS para ver errores detallados.

---

## 9. Seguridad

- **Nginx bloquea `/api/internal/`** para evitar acceso externo a los endpoints de comunicación servicio-a-servicio.
- **Tokens internos:** El socket server usa `rol: INTERNAL` con expiración de 5 minutos para llamar a la web app.
- **bcrypt:** Externalizado en webpack de Next.js para evitar problemas de bundle.
- **Secrets:** Jamás commitear archivos `.env`. Toda la configuración sensible reside en GitHub Secrets.
