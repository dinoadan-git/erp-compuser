import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.usuario.findUnique({ where: { email } });
    if (!user || !user.activo || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Credenciales incorrectas. Intentalo de nuevo.' });
    }
    const payload = { id: user.id, nombre: user.nombre, email: user.email, roles: user.roles };
    const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '8h' });
    res.json({ token, user: payload });
  } catch (e) {
    next(e);
  }
});

// Verificar PIN de 4 digitos de un colaborador (acciones sensibles).
const pinSchema = z.object({ pin: z.string().length(4) });
authRouter.post('/verify-pin', requireAuth, async (req, res, next) => {
  try {
    const { pin } = pinSchema.parse(req.body);
    const user = await prisma.usuario.findUnique({ where: { id: req.user!.id } });
    if (!user?.pinHash || !(await bcrypt.compare(pin, user.pinHash))) {
      return res.status(403).json({ error: 'PIN incorrecto para este colaborador.' });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
