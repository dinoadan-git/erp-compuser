import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Modulo "reportes": andamiaje listo. Implementar endpoints segun el documento.
export const reportesRouter = Router();
reportesRouter.use(requireAuth);

reportesRouter.get('/', (_req, res) => {
  res.json({ modulo: 'reportes', estado: 'pendiente', mensaje: 'Endpoints por implementar' });
});

export default reportesRouter;
