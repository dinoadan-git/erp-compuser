import type { Prisma, TipoMovInventario } from '@prisma/client';

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface MovimientoArgs {
  productoId: number;
  tipo: TipoMovInventario;
  cantidad: number; // en AJUSTE puede ser con signo (+/-)
  costoUnit?: number;
  motivo?: string;
  refTipo?: string;
  refId?: string;
  usuarioId?: number;
}

/**
 * Registra un movimiento de inventario, actualiza la existencia (disponible/apartado)
 * y, en entradas con costo, recalcula el costo promedio del producto.
 * Debe llamarse dentro de una transaccion de Prisma.
 */
export async function aplicarMovimiento(tx: Prisma.TransactionClient, args: MovimientoArgs) {
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
      nuevoDisp = disp + args.cantidad;
      break;
    case 'SALIDA':
      nuevoDisp = disp - args.cantidad;
      break;
    case 'APARTADO':
      nuevoDisp = disp - args.cantidad;
      nuevoApart = apart + args.cantidad;
      break;
    case 'LIBERACION_APARTADO':
      nuevoDisp = disp + args.cantidad;
      nuevoApart = apart - args.cantidad;
      break;
    case 'AJUSTE':
      nuevoDisp = disp + args.cantidad; // cantidad con signo
      break;
  }

  await tx.existencia.update({
    where: { productoId: args.productoId },
    data: { disponible: r3(nuevoDisp), apartado: r3(nuevoApart) },
  });

  // Costo promedio ponderado al ingresar mercancia con costo.
  if (args.tipo === 'ENTRADA' && args.costoUnit && args.costoUnit > 0) {
    const totalPrevio = disp + apart;
    const costoPrevio = Number(producto.costoPromedio);
    const nuevoTotal = totalPrevio + args.cantidad;
    const nuevoCosto = nuevoTotal > 0
      ? (totalPrevio * costoPrevio + args.cantidad * args.costoUnit) / nuevoTotal
      : args.costoUnit;
    await tx.producto.update({
      where: { id: args.productoId },
      data: { costoPromedio: Math.round(nuevoCosto * 10000) / 10000 },
    });
  }
}
