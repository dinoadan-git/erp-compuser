import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const catalogoRouter = Router();
catalogoRouter.use(requireAuth);

const GESTION = requireRole('COMPRAS_ALMACEN', 'ADMINISTRADOR');

// ==================================================================
// CATEGORIAS
// ==================================================================
catalogoRouter.get('/categorias', async (_req, res, next) => {
  try { res.json(await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } })); } catch (e) { next(e); }
});
catalogoRouter.post('/categorias', GESTION, async (req, res, next) => {
  try {
    const { nombre } = z.object({ nombre: z.string().min(1) }).parse(req.body);
    res.status(201).json(await prisma.categoria.create({ data: { nombre } }));
  } catch (e) { next(e); }
});
catalogoRouter.put('/categorias/:id', GESTION, async (req, res, next) => {
  try {
    const { nombre } = z.object({ nombre: z.string().min(1) }).parse(req.body);
    res.json(await prisma.categoria.update({ where: { id: Number(req.params.id) }, data: { nombre } }));
  } catch (e) { next(e); }
});

// ==================================================================
// MARCAS
// ==================================================================
catalogoRouter.get('/marcas', async (_req, res, next) => {
  try { res.json(await prisma.marca.findMany({ orderBy: { nombre: 'asc' } })); } catch (e) { next(e); }
});
catalogoRouter.post('/marcas', GESTION, async (req, res, next) => {
  try {
    const { nombre } = z.object({ nombre: z.string().min(1) }).parse(req.body);
    res.status(201).json(await prisma.marca.create({ data: { nombre } }));
  } catch (e) { next(e); }
});
catalogoRouter.put('/marcas/:id', GESTION, async (req, res, next) => {
  try {
    const { nombre } = z.object({ nombre: z.string().min(1) }).parse(req.body);
    res.json(await prisma.marca.update({ where: { id: Number(req.params.id) }, data: { nombre } }));
  } catch (e) { next(e); }
});

// ==================================================================
// PRODUCTOS
// ==================================================================

// Listado/busqueda (shape consumido por el POS: precioPublico + disponible).
catalogoRouter.get('/productos', async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const soloTienda = req.query.tienda === 'true';
    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
        ...(soloTienda ? { publicarEnTienda: true } : {}),
        ...(q ? { OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { codigoBarras: { equals: q } },
        ] } : {}),
      },
      include: { precios: true, existencia: true, categoria: true, marca: true },
      orderBy: { nombre: 'asc' }, take: 100,
    });
    res.json(productos.map((p) => ({
      id: p.id, sku: p.sku, nombre: p.nombre, tipo: p.tipo, tasaIva: p.tasaIva,
      categoria: p.categoria?.nombre ?? null, marca: p.marca?.nombre ?? null,
      precioPublico: p.precios.find((x) => x.lista === 'PUBLICO')?.precio ?? 0,
      disponible: p.existencia?.disponible ?? 0,
      publicarEnTienda: p.publicarEnTienda,
    })));
  } catch (e) { next(e); }
});

catalogoRouter.get('/productos/:id', async (req, res, next) => {
  try {
    const p = await prisma.producto.findUnique({
      where: { id: Number(req.params.id) },
      include: { precios: true, existencia: true, categoria: true, marca: true, compatibilidades: true },
    });
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(p);
  } catch (e) { next(e); }
});

const productoSchema = z.object({
  tipo: z.enum(['CONSUMIBLE', 'REFACCION', 'EQUIPO_COMPUTO', 'SERVICIO']),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  sku: z.string().optional(),
  codigoBarras: z.string().optional(),
  categoriaId: z.coerce.number().optional(),
  marcaId: z.coerce.number().optional(),
  claveProdServSat: z.string().optional(),
  claveUnidadSat: z.string().optional(),
  tasaIva: z.coerce.number().min(0).optional(),
  controlStock: z.boolean().optional(),
  controlSerie: z.boolean().optional(),
  controlLote: z.boolean().optional(),
  fotoUrl: z.string().optional(),
  publicarEnTienda: z.boolean().optional(),
  // precios por lista
  precios: z.array(z.object({
    lista: z.enum(['PUBLICO', 'EMPRESA', 'MAYOREO']),
    precio: z.coerce.number().min(0),
  })).optional(),
});

catalogoRouter.post('/productos', GESTION, async (req, res, next) => {
  try {
    const d = productoSchema.parse(req.body);
    const esServicio = d.tipo === 'SERVICIO';
    const controlStock = d.controlStock ?? !esServicio;
    const producto = await prisma.producto.create({
      data: {
        tipo: d.tipo, nombre: d.nombre, descripcion: d.descripcion, sku: d.sku, codigoBarras: d.codigoBarras,
        categoriaId: d.categoriaId, marcaId: d.marcaId,
        claveProdServSat: d.claveProdServSat, claveUnidadSat: d.claveUnidadSat,
        tasaIva: d.tasaIva ?? 16, controlStock, controlSerie: d.controlSerie ?? false, controlLote: d.controlLote ?? false,
        fotoUrl: d.fotoUrl, publicarEnTienda: d.publicarEnTienda ?? false,
        precios: d.precios?.length ? { create: d.precios } : undefined,
        existencia: controlStock ? { create: {} } : undefined,
      },
      include: { precios: true },
    });
    res.status(201).json(producto);
  } catch (e) { next(e); }
});

catalogoRouter.put('/productos/:id', GESTION, async (req, res, next) => {
  try {
    const d = productoSchema.partial().parse(req.body);
    const { precios, ...campos } = d;
    const producto = await prisma.producto.update({ where: { id: Number(req.params.id) }, data: campos });
    if (precios?.length) {
      for (const p of precios) {
        await prisma.precioProducto.upsert({
          where: { productoId_lista: { productoId: producto.id, lista: p.lista } },
          create: { productoId: producto.id, lista: p.lista, precio: p.precio },
          update: { precio: p.precio },
        });
      }
    }
    res.json(await prisma.producto.findUnique({ where: { id: producto.id }, include: { precios: true } }));
  } catch (e) { next(e); }
});

// Activar/desactivar (no se borra para no romper historicos).
catalogoRouter.patch('/productos/:id/activo', GESTION, async (req, res, next) => {
  try {
    const { activo } = z.object({ activo: z.boolean() }).parse(req.body);
    res.json(await prisma.producto.update({ where: { id: Number(req.params.id) }, data: { activo } }));
  } catch (e) { next(e); }
});

// ==================================================================
// COMPATIBILIDADES (refaccion/consumible <-> modelo de equipo)
// ==================================================================
catalogoRouter.post('/productos/:id/compatibilidades', GESTION, async (req, res, next) => {
  try {
    const { marca, modelo } = z.object({ marca: z.string().min(1), modelo: z.string().min(1) }).parse(req.body);
    const comp = await prisma.compatibilidadRefaccion.create({ data: { refaccionId: Number(req.params.id), marca, modelo } });
    res.status(201).json(comp);
  } catch (e) { next(e); }
});
catalogoRouter.delete('/compatibilidades/:compatId', GESTION, async (req, res, next) => {
  try {
    await prisma.compatibilidadRefaccion.delete({ where: { id: Number(req.params.compatId) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Buscar refacciones compatibles con un modelo de equipo.
catalogoRouter.get('/compatibles', async (req, res, next) => {
  try {
    const { marca, modelo } = req.query as { marca?: string; modelo?: string };
    const comps = await prisma.compatibilidadRefaccion.findMany({
      where: { marca: marca ? { equals: marca, mode: 'insensitive' } : undefined, modelo: modelo ? { equals: modelo, mode: 'insensitive' } : undefined },
      include: { refaccion: { include: { existencia: true, precios: true } } },
    });
    res.json(comps.map((c) => ({
      compatibilidadId: c.id, marca: c.marca, modelo: c.modelo,
      producto: { id: c.refaccion.id, nombre: c.refaccion.nombre, sku: c.refaccion.sku, disponible: c.refaccion.existencia?.disponible ?? 0 },
    })));
  } catch (e) { next(e); }
});

export default catalogoRouter;
