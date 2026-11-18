import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { EstatusOrden } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { siguienteFolio } from '../../lib/folios.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const ordenesRouter = Router();
ordenesRouter.use(requireAuth);

// Estatus que disparan aviso al cliente (segun el catalogo del documento).
const AVISA_CLIENTE: Record<EstatusOrden, boolean> = {
  RECIBIDO: true,
  EN_DIAGNOSTICO: true,
  ESPERANDO_AUTORIZACION: true,
  EN_TRAMITE_GARANTIA_EPSON: true,
  ESPERANDO_REFACCION: true,
  EN_REPARACION: false,
  EN_PRUEBAS_CALIDAD: false,
  LISTO_ENTREGA_REPARADO: true,
  LISTO_ENTREGA_SIN_REPARAR: true,
  ENTREGADO: true,
  ABANDONO: true,
  CANCELADO: true,
};

const recepcionSchema = z.object({
  clienteId: z.coerce.number(),
  equipoId: z.coerce.number(),
  fallaReportada: z.string().min(1),
  estadoFisico: z.string().optional(),
  accesorios: z.string().optional(),
  tipoGarantia: z.enum(['NINGUNA', 'EPSON', 'TALLER']).default('NINGUNA'),
  tecnicoId: z.coerce.number().optional(),
  prometidaEn: z.coerce.date().optional(),
});

// Recepcion de un equipo -> genera folio consecutivo y token QR.
ordenesRouter.post('/', async (req, res, next) => {
  try {
    const data = recepcionSchema.parse(req.body);
    const folio = await siguienteFolio('ORDEN', 'OT-');
    const orden = await prisma.ordenTrabajo.create({
      data: {
        ...data,
        folio,
        qrToken: randomUUID(),
        bitacora: { create: { estatus: 'RECIBIDO', nota: 'Equipo recibido', usuarioId: req.user!.id } },
      },
      include: { bitacora: true },
    });
    res.status(201).json(orden);
  } catch (e) { next(e); }
});

ordenesRouter.get('/', async (req, res, next) => {
  try {
    const { estatus, tecnicoId, clienteId } = req.query;
    const ordenes = await prisma.ordenTrabajo.findMany({
      where: {
        estatus: estatus ? (estatus as EstatusOrden) : undefined,
        tecnicoId: tecnicoId ? Number(tecnicoId) : undefined,
        clienteId: clienteId ? Number(clienteId) : undefined,
      },
      include: { cliente: true, equipo: true, tecnico: { select: { id: true, nombre: true } } },
      orderBy: { recibidaEn: 'desc' },
      take: 200,
    });
    res.json(ordenes);
  } catch (e) { next(e); }
});

ordenesRouter.get('/:id', async (req, res, next) => {
  try {
    const orden = await prisma.ordenTrabajo.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cliente: true, equipo: true, tecnico: { select: { id: true, nombre: true } },
        bitacora: { orderBy: { creadoEn: 'desc' }, include: { usuario: { select: { nombre: true } } } },
        consumos: { include: { producto: true } },
      },
    });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(orden);
  } catch (e) { next(e); }
});

// Cambio de estatus con registro en bitacora.
const cambioEstatusSchema = z.object({
  estatus: z.enum([
    'RECIBIDO', 'EN_DIAGNOSTICO', 'ESPERANDO_AUTORIZACION', 'EN_TRAMITE_GARANTIA_EPSON',
    'ESPERANDO_REFACCION', 'EN_REPARACION', 'EN_PRUEBAS_CALIDAD', 'LISTO_ENTREGA_REPARADO',
    'LISTO_ENTREGA_SIN_REPARAR', 'ENTREGADO', 'ABANDONO', 'CANCELADO',
  ]),
  nota: z.string().optional(),
  soloInterno: z.boolean().optional(),
});

ordenesRouter.post('/:id/estatus', async (req, res, next) => {
  try {
    const { estatus, nota, soloInterno } = cambioEstatusSchema.parse(req.body);
    const id = Number(req.params.id);
    const orden = await prisma.ordenTrabajo.update({
      where: { id },
      data: {
        estatus,
        entregadaEn: estatus === 'ENTREGADO' ? new Date() : undefined,
        bitacora: { create: { estatus, nota, soloInterno: soloInterno ?? false, usuarioId: req.user!.id } },
      },
    });
    // TODO: si AVISA_CLIENTE[estatus], encolar notificacion WhatsApp/correo.
    res.json({ orden, avisaCliente: AVISA_CLIENTE[estatus] });
  } catch (e) { next(e); }
});

// Asignar tecnico responsable.
ordenesRouter.post('/:id/tecnico', requireRole('RECEPCION', 'ADMINISTRADOR'), async (req, res, next) => {
  try {
    const tecnicoId = z.coerce.number().parse(req.body.tecnicoId);
    const orden = await prisma.ordenTrabajo.update({ where: { id: Number(req.params.id) }, data: { tecnicoId } });
    res.json(orden);
  } catch (e) { next(e); }
});

export default ordenesRouter;
