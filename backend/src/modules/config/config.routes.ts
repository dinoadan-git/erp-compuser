import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { auditar } from '../../lib/auditoria.js';

export const configRouter = Router();
configRouter.use(requireAuth);

const ADMIN = requireRole('ADMINISTRADOR');
const ROLES = ['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'CAJERO', 'COMPRAS_ALMACEN'] as const;

// ==================================================================
// EMPRESA (datos, logo, fiscales, politicas)
// ==================================================================
configRouter.get('/empresa', async (_req, res, next) => {
  try {
    const empresa = await prisma.empresa.upsert({ where: { id: 1 }, create: { id: 1, nombre: 'Mi empresa' }, update: {} });
    res.json(empresa);
  } catch (e) { next(e); }
});

configRouter.put('/empresa', ADMIN, async (req, res, next) => {
  try {
    const d = z.object({
      nombre: z.string().min(1).optional(),
      rfc: z.string().optional(), regimenFiscal: z.string().optional(), cpFiscal: z.string().optional(),
      logoUrl: z.string().optional(), direccion: z.string().optional(), telefono: z.string().optional(),
      telefono2: z.string().optional(), whatsapp: z.string().optional(),
      email: z.string().optional(), sitioWeb: z.string().optional(),
      facebook: z.string().optional(), instagram: z.string().optional(),
      diasAbandono: z.coerce.number().min(0).optional(),
    }).parse(req.body);
    const empresa = await prisma.empresa.upsert({ where: { id: 1 }, create: { id: 1, nombre: d.nombre ?? 'Mi empresa', ...d }, update: d });
    await auditar(req.user!.id, 'actualizar', 'Empresa', 1, d);
    res.json(empresa);
  } catch (e) { next(e); }
});

// ==================================================================
// USUARIOS, ROLES Y PERMISOS
// ==================================================================
configRouter.get('/usuarios', ADMIN, async (_req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nombre: true, email: true, roles: true, activo: true, creadoEn: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(usuarios);
  } catch (e) { next(e); }
});

const usuarioSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  pin: z.string().length(4).optional(),
  roles: z.array(z.enum(ROLES)).min(1),
});

configRouter.post('/usuarios', ADMIN, async (req, res, next) => {
  try {
    const d = usuarioSchema.parse(req.body);
    const usuario = await prisma.usuario.create({
      data: {
        nombre: d.nombre, email: d.email, roles: d.roles,
        passwordHash: await bcrypt.hash(d.password, 10),
        pinHash: d.pin ? await bcrypt.hash(d.pin, 10) : null,
      },
      select: { id: true, nombre: true, email: true, roles: true, activo: true },
    });
    await auditar(req.user!.id, 'crear', 'Usuario', usuario.id, { email: d.email, roles: d.roles });
    res.status(201).json(usuario);
  } catch (e) { next(e); }
});

configRouter.put('/usuarios/:id', ADMIN, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const d = z.object({
      nombre: z.string().min(1).optional(),
      roles: z.array(z.enum(ROLES)).min(1).optional(),
      activo: z.boolean().optional(),
      password: z.string().min(6).optional(),
      pin: z.string().length(4).optional(),
    }).parse(req.body);
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        nombre: d.nombre, roles: d.roles, activo: d.activo,
        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
        ...(d.pin ? { pinHash: await bcrypt.hash(d.pin, 10) } : {}),
      },
      select: { id: true, nombre: true, email: true, roles: true, activo: true },
    });
    await auditar(req.user!.id, 'actualizar', 'Usuario', id, { roles: d.roles, activo: d.activo, passwordCambiada: !!d.password });
    res.json(usuario);
  } catch (e) { next(e); }
});

// ==================================================================
// PLANTILLAS DE MENSAJES (WhatsApp / correo)
// ==================================================================
configRouter.get('/plantillas', async (_req, res, next) => {
  try { res.json(await prisma.plantillaMensaje.findMany({ orderBy: { clave: 'asc' } })); } catch (e) { next(e); }
});

configRouter.post('/plantillas', ADMIN, async (req, res, next) => {
  try {
    const d = z.object({
      clave: z.string().min(1), canal: z.enum(['WHATSAPP', 'EMAIL']),
      asunto: z.string().optional(), cuerpo: z.string().min(1), activo: z.boolean().optional(),
    }).parse(req.body);
    const plantilla = await prisma.plantillaMensaje.upsert({
      where: { clave: d.clave },
      create: d,
      update: { canal: d.canal, asunto: d.asunto, cuerpo: d.cuerpo, activo: d.activo ?? true },
    });
    res.status(201).json(plantilla);
  } catch (e) { next(e); }
});

// ==================================================================
// SERIES Y FOLIOS (contadores)
// ==================================================================
configRouter.get('/folios', ADMIN, async (_req, res, next) => {
  try { res.json(await prisma.contador.findMany()); } catch (e) { next(e); }
});

configRouter.put('/folios/:clave', ADMIN, async (req, res, next) => {
  try {
    const { valor } = z.object({ valor: z.coerce.number().int().min(0) }).parse(req.body);
    const c = await prisma.contador.upsert({ where: { clave: req.params.clave }, create: { clave: req.params.clave, valor }, update: { valor } });
    await auditar(req.user!.id, 'ajustar-folio', 'Contador', req.params.clave, { valor });
    res.json(c);
  } catch (e) { next(e); }
});

// ==================================================================
// PARAMETROS GENERICOS (checklist de recepcion, formas de pago, impuestos,
// politicas de garantia/resguardo, etc.)
// ==================================================================
configRouter.get('/parametros/:clave', async (req, res, next) => {
  try {
    const p = await prisma.configuracion.findUnique({ where: { clave: req.params.clave } });
    res.json(p?.valor ?? null);
  } catch (e) { next(e); }
});

configRouter.put('/parametros/:clave', ADMIN, async (req, res, next) => {
  try {
    const valor = req.body?.valor ?? req.body;
    const p = await prisma.configuracion.upsert({
      where: { clave: req.params.clave },
      create: { clave: req.params.clave, valor },
      update: { valor },
    });
    await auditar(req.user!.id, 'configurar', 'Configuracion', req.params.clave, undefined);
    res.json(p);
  } catch (e) { next(e); }
});

// ==================================================================
// CFDI / PAC (estado; las credenciales van por variables de entorno, no en BD)
// ==================================================================
configRouter.get('/cfdi/estado', ADMIN, (_req, res) => {
  res.json({
    pacConfigurado: !!process.env.PAC_URL,
    nota: 'Las credenciales del PAC y los certificados de sello digital se configuran por variables de entorno/archivos seguros, no se guardan en la base de datos.',
  });
});

// ==================================================================
// BITACORA DE AUDITORIA
// ==================================================================
configRouter.get('/auditoria', ADMIN, async (req, res, next) => {
  try {
    const { entidad } = req.query;
    const registros = await prisma.auditoria.findMany({
      where: entidad ? { entidad: String(entidad) } : undefined,
      include: { usuario: { select: { nombre: true } } },
      orderBy: { creadoEn: 'desc' }, take: 200,
    });
    res.json(registros);
  } catch (e) { next(e); }
});

export default configRouter;
