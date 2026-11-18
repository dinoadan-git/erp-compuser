import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Modulo "config": andamiaje listo. Implementar endpoints segun el documento.
export const configRouter = Router();
configRouter.use(requireAuth);

configRouter.get('/', (_req, res) => {
  res.json({ modulo: 'config', estado: 'pendiente', mensaje: 'Endpoints por implementar' });
});

export default configRouter;
