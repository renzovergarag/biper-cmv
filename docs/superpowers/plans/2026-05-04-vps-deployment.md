# VPS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar el monorepo `biper-cmv` para despliegue automatizado en un VPS Ubuntu usando un **GitHub Actions self-hosted runner**, PM2 y Nginx con SSL.

**Architecture:** Un runner self-hosted instalado en el VPS ejecuta el workflow directamente en la máquina. Descarga el código vía `actions/checkout`, genera los `.env` desde secrets, instala dependencias, corre build de Prisma y Next.js, y reinicia los procesos con PM2. Nginx expone el subdominio `viper.cmvalparaiso.cl` con proxy a los puertos **3001** (web) y **4000** (socket) y SSL vía Let's Encrypt.

**Tech Stack:** GitHub Actions (self-hosted runner), PM2, Nginx, Node.js 20+, MongoDB, Prisma, Next.js 14, Socket.io.

---

## Task 1: Update PM2 Ecosystem Config (Port 3001)

**Files:**
- Modify: `ecosystem.config.js`

- [ ] **Step 1: Update ports and process names for production**

Replace the content of `ecosystem.config.js` with:

```javascript
module.exports = {
    apps: [
        {
            name: "viper-web",
            cwd: "./apps/web",
            script: "npm",
            args: "start",
            env: {
                NODE_ENV: "production",
                PORT: 3001,
            },
            instances: 1,
            autorestart: true,
            max_memory_restart: "512M",
        },
        {
            name: "viper-socket",
            cwd: "./services/socket-server",
            script: "npm",
            args: "start",
            env: {
                NODE_ENV: "production",
                PORT: 4000,
            },
            instances: 1,
            autorestart: true,
            max_memory_restart: "256M",
        },
    ],
};
```

- [ ] **Step 2: Commit**

```bash
git add ecosystem.config.js
git commit -m "chore: update pm2 config for viper deploy (web port 3001)"
```

---

## Task 2: Create Nginx Config for Production (Port 3001)

**Files:**
- Create: `nginx/viper-cmv.conf`

- [ ] **Step 1: Write nginx site config pointing to port 3001**

Create `nginx/viper-cmv.conf` with:

```nginx
upstream viper_web {
    server 127.0.0.1:3001;
}

upstream viper_socket {
    server 127.0.0.1:4000;
}

server {
    listen 80;
    server_name viper.cmvalparaiso.cl;

    # Certbot managed redirect to HTTPS will be added here after running certbot.
    # The following location block ensures ACME challenges work before Certbot modifies this file.
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name viper.cmvalparaiso.cl;

    # SSL certificates will be managed by Certbot.
    # Before first Certbot run, place dummy paths or let Certbot inject them.

    # Web App (Next.js)
    location / {
        proxy_pass http://viper_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io
    location /socket.io/ {
        proxy_pass http://viper_socket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Internal API (block from external access)
    location /api/internal/ {
        deny all;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add nginx/viper-cmv.conf
git commit -m "chore: add nginx production config for viper.cmvalparaiso.cl (web 3001)"
```

---

## Task 3: Create GitHub Actions Deploy Workflow (Self-Hosted Runner)

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create directories**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write deploy workflow for self-hosted runner**

Create `.github/workflows/deploy.yml` with:

```yaml
name: Deploy to VPS

on:
    push:
        branches: ["main"]

jobs:
    deploy-vps:
        runs-on: self-hosted
        steps:
            - uses: actions/checkout@v4

            - name: Crear archivos de entorno
              run: |
                  # Root .env
                  cat > .env << 'EOF'
                  DATABASE_URL="${{ secrets.DATABASE_URL }}"
                  JWT_SECRET="${{ secrets.JWT_SECRET }}"
                  JWT_EXPIRES_IN="${{ secrets.JWT_EXPIRES_IN }}"
                  NEXT_PUBLIC_APP_URL="https://viper.cmvalparaiso.cl"
                  SOCKET_SERVER_URL="https://viper.cmvalparaiso.cl"
                  SOCKET_SERVER_INTERNAL_URL="http://localhost:4000"
                  EOF

                  # Web .env
                  cat > apps/web/.env << 'EOF'
                  DATABASE_URL="${{ secrets.DATABASE_URL }}"
                  JWT_SECRET="${{ secrets.JWT_SECRET }}"
                  JWT_EXPIRES_IN="${{ secrets.JWT_EXPIRES_IN }}"
                  NEXT_PUBLIC_APP_URL="https://viper.cmvalparaiso.cl"
                  SOCKET_SERVER_URL="https://viper.cmvalparaiso.cl"
                  EOF

                  # Socket .env
                  cat > services/socket-server/.env << 'EOF'
                  PORT=4000
                  DATABASE_URL="${{ secrets.DATABASE_URL }}"
                  JWT_SECRET="${{ secrets.JWT_SECRET }}"
                  NEXT_API_URL="http://localhost:3001"
                  EOF

            - name: Use Node.js 22.x
              uses: actions/setup-node@v4
              with:
                  node-version: 22.x
                  cache: "npm"

            - name: Instalacion de dependencias
              run: npm install

            - name: Generacion de Prisma Client
              run: npm run db:generate

            - name: Construccion del proyecto
              run: npm run build

            - name: Reinicio de PM2
              run: pm2 startOrRestart ecosystem.config.js
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add github actions deploy workflow using self-hosted runner"
```

---

## Task 4: Ensure .env files are ignored by Git

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Read current .gitignore**

Read `.gitignore` to verify if `.env*` is already present.

- [ ] **Step 2: Append env ignores if missing**

If `.env*` or explicit `.env` entries are missing, append:

```
# Environment variables
.env
.env.local
.env.production
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ensure env files are ignored"
```

---

## Task 5: Self-Review & Final Push

- [ ] **Step 1: Review the spec coverage**

Verify each requirement from `docs/superpowers/specs/2026-05-04-vps-deployment-design.md` is covered by a task:
- Build en el VPS → Task 3 (workflow ejecuta build en el runner self-hosted que está en el VPS).
- Generación de `.env` desde secrets → Task 3 (heredoc desde secrets).
- Nginx config → Task 2 (puerto 3001).
- PM2 ecosystem → Task 1 (puerto 3001).
- `.env` no commiteados → Task 4.

- [ ] **Step 2: Placeholder scan**

Ensure no "TBD", "TODO", or vague instructions remain in the created files.

- [ ] **Step 3: Push the branch**

```bash
git push origin main
```

---

## Post-Implementation: Manual VPS Setup Checklist (One-Time)

These steps must be executed **once** on the VPS before the first automated deploy can run.

### 1. Install and Configure GitHub Actions Self-Hosted Runner

1. Go to your GitHub repository → Settings → Actions → Runners → New self-hosted runner.
2. Select OS (Linux) and Architecture (x64 or ARM64 according to your VPS).
3. Follow the download and config commands shown by GitHub. Example:
   ```bash
   mkdir -p /var/www/actions-runner && cd /var/www/actions-runner
   curl -o actions-runner-linux-x64-2.319.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz
   tar xzf ./actions-runner-linux-x64-2.319.1.tar.gz
   ./config.sh --url https://github.com/<usuario>/biper-cmv --token <TOKEN_GITHUB>
   ```
4. Add the label `self-hosted` (or the label you used in `runs-on:`) during configuration if prompted, or add it later in the GitHub UI.
5. Install and start the runner as a service:
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

### 2. Install Node.js 22.x on the VPS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Clone the Repository

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/<usuario>/biper-cmv.git viper-cmv
sudo chown -R $USER:$USER /var/www/viper-cmv
cd viper-cmv
```

### 4. Install PM2 Globally

```bash
sudo npm install -g pm2
```

### 5. Configure Nginx

```bash
sudo cp /var/www/viper-cmv/nginx/viper-cmv.conf /etc/nginx/sites-available/viper-cmv
sudo ln -sf /etc/nginx/sites-available/viper-cmv /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d viper.cmvalparaiso.cl
# Choose redirect HTTP to HTTPS when prompted.
```

### 7. PM2 Startup Hook

```bash
cd /var/www/viper-cmv
pm2 startup
# Run the systemd command printed by pm2 startup.
pm2 save
```

### 8. Configure GitHub Secrets

Go to Repository Settings → Secrets and variables → Actions, and add:
- `DATABASE_URL` — e.g. `mongodb://user:pass@localhost:27017/biper-cmv?authSource=admin`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

**Note:** No SSH secrets (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`) are needed because the runner lives on the VPS.

### 9. Trigger First Deploy

Push a commit to `main` or merge a PR. The self-hosted runner will pick up the job automatically.
