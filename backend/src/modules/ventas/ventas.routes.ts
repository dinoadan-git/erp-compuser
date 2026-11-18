import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Modulo "ventas": andamiaje listo. Implementar endpoints segun el documento.
export const ventasRouter = Router();
ventasRouter.use(requireAuth);

ventasRouter.get('/', (_req, res) => {
  res.json({ modulo: 'ventas', estado: 'pendiente', mensaje: 'Endpoints por implementar' });
});

export default ventasRouter;
