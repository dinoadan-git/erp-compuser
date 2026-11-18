import type { Prisma, PrismaClient, TipoMovInventario } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export interface ItemVenta {
  productoId: number;
  descripcion?: string;
  cantidad: number;
  precioUnit: number; // precio NETO (sin IVA)
  descuento?: number;
  tasaIva?: number; // porcentaje; si se omite se toma del producto
}

export interface PagoInput {
  forma: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CREDITO' | 'MIXTO';
  monto: number;
  refPago?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Calcula importes de una lista de items. precioUnit es NETO (sin IVA).
export function calcularTotales(
  items: { cantidad: number; precioUnit: number; descuento?: number; tasaIva: number }[],
) {
  let subtotal = 0;
  let impuestos = 0;
  const detalles = items.map((it) => {
    const base = r2(it.cantidad * it.precioUnit - (it.descuento ?? 0));
    const iva = r2(base * (it.tasaIva / 100));
    subtotal += base;
    impuestos += iva;
    return { base, iva };
  });
  return { subtotal: r2(subtotal), impuestos: r2(impuestos), total: r2(subtotal + impuestos), detalles };
}

// Aplica un movimiento de inventario y actualiza la existencia (dentro de una tx).
export async function aplicarMovimiento(
  tx: Prisma.TransactionClient,
  args: { productoId: number; tipo: TipoMovInventario; cantidad: number; costoUnit?: number; motivo?: string; refTipo?: string; refId?: string; usuarioId?: number },
) {
  const producto = await tx.producto.findUnique({ where: { id: args.productoId } });
  if (!producto) throw new Error(`Producto ${args.productoId} no existe`);
  // Servicios y productos sin control de stock no mueven inventario.
  if (producto.tipo === 'SERVICIO' || !producto.controlStock) return;

  await tx.movimientoInventario.create({
    data: {
      productoId: args.productoId,
      tipo: args.tipo,
      cantidad: args.cantidad,
      costoUnit: args.costoUnit,
      motivo: args.motivo,
      refTipo: args.refTipo,
      refId: args.refId,
      usuarioId: args.usuarioId,
    },
  });

  const ex = await tx.existencia.upsert({
    where: { productoId: args.productoId },
    create: { productoId: args.productoId },
    update: {},
  });
  const disp = Number(ex.disponible);
  const apart = Number(ex.apartado);
  let nuevoDisp = disp;
  let nuevoApart = apart;
  switch (args.tipo) {
    case 'ENTRADA':
    case 'LIBERACION_APARTADO':
      nuevoDisp = disp + args.cantidad;
      if (args.tipo === 'LIBERACION_APARTADO') nuevoApart = apart - args.cantidad;
      break;
    case 'SALIDA':
      nuevoDisp = disp - args.cantidad;
      break;
    case 'APARTADO':
      nuevoDisp = disp - args.cantidad;
      nuevoApart = apart + args.cantidad;
      break;
    case 'AJUSTE':
      nuevoDisp = disp + args.cantidad; // cantidad con signo
      break;
  }
  await tx.existencia.update({
    where: { productoId: args.productoId },
    data: { disponible: nuevoDisp, apartado: nuevoApart },
  });
}

// Devuelve el corte de caja abierto para un usuario (o null).
export async function corteAbierto(usuarioId: number) {
  return prisma.corteCaja.findFirst({ where: { usuarioId, cerradoEn: null }, orderBy: { abiertoEn: 'desc' } });
}

export { r2, prisma as _prisma };
export type DB = PrismaClient;
