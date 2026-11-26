import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { r2 } from '../../lib/inventario.js';

export const gastosRouter = Router();
gastosRouter.use(requireAuth);

const ADMIN = requireRole('ADMINISTRADOR');

function rango(req: { query: Record<string, unknown> }) {
  // `hasta` incluye todo el día (fin de día) para no excluir registros de hoy.
  const hasta = req.query.hasta ? new Date(`${String(req.query.hasta)}T23:59:59.999`) : new Date();
  const desde = req.query.desde ? new Date(`${String(req.query.desde)}T00:00:00`) : new Date(hasta.getFullYear(), hasta.getMonth(), 1);
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
    const { categoria, centroCosto, q } = req.query;
    const texto = q ? String(q).trim() : '';
    const gastos = await prisma.gasto.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
        categoria: categoria ? String(categoria) : undefined,
        centroCosto: centroCosto ? (centroCosto as any) : undefined,
        ...(texto ? { descripcion: { contains: texto, mode: 'insensitive' } } : {}),
      },
      orderBy: { fecha: 'desc' }, take: 500,
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
// NOMINA = % sobre el SERVICIO (mano de obra + diagnostico) de las ordenes
// cobradas en el periodo. NO incluye refacciones ni insumos de inventario.
// El porcentaje es un valor global configurable.
// ------------------------------------------------------------------

const NOMINA_KEY = 'nomina_porcentaje';

async function porcentajeConfigurado(): Promise<number> {
  const row = await prisma.configuracion.findUnique({ where: { clave: NOMINA_KEY } });
  const v = row?.valor as any;
  return typeof v === 'number' ? v : (v?.porcentaje ?? 0);
}

// Base por orden = mano de obra (cotizacion) o, si no hay cotizacion, el costo de
// diagnostico. Nunca incluye refacciones/consumos de inventario.
function servicioDeOrden(o: { cotizacionTotal: any; costoDiagnostico: any }): number {
  const labor = Number(o.cotizacionTotal) || 0;
  const diag = Number(o.costoDiagnostico) || 0;
  return labor > 0 ? labor : diag;
}

async function calcularNomina(desde: Date, hasta: Date, porcentaje: number) {
  // Ordenes cobradas en el periodo (venta ligada, por fecha de cobro).
  const ventas = await prisma.venta.findMany({
    where: {
      tipo: { in: ['TICKET', 'FACTURA'] },
      ordenTrabajoId: { not: null },
      creadoEn: { gte: desde, lte: hasta },
    },
    select: {
      folio: true, creadoEn: true,
      ordenTrabajo: { select: { folio: true, cotizacionTotal: true, costoDiagnostico: true, tecnico: { select: { id: true, nombre: true } } } },
    },
    orderBy: { creadoEn: 'asc' },
  });

  const porTec = new Map<number, { tecnicoId: number | null; nombre: string; baseServicio: number; ordenes: number }>();
  const detalle: any[] = [];
  let base = 0;
  for (const v of ventas) {
    const o = v.ordenTrabajo; if (!o) continue;
    const servicio = servicioDeOrden(o);
    base += servicio;
    const tec = o.tecnico; const key = tec?.id ?? 0;
    const cur = porTec.get(key) ?? { tecnicoId: tec?.id ?? null, nombre: tec?.nombre ?? 'Sin técnico asignado', baseServicio: 0, ordenes: 0 };
    cur.baseServicio += servicio; cur.ordenes += 1; porTec.set(key, cur);
    detalle.push({ ventaFolio: v.folio, ordenFolio: o.folio, fecha: v.creadoEn, tecnico: tec?.nombre ?? 'Sin técnico asignado', servicio: r2(servicio) });
  }
  base = r2(base);
  const nomina = r2(base * (porcentaje / 100));
  const porTecnico = [...porTec.values()].map((t) => ({
    ...t, baseServicio: r2(t.baseServicio), pago: r2(t.baseServicio * (porcentaje / 100)),
  }));
  return { base, porcentaje, nomina, ordenesCobradas: ventas.length, porTecnico, detalle };
}

// Porcentaje global configurado.
gastosRouter.get('/nomina/config', async (_req, res, next) => {
  try { res.json({ porcentaje: await porcentajeConfigurado() }); } catch (e) { next(e); }
});
gastosRouter.put('/nomina/config', ADMIN, async (req, res, next) => {
  try {
    const { porcentaje } = z.object({ porcentaje: z.coerce.number().min(0).max(100) }).parse(req.body);
    await prisma.configuracion.upsert({ where: { clave: NOMINA_KEY }, create: { clave: NOMINA_KEY, valor: { porcentaje } }, update: { valor: { porcentaje } } });
    res.json({ porcentaje });
  } catch (e) { next(e); }
});

gastosRouter.get('/nomina/calcular', async (req, res, next) => {
  try {
    const { desde, hasta } = rango(req);
    const porcentaje = req.query.porcentaje != null ? Number(req.query.porcentaje) : await porcentajeConfigurado();
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
