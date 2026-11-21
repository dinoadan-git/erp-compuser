import { prisma } from '../../lib/prisma.js';
import { aplicarMovimiento, r2 } from '../../lib/inventario.js';

export { aplicarMovimiento, r2 };

export interface ItemVenta {
  productoId: number;
  descripcion?: string;
  cantidad: number;
  precioUnit: number; // precio NETO (sin IVA)
  descuento?: number;
  tasaIva?: number; // porcentaje; si se omite se toma del producto
}

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

// Devuelve el corte de caja abierto para un usuario (o null).
export async function corteAbierto(usuarioId: number) {
  return prisma.corteCaja.findFirst({ where: { usuarioId, cerradoEn: null }, orderBy: { abiertoEn: 'desc' } });
}

// Mensaje de error estandar cuando se intenta cobrar en efectivo sin caja abierta.
export const CAJA_CERRADA_EFECTIVO =
  'Debes abrir la caja para cobrar en efectivo. Abre la caja o cambia el método de pago (tarjeta/transferencia).';

// Un cobro en efectivo exige caja abierta. Con cualquier otra forma se permite
// sin caja. `formas` es la lista de formas de pago del cobro.
export function requiereCajaAbierta(formas: string[]): boolean {
  return formas.some((f) => f === 'EFECTIVO');
}
