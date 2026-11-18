import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';

import { authRouter } from './modules/auth/auth.routes.js';
import clientesRouter from './modules/clientes/clientes.routes.js';
import equiposRouter from './modules/equipos/equipos.routes.js';
import ordenesRouter from './modules/ordenes/ordenes.routes.js';
import portalRouter from './modules/portal/portal.routes.js';
import catalogoRouter from './modules/catalogo/catalogo.routes.js';
import inventarioRouter from './modules/inventario/inventario.routes.js';
import comprasRouter from './modules/compras/compras.routes.js';
import ventasRouter from './modules/ventas/ventas.routes.js';
import proyectosRouter from './modules/proyectos/proyectos.routes.js';
import gastosRouter from './modules/gastos/gastos.routes.js';
import reportesRouter from './modules/reportes/reportes.routes.js';
import configRouter from './modules/config/config.routes.js';

export const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, servicio: 'csa-epson-erp' }));

// Portal publico (sin auth)
app.use('/api/portal', portalRouter);

// Modulos protegidos
app.use('/api/auth', authRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/equipos', equiposRouter);
app.use('/api/ordenes', ordenesRouter);
app.use('/api/catalogo', catalogoRouter);
app.use('/api/inventario', inventarioRouter);
app.use('/api/compras', comprasRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/proyectos', proyectosRouter);
app.use('/api/gastos', gastosRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/config', configRouter);

app.use(notFound);
app.use(errorHandler);
