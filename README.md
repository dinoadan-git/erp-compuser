# CSA EPSON — ERP + Tienda en línea

Sistema de administración para un **Centro de Servicio Autorizado EPSON**: órdenes de trabajo de reparación, mostrador (POS), inventario, compras, proyectos, portal del cliente, gastos y reportes. Basado en el documento de definición de módulos (Nov 2026).

> **Estado:** base del proyecto (andamiaje). El núcleo (Clientes, Equipos, Órdenes de trabajo y Portal del cliente) está funcional; los demás módulos están estructurados y listos para desarrollarse por etapas.

---

## Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + React Router |
| Backend | Node.js + Express + TypeScript |
| ORM / BD | Prisma + **PostgreSQL** |
| Auth | JWT + roles + PIN de 4 dígitos por colaborador |

Monorepo:

```
csa-epson-erp/
├── backend/        API REST (Express + Prisma)
│   ├── prisma/     esquema de datos + migraciones + seed
│   └── src/
│       ├── modules/   un módulo por área (clientes, ordenes, ...)
│       ├── middleware/ auth, errores
│       └── lib/       prisma, folios
├── frontend/       SPA React (Vite)
└── docker-compose.yml  PostgreSQL para desarrollo
```

## Puesta en marcha (desarrollo local)

Requisitos: Node 22.19+ (o 24.11+) y Docker (o un PostgreSQL propio).

```bash
# 1) Base de datos
docker compose up -d db

# 2) Backend
cd backend
cp .env.example .env            # ajusta JWT_SECRET
npm install
npx prisma migrate deploy        # crea las tablas
npm run seed                     # datos iniciales (usuarios demo)
npm run dev                      # API en http://localhost:4000

# 3) Frontend (otra terminal)
cd frontend
npm install
npm run dev                      # app en http://localhost:5173
```

**Usuarios demo** (creados por el seed): `admin@csa.local` / `cambiar123`, PIN `1234`. También `recepcion@`, `tecnico@`, `cajero@`, `compras@`. **Cambia estas contraseñas antes de producción.**

## Módulos (del documento de definición)

| # | Módulo | Estado |
|---|---|---|
| 3.1 | Clientes (CRM) | ✅ núcleo (CRUD + contactos/direcciones/equipos) |
| 3.6 | Órdenes de trabajo | ✅ núcleo (recepción, folio, QR, flujo de 12 estatus, bitácora) |
| 3.8 | Portal del cliente | ✅ consulta pública por folio/QR |
| 3.2 | Productos y servicios | 🟡 parcial (listado/alta de productos para el POS) |
| 3.3 | Inventario (kardex) | ✅ kardex + costo promedio, entradas/salidas/ajustes, mín/máx + alertas de reorden, apartado/liberación, conteo físico |
| 3.4 | Compras | ✅ proveedores, órdenes de compra, recepción parcial/total → inventario + costeo, cuentas por pagar/pagos, requisiciones sugeridas |
| 3.5 | Ventas de mostrador (POS) | ✅ corte de caja, venta + descuento de stock, formas de pago, cobro de órdenes, devoluciones/NC; CFDI pendiente de PAC |
| 3.7 | Proyectos y servicios especiales | 🧱 andamiaje + modelo de datos |
| 3.9 | Gastos | 🧱 andamiaje + modelo de datos |
| 3.10 | Reportes y analítica | ✅ KPIs, órdenes por estatus, productividad/SLA, utilidad y margen, inventario valorizado, gastos vs ingresos, export CSV |
| 3.11 | Configuración y seguridad | 🧱 andamiaje (auth/roles/auditoría en el modelo) |

El **modelo de datos completo de los 11 módulos** ya está en `backend/prisma/schema.prisma`.

### Roles (5)
`ADMINISTRADOR`, `RECEPCION`, `TECNICO`, `CAJERO`, `COMPRAS_ALMACEN`. Una persona puede tener varios roles.

### Flujo de la orden de trabajo (12 estatus)
`RECIBIDO → EN_DIAGNOSTICO → ESPERANDO_AUTORIZACION → EN_TRAMITE_GARANTIA_EPSON → ESPERANDO_REFACCION → EN_REPARACION → EN_PRUEBAS_CALIDAD → LISTO_ENTREGA_REPARADO | LISTO_ENTREGA_SIN_REPARAR → ENTREGADO`, más `ABANDONO` y `CANCELADO`. Los estatus marcados en el documento disparan aviso al cliente (lógica en `ordenes.routes.ts`).

## Integraciones pendientes (requieren credenciales/servicios externos)

- **CFDI 4.0**: timbrado vía un **PAC** + certificados de sello digital (CSD). Campos `cfdiUuid` ya previstos.
- **WhatsApp / correo**: notificaciones por cambio de estatus (`PlantillaMensaje` en el modelo).
- **Pasarela de pago**: tienda en línea de consumibles.

Se configuran por variables de entorno (ver `backend/.env.example`). No se guardan credenciales en el repo.

## Despliegue en el servidor (64.177.83.100)

Pasos previstos (se detallarán al desplegar):
1. Instalar Node 22.19+ y PostgreSQL 16 en el servidor.
2. Clonar el repo, `npm ci` en `backend` y `frontend`.
3. Configurar `backend/.env` con `DATABASE_URL` real y un `JWT_SECRET` fuerte.
4. `npx prisma migrate deploy` + `npm run seed` (una sola vez).
5. `npm run build` en ambos; servir el frontend (Nginx) y correr la API con un gestor de procesos (pm2/systemd) detrás de Nginx con HTTPS.

> El despliegue requiere acceso SSH al servidor y abrir ese host en la red de la sesión; se coordina aparte.

## ETL (migración de datos reales)

Cuando esté disponible la base de datos real del sistema actual (export autorizado), se hará un ETL hacia este esquema. Prisma facilita la carga. **No se migran datos sin autorización del dueño de los datos.**
