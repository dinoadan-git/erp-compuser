import { prisma } from './prisma.js';

// Genera un folio consecutivo por clave (ORDEN, VENTA, COMPRA, PROYECTO)
// de forma atomica usando un upsert + increment.
export async function siguienteFolio(clave: string, prefijo = ''): Promise<string> {
  const c = await prisma.contador.upsert({
    where: { clave },
    create: { clave, valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return `${prefijo}${String(c.valor).padStart(6, '0')}`;
}
