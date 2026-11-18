import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const catalogoRouter = Router();
catalogoRouter.use(requireAuth);

// Listado/busqueda de productos con precio publico y existencia (usado por el POS).
catalogoRouter.get('/productos', async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
        ...(q ? { OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { codigoBarras: { equals: q } },
        ] } : {}),
      },
      include: { precios: true, existencia: true, categoria: true, marca: true },
      orderBy: { nombre: 'asc' },
      take: 50,
    });
    const salida = productos.map((p) => ({
      id: p.id, sku: p.sku, nombre: p.nombre, tipo: p.tipo, tasaIva: p.tasaIva,
      precioPublico: p.precios.find((x) => x.lista === 'PUBLICO')?.precio ?? 0,
      disponible: p.existencia?.disponible ?? 0,
    }));
    res.json(salida);
  } catch (e) { next(e); }
});

const productoSchema = z.object({
  tipo: z.enum(['CONSUMIBLE', 'REFACCION', 'EQUIPO_COMPUTO', 'SERVICIO']),
  nombre: z.string().min(1),
  sku: z.string().optional(),
  codigoBarras: z.string().optional(),
  tasaIva: z.coerce.number().optional(),
  precioPublico: z.coerce.number().optional(),
});

catalogoRouter.post('/productos', async (req, res, next) => {
  try {
    const d = productoSchema.parse(req.body);
    const producto = await prisma.producto.create({
      data: {
        tipo: d.tipo, nombre: d.nombre, sku: d.sku, codigoBarras: d.codigoBarras,
        tasaIva: d.tasaIva ?? 16,
        controlStock: d.tipo !== 'SERVICIO',
        precios: d.precioPublico !== undefined ? { create: [{ lista: 'PUBLICO', precio: d.precioPublico }] } : undefined,
        existencia: d.tipo !== 'SERVICIO' ? { create: {} } : undefined,
      },
    });
    res.status(201).json(producto);
  } catch (e) { next(e); }
});

export default catalogoRouter;
