import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const portalRouter = Router();

// Consulta publica del estatus de una orden por token QR o folio.
// Solo expone estados generales (no las notas internas del tecnico).
portalRouter.get('/estatus', async (req, res, next) => {
  try {
    const { token, folio } = req.query as { token?: string; folio?: string };
    if (!token && !folio) return res.status(400).json({ error: 'Indica token o folio' });
    const orden = await prisma.ordenTrabajo.findFirst({
      where: token ? { qrToken: token } : { folio },
      select: {
        folio: true, estatus: true, recibidaEn: true, prometidaEn: true, entregadaEn: true,
        equipo: { select: { tipo: true, marca: true, modelo: true } },
        bitacora: {
          where: { soloInterno: false },
          orderBy: { creadoEn: 'asc' },
          select: { estatus: true, nota: true, creadoEn: true },
        },
      },
    });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(orden);
  } catch (e) { next(e); }
});

export default portalRouter;
