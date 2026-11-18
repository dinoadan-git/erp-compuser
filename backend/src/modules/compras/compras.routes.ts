import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Modulo "compras": andamiaje listo. Implementar endpoints segun el documento.
export const comprasRouter = Router();
comprasRouter.use(requireAuth);

comprasRouter.get('/', (_req, res) => {
  res.json({ modulo: 'compras', estado: 'pendiente', mensaje: 'Endpoints por implementar' });
});

export default comprasRouter;
