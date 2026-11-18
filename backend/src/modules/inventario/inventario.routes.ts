import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { aplicarMovimiento, r3 } from '../../lib/inventario.js';

export const inventarioRouter = Router();
inventarioRouter.use(requireAuth);

const ALMACEN = requireRole('COMPRAS_ALMACEN', 'ADMINISTRADOR');

// ------------------------------------------------------------------
// EXISTENCIAS
// ------------------------------------------------------------------

// Lista de existencias (solo productos con control de stock).
inventarioRouter.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const bajoMinimo = req.query.bajoMinimo === 'true';
    const productos = await prisma.producto.findMany({
      where: {
        controlStock: true,
        tipo: { not: 'SERVICIO' },
        ...(q ? { OR: [{ nombre: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      include: { existencia: true },
      orderBy: { nombre: 'asc' },
      take: 300,
    });
    let filas = productos.map((p) => ({
      productoId: p.id,
      sku: p.sku,
      nombre: p.nombre,
      costoPromedio: p.costoPromedio,
      disponible: Number(p.existencia?.disponible ?? 0),
      apartado: Number(p.existencia?.apartado ?? 0),
      minimo: Number(p.existencia?.minimo ?? 0),
      maximo: Number(p.existencia?.maximo ?? 0),
      bajoMinimo: Number(p.existencia?.disponible ?? 0) <= Number(p.existencia?.minimo ?? 0),
    }));
    if (bajoMinimo) filas = filas.filter((f) => f.bajoMinimo && f.minimo > 0);
    res.json(filas);
  } catch (e) { next(e); }
});

// Alertas de reorden: disponible <= minimo (con minimo > 0).
inventarioRouter.get('/alertas', async (_req, res, next) => {
  try {
    const existencias = await prisma.existencia.findMany({
      where: { minimo: { gt: 0 } },
      include: { producto: { select: { nombre: true, sku: true } } },
    });
    const alertas = existencias
      .filter((e) => Number(e.disponible) <= Number(e.minimo))
      .map((e) => ({
        productoId: e.productoId, nombre: e.producto.nombre, sku: e.producto.sku,
        disponible: Number(e.disponible), minimo: Number(e.minimo), maximo: Number(e.maximo),
        sugeridoComprar: r3(Number(e.maximo) - Number(e.disponible)),
      }));
    res.json(alertas);
  } catch (e) { next(e); }
});

// Kardex de un producto: movimientos ordenados con saldo corrido.
inventarioRouter.get('/:productoId/kardex', async (req, res, next) => {
  try {
    const productoId = Number(req.params.productoId);
    const producto = await prisma.producto.findUnique({ where: { id: productoId }, include: { existencia: true } });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const movs = await prisma.movimientoInventario.findMany({
      where: { productoId },
      orderBy: { creadoEn: 'asc' },
      include: { usuario: { select: { nombre: true } } },
    });
    let saldo = 0;
    const kardex = movs.map((m) => {
      const signo = m.tipo === 'SALIDA' || m.tipo === 'APARTADO' ? -1 : 1;
      // APARTADO no cambia el total en almacen, pero si el disponible; para el kardex
      // de existencia fisica consideramos ENTRADA/SALIDA/AJUSTE.
      const delta = m.tipo === 'APARTADO' || m.tipo === 'LIBERACION_APARTADO' ? 0 : signo * Number(m.cantidad);
      saldo = r3(saldo + delta);
      return {
        fecha: m.creadoEn, tipo: m.tipo, cantidad: Number(m.cantidad),
        costoUnit: m.costoUnit ? Number(m.costoUnit) : null, motivo: m.motivo,
        ref: m.refTipo ? `${m.refTipo} ${m.refId ?? ''}`.trim() : null,
        usuario: m.usuario?.nombre, saldo,
      };
    });
    res.json({
      producto: { id: producto.id, nombre: producto.nombre, sku: producto.sku, costoPromedio: producto.costoPromedio },
      existencia: producto.existencia,
      kardex,
    });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// MOVIMIENTOS MANUALES
// ------------------------------------------------------------------

const movBase = z.object({
  productoId: z.coerce.number(),
  cantidad: z.coerce.number().positive(),
  motivo: z.string().optional(),
});

inventarioRouter.post('/entrada', ALMACEN, async (req, res, next) => {
  try {
    const { productoId, cantidad, motivo } = movBase.extend({ costoUnit: z.coerce.number().min(0).optional() }).parse(req.body);
    const costoUnit = (req.body.costoUnit != null) ? Number(req.body.costoUnit) : undefined;
    await prisma.$transaction((tx) => aplicarMovimiento(tx, { productoId, tipo: 'ENTRADA', cantidad, costoUnit, motivo: motivo ?? 'Entrada manual', refTipo: 'AJUSTE', usuarioId: req.user!.id }));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

inventarioRouter.post('/salida', ALMACEN, async (req, res, next) => {
  try {
    const { productoId, cantidad, motivo } = movBase.parse(req.body);
    await prisma.$transaction((tx) => aplicarMovimiento(tx, { productoId, tipo: 'SALIDA', cantidad, motivo: motivo ?? 'Salida manual', refTipo: 'AJUSTE', usuarioId: req.user!.id }));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Ajuste: fija la existencia a una cantidad objetivo y registra la diferencia.
inventarioRouter.post('/ajuste', ALMACEN, async (req, res, next) => {
  try {
    const { productoId, cantidadFinal, motivo } = z.object({
      productoId: z.coerce.number(),
      cantidadFinal: z.coerce.number().min(0),
      motivo: z.string().min(1),
    }).parse(req.body);
    const ex = await prisma.existencia.findUnique({ where: { productoId } });
    const actual = Number(ex?.disponible ?? 0);
    const diferencia = r3(cantidadFinal - actual);
    if (diferencia !== 0) {
      await prisma.$transaction((tx) => aplicarMovimiento(tx, { productoId, tipo: 'AJUSTE', cantidad: diferencia, motivo, refTipo: 'AJUSTE', usuarioId: req.user!.id }));
    }
    res.status(201).json({ ok: true, anterior: actual, nuevo: cantidadFinal, diferencia });
  } catch (e) { next(e); }
});

// Limites de reorden (minimo/maximo).
inventarioRouter.put('/:productoId/limites', ALMACEN, async (req, res, next) => {
  try {
    const { minimo, maximo } = z.object({ minimo: z.coerce.number().min(0), maximo: z.coerce.number().min(0) }).parse(req.body);
    const ex = await prisma.existencia.upsert({
      where: { productoId: Number(req.params.productoId) },
      create: { productoId: Number(req.params.productoId), minimo, maximo },
      update: { minimo, maximo },
    });
    res.json(ex);
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// APARTADO / LIBERACION (refacciones para ordenes de trabajo)
// ------------------------------------------------------------------

inventarioRouter.post('/apartar', async (req, res, next) => {
  try {
    const { productoId, cantidad, ordenId } = z.object({
      productoId: z.coerce.number(), cantidad: z.coerce.number().positive(), ordenId: z.coerce.number().optional(),
    }).parse(req.body);
    const ex = await prisma.existencia.findUnique({ where: { productoId } });
    if (Number(ex?.disponible ?? 0) < cantidad) return res.status(400).json({ error: 'Stock disponible insuficiente para apartar' });
    await prisma.$transaction((tx) => aplicarMovimiento(tx, { productoId, tipo: 'APARTADO', cantidad, motivo: ordenId ? `Apartado orden ${ordenId}` : 'Apartado', refTipo: 'ORDEN', refId: ordenId ? String(ordenId) : undefined, usuarioId: req.user!.id }));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

inventarioRouter.post('/liberar', async (req, res, next) => {
  try {
    const { productoId, cantidad } = z.object({ productoId: z.coerce.number(), cantidad: z.coerce.number().positive() }).parse(req.body);
    await prisma.$transaction((tx) => aplicarMovimiento(tx, { productoId, tipo: 'LIBERACION_APARTADO', cantidad, motivo: 'Liberacion de apartado', usuarioId: req.user!.id }));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// CONTEO FISICO (ciclico o total) con ajuste de diferencias
// ------------------------------------------------------------------

inventarioRouter.post('/conteo', ALMACEN, async (req, res, next) => {
  try {
    const { conteos } = z.object({
      conteos: z.array(z.object({ productoId: z.coerce.number(), contado: z.coerce.number().min(0) })).min(1),
    }).parse(req.body);

    const resultado = await prisma.$transaction(async (tx) => {
      const filas = [];
      for (const c of conteos) {
        const ex = await tx.existencia.findUnique({ where: { productoId: c.productoId } });
        const sistema = Number(ex?.disponible ?? 0);
        const diferencia = r3(c.contado - sistema);
        if (diferencia !== 0) {
          await aplicarMovimiento(tx, { productoId: c.productoId, tipo: 'AJUSTE', cantidad: diferencia, motivo: 'Conteo fisico', refTipo: 'CONTEO', usuarioId: req.user!.id });
        }
        filas.push({ productoId: c.productoId, sistema, contado: c.contado, diferencia });
      }
      return filas;
    });
    res.status(201).json({ ajustados: resultado.filter((r) => r.diferencia !== 0).length, detalle: resultado });
  } catch (e) { next(e); }
});

export default inventarioRouter;
