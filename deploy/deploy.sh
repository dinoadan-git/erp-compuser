#!/usr/bin/env bash
# Despliegue / actualizacion del ERP CSA EPSON en el servidor.
# Ejecutar como usuario con permisos (ver DEPLOY.md). Idempotente.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/erp-compuser}"
BRANCH="${BRANCH:-main}"

echo ">> Actualizando codigo en $APP_DIR (rama $BRANCH)"
cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo ">> Backend: dependencias, migraciones y build"
cd "$APP_DIR/backend"
npm ci
npx prisma generate
npx prisma migrate deploy          # aplica migraciones sin perder datos
npm run build

echo ">> Frontend: dependencias y build"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo ">> Reiniciando servicio de la API"
sudo systemctl restart csa-epson-api
sudo systemctl reload nginx || true

echo ">> Listo. Estado del servicio:"
sudo systemctl --no-pager status csa-epson-api | head -5
