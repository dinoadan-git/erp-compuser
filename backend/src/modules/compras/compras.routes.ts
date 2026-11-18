import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { siguienteFolio } from '../../lib/folios.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { aplicarMovimiento, r2, r3 } from '../../lib/inventario.js';

export const comprasRouter = Router();
comprasRouter.use(requireAuth);

const COMPRAS = requireRole('COMPRAS_ALMACEN', 'ADMINISTRADOR');

// ------------------------------------------------------------------
// PROVEEDORES
// ------------------------------------------------------------------

comprasRouter.get('/proveedores', async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const proveedores = await prisma.proveedor.findMany({
      where: q ? { nombre: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { nombre: 'asc' }, take: 100,
    });
    res.json(proveedores);
  } catch (e) { next(e); }
});

const proveedorSchema = z.object({
  nombre: z.string().min(1),
  rfc: z.string().optional(),
  esEpson: z.boolean().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  direccion: z.string().optional(),
});

comprasRouter.post('/proveedores', COMPRAS, async (req, res, next) => {
  try {
    const d = proveedorSchema.parse(req.body);
    const prov = await prisma.proveedor.create({ data: { ...d, email: d.email || null } });
    res.status(201).json(prov);
  } catch (e) { next(e); }
});

comprasRouter.put('/proveedores/:id', COMPRAS, async (req, res, next) => {
  try {
    const d = proveedorSchema.partial().parse(req.body);
    const prov = await prisma.proveedor.update({ where: { id: Number(req.params.id) }, data: d });
    res.json(prov);
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// REQUISICIONES SUGERIDAS (por faltantes de inventario)
// ------------------------------------------------------------------

comprasRouter.get('/requisiciones/sugeridas', async (_req, res, next) => {
  try {
    const existencias = await prisma.existencia.findMany({
      where: { minimo: { gt: 0 } },
      include: { producto: { select: { id: true, nombre: true, sku: true, costoPromedio: true } } },
    });
    const sugeridas = existencias
      .filter((e) => Number(e.disponible) <= Number(e.minimo))
      .map((e) => ({
        productoId: e.productoId, nombre: e.producto.nombre, sku: e.producto.sku,
        disponible: Number(e.disponible), minimo: Number(e.minimo), maximo: Number(e.maximo),
        cantidadSugerida: r3(Number(e.maximo) - Number(e.disponible)),
        costoEstimado: Number(e.producto.costoPromedio),
      }));
    res.json(sugeridas);
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// ORDENES DE COMPRA
// ------------------------------------------------------------------

const ocSchema = z.object({
  proveedorId: z.coerce.number(),
  xmlProveedor: z.string().optional(),
  enviar: z.boolean().optional(), // true => estatus ENVIADA, false => BORRADOR
  tasaIva: z.coerce.number().min(0).default(16),
  items: z.array(z.object({
    productoId: z.coerce.number(),
    cantidad: z.coerce.number().positive(),
    costoUnit: z.coerce.number().min(0),
  })).min(1),
});

comprasRouter.post('/ordenes', COMPRAS, async (req, res, next) => {
  try {
    const d = ocSchema.parse(req.body);
    const subtotal = r2(d.items.reduce((s, it) => s + it.cantidad * it.costoUnit, 0));
    const impuestos = r2(subtotal * (d.tasaIva / 100));
    const total = r2(subtotal + impuestos);
    const folio = await siguienteFolio('COMPRA', 'OC-');
    const oc = await prisma.ordenCompra.create({
      data: {
        folio, proveedorId: d.proveedorId, xmlProveedor: d.xmlProveedor,
        estatus: d.enviar ? 'ENVIADA' : 'BORRADOR',
        subtotal, impuestos, total,
        detalles: { create: d.items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad, costoUnit: it.costoUnit })) },
      },
      include: { detalles: { include: { producto: { select: { nombre: true } } } }, proveedor: true },
    });
    res.status(201).json(oc);
  } catch (e) { next(e); }
});

comprasRouter.get('/ordenes', async (req, res, next) => {
  try {
    const { estatus, proveedorId } = req.query;
    const ordenes = await prisma.ordenCompra.findMany({
      where: { estatus: estatus ? (estatus as any) : undefined, proveedorId: proveedorId ? Number(proveedorId) : undefined },
      include: { proveedor: { select: { nombre: true } } },
      orderBy: { creadoEn: 'desc' }, take: 200,
    });
    res.json(ordenes);
  } catch (e) { next(e); }
});

comprasRouter.get('/ordenes/:id', async (req, res, next) => {
  try {
    const oc = await prisma.ordenCompra.findUnique({
      where: { id: Number(req.params.id) },
      include: { detalles: { include: { producto: { select: { nombre: true, sku: true } } } }, proveedor: true, pagos: true },
    });
    if (!oc) return res.status(404).json({ error: 'Orden de compra no encontrada' });
    res.json(oc);
  } catch (e) { next(e); }
});

// Recepcion parcial o total: entra a inventario con su costo y actualiza estatus.
comprasRouter.post('/ordenes/:id/recepcion', COMPRAS, async (req, res, next) => {
  try {
    const ocId = Number(req.params.id);
    const { recibidos, xmlProveedor } = z.object({
      recibidos: z.array(z.object({ detalleId: z.coerce.number(), cantidad: z.coerce.number().positive() })).min(1),
      xmlProveedor: z.string().optional(),
    }).parse(req.body);

    const oc = await prisma.ordenCompra.findUnique({ where: { id: ocId }, include: { detalles: true } });
    if (!oc) return res.status(404).json({ error: 'Orden de compra no encontrada' });
    if (oc.estatus === 'CANCELADA' || oc.estatus === 'RECIBIDA') {
      return res.status(409).json({ error: `La orden esta ${oc.estatus} y no admite recepcion` });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      let valorRecibido = 0;
      for (const rec of recibidos) {
        const det = oc.detalles.find((x) => x.id === rec.detalleId);
        if (!det) throw new Error(`Detalle ${rec.detalleId} no pertenece a la orden`);
        const pendiente = Number(det.cantidad) - Number(det.cantidadRecibida);
        if (rec.cantidad > pendiente) throw new Error(`Recepcion (${rec.cantidad}) excede lo pendiente (${pendiente}) del detalle ${rec.detalleId}`);

        await tx.detalleCompra.update({ where: { id: det.id }, data: { cantidadRecibida: { increment: rec.cantidad } } });
        await aplicarMovimiento(tx, {
          productoId: det.productoId, tipo: 'ENTRADA', cantidad: rec.cantidad, costoUnit: Number(det.costoUnit),
          motivo: `Recepcion compra ${oc.folio}`, refTipo: 'COMPRA', refId: String(oc.id), usuarioId: req.user!.id,
        });
        valorRecibido += rec.cantidad * Number(det.costoUnit);
      }

      // Recalcular estatus: RECIBIDA si todo lo pedido ya llego, si no PARCIAL.
      const dets = await tx.detalleCompra.findMany({ where: { ordenCompraId: ocId } });
      const completa = dets.every((d) => Number(d.cantidadRecibida) >= Number(d.cantidad));
      const nuevoEstatus = completa ? 'RECIBIDA' : 'PARCIAL';
      await tx.ordenCompra.update({ where: { id: ocId }, data: { estatus: nuevoEstatus, ...(xmlProveedor ? { xmlProveedor } : {}) } });

      // Cuenta por pagar: incrementa el saldo del proveedor por lo recibido (con IVA).
      const porPagar = r2(valorRecibido * (1 + Number(oc.impuestos) / Number(oc.subtotal || 1)));
      await tx.proveedor.update({ where: { id: oc.proveedorId }, data: { saldo: { increment: porPagar } } });

      return { estatus: nuevoEstatus, porPagar };
    });

    res.json({ ok: true, ...resultado });
  } catch (e) { next(e); }
});

comprasRouter.post('/ordenes/:id/cancelar', COMPRAS, async (req, res, next) => {
  try {
    const oc = await prisma.ordenCompra.update({ where: { id: Number(req.params.id) }, data: { estatus: 'CANCELADA' } });
    res.json(oc);
  } catch (e) { next(e); }
});

// Pago a proveedor (cuenta por pagar) -> reduce su saldo.
comprasRouter.post('/ordenes/:id/pago', COMPRAS, async (req, res, next) => {
  try {
    const ocId = Number(req.params.id);
    const { monto, forma } = z.object({
      monto: z.coerce.number().positive(),
      forma: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO']).default('TRANSFERENCIA'),
    }).parse(req.body);
    const oc = await prisma.ordenCompra.findUnique({ where: { id: ocId } });
    if (!oc) return res.status(404).json({ error: 'Orden de compra no encontrada' });

    const pago = await prisma.$transaction(async (tx) => {
      const p = await tx.pagoProveedor.create({ data: { ordenCompraId: ocId, monto, forma } });
      await tx.proveedor.update({ where: { id: oc.proveedorId }, data: { saldo: { decrement: monto } } });
      return p;
    });
    res.status(201).json(pago);
  } catch (e) { next(e); }
});

export default comprasRouter;
