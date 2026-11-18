# Despliegue en el servidor (64.177.83.100)

Guía para dejar el ERP corriendo en tu servidor Linux (probada para **Ubuntu/Debian**). Supone acceso `sudo`. Reemplaza `TU_DOMINIO_O_IP` por `64.177.83.100` o tu dominio.

> Arquitectura en el servidor: **PostgreSQL** (datos) · **Node** corriendo la API (puerto 4000, gestionada por **systemd**) · **Nginx** sirviendo el frontend y haciendo proxy de `/api`.

---

## 1. Requisitos del sistema

```bash
sudo apt update
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx postgresql
node -v   # debe ser >= 22.19
```

## 2. Base de datos PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER csa WITH PASSWORD 'PON_UNA_PASSWORD_FUERTE';
CREATE DATABASE csa_epson OWNER csa;
SQL
```

## 3. Usuario del sistema y código

```bash
sudo useradd -r -m -d /opt/erp-compuser -s /bin/bash csa || true
sudo mkdir -p /opt/erp-compuser
sudo chown -R csa:csa /opt/erp-compuser

# Clonar el repo (como usuario csa)
sudo -u csa git clone https://github.com/dinoadan-git/erp-compuser.git /opt/erp-compuser
```

> Repo privado: usa un **token de acceso** o una **deploy key** de GitHub para el clone. (No pongas el token en archivos versionados.)

## 4. Variables de entorno del backend

```bash
sudo -u csa cp /opt/erp-compuser/deploy/.env.production.example /opt/erp-compuser/backend/.env
sudo -u csa nano /opt/erp-compuser/backend/.env   # edita DATABASE_URL, JWT_SECRET, CORS_ORIGIN
# Genera un JWT_SECRET fuerte:
openssl rand -hex 32
```

## 5. Build inicial + migraciones + datos semilla

```bash
cd /opt/erp-compuser/backend
sudo -u csa npm ci
sudo -u csa npx prisma generate
sudo -u csa --preserve-env=DATABASE_URL npx prisma migrate deploy
sudo -u csa npm run build
sudo -u csa npm run seed          # SOLO la primera vez (crea usuarios demo)

cd /opt/erp-compuser/frontend
sudo -u csa npm ci
sudo -u csa npm run build
```

> **Importante:** tras el primer login, cambia las contraseñas de los usuarios demo (admin@csa.local / cambiar123) desde Configuración → Usuarios.

## 6. Servicio systemd (API)

```bash
sudo cp /opt/erp-compuser/deploy/csa-epson-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now csa-epson-api
sudo systemctl status csa-epson-api     # debe estar "active (running)"
```

## 7. Nginx (frontend + proxy /api)

```bash
sudo cp /opt/erp-compuser/deploy/nginx.conf /etc/nginx/sites-available/erp-compuser
sudo sed -i 's/TU_DOMINIO_O_IP/64.177.83.100/' /etc/nginx/sites-available/erp-compuser
sudo ln -sf /etc/nginx/sites-available/erp-compuser /etc/nginx/sites-enabled/erp-compuser
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Abre `http://64.177.83.100` — deberías ver el login.

## 8. HTTPS (recomendado, si tienes dominio)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d TU_DOMINIO     # requiere un dominio apuntando al servidor
```

Luego pon `CORS_ORIGIN=https://TU_DOMINIO` en el `.env` y `sudo systemctl restart csa-epson-api`.

## 9. Firewall (opcional)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Actualizaciones futuras

Cada vez que haya cambios nuevos en `main`:

```bash
sudo -u csa APP_DIR=/opt/erp-compuser /opt/erp-compuser/deploy/deploy.sh
```

El script hace `git pull`, instala dependencias, **aplica migraciones sin borrar datos**, reconstruye frontend/backend y reinicia el servicio.

---

## Notas

- **Respaldos**: programa `pg_dump` periódico de `csa_epson`.
  `pg_dump -U csa csa_epson > backup_$(date +%F).sql`
- **Integraciones** (CFDI/PAC, WhatsApp, pagos): se activan llenando sus variables en `.env` y reiniciando la API.
- **ETL**: cuando tengas el export autorizado de la base real, se carga contra este mismo esquema (Prisma).
