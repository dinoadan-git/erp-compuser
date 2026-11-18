import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Modulo "inventario": andamiaje listo. Implementar endpoints segun el documento.
export const inventarioRouter = Router();
inventarioRouter.use(requireAuth);

inventarioRouter.get('/', (_req, res) => {
  res.json({ modulo: 'inventario', estado: 'pendiente', mensaje: 'Endpoints por implementar' });
});

export default inventarioRouter;
