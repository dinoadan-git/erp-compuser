import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Modulo "gastos": andamiaje listo. Implementar endpoints segun el documento.
export const gastosRouter = Router();
gastosRouter.use(requireAuth);

gastosRouter.get('/', (_req, res) => {
  res.json({ modulo: 'gastos', estado: 'pendiente', mensaje: 'Endpoints por implementar' });
});

export default gastosRouter;
