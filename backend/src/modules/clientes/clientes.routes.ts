import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

const clienteSchema = z.object({
  tipo: z.enum(['MOSTRADOR', 'EMPRESA', 'GARANTIA_EPSON']).default('MOSTRADOR'),
  personaFiscal: z.enum(['FISICA', 'MORAL']).default('FISICA'),
  nombre: z.string().min(1),
  rfc: z.string().optional(),
  regimenFiscal: z.string().optional(),
  usoCfdi: z.string().optional(),
  cpFiscal: z.string().optional(),
  creditoAutorizado: z.coerce.number().optional(),
  notas: z.string().optional(),
});

clientesRouter.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const clientes = await prisma.cliente.findMany({
      where: q ? { OR: [{ nombre: { contains: q, mode: 'insensitive' } }, { rfc: { contains: q, mode: 'insensitive' } }] } : undefined,
      orderBy: { nombre: 'asc' },
      take: 100,
    });
    res.json(clientes);
  } catch (e) { next(e); }
});

clientesRouter.get('/:id', async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(req.params.id) },
      include: { contactos: true, direcciones: true, equipos: true, ordenes: { orderBy: { recibidaEn: 'desc' }, take: 20 } },
    });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (e) { next(e); }
});

clientesRouter.post('/', async (req, res, next) => {
  try {
    const data = clienteSchema.parse(req.body);
    const cliente = await prisma.cliente.create({ data });
    res.status(201).json(cliente);
  } catch (e) { next(e); }
});

clientesRouter.put('/:id', async (req, res, next) => {
  try {
    const data = clienteSchema.partial().parse(req.body);
    const cliente = await prisma.cliente.update({ where: { id: Number(req.params.id) }, data });
    res.json(cliente);
  } catch (e) { next(e); }
});

export default clientesRouter;
