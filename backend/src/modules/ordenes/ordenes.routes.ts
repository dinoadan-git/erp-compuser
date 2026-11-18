import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { EstatusOrden } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { siguienteFolio } from '../../lib/folios.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { aplicarMovimiento } from '../../lib/inventario.js';
import { notificar } from '../../lib/notificaciones.js';

export const ordenesRouter = Router();
ordenesRouter.use(requireAuth);

// Lista de tecnicos activos (para asignar en la orden). Accesible a recepcion.
ordenesRouter.get('/tecnicos', async (_req, res, next) => {
  try {
    const tecnicos = await prisma.usuario.findMany({
      where: { activo: true, roles: { has: 'TECNICO' } },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(tecnicos);
  } catch (e) { next(e); }
});

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
      include: { bitacora: true, cliente: true, equipo: true },
    });
    await notificar({ evento: 'recepcion', orden });
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
        venta: { include: { pagos: true } },
      },
    });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    const notificaciones = await prisma.notificacion.findMany({ where: { ordenId: orden.id }, orderBy: { creadoEn: 'desc' } });
    res.json({ ...orden, notificaciones });
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
      include: { cliente: true, equipo: true },
    });
    // Notificar al cliente en los eventos clave.
    if (estatus === 'ESPERANDO_AUTORIZACION') await notificar({ evento: 'autorizacion', orden });
    else if (estatus === 'LISTO_ENTREGA_REPARADO' || estatus === 'LISTO_ENTREGA_SIN_REPARAR') await notificar({ evento: 'listo', orden });
    res.json({ orden, avisaCliente: AVISA_CLIENTE[estatus] });
  } catch (e) { next(e); }
});

// Asignar tecnico responsable (recepcion/admin).
ordenesRouter.post('/:id/tecnico', requireRole('RECEPCION', 'ADMINISTRADOR'), async (req, res, next) => {
  try {
    const tecnicoId = z.coerce.number().parse(req.body.tecnicoId);
    const orden = await prisma.ordenTrabajo.update({
      where: { id: Number(req.params.id) },
      data: { tecnicoId, bitacora: { create: { estatus: (await prisma.ordenTrabajo.findUnique({ where: { id: Number(req.params.id) } }))!.estatus, nota: 'Tecnico asignado', soloInterno: true, usuarioId: req.user!.id } } },
    });
    res.json(orden);
  } catch (e) { next(e); }
});

// Tomar la orden: el usuario actual (tecnico) se asigna a si mismo.
ordenesRouter.post('/:id/tomar', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const actual = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Orden no encontrada' });
    const orden = await prisma.ordenTrabajo.update({
      where: { id },
      data: { tecnicoId: req.user!.id, bitacora: { create: { estatus: actual.estatus, nota: `Tomada por ${req.user!.nombre}`, soloInterno: true, usuarioId: req.user!.id } } },
    });
    res.json(orden);
  } catch (e) { next(e); }
});

// Editar datos de la orden (diagnostico, cotizacion, autorizacion, etc.).
ordenesRouter.patch('/:id', async (req, res, next) => {
  try {
    const d = z.object({
      fallaReportada: z.string().min(1).optional(),
      estadoFisico: z.string().optional(),
      diagnostico: z.string().optional(),
      costoDiagnostico: z.coerce.number().min(0).optional(),
      cotizacionTotal: z.coerce.number().min(0).optional(),
      tipoGarantia: z.enum(['NINGUNA', 'EPSON', 'TALLER']).optional(),
      prometidaEn: z.coerce.date().optional(),
      autorizadaPor: z.string().optional(),
      autorizada: z.boolean().optional(),
    }).parse(req.body);
    const { autorizada, ...campos } = d;
    const orden = await prisma.ordenTrabajo.update({
      where: { id: Number(req.params.id) },
      data: { ...campos, ...(autorizada ? { autorizadaEn: new Date() } : {}) },
    });
    res.json(orden);
  } catch (e) { next(e); }
});

// Consumir una refaccion del inventario dentro de la orden.
ordenesRouter.post('/:id/consumos', async (req, res, next) => {
  try {
    const ordenId = Number(req.params.id);
    const { productoId, cantidad } = z.object({
      productoId: z.coerce.number(), cantidad: z.coerce.number().positive(),
    }).parse(req.body);

    const producto = await prisma.producto.findUnique({ where: { id: productoId }, include: { existencia: true, precios: true } });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const controlaStock = producto.tipo !== 'SERVICIO' && producto.controlStock;
    if (controlaStock && Number(producto.existencia?.disponible ?? 0) < cantidad) {
      return res.status(400).json({ error: `Stock insuficiente de ${producto.nombre} (disponible ${Number(producto.existencia?.disponible ?? 0)})` });
    }
    const costoUnit = Number(producto.costoPromedio);
    const precioUnit = Number(producto.precios.find((p) => p.lista === 'PUBLICO')?.precio ?? 0);

    const consumo = await prisma.$transaction(async (tx) => {
      const c = await tx.consumoRefaccion.create({ data: { ordenId, productoId, cantidad, costoUnit, precioUnit } });
      if (controlaStock) {
        await aplicarMovimiento(tx, { productoId, tipo: 'SALIDA', cantidad, motivo: `Refaccion orden ${ordenId}`, refTipo: 'ORDEN', refId: String(ordenId), usuarioId: req.user!.id });
      }
      return c;
    });
    res.status(201).json(consumo);
  } catch (e) { next(e); }
});

export default ordenesRouter;
