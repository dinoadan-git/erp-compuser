import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { RolUsuario } from '@prisma/client';

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  roles: RolUsuario[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

// Requiere que el usuario tenga al menos uno de los roles indicados.
export function requireRole(...roles: RolUsuario[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    const ok = req.user.roles.includes('ADMINISTRADOR') ||
      req.user.roles.some((r) => roles.includes(r));
    if (!ok) return res.status(403).json({ error: 'Sin permiso para esta accion' });
    next();
  };
}
