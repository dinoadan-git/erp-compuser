import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Modulo "catalogo": andamiaje listo. Implementar endpoints segun el documento.
export const catalogoRouter = Router();
catalogoRouter.use(requireAuth);

catalogoRouter.get('/', (_req, res) => {
  res.json({ modulo: 'catalogo', estado: 'pendiente', mensaje: 'Endpoints por implementar' });
});

export default catalogoRouter;
