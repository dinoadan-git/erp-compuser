import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { siguienteFolio } from '../../lib/folios.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { aplicarMovimiento, calcularTotales, corteAbierto, r2, type ItemVenta } from './ventas.service.js';
import { notificar } from '../../lib/notificaciones.js';

export const ventasRouter = Router();
ventasRouter.use(requireAuth);

// ------------------------------------------------------------------
// CORTE DE CAJA
// ------------------------------------------------------------------

ventasRouter.get('/caja/actual', async (req, res, next) => {
  try {
    const corte = await corteAbierto(req.user!.id);
    res.json(corte);
  } catch (e) { next(e); }
});

ventasRouter.post('/caja/abrir', requireRole('CAJERO', 'RECEPCION'), async (req, res, next) => {
  try {
    const { fondoApertura } = z.object({ fondoApertura: z.coerce.number().min(0).default(0) }).parse(req.body);
    const abierto = await corteAbierto(req.user!.id);
    if (abierto) return res.status(409).json({ error: 'Ya tienes una caja abierta' });
    const corte = await prisma.corteCaja.create({ data: { usuarioId: req.user!.id, fondoApertura } });
    res.status(201).json(corte);
  } catch (e) { next(e); }
});

ventasRouter.post('/caja/retiro', requireRole('CAJERO', 'RECEPCION'), async (req, res, next) => {
  try {
    const { monto } = z.object({ monto: z.coerce.number().positive() }).parse(req.body);
    const corte = await corteAbierto(req.user!.id);
    if (!corte) return res.status(409).json({ error: 'No hay caja abierta' });
    const upd = await prisma.corteCaja.update({ where: { id: corte.id }, data: { retiros: { increment: monto } } });
    res.json(upd);
  } catch (e) { next(e); }
});

ventasRouter.post('/caja/cerrar', requireRole('CAJERO', 'RECEPCION'), async (req, res, next) => {
  try {
    const { arqueo } = z.object({ arqueo: z.coerce.number().min(0) }).parse(req.body);
    const corte = await corteAbierto(req.user!.id);
    if (!corte) return res.status(409).json({ error: 'No hay caja abierta' });
    // Totales reales por forma de pago de las ventas ligadas al corte.
    const pagos = await prisma.pagoVenta.findMany({ where: { venta: { corteCajaId: corte.id } } });
    const totalEfectivo = r2(pagos.filter((p) => p.forma === 'EFECTIVO').reduce((s, p) => s + Number(p.monto), 0));
    const totalTarjeta = r2(pagos.filter((p) => p.forma === 'TARJETA').reduce((s, p) => s + Number(p.monto), 0));
    const esperadoEfectivo = r2(Number(corte.fondoApertura) + totalEfectivo - Number(corte.retiros));
    const diferencia = r2(arqueo - esperadoEfectivo);
    const cerrado = await prisma.corteCaja.update({
      where: { id: corte.id },
      data: { totalEfectivo, totalTarjeta, arqueo, diferencia, cerradoEn: new Date() },
    });
    res.json({ corte: cerrado, esperadoEfectivo });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// VENTAS
// ------------------------------------------------------------------

const itemSchema = z.object({
  productoId: z.coerce.number(),
  descripcion: z.string().optional(),
  cantidad: z.coerce.number().positive(),
  precioUnit: z.coerce.number().min(0),
  descuento: z.coerce.number().min(0).optional(),
  tasaIva: z.coerce.number().min(0).optional(),
});

const ventaSchema = z.object({
  tipo: z.enum(['TICKET', 'FACTURA', 'COTIZACION', 'APARTADO']).default('TICKET'),
  clienteId: z.coerce.number().optional(),
  cobrarIva: z.boolean().default(true),
  items: z.array(itemSchema).min(1),
  pagos: z.array(z.object({
    forma: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO']),
    monto: z.coerce.number().positive(),
    refPago: z.string().optional(),
  })).default([]),
});

ventasRouter.post('/', async (req, res, next) => {
  try {
    const body = ventaSchema.parse(req.body);

    // Resolver tasa de IVA faltante desde el producto.
    const productos = await prisma.producto.findMany({ where: { id: { in: body.items.map((i) => i.productoId) } } });
    const mapProd = new Map(productos.map((p) => [p.id, p]));
    const items: Required<Pick<ItemVenta, 'cantidad' | 'precioUnit'>> & any = body.items.map((it) => {
      const p = mapProd.get(it.productoId);
      if (!p) throw new Error(`Producto ${it.productoId} no existe`);
      // Si no se cobra IVA, la tasa de cada partida es 0.
      return { ...it, tasaIva: body.cobrarIva ? (it.tasaIva ?? Number(p.tasaIva)) : 0 };
    });

    const totales = calcularTotales(items);
    const pagado = r2(body.pagos.reduce((s, p) => s + p.monto, 0));

    // Reglas de pago por tipo de venta.
    const afectaStock = body.tipo === 'TICKET' || body.tipo === 'FACTURA';
    const esApartado = body.tipo === 'APARTADO';
    const esCotizacion = body.tipo === 'COTIZACION';
    if (afectaStock) {
      const soloCredito = body.pagos.length === 1 && body.pagos[0].forma === 'CREDITO';
      if (!soloCredito && pagado < totales.total) {
        return res.status(400).json({ error: `El pago (${pagado}) no cubre el total (${totales.total})` });
      }
    }

    const corte = await corteAbierto(req.user!.id);
    const prefijo = { TICKET: 'TK-', FACTURA: 'FA-', COTIZACION: 'COT-', APARTADO: 'AP-' }[body.tipo];
    const folio = await siguienteFolio('VENTA', prefijo);

    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.create({
        data: {
          folio,
          tipo: body.tipo,
          clienteId: body.clienteId,
          cajeroId: req.user!.id,
          corteCajaId: corte?.id,
          subtotal: totales.subtotal,
          impuestos: totales.impuestos,
          total: totales.total,
          detalles: {
            create: items.map((it: any, idx: number) => ({
              productoId: it.productoId,
              descripcion: it.descripcion ?? mapProd.get(it.productoId)!.nombre,
              cantidad: it.cantidad,
              precioUnit: it.precioUnit,
              descuento: it.descuento ?? 0,
              tasaIva: it.tasaIva,
              importe: r2(totales.detalles[idx].base + totales.detalles[idx].iva),
            })),
          },
          pagos: { create: body.pagos.map((p) => ({ forma: p.forma, monto: p.monto, refPago: p.refPago })) },
        },
        include: { detalles: true, pagos: true },
      });

      // Movimientos de inventario.
      if (afectaStock || esApartado) {
        for (const it of items as any[]) {
          await aplicarMovimiento(tx, {
            productoId: it.productoId,
            tipo: esApartado ? 'APARTADO' : 'SALIDA',
            cantidad: it.cantidad,
            motivo: `Venta ${folio}`,
            refTipo: 'VENTA',
            refId: String(v.id),
            usuarioId: req.user!.id,
          });
        }
      }

      // Venta a credito: incrementa el saldo del cliente.
      if (body.clienteId) {
        const saldoCredito = r2(totales.total - pagado);
        if (saldoCredito > 0 && !esCotizacion) {
          await tx.cliente.update({ where: { id: body.clienteId }, data: { saldo: { increment: saldoCredito } } });
        }
      }
      return v;
    });

    res.status(201).json(venta);
  } catch (e) { next(e); }
});

ventasRouter.get('/', async (req, res, next) => {
  try {
    const { tipo, clienteId, cajeroId, desde, hasta, folio } = req.query as Record<string, string>;
    const creadoEn = (desde || hasta) ? {
      gte: desde ? new Date(desde) : undefined,
      lte: hasta ? new Date(`${hasta}T23:59:59`) : undefined,
    } : undefined;
    const ventas = await prisma.venta.findMany({
      where: {
        tipo: tipo ? (tipo as any) : undefined,
        clienteId: clienteId ? Number(clienteId) : undefined,
        cajeroId: cajeroId ? Number(cajeroId) : undefined,
        folio: folio ? { contains: folio, mode: 'insensitive' } : undefined,
        creadoEn,
      },
      include: { cliente: { select: { nombre: true } }, cajero: { select: { id: true, nombre: true } } },
      orderBy: { creadoEn: 'desc' },
      take: 300,
    });
    res.json(ventas);
  } catch (e) { next(e); }
});

ventasRouter.get('/:id', async (req, res, next) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: Number(req.params.id) },
      include: { detalles: { include: { producto: true } }, pagos: true, cliente: true, cajero: { select: { nombre: true } } },
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(venta);
  } catch (e) { next(e); }
});

// Abono / anticipo a un apartado o cotizacion.
ventasRouter.post('/:id/pago', async (req, res, next) => {
  try {
    const { forma, monto, refPago } = z.object({
      forma: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO']),
      monto: z.coerce.number().positive(),
      refPago: z.string().optional(),
    }).parse(req.body);
    const pago = await prisma.pagoVenta.create({ data: { ventaId: Number(req.params.id), forma, monto, refPago } });
    res.status(201).json(pago);
  } catch (e) { next(e); }
});

// Cobro de una orden de trabajo terminada -> genera una venta ligada,
// desglosando cada refaccion como partida + la mano de obra / diagnostico.
ventasRouter.post('/orden/:ordenId', async (req, res, next) => {
  try {
    const ordenId = Number(req.params.ordenId);
    const orden = await prisma.ordenTrabajo.findUnique({
      where: { id: ordenId },
      include: { venta: true, consumos: { include: { producto: true } }, cliente: true, equipo: true },
    });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.venta) return res.status(409).json({ error: 'La orden ya tiene una venta' });

    const { forma, monto, refPago, cobrarIva } = z.object({
      forma: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO']).default('EFECTIVO'),
      monto: z.coerce.number().min(0).optional(),
      refPago: z.string().optional(),
      cobrarIva: z.boolean().default(true),
    }).parse(req.body);

    // Partidas: una por refaccion consumida + mano de obra (cotizacion) o diagnostico.
    const detalles: any[] = [];
    let subtotal = 0, impuestos = 0;
    for (const c of orden.consumos) {
      const iva = cobrarIva ? (Number(c.producto.tasaIva) || 16) : 0;
      const net = Number(c.cantidad) * Number(c.precioUnit);
      const ivaM = r2(net * iva / 100);
      subtotal += net; impuestos += ivaM;
      detalles.push({ productoId: c.productoId, descripcion: c.producto.nombre, cantidad: c.cantidad, precioUnit: c.precioUnit, tasaIva: iva, importe: r2(net + ivaM) });
    }
    const servId = await servicioReparacionId();
    const tIva = cobrarIva ? 16 : 0;
    const labor = Number(orden.cotizacionTotal);
    const diag = Number(orden.costoDiagnostico);
    if (labor > 0) {
      const ivaM = r2(labor * tIva / 100); subtotal += labor; impuestos += ivaM;
      detalles.push({ productoId: servId, descripcion: `Mano de obra y servicio (orden ${orden.folio})`, cantidad: 1, precioUnit: labor, tasaIva: tIva, importe: r2(labor + ivaM) });
    } else if (diag > 0) {
      const ivaM = r2(diag * tIva / 100); subtotal += diag; impuestos += ivaM;
      detalles.push({ productoId: servId, descripcion: `Diagnostico (orden ${orden.folio})`, cantidad: 1, precioUnit: diag, tasaIva: tIva, importe: r2(diag + ivaM) });
    }
    subtotal = r2(subtotal); impuestos = r2(impuestos);
    const total = r2(subtotal + impuestos);
    if (total <= 0) return res.status(400).json({ error: 'No hay importe a cobrar: captura la cotizacion o consume refacciones.' });

    const corte = await corteAbierto(req.user!.id);
    const folio = await siguienteFolio('VENTA', 'TK-');
    const venta = await prisma.venta.create({
      data: {
        folio, tipo: 'TICKET', clienteId: orden.clienteId, cajeroId: req.user!.id, corteCajaId: corte?.id,
        ordenTrabajoId: ordenId, subtotal, impuestos, total,
        detalles: { create: detalles },
        pagos: { create: [{ forma, monto: monto ?? total, refPago }] },
      },
      include: { detalles: true, pagos: true },
    });
    await notificar({ evento: 'ticket', orden, venta });
    res.status(201).json(venta);
  } catch (e) { next(e); }
});

// Devolucion / nota de credito ligada a una venta original (reingresa stock).
ventasRouter.post('/:id/devolucion', requireRole('CAJERO', 'ADMINISTRADOR'), async (req, res, next) => {
  try {
    const origenId = Number(req.params.id);
    const { motivo } = z.object({ motivo: z.string().optional() }).parse(req.body);
    const origen = await prisma.venta.findUnique({ where: { id: origenId }, include: { detalles: true } });
    if (!origen) return res.status(404).json({ error: 'Venta no encontrada' });

    const folio = await siguienteFolio('VENTA', 'NC-');
    const nota = await prisma.$transaction(async (tx) => {
      const nc = await tx.venta.create({
        data: {
          folio, tipo: 'NOTA_CREDITO', clienteId: origen.clienteId, cajeroId: req.user!.id,
          ventaOrigenId: origenId, motivo,
          subtotal: r2(-Number(origen.subtotal)), impuestos: r2(-Number(origen.impuestos)), total: r2(-Number(origen.total)),
          detalles: { create: origen.detalles.map((d) => ({
            productoId: d.productoId, descripcion: `Devolucion: ${d.descripcion}`,
            cantidad: d.cantidad, precioUnit: d.precioUnit, descuento: d.descuento, tasaIva: d.tasaIva,
            importe: r2(-Number(d.importe)),
          })) },
        },
        include: { detalles: true },
      });
      for (const d of origen.detalles) {
        await aplicarMovimiento(tx, {
          productoId: d.productoId, tipo: 'ENTRADA', cantidad: Number(d.cantidad),
          motivo: `Devolucion ${folio}`, refTipo: 'VENTA', refId: String(nc.id), usuarioId: req.user!.id,
        });
      }
      return nc;
    });
    res.status(201).json(nota);
  } catch (e) { next(e); }
});

// Timbrado CFDI 4.0 (requiere PAC configurado).
ventasRouter.post('/:id/timbrar', async (_req, res) => {
  if (!process.env.PAC_URL) {
    return res.status(501).json({ error: 'Timbrado CFDI pendiente: configura el PAC (PAC_URL/PAC_USER/PAC_PASS) y los certificados de sello digital.' });
  }
  // TODO: integrar con el PAC y guardar cfdiUuid.
  res.status(501).json({ error: 'Integracion con PAC por implementar' });
});

// Producto "servicio de reparacion" usado al cobrar ordenes.
async function servicioReparacionId(): Promise<number> {
  const existente = await prisma.producto.findUnique({ where: { sku: 'SERV-REP' } });
  if (existente) return existente.id;
  const creado = await prisma.producto.create({
    data: { sku: 'SERV-REP', nombre: 'Servicio de reparacion', tipo: 'SERVICIO', controlStock: false, tasaIva: 16 },
  });
  return creado.id;
}

export default ventasRouter;
