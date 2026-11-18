import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { r2 } from '../../lib/inventario.js';

export const gastosRouter = Router();
gastosRouter.use(requireAuth);

const ADMIN = requireRole('ADMINISTRADOR');

function rango(req: { query: Record<string, unknown> }) {
  const hasta = req.query.hasta ? new Date(String(req.query.hasta)) : new Date();
  const desde = req.query.desde ? new Date(String(req.query.desde)) : new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  return { desde, hasta };
}

// ------------------------------------------------------------------
// GASTOS
// ------------------------------------------------------------------

const gastoSchema = z.object({
  categoria: z.string().min(1), // renta, luz, nomina, viaticos, otros
  centroCosto: z.enum(['TALLER', 'MOSTRADOR', 'PROYECTOS']).default('TALLER'),
  descripcion: z.string().min(1),
  monto: z.coerce.number().positive(),
  comprobanteUrl: z.string().optional(),
  xmlUrl: z.string().optional(),
  esCajaChica: z.boolean().optional(),
  fecha: z.coerce.date().optional(),
});

gastosRouter.get('/', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const { categoria, centroCosto } = req.query;
    const gastos = await prisma.gasto.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
        categoria: categoria ? String(categoria) : undefined,
        centroCosto: centroCosto ? (centroCosto as any) : undefined,
      },
      orderBy: { fecha: 'desc' }, take: 300,
    });
    res.json(gastos);
  } catch (e) { next(e); }
});

gastosRouter.post('/', async (req, res, next) => {
  try {
    const d = gastoSchema.parse(req.body);
    const gasto = await prisma.$transaction(async (tx) => {
      const g = await tx.gasto.create({ data: d });
      // Si es de caja chica, descuenta del saldo del fondo.
      if (d.esCajaChica) {
        await tx.cajaChica.upsert({ where: { id: 1 }, create: { id: 1, saldo: 0, fondo: 0 }, update: {} });
        await tx.cajaChica.update({ where: { id: 1 }, data: { saldo: { decrement: d.monto } } });
      }
      return g;
    });
    res.status(201).json(gasto);
  } catch (e) { next(e); }
});

gastosRouter.put('/:id', async (req, res, next) => {
  try {
    const d = gastoSchema.partial().parse(req.body);
    const gasto = await prisma.gasto.update({ where: { id: Number(req.params.id) }, data: d });
    res.json(gasto);
  } catch (e) { next(e); }
});

gastosRouter.delete('/:id', ADMIN, async (req, res, next) => {
  try {
    await prisma.gasto.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Resumen por categoria y por centro de costo.
gastosRouter.get('/resumen', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const where = { fecha: { gte: desde, lte: hasta } };
    const [porCategoria, porCentro, total] = await Promise.all([
      prisma.gasto.groupBy({ by: ['categoria'], _sum: { monto: true }, where }),
      prisma.gasto.groupBy({ by: ['centroCosto'], _sum: { monto: true }, where }),
      prisma.gasto.aggregate({ _sum: { monto: true }, where }),
    ]);
    res.json({
      periodo: { desde, hasta },
      total: r2(Number(total._sum.monto ?? 0)),
      porCategoria: porCategoria.map((g) => ({ categoria: g.categoria, total: r2(Number(g._sum.monto ?? 0)) })),
      porCentroCosto: porCentro.map((g) => ({ centroCosto: g.centroCosto, total: r2(Number(g._sum.monto ?? 0)) })),
    });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// CAJA CHICA
// ------------------------------------------------------------------

gastosRouter.get('/caja-chica', async (_req, res, next) => {
  try {
    const caja = await prisma.cajaChica.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    const reposiciones = await prisma.reposicionCajaChica.findMany({ orderBy: { fecha: 'desc' }, take: 50 });
    res.json({ caja, reposiciones });
  } catch (e) { next(e); }
});

// Fijar el fondo fijo de la caja chica.
gastosRouter.put('/caja-chica/fondo', ADMIN, async (req, res, next) => {
  try {
    const { fondo } = z.object({ fondo: z.coerce.number().min(0) }).parse(req.body);
    const caja = await prisma.cajaChica.upsert({ where: { id: 1 }, create: { id: 1, fondo, saldo: fondo }, update: { fondo } });
    res.json(caja);
  } catch (e) { next(e); }
});

// Reposicion: devuelve el saldo al fondo (normalmente por el monto gastado).
gastosRouter.post('/caja-chica/reposicion', async (req, res, next) => {
  try {
    const { monto, nota } = z.object({ monto: z.coerce.number().positive(), nota: z.string().optional() }).parse(req.body);
    const resultado = await prisma.$transaction(async (tx) => {
      const rep = await tx.reposicionCajaChica.create({ data: { monto, nota } });
      const caja = await tx.cajaChica.upsert({ where: { id: 1 }, create: { id: 1, saldo: monto }, update: { saldo: { increment: monto } } });
      return { rep, caja };
    });
    res.status(201).json(resultado);
  } catch (e) { next(e); }
});

// ------------------------------------------------------------------
// NOMINA = % sobre lo cobrado en ordenes de trabajo del periodo
// ------------------------------------------------------------------

// Base: total cobrado (ventas ligadas a ordenes de trabajo entregadas en el
// periodo). La nomina es ese total * porcentaje. El porcentaje es configurable
// por quincena (lo define el usuario segun su regla de negocio).
async function calcularNomina(desde: Date, hasta: Date, porcentaje: number) {
  const ventas = await prisma.venta.findMany({
    where: {
      tipo: { in: ['TICKET', 'FACTURA'] },
      ordenTrabajoId: { not: null },
      creadoEn: { gte: desde, lte: hasta },
    },
    select: { total: true, ordenTrabajoId: true },
  });
  const base = r2(ventas.reduce((s, v) => s + Number(v.total), 0));
  const nomina = r2(base * (porcentaje / 100));
  return { base, porcentaje, nomina, ordenesCobradas: ventas.length };
}

gastosRouter.get('/nomina/calcular', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const porcentaje = Number(req.query.porcentaje ?? 0);
    res.json({ periodo: { desde, hasta }, ...(await calcularNomina(desde, hasta, porcentaje)) });
  } catch (e) { next(e); }
});

// Registra la nomina calculada como un gasto de categoria "nomina".
gastosRouter.post('/nomina', ADMIN, async (req, res, next) => {
  try {
    const { desde, hasta, porcentaje, descripcion } = z.object({
      desde: z.coerce.date(),
      hasta: z.coerce.date(),
      porcentaje: z.coerce.number().min(0).max(100),
      descripcion: z.string().optional(),
    }).parse(req.body);
    const calc = await calcularNomina(desde, hasta, porcentaje);
    const gasto = await prisma.gasto.create({
      data: {
        categoria: 'nomina', centroCosto: 'TALLER',
        descripcion: descripcion ?? `Nomina quincena ${desde.toISOString().slice(0, 10)} a ${hasta.toISOString().slice(0, 10)} (${porcentaje}%)`,
        monto: calc.nomina, fecha: hasta,
      },
    });
    res.status(201).json({ gasto, calculo: calc });
  } catch (e) { next(e); }
});

export default gastosRouter;
