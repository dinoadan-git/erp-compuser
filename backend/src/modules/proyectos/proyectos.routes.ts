import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { siguienteFolio } from '../../lib/folios.js';
import { requireAuth } from '../../middleware/auth.js';
import { aplicarMovimiento, r2 } from '../../lib/inventario.js';

export const proyectosRouter = Router();
proyectosRouter.use(requireAuth);

// ==================================================================
// PROYECTOS
// ==================================================================

const proyectoSchema = z.object({
  clienteId: z.coerce.number(),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  alcance: z.string().optional(),
  total: z.coerce.number().min(0).optional(),
});

proyectosRouter.get('/', async (req, res, next) => {
  try {
    const { estatus, clienteId } = req.query;
    const proyectos = await prisma.proyecto.findMany({
      where: { estatus: estatus ? (estatus as any) : undefined, clienteId: clienteId ? Number(clienteId) : undefined },
      include: { cliente: { select: { nombre: true } }, _count: { select: { etapas: true } } },
      orderBy: { creadoEn: 'desc' }, take: 200,
    });
    res.json(proyectos);
  } catch (e) { next(e); }
});

proyectosRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const proyecto = await prisma.proyecto.findUnique({
      where: { id },
      include: {
        cliente: true,
        etapas: { orderBy: { id: 'asc' } },
        visitas: { orderBy: { fecha: 'desc' } },
        pagos: { orderBy: { fecha: 'desc' } },
      },
    });
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    // Materiales consumidos (movimientos de inventario ligados al proyecto).
    const materiales = await prisma.movimientoInventario.findMany({
      where: { refTipo: 'PROYECTO', refId: String(id) },
      include: { producto: { select: { nombre: true } } },
      orderBy: { creadoEn: 'desc' },
    });
    const pagado = r2(proyecto.pagos.reduce((s, p) => s + Number(p.monto), 0));
    res.json({ ...proyecto, materiales, pagado, saldo: r2(Number(proyecto.total) - pagado) });
  } catch (e) { next(e); }
});

proyectosRouter.post('/', async (req, res, next) => {
  try {
    const d = proyectoSchema.parse(req.body);
    const folio = await siguienteFolio('PROYECTO', 'PRY-');
    const proyecto = await prisma.proyecto.create({ data: { ...d, folio } });
    res.status(201).json(proyecto);
  } catch (e) { next(e); }
});

proyectosRouter.put('/:id', async (req, res, next) => {
  try {
    const d = proyectoSchema.partial().extend({
      estatus: z.enum(['COTIZACION', 'EN_CURSO', 'PAUSADO', 'CERRADO', 'CANCELADO']).optional(),
    }).parse(req.body);
    const proyecto = await prisma.proyecto.update({ where: { id: Number(req.params.id) }, data: d });
    res.json(proyecto);
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// ETAPAS (con responsables, avance y horas)
// ------------------------------------------------------------------
proyectosRouter.post('/:id/etapas', async (req, res, next) => {
  try {
    const d = z.object({ nombre: z.string().min(1), responsable: z.string().optional(), avance: z.coerce.number().min(0).max(100).optional(), horas: z.coerce.number().min(0).optional() }).parse(req.body);
    const etapa = await prisma.etapaProyecto.create({ data: { proyectoId: Number(req.params.id), ...d } });
    res.status(201).json(etapa);
  } catch (e) { next(e); }
});

proyectosRouter.put('/etapas/:etapaId', async (req, res, next) => {
  try {
    const d = z.object({ nombre: z.string().optional(), responsable: z.string().optional(), avance: z.coerce.number().min(0).max(100).optional(), horas: z.coerce.number().min(0).optional() }).parse(req.body);
    const etapa = await prisma.etapaProyecto.update({ where: { id: Number(req.params.etapaId) }, data: d });
    res.json(etapa);
  } catch (e) { next(e); }
});

// Registrar horas adicionales en una etapa.
proyectosRouter.post('/etapas/:etapaId/horas', async (req, res, next) => {
  try {
    const { horas } = z.object({ horas: z.coerce.number().positive() }).parse(req.body);
    const etapa = await prisma.etapaProyecto.update({ where: { id: Number(req.params.etapaId) }, data: { horas: { increment: horas } } });
    res.json(etapa);
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// VISITAS EN SITIO
// ------------------------------------------------------------------
proyectosRouter.post('/:id/visitas', async (req, res, next) => {
  try {
    const d = z.object({ fecha: z.coerce.date(), nota: z.string().optional() }).parse(req.body);
    const visita = await prisma.visitaProyecto.create({ data: { proyectoId: Number(req.params.id), ...d } });
    res.status(201).json(visita);
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// MATERIALES CONSUMIDOS (descuentan inventario)
// ------------------------------------------------------------------
proyectosRouter.post('/:id/materiales', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { productoId, cantidad } = z.object({ productoId: z.coerce.number(), cantidad: z.coerce.number().positive() }).parse(req.body);
    await prisma.$transaction((tx) => aplicarMovimiento(tx, {
      productoId, tipo: 'SALIDA', cantidad, motivo: `Material proyecto ${id}`,
      refTipo: 'PROYECTO', refId: String(id), usuarioId: req.user!.id,
    }));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// FACTURACION / PAGOS (anticipo, avance, cierre)
// ------------------------------------------------------------------
proyectosRouter.post('/:id/pagos', async (req, res, next) => {
  try {
    const d = z.object({
      concepto: z.enum(['ANTICIPO', 'AVANCE', 'CIERRE']),
      monto: z.coerce.number().positive(),
      nota: z.string().optional(),
    }).parse(req.body);
    const pago = await prisma.pagoProyecto.create({ data: { proyectoId: Number(req.params.id), ...d } });
    res.status(201).json(pago);
  } catch (e) { next(e); }
});

// ==================================================================
// POLIZAS DE MANTENIMIENTO (con servicios programados)
// ==================================================================
proyectosRouter.get('/polizas/lista', async (_req, res, next) => {
  try {
    const polizas = await prisma.polizaMantenimiento.findMany({
      include: { cliente: { select: { nombre: true } }, servicios: { orderBy: { fecha: 'asc' } } },
      orderBy: { creadoEn: 'desc' }, take: 200,
    });
    res.json(polizas);
  } catch (e) { next(e); }
});

proyectosRouter.post('/polizas', async (req, res, next) => {
  try {
    const d = z.object({
      clienteId: z.coerce.number(),
      nombre: z.string().min(1),
      inicio: z.coerce.date(),
      fin: z.coerce.date().optional(),
      total: z.coerce.number().min(0).optional(),
    }).parse(req.body);
    const poliza = await prisma.polizaMantenimiento.create({ data: d });
    res.status(201).json(poliza);
  } catch (e) { next(e); }
});

proyectosRouter.post('/polizas/:polizaId/servicios', async (req, res, next) => {
  try {
    const d = z.object({ fecha: z.coerce.date(), descripcion: z.string().min(1) }).parse(req.body);
    const servicio = await prisma.servicioProgramado.create({ data: { polizaId: Number(req.params.polizaId), ...d } });
    res.status(201).json(servicio);
  } catch (e) { next(e); }
});

// Marcar un servicio programado como realizado.
proyectosRouter.post('/servicios/:servicioId/realizado', async (req, res, next) => {
  try {
    const servicio = await prisma.servicioProgramado.update({
      where: { id: Number(req.params.servicioId) },
      data: { realizado: true, realizadoEn: new Date() },
    });
    res.json(servicio);
  } catch (e) { next(e); }
});

export default proyectosRouter;
