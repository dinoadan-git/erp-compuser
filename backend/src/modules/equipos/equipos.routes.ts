import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const equiposRouter = Router();
equiposRouter.use(requireAuth);

const equipoSchema = z.object({
  clienteId: z.coerce.number(),
  tipo: z.string().min(1),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroSerie: z.string().optional(),
  accesorios: z.string().optional(),
});

// Buscar equipo por numero de serie ("Equipo encontrado. Datos cargados.")
equiposRouter.get('/buscar', async (req, res, next) => {
  try {
    const serie = (req.query.serie as string | undefined)?.trim();
    if (!serie) return res.json(null);
    const equipo = await prisma.equipo.findFirst({ where: { numeroSerie: serie }, include: { cliente: true } });
    res.json(equipo);
  } catch (e) { next(e); }
});

equiposRouter.post('/', async (req, res, next) => {
  try {
    const data = equipoSchema.parse(req.body);
    const equipo = await prisma.equipo.create({ data });
    res.status(201).json(equipo);
  } catch (e) { next(e); }
});

export default equiposRouter;
