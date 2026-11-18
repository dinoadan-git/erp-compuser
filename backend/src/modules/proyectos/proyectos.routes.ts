import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Modulo "proyectos": andamiaje listo. Implementar endpoints segun el documento.
export const proyectosRouter = Router();
proyectosRouter.use(requireAuth);

proyectosRouter.get('/', (_req, res) => {
  res.json({ modulo: 'proyectos', estado: 'pendiente', mensaje: 'Endpoints por implementar' });
});

export default proyectosRouter;
