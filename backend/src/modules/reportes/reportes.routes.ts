import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { r2 } from '../../lib/inventario.js';

export const reportesRouter = Router();
reportesRouter.use(requireAuth);

const VENTAS_REALES = ['TICKET', 'FACTURA', 'NOTA_CREDITO'] as const;

// Rango de fechas: por defecto, del inicio del mes actual a ahora.
function rango(req: { query: Record<string, unknown> }) {
  const hasta = req.query.hasta ? new Date(String(req.query.hasta)) : new Date();
  const desde = req.query.desde
    ? new Date(String(req.query.desde))
    : new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  return { desde, hasta };
}

// Envia filas como CSV si se pide ?formato=csv (compatible con Excel).
function talVezCsv(res: Response, formato: unknown, nombre: string, columnas: string[], filas: (string | number)[][]) {
  if (formato !== 'csv') return false;
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columnas.join(','), ...filas.map((f) => f.map(esc).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.csv"`);
  res.send('﻿' + csv); // BOM para acentos en Excel
  return true;
}

// ------------------------------------------------------------------
// TABLERO / KPIs
// ------------------------------------------------------------------
reportesRouter.get('/dashboard', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const ventas = await prisma.venta.findMany({
      where: { tipo: { in: [...VENTAS_REALES] }, creadoEn: { gte: desde, lte: hasta } },
      select: { total: true, tipo: true },
    });
    const ingresos = r2(ventas.reduce((s, v) => s + Number(v.total), 0));
    const numVentas = ventas.filter((v) => v.tipo !== 'NOTA_CREDITO').length;

    const gastos = await prisma.gasto.aggregate({ _sum: { monto: true }, where: { fecha: { gte: desde, lte: hasta } } });
    const totalGastos = r2(Number(gastos._sum.monto ?? 0));

    const ordenesActivas = await prisma.ordenTrabajo.count({ where: { estatus: { notIn: ['ENTREGADO', 'CANCELADO', 'ABANDONO'] } } });

    const existencias = await prisma.existencia.findMany({ include: { producto: { select: { costoPromedio: true } } } });
    const inventarioValorizado = r2(existencias.reduce((s, e) => s + Number(e.disponible) * Number(e.producto.costoPromedio), 0));

    const porPagar = r2(Number((await prisma.proveedor.aggregate({ _sum: { saldo: true } }))._sum.saldo ?? 0));
    const porCobrar = r2(Number((await prisma.cliente.aggregate({ _sum: { saldo: true } }))._sum.saldo ?? 0));

    res.json({
      periodo: { desde, hasta },
      ingresos, numVentas, ticketPromedio: numVentas ? r2(ingresos / numVentas) : 0,
      gastos: totalGastos, utilidadOperativa: r2(ingresos - totalGastos),
      ordenesActivas, inventarioValorizado, cuentasPorPagar: porPagar, cuentasPorCobrar: porCobrar,
    });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// ORDENES POR ESTATUS
// ------------------------------------------------------------------
reportesRouter.get('/ordenes-por-estatus', async (_req, res, next) => {
  try {
    const grupos = await prisma.ordenTrabajo.groupBy({ by: ['estatus'], _count: { _all: true } });
    res.json(grupos.map((g) => ({ estatus: g.estatus, total: g._count._all })));
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// PRODUCTIVIDAD POR TECNICO + TIEMPO/SLA
// ------------------------------------------------------------------
reportesRouter.get('/productividad-tecnicos', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const ordenes = await prisma.ordenTrabajo.findMany({
      where: { estatus: 'ENTREGADO', entregadaEn: { gte: desde, lte: hasta } },
      select: { tecnicoId: true, recibidaEn: true, entregadaEn: true, prometidaEn: true, tecnico: { select: { nombre: true } } },
    });
    const map = new Map<string, { nombre: string; entregadas: number; horasTotal: number; enTiempo: number; conPromesa: number }>();
    for (const o of ordenes) {
      const key = String(o.tecnicoId ?? 'sin');
      const nombre = o.tecnico?.nombre ?? 'Sin asignar';
      const g = map.get(key) ?? { nombre, entregadas: 0, horasTotal: 0, enTiempo: 0, conPromesa: 0 };
      g.entregadas++;
      if (o.entregadaEn) g.horasTotal += (o.entregadaEn.getTime() - o.recibidaEn.getTime()) / 36e5;
      if (o.prometidaEn && o.entregadaEn) { g.conPromesa++; if (o.entregadaEn <= o.prometidaEn) g.enTiempo++; }
      map.set(key, g);
    }
    const filas = [...map.values()].map((g) => ({
      tecnico: g.nombre, entregadas: g.entregadas,
      horasPromedio: g.entregadas ? r2(g.horasTotal / g.entregadas) : 0,
      cumplimientoSla: g.conPromesa ? r2((g.enTiempo / g.conPromesa) * 100) : null,
    }));
    if (talVezCsv(res, req.query.formato, 'productividad-tecnicos',
      ['Tecnico', 'Entregadas', 'Horas promedio', 'Cumplimiento SLA %'],
      filas.map((f) => [f.tecnico, f.entregadas, f.horasPromedio, f.cumplimientoSla ?? '']))) return;
    res.json(filas);
  } catch (e) { next(e); }
});

// Tasa de aprobacion de presupuestos (ordenes que pasaron de esperando autorizacion a autorizadas).
reportesRouter.get('/aprobacion-presupuestos', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const cotizadas = await prisma.ordenTrabajo.count({ where: { cotizacionTotal: { gt: 0 }, recibidaEn: { gte: desde, lte: hasta } } });
    const autorizadas = await prisma.ordenTrabajo.count({ where: { autorizadaEn: { not: null }, recibidaEn: { gte: desde, lte: hasta } } });
    res.json({ cotizadas, autorizadas, tasaAprobacion: cotizadas ? r2((autorizadas / cotizadas) * 100) : 0 });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// VENTAS: UTILIDAD Y MARGEN POR PRODUCTO
// ------------------------------------------------------------------
reportesRouter.get('/ventas-utilidad', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const detalles = await prisma.detalleVenta.findMany({
      where: { venta: { tipo: { in: [...VENTAS_REALES] }, creadoEn: { gte: desde, lte: hasta } } },
      include: { producto: { select: { nombre: true, sku: true, costoPromedio: true } }, venta: { select: { tipo: true } } },
    });
    const map = new Map<number, { nombre: string; sku: string | null; cantidad: number; ingreso: number; costo: number }>();
    for (const d of detalles) {
      const factor = d.venta.tipo === 'NOTA_CREDITO' ? -1 : 1;
      const ingresoNeto = (Number(d.cantidad) * Number(d.precioUnit) - Number(d.descuento)) * factor;
      const costo = Number(d.cantidad) * Number(d.producto.costoPromedio) * factor;
      const g = map.get(d.productoId) ?? { nombre: d.producto.nombre, sku: d.producto.sku, cantidad: 0, ingreso: 0, costo: 0 };
      g.cantidad += Number(d.cantidad) * factor;
      g.ingreso += ingresoNeto;
      g.costo += costo;
      map.set(d.productoId, g);
    }
    const filas = [...map.values()].map((g) => ({
      producto: g.nombre, sku: g.sku, cantidad: g.cantidad,
      ingreso: r2(g.ingreso), costo: r2(g.costo), utilidad: r2(g.ingreso - g.costo),
      margen: g.ingreso ? r2(((g.ingreso - g.costo) / g.ingreso) * 100) : 0,
    })).sort((a, b) => b.utilidad - a.utilidad);

    if (talVezCsv(res, req.query.formato, 'ventas-utilidad',
      ['Producto', 'SKU', 'Cantidad', 'Ingreso', 'Costo', 'Utilidad', 'Margen %'],
      filas.map((f) => [f.producto, f.sku ?? '', f.cantidad, f.ingreso, f.costo, f.utilidad, f.margen]))) return;

    const totales = filas.reduce((t, f) => ({ ingreso: t.ingreso + f.ingreso, costo: t.costo + f.costo, utilidad: t.utilidad + f.utilidad }), { ingreso: 0, costo: 0, utilidad: 0 });
    res.json({ filas, totales: { ingreso: r2(totales.ingreso), costo: r2(totales.costo), utilidad: r2(totales.utilidad) } });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// INVENTARIO VALORIZADO
// ------------------------------------------------------------------
reportesRouter.get('/inventario-valorizado', async (req, res, next) => {
  try {
    const existencias = await prisma.existencia.findMany({
      include: { producto: { select: { nombre: true, sku: true, costoPromedio: true } } },
      orderBy: { producto: { nombre: 'asc' } },
    });
    const filas = existencias
      .filter((e) => Number(e.disponible) !== 0)
      .map((e) => ({
        producto: e.producto.nombre, sku: e.producto.sku,
        disponible: Number(e.disponible), costoPromedio: Number(e.producto.costoPromedio),
        valor: r2(Number(e.disponible) * Number(e.producto.costoPromedio)),
      }));
    if (talVezCsv(res, req.query.formato, 'inventario-valorizado',
      ['Producto', 'SKU', 'Disponible', 'Costo promedio', 'Valor'],
      filas.map((f) => [f.producto, f.sku ?? '', f.disponible, f.costoPromedio, f.valor]))) return;
    res.json({ filas, valorTotal: r2(filas.reduce((s, f) => s + f.valor, 0)) });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// GASTOS VS INGRESOS
// ------------------------------------------------------------------
reportesRouter.get('/gastos-vs-ingresos', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const ventas = await prisma.venta.findMany({ where: { tipo: { in: [...VENTAS_REALES] }, creadoEn: { gte: desde, lte: hasta } }, select: { total: true } });
    const ingresos = r2(ventas.reduce((s, v) => s + Number(v.total), 0));
    const gastos = await prisma.gasto.groupBy({ by: ['categoria'], _sum: { monto: true }, where: { fecha: { gte: desde, lte: hasta } } });
    const porCategoria = gastos.map((g) => ({ categoria: g.categoria, total: r2(Number(g._sum.monto ?? 0)) }));
    const totalGastos = r2(porCategoria.reduce((s, g) => s + g.total, 0));
    res.json({ periodo: { desde, hasta }, ingresos, gastos: totalGastos, utilidad: r2(ingresos - totalGastos), porCategoria });
  } catch (e) { next(e); }
});

export default reportesRouter;
