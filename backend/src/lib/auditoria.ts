import { prisma } from './prisma.js';

// Registra una accion de usuario en la bitacora de auditoria.
export async function auditar(
  usuarioId: number | undefined,
  accion: string,
  entidad: string,
  entidadId?: string | number,
  detalle?: unknown,
) {
  try {
    await prisma.auditoria.create({
      data: {
        usuarioId: usuarioId ?? null,
        accion, entidad,
        entidadId: entidadId != null ? String(entidadId) : null,
        detalle: detalle === undefined ? undefined : (detalle as any),
      },
    });
  } catch {
    // La auditoria nunca debe romper la operacion principal.
  }
}
